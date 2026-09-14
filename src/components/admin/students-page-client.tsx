"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { GraduationCap, QrCode as QrIcon, QrCode, Loader2, Download } from "lucide-react";
import { DeleteStudentButton } from "@/components/admin/delete-student-button";
import { EditStudentDialog } from "@/components/admin/edit-student-dialog";
import type { Bus, Student } from "@/lib/types";

type Props = {
  initialStudents: Student[];
  buses: Bus[];
};

export function StudentsPageClient({ initialStudents, buses }: Props) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("+852");
  const [busId, setBusId] = useState<string>(buses[0]?.id ?? "");

  const busById = new Map(buses.map((b) => [b.id, b]));

  // 首載或瀏覽器從快取返回時，主動從伺服器重新拉取學生清單，
  // 確保資料一定來自 Supabase，不會因為 initialStudents 是 server-side render 的空陣列
  // 而誤以為資料不見了。
  useEffect(() => {
    let alive = true;
    async function refetch() {
      try {
        const res = await fetch("/api/students?limit=500", { cache: "no-store" });
        const json = (await res.json()) as
          | { success: true; data: Student[] }
          | { success: false; error: string };
        if (!alive) return;
        if (res.ok && "success" in json && json.success && Array.isArray(json.data)) {
          // 以伺服器資料為主，再用本地的新增/刪除合併。
          setStudents((prev) => {
            const serverIds = new Set(json.data.map((s) => s.id));
            const localOnly = prev.filter((s) => !serverIds.has(s.id));
            return [...json.data, ...localOnly];
          });
        }
      } catch {
        // 忽略錯誤，保留初始資料。
      } finally {
        if (alive) setHydrated(true);
      }
    }
    refetch();
    return () => {
      alive = false;
    };
  }, []);

  function validate(): string | null {
    if (!name.trim()) return "請填寫學生姓名";
    if (name.trim().length < 2) return "學生姓名至少需要 2 個字元";
    if (!studentNo.trim()) return "請填寫學號";
    if (studentNo.trim().length < 3) return "學號至少需要 3 個字元";
    if (!parentName.trim()) return "請填寫家長姓名";
    if (!parentPhone.trim()) return "請填寫家長電話";
    if (!/^\+852\d{8}$/.test(parentPhone)) return "家長電話格式錯誤，請使用 +852XXXXXXXX";
    if (!busId) return "請選擇所屬校巴";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "資料不完整", description: err, variant: "destructive", duration: 4000 });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          student_no: studentNo,
          photo_url: photoUrl || null,
          parent_name: parentName,
          parent_phone: parentPhone,
          assigned_bus_id: busId,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: Student;
        error?: string;
        code?: string;
      };

      if (!res.ok || !json.success) {
        toast({
          title: "新增失敗",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const created = json.data as Student;
      // 立即寫入本地狀態 (避免等待伺服器回應導致閃爍)。
      setStudents((prev) => {
        const withoutDup = prev.filter((s) => s.id !== created.id);
        return [...withoutDup, created].sort((a, b) =>
          a.student_no.localeCompare(b.student_no)
        );
      });
      setNewStudent(created);
      setQrPreview(null);

      const { default: QRCode } = await import("qrcode");
      const origin = window.location.origin;
      const url = await QRCode.toDataURL(`${origin}/student/${created.id}`, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 200,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrPreview(url);

      setName("");
      setStudentNo("");
      setPhotoUrl("");
      setParentName("");
      setParentPhone("+852");
      setShowAddForm(false);

      // 重新驗證伺服器資料，並刷新所有引用此路徑的 route segment。
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

  function handleDeleteStudent(deletedId: string) {
    setStudents((prev) => prev.filter((s) => s.id !== deletedId));
    if (newStudent?.id === deletedId) setNewStudent(null);
    router.refresh();
  }

  function handleUpdateStudent(updated: Student) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    router.refresh();
  }

  async function downloadQr(studentId: string) {
    if (!qrPreview || newStudent?.id !== studentId) return;
    const a = document.createElement("a");
    a.href = qrPreview;
    // 檔案名稱格式：學生姓名_QRCode-{uuid前8碼}.png
    const safeName = newStudent.name.replace(/[\\/:*?"<>|]/g, "_");
    a.download = `${safeName}_QRCode-${studentId.slice(0, 8)}.png`;
    a.click();
  }

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto scrollbar-inset">
      {/* 動作列：批次 QR Code / 新增學生 */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/system-setting/admin/qr-codes">
            <QrIcon className="mr-2 h-4 w-4" /> 批次 QR Code
          </Link>
        </Button>
        <Button onClick={() => setShowAddForm((v) => !v)} variant="default" size="sm">
          {showAddForm ? "取消新增" : "+ 新增學生"}
        </Button>
      </div>

      {/* ── QR Preview (shown after successful creation) ── */}
      {newStudent && qrPreview ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
              <QrCode className="h-5 w-5" />
              QR Code 已產生 — {newStudent.name}
            </CardTitle>
            <CardDescription className="text-emerald-700">
              可列印或下載此 QR Code，貼在學生接送證或書包上
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="rounded-xl bg-white p-3 shadow ring-1 ring-emerald-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrPreview} alt={`QR for ${newStudent.name}`} className="h-44 w-44" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">學生姓名</p>
                  <p className="text-base font-bold text-slate-900">{newStudent.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">學號</p>
                  <p className="text-sm text-slate-600">{newStudent.student_no}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">UUID（QR 內容）</p>
                  <code className="text-[10px] text-slate-500">{newStudent.id}</code>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => downloadQr(newStudent.id)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    下載 PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setNewStudent(null); setQrPreview(null); }}
                  >
                    關閉
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 說明列 */}
      <p className="text-sm text-slate-500">
        新增、查看、刪除學生資料，並取得家長追蹤連結
      </p>

      {/* ── Add Student Form ── */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">新增學生</CardTitle>
            <CardDescription>填寫完成後系統會自動寫入 Supabase 並在此顯示</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="學生姓名 *">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：陳小強" />
                </Field>
                <Field label="學號 *">
                  <Input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="例如：STU2026002" />
                </Field>
                <Field label="照片 URL">
                  <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://… (選填)" />
                </Field>
                <Field label="家長姓名 *">
                  <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="例如：陳先生" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="家長電話 (WhatsApp) *">
                  <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+85261234567" />
                </Field>
                <Field label="所屬校巴 *">
                  <select
                    value={busId}
                    onChange={(e) => setBusId(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {buses.length === 0 ? <option value="">尚未有校巴</option> : null}
                    {buses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.plate_number} · {b.route_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 新增中…
                  </>
                ) : (
                  <>
                    <QrIcon className="mr-2 h-4 w-4" /> 新增並產生 QR Code
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Student List ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            已註冊學生 ({students.length})
            {hydrated ? null : (
              <span className="ml-2 inline-flex items-center text-xs text-slate-400">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 與 Supabase 同步中…
              </span>
            )}
          </CardTitle>
          <CardDescription>
            資料儲存於 Supabase <code>students</code> 表，列表會自動同步
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {students.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">尚未有學生資料，請使用上方「新增學生」</p>
            </div>
          ) : (
            students.map((s) => {
              const bus = s.assigned_bus_id ? busById.get(s.assigned_bus_id) : null;
              const trackingUrl = `/student/${s.id}`;
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-md border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.student_no}</span>
                      {bus ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                          {bus.plate_number} · {bus.route_name}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-slate-500">
                      家長：{s.parent_name} ({s.parent_phone})
                    </span>
                    <code className="mt-0.5 break-all text-[10px] text-slate-400">UUID: {s.id}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={trackingUrl} target="_blank">
                        家長連結
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/system-setting/admin/qr-codes?highlight=${s.id}`}>
                        <QrIcon className="mr-1 h-3 w-3" /> QR
                      </Link>
                    </Button>
                    <EditStudentDialog student={s} buses={buses} onUpdated={handleUpdateStudent} />
                    <DeleteStudentButton studentId={s.id} studentName={s.name} onDeleted={handleDeleteStudent} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
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
