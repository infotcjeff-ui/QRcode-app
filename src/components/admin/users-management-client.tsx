"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import type { Bus, User, UserRole } from "@/lib/types";

type Props = {
  initialUsers: User[];
  buses: Bus[];
};

type EditState = {
  id: string | null;
  name: string;
  phone: string;
  role: UserRole;
  assigned_bus_id: string;
};

const EMPTY: EditState = {
  id: null,
  name: "",
  phone: "",
  role: "attendant",
  assigned_bus_id: "",
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "系統管理員",
  attendant: "打卡員",
};

export function UsersManagementClient({ initialUsers, buses }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const busLabelById = useMemo(() => {
    const m = new Map<string, string>();
    buses.forEach((b) => m.set(b.id, `${b.plate_number} · ${b.route_name}`));
    return m;
  }, [buses]);

  // 從伺服器抓最新資料 (防止 initial 為空)
  useEffect(() => {
    let alive = true;
    async function refetch() {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const json = (await res.json()) as
          | { success: true; data: User[] }
          | { success: false; error: string };
        if (!alive) return;
        if (res.ok && "success" in json && json.success && Array.isArray(json.data)) {
          setUsers((prev) => {
            const serverIds = new Set(json.data.map((u) => u.id));
            const localOnly = prev.filter((u) => !serverIds.has(u.id));
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
    setEdit({ ...EMPTY });
  }

  function openEdit(u: User) {
    setEdit({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      assigned_bus_id: u.assigned_bus_id ?? "",
    });
  }

  function closeEdit() {
    setEdit(null);
  }

  function validate(): string | null {
    if (!edit) return null;
    if (!edit.name.trim()) return "請填寫姓名";
    if (!edit.phone.trim()) return "請填寫電話";
    if (edit.role !== "admin" && edit.role !== "attendant") return "請選擇有效角色";
    if (edit.assigned_bus_id && !/^[0-9a-f-]{36}$/i.test(edit.assigned_bus_id)) {
      return "校巴 ID 格式不正確";
    }
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
        name: edit.name.trim(),
        phone: edit.phone.trim(),
        role: edit.role,
        assigned_bus_id: edit.assigned_bus_id ? edit.assigned_bus_id : null,
      };
      const isUpdate = Boolean(edit.id);
      const url = isUpdate ? `/api/users?id=${encodeURIComponent(edit.id!)}` : "/api/users";
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { success: true; data: User }
        | { success: false; error: string };

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

      const saved = json.data as User;
      setUsers((prev) => {
        if (isUpdate) return prev.map((u) => (u.id === saved.id ? saved : u));
        return [...prev, saved];
      });
      setEdit(null);
      toast({
        title: isUpdate ? "✅ 已更新帳號" : "✅ 已新增帳號",
        description: `${saved.name} · ${ROLE_LABEL[saved.role]}`,
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

  async function handleDelete(u: User) {
    if (deletingId) return;
    if (
      !confirm(
        `確定刪除「${u.name}」嗎？\n此操作將同時把此帳號在 trips 表中的關聯設為空。`
      )
    ) {
      return;
    }
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
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
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({
        title: "已刪除帳號",
        description: u.name,
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

  const adminCount = users.filter((u) => u.role === "admin").length;
  const attendantCount = users.filter((u) => u.role === "attendant").length;

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="h-5 w-5" /> 人員帳號
            </CardTitle>
            <CardDescription>
              新增及修改管理員 / 打卡員帳號 (Supabase <code>users</code> 表)；更新後管理員控制台會自動同步
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              共 {users.length} 個 · 管理員 {adminCount} · 打卡員 {attendantCount}
            </span>
            {!hydrated ? (
              <span className="inline-flex items-center text-xs text-slate-400">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 與 Supabase 同步中…
              </span>
            ) : null}
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" /> 新增帳號
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <UserIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">尚未有帳號資料，請按右上「新增帳號」</p>
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-2 rounded-md border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.name}</span>
                    <span
                      className={
                        u.role === "admin"
                          ? "rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                      }
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    電話：{u.phone}
                    {u.assigned_bus_id
                      ? ` · 指派校巴：${busLabelById.get(u.assigned_bus_id) ?? u.assigned_bus_id}`
                      : " · 未指派校巴"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(u)}
                    disabled={edit !== null && edit.id === u.id}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> 編輯
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(u)}
                    disabled={deletingId === u.id}
                  >
                    {deletingId === u.id ? (
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
                      <Pencil className="h-4 w-4" /> 編輯帳號
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> 新增帳號
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="關閉"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 p-4">
                <Field label="姓名 *">
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="例如：陳大文主管"
                    autoFocus
                  />
                </Field>
                <Field label="電話 *">
                  <Input
                    value={edit.phone}
                    onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                    placeholder="例如：+85290001111"
                  />
                </Field>
                <Field label="角色 *">
                  <div className="grid grid-cols-2 gap-2">
                    <RoleButton
                      active={edit.role === "admin"}
                      onClick={() => setEdit({ ...edit, role: "admin" })}
                      label="系統管理員"
                    />
                    <RoleButton
                      active={edit.role === "attendant"}
                      onClick={() => setEdit({ ...edit, role: "attendant" })}
                      label="打卡員"
                    />
                  </div>
                </Field>
                <Field label="指派校巴 (可選)">
                  <select
                    value={edit.assigned_bus_id}
                    onChange={(e) => setEdit({ ...edit, assigned_bus_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                  >
                    <option value="">— 未指派 —</option>
                    {buses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.plate_number} · {b.route_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    打卡員通常需要綁定一台校巴；管理員可不綁定。
                  </p>
                </Field>
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    目前站台並未綁定登入密碼欄位，新建 / 變更後可於登入頁使用示範密碼
                    「admin」/「test」試登 (Supabase 未連線時)。
                  </span>
                </div>
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
                    "新增帳號"
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

function RoleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}