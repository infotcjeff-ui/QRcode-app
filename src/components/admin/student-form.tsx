"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { SUPABASE_CONFIGURED } from "@/lib/supabase";
import type { Bus } from "@/lib/types";
import { Loader2, Plus } from "lucide-react";

type Props = {
  buses: Bus[];
};

export function StudentForm({ buses }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("+852");
  const [busId, setBusId] = useState<string>(buses[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) {
      toast({
        title: "Supabase 尚未設定",
        description: "請先設定 .env.local 才能新增學生。",
        variant: "destructive",
      });
      return;
    }
    if (!name || !studentNo || !parentName || !parentPhone || !busId) {
      toast({ title: "欄位不完整", description: "請填寫所有必填欄位", variant: "destructive" });
      return;
    }
    if (!/^\+852\d{8}$/.test(parentPhone)) {
      toast({
        title: "家長電話格式錯誤",
        description: "請使用 +852 開頭的 8 位數字格式，例如 +85261234567",
        variant: "destructive",
      });
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

      const json = (await res.json()) as { success: boolean; data?: { id: string }; error?: string };

      if (!res.ok || !json.success) {
        toast({
          title: "新增失敗",
          description: json.error ?? "資料庫寫入失敗",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ 新增成功",
        description: `${name} 已建立，ID: ${(json.data as { id: string }).id.slice(0, 8)}…`,
      });
      setName("");
      setStudentNo("");
      setPhotoUrl("");
      setParentName("");
      setParentPhone("+852");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="學生姓名 *">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：陳小強" />
      </Field>
      <Field label="學號 *">
        <Input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="例如：STU2026002" />
      </Field>
      <Field label="照片 URL">
        <Input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://… (選填)"
        />
      </Field>
      <Field label="家長姓名 *">
        <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="例如：陳先生" />
      </Field>
      <Field label="家長電話 (WhatsApp) *">
        <Input
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
          placeholder="+85261234567"
        />
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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 新增中…
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" /> 新增學生
          </>
        )}
      </Button>
    </form>
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