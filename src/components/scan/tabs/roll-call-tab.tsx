"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bus as BusIcon,
  Check,
  CheckCircle2,
  CheckSquare,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Square,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import { formatTime, formatDateTime } from "@/lib/utils";
import { useGeolocation } from "@/lib/use-geolocation";
import type {
  Bus,
  CheckLogType,
  CheckLogWithStudent,
  Student,
  Trip,
} from "@/lib/types";

type Props = {
  attendantAssignedBusId: string | null;
  allBuses: Bus[];
  trip: Trip;
  bus: Bus;
  students: Student[];
  logs: CheckLogWithStudent[];
  onAfterCheck?: (studentIds: string[]) => void;
  /** 上 / 落車地點 (由父層傳入) */
  pickupPoint: string;
  onPickupPointChange: (value: string) => void;
};

const DEFAULT_PICKUP = "沙田A線 · 首站";

/**
 * 「點名」分頁：
 *  - 根據保姆 (attendant) 已綁定的校巴 → 顯示綁定該校巴的學生
 *  - 列表形式「tick tick tick」快速選擇學生完成打卡
 *  - 支援「上車 / 落車」切換，並即時記錄位置 / 時間供家長追蹤
 */
export function RollCallTab({
  attendantAssignedBusId,
  allBuses,
  trip,
  bus,
  students,
  logs,
  onAfterCheck,
  pickupPoint,
  onPickupPointChange,
}: Props) {
  const { toast } = useToast();
  const [scanType, setScanType] = useState<CheckLogType>("ON");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const geo = useGeolocation({ watchIntervalMs: 30000 });

  // 1. 找出保姆已綁定的校巴清單
  const assignedBuses = useMemo(() => {
    if (!attendantAssignedBusId) return allBuses;
    const found = allBuses.filter((b) => b.id === attendantAssignedBusId);
    return found.length > 0 ? found : [bus];
  }, [attendantAssignedBusId, allBuses, bus]);

  const assignedBusIds = useMemo(
    () => new Set(assignedBuses.map((b) => b.id)),
    [assignedBuses]
  );

  // 2. 篩選綁定這些校巴的學生
  const routeStudents = useMemo(() => {
    return students.filter((s) => {
      if (!s.assigned_bus_id) return false;
      return assignedBusIds.has(s.assigned_bus_id);
    });
  }, [students, assignedBusIds]);

  // 3. 依學號 / 姓名搜尋
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return routeStudents;
    return routeStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.student_no ?? "").toLowerCase().includes(kw) ||
        (s.parent_name ?? "").toLowerCase().includes(kw)
    );
  }, [routeStudents, keyword]);

  // 4. 已 O N / OFF 的學生 ID
  const doneMap = useMemo(() => {
    const map = new Map<string, CheckLogWithStudent>();
    logs.forEach((l) => {
      if (l.type === scanType) {
        // 只保留「本班次最近一筆」
        const existing = map.get(l.student_id);
        if (!existing || l.timestamp > existing.timestamp) {
          map.set(l.student_id, l);
        }
      }
    });
    return map;
  }, [logs, scanType]);

  // 5. 對應到 scanType 時，未完成打卡的學生 = 可選
  const checkableStudents = useMemo(
    () => filtered.filter((s) => !doneMap.has(s.id)),
    [filtered, doneMap]
  );

  // 6. 已完成 (依照目前 scanType)
  const checkedStudents = useMemo(
    () => filtered.filter((s) => doneMap.has(s.id)),
    [filtered, doneMap]
  );

  // 切換 ON / OFF 時清空選擇 (避免跨類型誤選)
  const switchType = useCallback((type: CheckLogType) => {
    setScanType(type);
    setSelected(new Set());
  }, []);

  // 切換單一學生選取
  const toggleStudent = useCallback(
    (studentId: string) => {
      if (submitting) return;
      // 若該學生已經完成本類型打卡 → 不能再 tick
      if (doneMap.has(studentId)) return;

      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
        return next;
      });
    },
    [submitting, doneMap]
  );

  // 全選 / 取消全選 (僅 checkable)
  const toggleSelectAll = useCallback(() => {
    if (submitting) return;
    if (selected.size === checkableStudents.length && checkableStudents.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(checkableStudents.map((s) => s.id)));
    }
  }, [submitting, selected.size, checkableStudents]);

  const flashNew = useCallback((sid: string) => {
    setRecentlyAdded((prev) => {
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
    setTimeout(() => {
      setRecentlyAdded((prev) => {
        if (!prev.has(sid)) return prev;
        const next = new Set(prev);
        next.delete(sid);
        return next;
      });
    }, 2500);
  }, []);

  // 批次送出 (只支援打卡類型一致的批次送出；不會混 ON / OFF)
  const submitBatch = useCallback(async () => {
    if (submitting) return;
    const studentIds = Array.from(selected);
    if (studentIds.length === 0) return;

    setSubmitting(true);
    const failed: { student: Student; reason: string }[] = [];
    const succeeded: { student: Student; log: CheckLogWithStudent }[] = [];

    // 依序送出，避免瞬間併發太多請求
    for (const sid of studentIds) {
      const student = routeStudents.find((s) => s.id === sid);
      if (!student) continue;

      const location = pickupPoint || DEFAULT_PICKUP;
      try {
        const res = await fetch("/api/check-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: sid,
            trip_id: trip.id,
            type: scanType,
            location_name: location,
          }),
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: CheckLogWithStudent;
          error?: string;
          error_code?: string;
        };

        if (!res.ok || !json.success) {
          failed.push({
            student,
            reason:
              json.error_code === "DUPLICATE_ON"
                ? "已上車"
                : json.error_code === "DUPLICATE_OFF"
                ? "已落車"
                : json.error_code === "INVALID_PAYLOAD"
                ? json.error ?? "尚未上車"
                : json.error ?? "打卡失敗",
          });
        } else if (json.data) {
          succeeded.push({
            student,
            log: { ...json.data, student },
          });
          flashNew(sid);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "網絡錯誤";
        failed.push({ student, reason: message });
      }
    }

    setSubmitting(false);

    // 通知父層更新本地 logs (透過父層將 log 推進去)
    onAfterCheck?.(studentIds);

    // 清除已送出成功的選擇
    const succeededIds = new Set(succeeded.map((s) => s.student.id));
    setSelected((prev) => {
      const next = new Set(prev);
      succeededIds.forEach((id) => next.delete(id));
      return next;
    });

    if (succeeded.length > 0) {
      toast({
        title:
          scanType === "ON"
            ? `✅  ${succeeded.length} 位學生已完成上車打卡`
            : `✅  ${succeeded.length} 位學生已完成落車打卡`,
        description: failed.length > 0 ? `${failed.length} 位失敗 (見個別訊息)` : `地點：${pickupPoint || DEFAULT_PICKUP}`,
        duration: 3500,
      });
    }
    if (failed.length > 0) {
      // 把失敗訊息以個別 toast 顯示，避免一次塞太多
      failed.slice(0, 3).forEach((f) => {
        toast({
          title: `${f.student.name} 打卡失敗`,
          description: f.reason,
          variant: "destructive",
          duration: 4000,
        });
      });
      if (failed.length > 3) {
        toast({
          title: `另外 ${failed.length - 3} 位也失敗`,
          description: "請切換至 QR Code 分頁或手動補登記。",
          variant: "destructive",
          duration: 4000,
        });
      }
    }
  }, [submitting, selected, routeStudents, trip.id, scanType, pickupPoint, onAfterCheck, flashNew, toast]);

  // ── 切換 ON / OFF 並清除 local 狀態
  const handleSwitchType = useCallback(
    (next: CheckLogType) => {
      switchType(next);
    },
    [switchType]
  );

  const totalCount = routeStudents.length;
  const checkedCount = doneMap.size;
  const allCheckedInRoute = totalCount > 0 && checkedCount >= totalCount;

  return (
    <div className="space-y-3">
      {/* ── 已綁定校巴資訊 ── */}
      <Card className="overflow-hidden border-emerald-200 bg-emerald-50/60">
        <CardContent className="space-y-2 p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <BusIcon className="h-4 w-4" />
              <span>已綁定校巴 ({assignedBuses.length})</span>
            </div>
            <Badge variant="success" className="text-[10px]">
              {assignedBuses[0]?.plate_number ?? "-"} · {assignedBuses[0]?.route_name ?? "-"}
            </Badge>
          </div>
          {assignedBuses.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {assignedBuses.map((b) => (
                <span
                  key={b.id}
                  className="rounded-full border border-emerald-300 bg-white/70 px-2 py-0.5 text-[11px] text-emerald-800"
                >
                  {b.plate_number} · {b.route_name}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-emerald-700">
            顯示 {totalCount} 位學生 (篩選 assigned_bus_id = 你的校巴)
          </p>
        </CardContent>
      </Card>

      {/* ── 上 / 落車切換 ── */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
        <span
          className={`text-sm font-medium ${
            scanType === "ON" ? "text-emerald-600" : "text-slate-400"
          }`}
        >
          上車點名
        </span>
        <button
          onClick={() => handleSwitchType(scanType === "ON" ? "OFF" : "ON")}
          disabled={submitting}
          className={`relative flex h-7 w-14 items-center rounded-full px-1 transition-colors disabled:opacity-50 ${
            scanType === "OFF" ? "bg-sky-500" : "bg-emerald-500"
          }`}
          aria-label={`切換至${scanType === "ON" ? "落車" : "上車"}打卡`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
              scanType === "OFF" ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${
            scanType === "OFF" ? "text-sky-600" : "text-slate-400"
          }`}
        >
          落車點名
        </span>
      </div>

      {/* ── 上 / 落車地點設定 ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500">
          <MapPin className="h-3 w-3" />
          {scanType === "ON" ? "上車地點" : "落車地點"} (寫入每筆打卡供家長追蹤)
        </label>
        <input
          value={pickupPoint}
          onChange={(e) => onPickupPointChange(e.target.value)}
          placeholder={DEFAULT_PICKUP}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* ── 統計列 + 全選 + 搜尋 ── */}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-800">
              {checkedCount} / {totalCount}
            </span>
            <span className="text-xs text-slate-500">
              已{scanType === "ON" ? "上車" : "落車"}
              {allCheckedInRoute ? " · 🎉 全員到齊" : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={submitting || checkableStudents.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {selected.size === checkableStudents.length && checkableStudents.length > 0 ? (
              <>
                <CheckSquare className="h-3 w-3 text-emerald-600" /> 取消全選
              </>
            ) : (
              <>
                <Square className="h-3 w-3" /> 全選未打卡 ({checkableStudents.length})
              </>
            )}
          </button>
        </div>

        {/* 已選數量顯示 */}
        {selected.size > 0 ? (
          <div className="flex items-center justify-between rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow">
            <span>已選 {selected.size} 位</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set())}
                disabled={submitting}
                className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-50"
              >
                清除
              </button>
              <button
                onClick={submitBatch}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 font-semibold text-white shadow hover:bg-emerald-600 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                確認送出
              </button>
            </div>
          </div>
        ) : null}

        {/* 搜尋 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋學號 / 姓名 / 家長…"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {keyword ? (
            <button
              type="button"
              onClick={() => setKeyword("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="清除搜尋"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 即時 GPS 與打卡時間摘要 ── */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-emerald-600" />
          {geo.lat !== null && geo.lng !== null
            ? `即時位置：${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}${
                geo.accuracy ? ` (±${Math.round(geo.accuracy)}m)` : ""
              }`
            : geo.error
            ? `GPS：${geo.error}`
            : "GPS 取得中…"}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <RefreshCw className="h-3 w-3" />
          {formatDateTime(new Date())}
        </span>
      </div>

      {/* ── 未打卡 (可選) 學生 ── */}
      {checkableStudents.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Filter className="h-3.5 w-3.5 text-amber-600" />
            待打卡 ({checkableStudents.length})
          </h3>
          <div className="space-y-1.5">
            {checkableStudents.map((s) => {
              const isSelected = selected.has(s.id);
              return (
                <StudentCheckRow
                  key={s.id}
                  student={s}
                  checked={false}
                  selectable
                  isSelected={isSelected}
                  onToggle={() => toggleStudent(s.id)}
                  highlight={recentlyAdded.has(s.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── 已完成 (顯示於清單尾) ── */}
      {checkedStudents.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <CheckCircle2
              className={`h-3.5 w-3.5 ${
                scanType === "ON" ? "text-emerald-600" : "text-sky-600"
              }`}
            />
            已{scanType === "ON" ? "上車" : "落車"} ({checkedStudents.length})
          </h3>
          <div className="space-y-1.5">
            {checkedStudents.map((s) => {
              const log = doneMap.get(s.id);
              return (
                <StudentCheckRow
                  key={s.id}
                  student={s}
                  checked
                  selectable={false}
                  isSelected={false}
                  onToggle={() => undefined}
                  timestamp={log?.timestamp ?? null}
                  location={log?.location_name ?? null}
                  highlight={recentlyAdded.has(s.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 全空狀態 */}
      {totalCount === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
          目前沒有綁定此校巴的學生。請聯絡管理員補登學生資料。
        </div>
      ) : null}
      {totalCount > 0 && checkedStudents.length === 0 && checkableStudents.length === 0 ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-center text-xs text-emerald-700">
          🎉 全體同學已完成{scanType === "ON" ? "上車" : "落車"}打卡
        </div>
      ) : null}
    </div>
  );
}

/* ── 子元件 ── */

function StudentCheckRow({
  student,
  checked,
  selectable,
  isSelected,
  onToggle,
  timestamp,
  location,
  highlight,
}: {
  student: Student;
  checked: boolean;
  selectable: boolean;
  isSelected: boolean;
  onToggle: () => void;
  timestamp?: string | null;
  location?: string | null;
  highlight?: boolean;
}) {
  const cardClass = [
    "flex items-center gap-3 rounded-md border p-3 text-sm transition-all duration-500",
    highlight
      ? checked
        ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/60 shadow-md"
        : "border-sky-400 bg-sky-50 ring-2 ring-sky-300/60 shadow-md"
      : checked
      ? "border-slate-200 bg-slate-50/70"
      : isSelected
      ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/30 shadow-md"
      : "border-slate-200 bg-white hover:bg-slate-50",
  ].join(" ");

  return (
    <div className={cardClass}>
      {/* 選取框 (可選) */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!selectable}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
          !selectable
            ? "cursor-default border-slate-200 bg-slate-100 text-slate-400"
            : isSelected
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 bg-white text-transparent hover:border-slate-500"
        }`}
        aria-label={`選擇 ${student.name}`}
      >
        {isSelected || checked ? <Check className="h-4 w-4" /> : null}
      </button>

      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        {student.photo_url ? (
          <AvatarImage
            src={student.photo_url}
            alt={student.name}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback>{student.name?.slice(0, 1) ?? "?"}</AvatarFallback>
      </Avatar>

      {/* 姓名 / 學號 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-slate-800">
            {student.name}
          </span>
          {student.student_no ? (
            <span className="text-xs text-slate-400">{student.student_no}</span>
          ) : null}
          {highlight ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-2.5 w-2.5" /> 剛打卡
            </span>
          ) : null}
        </div>
        {checked ? (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
            {location ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> {location}
              </span>
            ) : null}
            {timestamp ? (
              <span className="inline-flex items-center gap-0.5 font-mono">
                ⏰ {formatTime(timestamp)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-0.5 text-[11px] text-slate-400">
            家長：{student.parent_name ?? "未填寫"}
          </p>
        )}
      </div>

      {/* 右側狀態 */}
      <div className="flex shrink-0 items-center">
        {checked ? (
          <Badge variant="success" className="text-[10px]">
            已打卡
          </Badge>
        ) : isSelected ? (
          <Badge className="text-[10px]">已選</Badge>
        ) : null}
      </div>
    </div>
  );
}
