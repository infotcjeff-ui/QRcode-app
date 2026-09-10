"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bus as BusIcon, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import type { Bus } from "@/lib/types";

type Props = {
  initialBuses: Bus[];
};

type EditState = {
  id: string | null;
  plate_number: string;
  route_name: string;
  capacity: string;
};

const EMPTY: EditState = { id: null, plate_number: "", route_name: "", capacity: "20" };

export function BusesManagementClient({ initialBuses }: Props) {
  const [buses, setBuses] = useState<Bus[]>(initialBuses);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // 從伺服器抓最新資料 (防止 initial 為空)
  useEffect(() => {
    let alive = true;
    async function refetch() {
      try {
        const res = await fetch("/api/buses", { cache: "no-store" });
        const json = (await res.json()) as
          | { success: true; data: Bus[] }
          | { success: false; error: string };
        if (!alive) return;
        if (res.ok && "success" in json && json.success && Array.isArray(json.data)) {
          setBuses((prev) => {
            const serverIds = new Set(json.data.map((b) => b.id));
            const localOnly = prev.filter((b) => !serverIds.has(b.id));
            return [...json.data, ...localOnly];
          });
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setHydrated(true);
      }
    }
    refetch();
    return () => {
      alive = false;
    };
  }, []);

  function openCreate() {
    setEdit({ ...EMPTY, capacity: "20" });
  }

  function openEdit(b: Bus) {
    setEdit({
      id: b.id,
      plate_number: b.plate_number,
      route_name: b.route_name,
      capacity: String(b.capacity),
    });
  }

  function closeEdit() {
    setEdit(null);
  }

  function validate(): string | null {
    if (!edit) return null;
    if (!edit.plate_number.trim()) return "請填寫車牌號碼";
    if (!edit.route_name.trim()) return "請填寫路線名稱";
    const cap = Number(edit.capacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 99) return "載客量需為 1–99 之間";
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const err = validate();
    if (err) {
      toast({ title: "資料不完整", description: err, variant: "destructive", duration: 4000 });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        plate_number: edit.plate_number.trim(),
        route_name: edit.route_name.trim(),
        capacity: Number(edit.capacity),
      };
      const isUpdate = Boolean(edit.id);
      const url = isUpdate ? `/api/buses?id=${encodeURIComponent(edit.id!)}` : "/api/buses";
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { success: true; data: Bus }
        | { success: false; error: string; code?: string };

      if (!res.ok || !json.success) {
        const errMsg = "error" in json ? json.error : "未知錯誤";
        toast({
          title: isUpdate ? "更新失敗" : "新增失敗",
          description: errMsg,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const saved = json.data as Bus;
      setBuses((prev) => {
        if (isUpdate) return prev.map((b) => (b.id === saved.id ? saved : b));
        return [...prev, saved];
      });
      setEdit(null);
      toast({
        title: isUpdate ? "✅ 已更新校巴資料" : "✅ 已新增校巴",
        description: `${saved.plate_number} · ${saved.route_name} (容量 ${saved.capacity})`,
        duration: 3500,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "網絡錯誤",
        description: err instanceof Error ? err.message : "無法連線到伺服器",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(b: Bus) {
    if (deletingId) return;
    if (!confirm(`確定刪除校巴「${b.plate_number} · ${b.route_name}」嗎？\n此操作將同時把已指派到此車的學生改為「未指派」。`)) {
      return;
    }
    setDeletingId(b.id);
    try {
      const res = await fetch(`/api/buses?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast({
          title: "刪除失敗",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      setBuses((prev) => prev.filter((x) => x.id !== b.id));
      toast({
        title: "已刪除校巴",
        description: `${b.plate_number} · ${b.route_name}`,
        duration: 3000,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "網絡錯誤",
        description: err instanceof Error ? err.message : "無法連線到伺服器",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BusIcon className="h-5 w-5" /> 校巴資料管理
            </CardTitle>
            <CardDescription>
              新增及修改校巴 (Supabase <code>buses</code> 表)；更新後管理員控制台與學生管理頁面會自動同步
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              共 {buses.length} 輛
            </span>
            {!hydrated ? (
              <span className="inline-flex items-center text-xs text-slate-400">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 與 Supabase 同步中…
              </span>
            ) : null}
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" /> 新增校巴
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {buses.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <BusIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">尚未有校巴資料，請按右上「新增校巴」</p>
            </div>
          ) : (
            buses.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-2 rounded-md border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.plate_number}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      {b.route_name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">容量 {b.capacity} 人</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(b)}
                    disabled={edit !== null && edit.id === b.id}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> 編輯
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(b)}
                    disabled={deletingId === b.id}
                  >
                    {deletingId === b.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    刪除
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between border-b p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  {edit.id ? (
                    <>
                      <Pencil className="h-4 w-4" /> 編輯校巴
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> 新增校巴
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="關閉"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-4">
                <Field label="車牌號碼 *">
                  <Input
                    value={edit.plate_number}
                    onChange={(e) => setEdit({ ...edit, plate_number: e.target.value })}
                    placeholder="例如：AB-1234"
                    autoFocus
                  />
                </Field>
                <Field label="路線名稱 *">
                  <Input
                    value={edit.route_name}
                    onChange={(e) => setEdit({ ...edit, route_name: e.target.value })}
                    placeholder="例如：沙田A線 · 首站"
                  />
                </Field>
                <Field label="載客量 (1–99) *">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={edit.capacity}
                    onChange={(e) => setEdit({ ...edit, capacity: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 border-t bg-slate-50 p-4">
                <Button type="button" variant="outline" onClick={closeEdit} disabled={submitting}>
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 儲存中…
                    </>
                  ) : edit.id ? (
                    "儲存變更"
                  ) : (
                    "新增校巴"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
