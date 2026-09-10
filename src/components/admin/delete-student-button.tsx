"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
  studentId: string;
  studentName: string;
  onDeleted?: (id: string) => void;
};

export function DeleteStudentButton({ studentId, studentName, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`確定要刪除學生「${studentName}」嗎？此操作無法撤銷。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/students?id=${studentId}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        alert(`刪除失敗：${json.error ?? "未知錯誤"}`);
        return;
      }
      onDeleted?.(studentId);
    } catch (err) {
      alert(`網絡錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
