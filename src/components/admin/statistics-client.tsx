"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Users as UsersIcon,
  XCircle,
  Route as RouteIcon,
  PieChart as PieIcon,
  Activity,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-context";
import { formatDateTime } from "@/lib/utils";
import type {
  Bus,
  StatisticsReport,
  StatisticsReportFilters,
  StatisticsReportPayload,
  TripTypeFilter,
  User,
} from "@/lib/types";

type Props = {
  initialReports: StatisticsReport[];
  buses: Bus[];
  trips: { id: string; bus_id: string | null; attendant_id: string | null; type: string; date: string }[];
  users: User[];
};

type SortKey = "active" | "name";

export function StatisticsClient({ initialReports, buses, trips, users }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [reports, setReports] = useState<StatisticsReport[]>(initialReports);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialReports[0]?.id ?? null
  );

  // 預設區間：本月第一天 ~ 今天
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [rangeStart, setRangeStart] = useState(monthStart);
  const [rangeEnd, setRangeEnd] = useState(todayStr);
  const [title, setTitle] = useState("");
  const [tripType, setTripType] = useState<TripTypeFilter>("ALL");
  const [busId, setBusId] = useState<string>("");
  const [attendantId, setAttendantId] = useState<string>("");

  const busById = useMemo(() => new Map(buses.map((b) => [b.id, b])), [buses]);

  const attendantOptions = useMemo(
    () => users.filter((u) => u.role === "attendant"),
    [users]
  );

  useEffect(() => {
    if (!selectedId && initialReports[0]) {
      setSelectedId(initialReports[0].id);
    }
  }, [initialReports, selectedId]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId]
  );

  async function refreshReports() {
    try {
      const res = await fetch("/api/statistics?limit=50", { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        data?: StatisticsReport[];
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast({
          title: "無法取得報表列表",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
        });
        return;
      }
      const list = json.data ?? [];
      setReports(list);
      if (list.length > 0 && !list.find((r) => r.id === selectedId)) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      toast({
        title: "網絡錯誤",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    }
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (generating) return;

    if (!rangeStart || !rangeEnd) {
      toast({
        title: "請選擇完整日期區間",
        description: "起始日與結束日皆為必填。",
        variant: "destructive",
      });
      return;
    }
    if (rangeStart > rangeEnd) {
      toast({
        title: "日期區間錯誤",
        description: "起始日不可晚於結束日。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const filters: StatisticsReportFilters = {
        trip_type: tripType,
        bus_id: busId || null,
        attendant_id: attendantId || null,
      };

      const res = await fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          report_type: "check_log_advanced",
          range_start: rangeStart,
          range_end: rangeEnd,
          filters,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: StatisticsReport;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast({
          title: "報表生成失敗",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
        });
        return;
      }

      setReports((prev) => [json.data!, ...prev.filter((r) => r.id !== json.data!.id)]);
      setSelectedId(json.data!.id);
      toast({
        title: "✅ 進階統計表已生成",
        description: json.data!.summary ?? `報表 ${json.data!.title} 已保存至 Supabase`,
        duration: 4500,
      });
      setTitle("");
      router.refresh();
    } catch (err) {
      toast({
        title: "網絡錯誤",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!confirm("確認要刪除這份報表嗎？此操作無法復原。")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/statistics?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast({
          title: "刪除失敗",
          description: json.error ?? "未知錯誤",
          variant: "destructive",
        });
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) {
        setSelectedId(reports.find((r) => r.id !== id)?.id ?? null);
      }
      toast({
        title: "報表已刪除",
        description: "統計表已從 Supabase 移除。",
        duration: 3000,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "網絡錯誤",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function exportJson() {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statistics-${selected.range_start}-${selected.range_end}-${selected.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Generator Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-emerald-600" /> 生成進階統計表
          </CardTitle>
          <CardDescription>
            根據打卡資料（check_logs）即時彙整，寫入 Supabase statistics_reports 表。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="報表標題 (選填)">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="例如：本月 AM_GO 進階統計"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>
            <Field label="起始日 *">
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>
            <Field label="結束日 *">
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>
            <Field label="班次類型">
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripTypeFilter)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="ALL">全部</option>
                <option value="AM_GO">上午上學</option>
                <option value="PM_BACK">下午放學</option>
              </select>
            </Field>
            <Field label="校巴路線">
              <select
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">全部校巴</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.plate_number} · {b.route_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="打卡員">
              <select
                value={attendantId}
                onChange={(e) => setAttendantId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">全部打卡員</option>
                {attendantOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={generating}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> 生成進階統計表
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={refreshReports}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> 重新整理
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Layout: Reports list (click → popup) ── */}
      <div className="grid gap-4">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> 已生成報表 ({reports.length})
            </CardTitle>
            <CardDescription>點擊任一報表以 popup 形式查看詳細內容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-400">
                尚未生成任何報表。請於上方填寫區間並按「生成」。
              </div>
            ) : (
              reports.map((r) => {
                const bus = r.filters.bus_id ? busById.get(r.filters.bus_id) : null;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="w-full rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="line-clamp-1 text-sm font-semibold text-slate-900">
                          {r.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                          <CalendarRange className="h-3 w-3" />
                          <span>{r.range_start} ~ {r.range_end}</span>
                          {r.filters.trip_type && r.filters.trip_type !== "ALL" ? (
                            <Badge variant="outline" className="text-[10px]">
                              {r.filters.trip_type === "AM_GO" ? "上學" : "放學"}
                            </Badge>
                          ) : null}
                          {bus ? (
                            <Badge variant="outline" className="text-[10px]">
                              {bus.route_name}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(r.generated_at)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        點擊查看
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Report detail popup ── */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        {selected ? (
          <ReportDetailPopup
            report={selected}
            onDelete={handleDelete}
            deleting={deletingId === selected.id}
            onExport={exportJson}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ReportDetail({
  report,
  onDelete,
  deleting,
  onExport,
}: {
  report: StatisticsReport;
  onDelete: (id: string) => void;
  deleting: boolean;
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-emerald-600" /> {report.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {report.range_start} ~ {report.range_end} · 生成於 {formatDateTime(report.generated_at)}
            </CardDescription>
            {report.summary ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                {report.summary}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-1 h-4 w-4" /> 匯出 JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(report.id)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              刪除
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ReportBody report={report} />
      </CardContent>
    </Card>
  );
}

/**
 * 報表 popup 版本：使用 Dialog 包裝，方便在手機/小螢幕直接查看所有詳細內容。
 */
function ReportDetailPopup({
  report,
  onDelete,
  deleting,
  onExport,
  onClose,
}: {
  report: StatisticsReport;
  onDelete: (id: string) => void;
  deleting: boolean;
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto scrollbar-inset">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-emerald-600" /> {report.title}
        </DialogTitle>
        <p className="text-sm text-slate-500">
          {report.range_start} ~ {report.range_end} · 生成於 {formatDateTime(report.generated_at)}
        </p>
        {report.summary ? (
          <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
            {report.summary}
          </p>
        ) : null}
      </DialogHeader>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 h-4 w-4" /> 匯出 JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-red-300 text-red-600 hover:bg-red-50"
          onClick={() => onDelete(report.id)}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-4 w-4" />
          )}
          刪除
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
          關閉
        </Button>
      </div>

      <div className="space-y-5">
        <ReportBody report={report} />
      </div>
    </DialogContent>
  );
}

/**
 * 報表主體內容 (KPI + 各分類區段)，給 ReportDetail / ReportDetailPopup 共用。
 */
function ReportBody({ report }: { report: StatisticsReport }) {
  const p: StatisticsReportPayload = report.payload;
  const hasData = p.total_check_logs > 0;

  return (
    <>
      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="打卡總筆數" value={p.total_check_logs} icon={<BarChart3 className="h-4 w-4" />} />
        <Stat label="上車 / 落車" value={`${p.total_on} / ${p.total_off}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="涵蓋學生數" value={p.unique_students} icon={<UsersIcon className="h-4 w-4" />} />
        <Stat label="班次數" value={p.unique_trips} icon={<RouteIcon className="h-4 w-4" />} />
        <Stat label="上車率" value={`${p.on_rate}%`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        <Stat label="落車率" value={`${p.off_rate}%`} icon={<CheckCircle2 className="h-4 w-4 text-sky-600" />} />
        <Stat
          label="WhatsApp 已送出"
          value={p.whatsapp_sent}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        />
        <Stat
          label="WhatsApp 失敗 / 待處理"
          value={`${p.whatsapp_failed} / ${p.whatsapp_pending}`}
          icon={<XCircle className="h-4 w-4 text-amber-600" />}
        />
      </div>

      {!hasData ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
          此報表區間內沒有任何打卡紀錄。
        </div>
      ) : (
        <>
          <Separator />
          <Section
            title="依路線"
            icon={<RouteIcon className="h-4 w-4 text-slate-700" />}
            empty={p.by_route.length === 0}
          >
            {p.by_route.map((r) => {
              const pct =
                p.total_check_logs === 0
                  ? 0
                  : Math.round((r.total_check_logs / p.total_check_logs) * 100);
              return (
                <div key={r.bus_id ?? "unassigned"} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.route_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.plate_number ?? "未指派"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(r.on_count / Math.max(r.total_check_logs, 1)) * 100}%` }}
                    />
                    <div
                      className="bg-sky-500"
                      style={{ width: `${(r.off_count / Math.max(r.total_check_logs, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>打卡 {r.total_check_logs} 筆（佔 {pct}%）</span>
                    <span>
                      上車 {r.on_count} · 落車 {r.off_count} · 學生 {r.unique_students}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <Badge variant="success" className="text-[10px]">已發送 {r.whatsapp_sent}</Badge>
                    <Badge variant="destructive" className="text-[10px]">失敗 {r.whatsapp_failed}</Badge>
                    <Badge variant="warning" className="text-[10px]">排隊中 {r.whatsapp_pending}</Badge>
                  </div>
                </div>
              );
            })}
          </Section>

          <Separator />
          <Section
            title="依日期"
            icon={<CalendarRange className="h-4 w-4 text-slate-700" />}
            empty={p.by_day.length === 0}
          >
            {p.by_day.map((d) => {
              const max = Math.max(1, ...p.by_day.map((x) => x.total_check_logs));
              const widthPct = (d.total_check_logs / max) * 100;
              return (
                <div key={d.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 font-mono text-slate-500">{d.date}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-700"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-slate-600">
                    上 {d.on_count} / 落 {d.off_count} / {d.unique_students} 人
                  </span>
                </div>
              );
            })}
          </Section>

          <Separator />
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="依班次類型"
              icon={<PieIcon className="h-4 w-4 text-slate-700" />}
              empty={p.by_trip_type.length === 0}
            >
              {p.by_trip_type.map((t) => (
                <div key={t.trip_type} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-semibold">
                    {t.trip_type === "AM_GO" ? "上午上學" : t.trip_type === "PM_BACK" ? "下午放學" : "未分類"}
                  </span>
                  <span className="text-xs text-slate-500">
                    上 {t.on_count} · 落 {t.off_count} · 班次 {t.unique_trips} · 學生 {t.unique_students}
                  </span>
                </div>
              ))}
            </Section>

            <Section
              title="依時段（24h）"
              icon={<Clock className="h-4 w-4 text-slate-700" />}
              empty={p.by_hour.length === 0}
            >
              {p.by_hour.map((h) => {
                const max = Math.max(1, ...p.by_hour.map((x) => x.on_count + x.off_count));
                const widthPct = ((h.on_count + h.off_count) / max) * 100;
                return (
                  <div key={h.hour} className="flex items-center gap-3 text-xs">
                    <span className="w-12 shrink-0 font-mono text-slate-500">
                      {String(h.hour).padStart(2, "0")}:00
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-slate-600">
                      上 {h.on_count} / 落 {h.off_count}
                    </span>
                  </div>
                );
              })}
            </Section>
          </div>

          <Separator />
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="打卡最穩定（Top 5）"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              empty={p.top_students.length === 0}
            >
              {p.top_students.map((s) => (
                <div key={s.student_id} className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm">
                  <div>
                    <div className="font-semibold text-emerald-900">{s.student_name}</div>
                    <div className="text-[10px] text-emerald-700">
                      {s.student_no} · {s.assigned_route}
                    </div>
                  </div>
                  <div className="text-right text-xs text-emerald-700">
                    <div>出勤率 {s.attendance_rate}/天</div>
                    <div>上 {s.on_count} / 落 {s.off_count}</div>
                  </div>
                </div>
              ))}
            </Section>

            <Section
              title="打卡需留意（Bottom 5）"
              icon={<XCircle className="h-4 w-4 text-amber-600" />}
              empty={p.bottom_students.length === 0}
            >
              {p.bottom_students.map((s) => (
                <div key={s.student_id} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2 text-sm">
                  <div>
                    <div className="font-semibold text-amber-900">{s.student_name}</div>
                    <div className="text-[10px] text-amber-700">
                      {s.student_no} · {s.assigned_route}
                    </div>
                  </div>
                  <div className="text-right text-xs text-amber-700">
                    <div>出勤率 {s.attendance_rate}/天</div>
                    <div>上 {s.on_count} / 落 {s.off_count}</div>
                  </div>
                </div>
              ))}
            </Section>
          </div>
        </>
      )}
    </>
  );
}

function Section({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        {icon}
        {title}
      </h3>
      {empty ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
          無資料
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
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