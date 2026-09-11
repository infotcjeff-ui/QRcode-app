"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-context";
import { MediaUpload } from "@/components/ui/media-upload";
import type { Bus, Student } from "@/lib/types";
import { Loader2, Pencil } from "lucide-react";

type Props = {
  student: Student;
  buses: Bus[];
  onUpdated: (updated: Student) => void;
};

export function EditStudentDialog({ student, buses, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(student.name);
  const [studentNo, setStudentNo] = useState(student.student_no);
  const [photoUrl, setPhotoUrl] = useState<string | null>(student.photo_url ?? null);
  const [parentName, setParentName] = useState(student.parent_name);
  const [parentPhone, setParentPhone] = useState(student.parent_phone);
  const [busId, setBusId] = useState<string>(student.assigned_bus_id ?? "");

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(student.name);
      setStudentNo(student.student_no);
      setPhotoUrl(student.photo_url ?? null);
      setParentName(student.parent_name);
      setParentPhone(student.parent_phone);
      setBusId(student.assigned_bus_id ?? "");
    }
    setOpen(next);
  }

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
      const res = await fetch(`/api/students?id=${student.id}`, {
        method: "PUT",
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
      };

      if (!res.ok || !json.success) {
        toast({
          title: "更新失敗",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const updated = json.data as Student;
      onUpdated(updated);
      setOpen(false);
      toast({ title: "更新成功", description: `${updated.name} 的資料已更新` });
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Pencil className="mr-1 h-3 w-3" /> 編輯
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>編輯學生資料</DialogTitle>
          <DialogDescription>修改後按「儲存」以更新資料</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">學生姓名 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：陳小強" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">學號 *</label>
            <Input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="例如：STU2026002" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">照片</label>
            <MediaUpload
              value={photoUrl}
              onChange={setPhotoUrl}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">家長姓名 *</label>
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="例如：陳先生" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">家長電話 (WhatsApp) *</label>
            <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+85261234567" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">所屬校巴 *</label>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">未分配</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.plate_number} · {b.route_name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 儲存中…</> : "儲存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
