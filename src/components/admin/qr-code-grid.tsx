"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, QrCode as QrIcon } from "lucide-react";
import type { Student } from "@/lib/types";

type Props = {
  students: Student[];
  busPlateById: Record<string, string>;
};

type QrSvg = { id: string; dataUrl: string };

export function QrCodeGrid({ students, busPlateById }: Props) {
  const [qrs, setQrs] = useState<QrSvg[]>([]);
  const [generating, setGenerating] = useState(false);
  const [size, setSize] = useState<number>(240);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;
    void generate();
  }, [students]);

  async function generate() {
    setGenerating(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const list: QrSvg[] = await Promise.all(
        students.map(async (s) => ({
          id: s.id,
          dataUrl: await QRCode.toDataURL(`${origin}/student/${s.id}`, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: size,
            color: { dark: "#0f172a", light: "#ffffff" },
          }),
        }))
      );
      setQrs(list);
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(next: number) {
    setSize(next);
    setGenerating(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const list: QrSvg[] = await Promise.all(
        students.map(async (s) => ({
          id: s.id,
          dataUrl: await QRCode.toDataURL(`${origin}/student/${s.id}`, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: next,
            color: { dark: "#0f172a", light: "#ffffff" },
          }),
        }))
      );
      setQrs(list);
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  async function handleDownloadOne(studentId: string) {
    const qrInfo = qrs.find((q) => q.id === studentId);
    if (!qrInfo) return;
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const a = document.createElement("a");
    a.href = qrInfo.dataUrl;
    // 檔案名稱格式：學生姓名_QRCode-{uuid前8碼}.png
    const safeName = student.name.replace(/[\\/:*?"<>|]/g, "_");
    a.download = `${safeName}_QRCode-${studentId.slice(0, 8)}.png`;
    a.click();
  }

  async function handleDownloadAll() {
    for (const q of qrs) {
      const student = students.find((s) => s.id === q.id);
      if (!student) continue;
      const a = document.createElement("a");
      a.href = q.dataUrl;
      const safeName = student.name.replace(/[\\/:*?"<>|]/g, "_");
      a.download = `${safeName}_QRCode-${q.id.slice(0, 8)}.png`;
      a.click();
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  const byId = new Map(students.map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrIcon className="h-5 w-5" /> 批次 QR Code 設定
          </CardTitle>
          <CardDescription>
            為每個學生產生獨立 QR Code，內容為學生 UUID，可貼在接送證或背包上。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">尺寸 (px)</label>
            <input
              type="range"
              min={160}
              max={360}
              step={20}
              value={size}
              onChange={(e) => regenerate(Number(e.target.value))}
              className="w-48"
            />
            <span className="text-sm font-medium">{size}px</span>
            <Badge variant="outline">{students.length} 位學生</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} disabled={generating}>
              <Printer className="mr-2 h-4 w-4" /> 列印 / 匯出 PDF
            </Button>
            <Button onClick={handleDownloadAll} variant="outline" disabled={generating}>
              <Download className="mr-2 h-4 w-4" /> 下載全部 PNG
            </Button>
            {generating ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> 產生中…
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="qr-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {qrs.map((q) => {
          const s = byId.get(q.id);
          if (!s) return null;
          const plate = s.assigned_bus_id ? busPlateById[s.assigned_bus_id] ?? null : null;
          return (
            <Card key={q.id} className="qr-card break-inside-avoid">
              <CardContent className="flex flex-col items-center gap-2 p-4">
                <div className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.dataUrl} alt={`QR for ${s.name}`} className="h-40 w-40" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.student_no}</p>
                  <code className="mt-1 inline-block break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-600">
                    {q.id}
                  </code>
                  {plate ? <Badge variant="secondary" className="mt-1 text-[10px]">{plate}</Badge> : null}
                </div>
                <Button size="sm" variant="ghost" className="no-print text-xs" onClick={() => handleDownloadOne(q.id)}>
                  <Download className="mr-1 h-3 w-3" /> 下載
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .qr-card { box-shadow: none !important; border: 1px dashed #94a3b8 !important; }
        }
      `}</style>
    </div>
  );
}