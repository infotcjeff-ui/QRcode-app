"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Bus,
  CheckLog,
  CheckLogType,
  CheckLogWithStudent,
  Student,
  Trip,
  User,
} from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bus as BusIcon,
  CheckCircle2,
  CheckCircle,
  Loader2,
  MapPin,
  Radio,
  Users,
  XCircle,
  X,
  Info,
  Route as RouteIcon,
  Map as MapIcon,
  RefreshCw,
  Clock,
  Compass,
  Trash2,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import { QrScanner } from "@/components/scan/qr-scanner";
import { useToast } from "@/components/ui/toast-context";
import { formatTime, isValidUuid } from "@/lib/utils";
import { isAdmin, type AuthUser } from "@/lib/auth";
import { useGeolocation } from "@/lib/use-geolocation";

type Props = {
  attendant: User;
  trip: Trip;
  bus: Bus;
  initialStudents: Student[];
  initialLogs: CheckLogWithStudent[];
  supabaseConfigured: boolean;
  /** 父層傳入的 auth user，用於判斷是否為 admin */
  authUser: AuthUser | null;
  /** Realtime 是否已連線 (用於顯示狀態) */
  realtimeStatus: "idle" | "connecting" | "connected" | "error";
  /** 即時新加入的 log id 集合 (高亮用) */
  recentlyAddedLogIds: Set<string>;
  /** 上 / 落車地點 (與「點名」分頁共用) */
  pickupPoint: string;
  onPickupPointChange: (v: string) => void;
  dropoffPoint: string;
  onDropoffPointChange: (v: string) => void;
  /** Realtime 新增 log 時呼叫 (供 QrCodeTab 同步) */
  onLogInsert?: (log: CheckLog, student: Student | null) => void;
  /** Realtime 刪除 log 時呼叫 */
  onLogDelete?: (logId: string) => void;
};

type PendingScan = {
  studentId: string;
  student: Student;
};

const DEFAULT_QR_PICKUP = "沙田A線 · 首站";
const DEFAULT_DROPOFF = "學校";

/**
 * QR Code 分頁：
 *  - 等同於舊 /scan 頁面內的所有 section (上落車掃瞄 + 本次資訊)
 */
export function QrCodeTab({
  attendant,
  trip,
  bus,
  initialStudents,
  initialLogs,
  supabaseConfigured,
  authUser,
  realtimeStatus: _realtimeStatus,
  recentlyAddedLogIds,
  pickupPoint,
  onPickupPointChange,
  dropoffPoint,
  onDropoffPointChange,
  onLogInsert,
  onLogDelete,
}: Props) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [logs, setLogs] = useState<CheckLogWithStudent[]>(initialLogs);
  const [scanTab, setScanTab] = useState<CheckLogType>("ON");
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitching, setTabSwitching] = useState(false);
  const [isInsecureContext, setIsInsecureContext] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  // 取消打卡 Dialog
  const [cancelTarget, setCancelTarget] = useState<CheckLogWithStudent | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const geo = useGeolocation({ watchIntervalMs: 30000 });

  // 同步來自父層 realtime 事件
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    setIsInsecureContext(window.location.protocol !== "https:" && !isLocal);
  }, []);

  const isAdminUser = isAdmin(authUser);

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Realtime 訂閱
  useEffect(() => {
    if (!supabaseConfigured) return;

    const channel = supabase
      .channel(`qrcode-tab-${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "check_logs",
          filter: `trip_id=eq.${trip.id}`,
        },
        async (payload) => {
          const newRow = payload.new as CheckLog;
          let student: Student | null = studentsById.get(newRow.student_id) ?? null;
          if (!student) {
            const { data } = await supabase
              .from("students")
              .select("*")
              .eq("id", newRow.student_id)
              .maybeSingle();
            if (data) {
              student = data as Student;
              setStudents((prev) =>
                prev.find((s) => s.id === student!.id) ? prev : [...prev, student!]
              );
            }
          }
          setLogs((prev) => {
            if (prev.find((l) => l.id === newRow.id)) return prev;
            return [{ ...newRow, student }, ...prev];
          });
          onLogInsert?.(newRow, student);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "check_logs",
          filter: `trip_id=eq.${trip.id}`,
        },
        (payload) => {
          const updatedRow = payload.new as CheckLog;
          setLogs((prev) =>
            prev.map((l) => (l.id === updatedRow.id ? { ...l, ...updatedRow } : l))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "check_logs",
          filter: `trip_id=eq.${trip.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string } | null;
          if (!oldRow?.id) return;
          setLogs((prev) => prev.filter((l) => l.id !== oldRow.id));
          onLogDelete?.(oldRow.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured, trip.id]);

  const confirmScan = useCallback(async () => {
    if (!pendingScan || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/check-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: pendingScan.studentId,
          trip_id: trip.id,
          type: scanTab,
          location_name: pickupPoint,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: CheckLogWithStudent;
        error?: string;
        error_code?: string;
      };

      if (!res.ok || !json.success) {
        const msg =
          json.error_code === "DUPLICATE_ON"
            ? `${pendingScan.student.name} 已於本班次完成上車打卡，請勿重複掃瞄。`
            : json.error_code === "DUPLICATE_OFF"
            ? `${pendingScan.student.name} 已完成落車打卡，請勿重複掃瞄。`
            : json.error_code === "INVALID_PAYLOAD"
            ? json.error ?? `${pendingScan.student.name} 無法登記落車：尚未上車打卡。`
            : json.error ?? "打卡失敗，請重試。";
        toast({
          title: "打卡失敗",
          description: msg,
          variant: "destructive",
          duration: 5000,
        });
        setPendingScan(null);
        return;
      }

      const newLog = json.data!;
      const student = newLog.student ?? pendingScan.student;
      const enriched: CheckLogWithStudent = { ...newLog, student };

      setLogs((prev) => {
        if (prev.find((l) => l.id === enriched.id)) return prev;
        return [enriched, ...prev];
      });
      onLogInsert?.(enriched, student);

      toast({
        title: scanTab === "ON" ? "✅ 上車打卡成功" : "✅ 落車打卡成功",
        description: `${student.name} 已完成打卡`,
        duration: 3500,
      });
      setPendingScan(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "網絡錯誤";
      toast({
        title: "網絡錯誤",
        description: message,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [pendingScan, submitting, scanTab, trip.id, pickupPoint, toast, onLogInsert]);

  const handleScan = useCallback(
    (decodedText: string) => {
      if (!isValidUuid(decodedText)) {
        toast({
          title: "QR Code 無效",
          description: "掃描內容並非學生 UUID。請使用有效的學生 QR Code。",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      const student = studentsById.get(decodedText);
      if (!student) {
        toast({
          title: "學生不存在",
          description: `找不到 ID ${decodedText.slice(0, 8)}... 的學生資料。請確認已正確指派路線。`,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const existingOn = logs.find((l) => l.student_id === decodedText && l.type === "ON");
      const existingOff = logs.find((l) => l.student_id === decodedText && l.type === "OFF");

      if (scanTab === "ON" && existingOn) {
        toast({
          title: "已上車打卡",
          description: `${student.name} 已於本班次完成上車打卡，請勿重複掃瞄。`,
          variant: "destructive",
          duration: 4000,
        });
        return;
      }
      if (scanTab === "OFF") {
        if (existingOff) {
          toast({
            title: "已落車打卡",
            description: `${student.name} 已完成落車打卡，請勿重複掃瞄。`,
            variant: "destructive",
            duration: 4000,
          });
          return;
        }
        if (!existingOn) {
          toast({
            title: "尚未上車",
            description: `${student.name} 尚未完成上車打卡，請先完成上車掃瞄。`,
            variant: "destructive",
            duration: 5000,
          });
          return;
        }
      }

      setPendingScan({ studentId: decodedText, student });
    },
    [studentsById, logs, scanTab, toast]
  );

  const requestCancel = useCallback((log: CheckLogWithStudent) => {
    if (!isAdminUser) return;
    setCancelTarget(log);
    setCancelReason("");
  }, [isAdminUser]);

  const closeCancelDialog = useCallback(() => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
    setCancelReason("");
  }, [cancelSubmitting]);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget || cancelSubmitting) return;
    if (!isAdminUser) {
      toast({
        title: "權限不足",
        description: "只有系統管理員可以取消打卡紀錄。",
        variant: "destructive",
        duration: 4000,
      });
      setCancelTarget(null);
      return;
    }

    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/check-log/${cancelTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancelled_by_user_id: authUser?.id ?? null,
          cancelled_by_name: authUser?.name ?? null,
          reason: cancelReason.trim() || null,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: { deleted_log_id: string; trip_id: string; student_id: string; type: CheckLogType };
        error?: string;
        error_code?: string;
      };

      if (!res.ok || !json.success) {
        const msg = json.error ?? "取消打卡失敗，請重試。";
        toast({
          title: "取消失敗",
          description: msg,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      setLogs((prev) => prev.filter((l) => l.id !== cancelTarget.id));
      onLogDelete?.(cancelTarget.id);

      const studentName = cancelTarget.student?.name ?? "學生";
      const actionLabel = cancelTarget.type === "ON" ? "上車" : "落車";
      toast({
        title: "✅ 已取消打卡",
        description: `${studentName} 的${actionLabel}打卡已取消，可重新掃瞄。`,
        duration: 3500,
      });
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "網絡錯誤";
      toast({
        title: "網絡錯誤",
        description: message,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setCancelSubmitting(false);
    }
  }, [cancelTarget, cancelSubmitting, cancelReason, authUser, isAdminUser, toast, onLogDelete]);

  const totalOn = logs.filter((l) => l.type === "ON").length;
  const totalOff = logs.filter((l) => l.type === "OFF").length;

  const recentLocations = useMemo(() => {
    const map = new Map<string, { name: string; time: string }>();
    logs.forEach((l) => {
      const key = (l.location_name ?? "").trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { name: key, time: l.timestamp });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);
  }, [logs]);

  return (
    <div className="space-y-3">
      {isInsecureContext ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠️ 偵測到非 HTTPS 連線。部分手機瀏覽器會封鎖相機權限。如無法啟動鏡頭，請改用 HTTPS tunnel (<code>npm run dev:tunnel</code>)。
        </div>
      ) : null}

      {/* ── Confirmation Dialog ── */}
      <Dialog open={!!pendingScan} onOpenChange={(open) => !open && setPendingScan(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                {pendingScan?.student.photo_url ? (
                  <AvatarImage src={pendingScan.student.photo_url} alt={pendingScan.student.name} />
                ) : null}
                <AvatarFallback className="text-lg">
                  {pendingScan?.student.name?.slice(0, 1) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{pendingScan?.student.name ?? ""}</DialogTitle>
                <p className="text-sm text-slate-500">學號：{pendingScan?.student.student_no}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <UsersIcon className="h-4 w-4 text-slate-400" />
              <span className="text-xs">家長：{pendingScan?.student.parent_name ?? "未填寫"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-xs">上車地點：{pickupPoint}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <BusIcon className="h-4 w-4 text-slate-400" />
              <span className="text-xs">路線：{bus.route_name}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium">
                動作：{scanTab === "ON" ? "上車打卡" : "落車打卡"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-2 text-center">
            <p className="text-[10px] text-slate-400">QR Code 內容</p>
            <p className="truncate text-xs font-mono text-slate-600">{pendingScan?.studentId}</p>
          </div>

          <div className="flex-row flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingScan(null)}
              disabled={submitting}
              className="flex-1"
            >
              <X className="mr-1 h-4 w-4" />
              取消
            </Button>
            <Button
              onClick={confirmScan}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              確認打卡
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 取消打卡 Dialog ── */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) closeCancelDialog();
        }}
      >
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                {cancelTarget?.student?.photo_url ? (
                  <AvatarImage src={cancelTarget.student.photo_url} alt={cancelTarget.student.name} />
                ) : null}
                <AvatarFallback className="text-lg">
                  {cancelTarget?.student?.name?.slice(0, 1) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  確認取消打卡
                </DialogTitle>
                <p className="text-sm text-slate-500">
                  {cancelTarget?.student?.name ?? ""} · 學號 {cancelTarget?.student?.student_no ?? "-"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-800">打卡類型</span>
              <span className="font-semibold text-amber-900">
                {cancelTarget?.type === "ON" ? "上車打卡" : "落車打卡"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-800">原始時間</span>
              <span className="font-mono font-semibold text-amber-900">
                {cancelTarget?.timestamp ? formatTime(cancelTarget.timestamp) : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-800">地點</span>
              <span className="font-medium text-amber-900">
                {cancelTarget?.location_name ?? "未提供地點"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-800">操作者</span>
              <span className="font-medium text-amber-900">
                {authUser?.name ?? "未知管理員"}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-slate-500">
              取消原因 (選填，僅供內部記錄)
            </label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="例如：學生重複掃瞄、選錯學生…"
              className="h-9 text-sm"
              maxLength={120}
              disabled={cancelSubmitting}
            />
          </div>

          <div className="rounded-md border border-rose-200 bg-rose-50/70 p-2 text-[11px] text-rose-700">
            ⚠️ 取消後該學生即可重新掃瞄登記。請確認無誤再操作。
          </div>

          <div className="flex-row flex gap-2">
            <Button
              variant="outline"
              onClick={closeCancelDialog}
              disabled={cancelSubmitting}
              className="flex-1"
            >
              <X className="mr-1 h-4 w-4" />
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelSubmitting}
              className="flex-1"
            >
              {cancelSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              確認取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 上落車打卡 Section ── */}
      <Tabs defaultValue="scan" className="flex w-full flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan" className="text-sm">
            <BusIcon className="mr-1.5 h-4 w-4" />
            上落車打卡
          </TabsTrigger>
          <TabsTrigger value="info" className="text-sm">
            <Info className="mr-1.5 h-4 w-4" />
            本次資訊
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-3 space-y-3">
          {/* Switch Button */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
            <span className={`text-sm font-medium ${scanTab === "ON" ? "text-emerald-600" : "text-slate-400"}`}>
              上車打卡
            </span>
            <button
              onClick={() => {
                setTabSwitching(true);
                setScanTab(scanTab === "ON" ? "OFF" : "ON");
                setTimeout(() => setTabSwitching(false), 300);
              }}
              className={`relative flex h-7 w-14 items-center rounded-full px-1 transition-colors ${
                scanTab === "OFF" ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  scanTab === "OFF" ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${scanTab === "OFF" ? "text-emerald-600" : "text-slate-400"}`}>
              落車打卡
            </span>
          </div>

          {/* QR Scanner */}
          {tabSwitching ? (
            <TabSkeleton />
          ) : (
            <QrScanner onScan={handleScan} />
          )}

          {/* 已完成上車 / 落車掃瞄 */}
          <Section
            icon={
              scanTab === "ON" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-sky-600" />
              )
            }
            title={
              scanTab === "ON"
                ? `已完成上車掃瞄 (${totalOn}/${students.length})`
                : `已完成落車掃瞄 (${totalOff}/${students.length})`
            }
          >
            {logs.filter((l) => l.type === scanTab).length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
                {scanTab === "ON" ? "尚未有學生上車" : "尚未有學生落車"}
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs
                  .filter((l) => l.type === scanTab)
                  .map((log) => (
                    <StudentRow
                      key={log.id}
                      student={log.student}
                      location={log.location_name}
                      variant={scanTab === "ON" ? "success" : "info"}
                      timestamp={log.timestamp}
                      showCancelButton={isAdminUser}
                      onCancel={() => requestCancel(log)}
                      highlight={recentlyAddedLogIds.has(log.id)}
                    />
                  ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="info" className="mt-3 space-y-3">
          {/* 即時 Google Map */}
          <Section
            icon={<MapIcon className="h-4 w-4 text-emerald-600" />}
            title="即時 Google Map 位置"
          >
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {geo.lat !== null && geo.lng !== null ? (
                <iframe
                  title="realtime-map"
                  src={`https://maps.google.com/maps?q=${geo.lat},${geo.lng}&z=16&output=embed`}
                  className="h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-56 flex-col items-center justify-center gap-1 bg-slate-50 text-xs text-slate-400">
                  <Compass className="h-6 w-6 animate-pulse text-slate-300" />
                  {geo.error ? `無法取得位置：${geo.error}` : "取得 GPS 中…"}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {geo.lat !== null && geo.lng !== null
                  ? `經緯度：${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}${
                      geo.accuracy ? ` (±${Math.round(geo.accuracy)}m)` : ""
                    }`
                  : "尚未取得定位"}
              </span>
              <button
                onClick={() => geo.refresh()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" /> 重新定位
              </button>
            </div>
          </Section>

          {/* 本班次資訊 */}
          <Section
            icon={<Info className="h-4 w-4 text-sky-600" />}
            title="本班次資訊"
          >
            <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <InfoRow icon={<RouteIcon className="h-3 w-3" />} label="班次 ID" value={`${trip.id.slice(0, 8)}…`} />
              <InfoRow icon={<BusIcon className="h-3 w-3" />} label="車牌 / 路線" value={`${bus.plate_number} · ${bus.route_name}`} />
              <InfoRow icon={<Clock className="h-3 w-3" />} label="日期" value={trip.date} />
              <InfoRow icon={<RouteIcon className="h-3 w-3" />} label="班次類型" value={trip.type === "AM_GO" ? "上午上學" : "下午放學"} />
              <InfoRow icon={<Radio className="h-3 w-3" />} label="狀態" value={trip.status === "active" ? "進行中" : "已完成"} />
              <InfoRow icon={<Users className="h-3 w-3" />} label="管理員" value={authUser?.name ?? attendant.name} />
            </div>
          </Section>

          {/* 上落車點 */}
          <Section
            icon={<MapPin className="h-4 w-4 text-amber-600" />}
            title="上落車點"
          >
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">
                  上車地點 (預設寫入每筆打卡)
                </label>
                <input
                  value={pickupPoint}
                  onChange={(e) => onPickupPointChange(e.target.value)}
                  placeholder="例如：沙田A線 · 首站"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">
                  落車地點 (顯示於家長通知)
                </label>
                <input
                  value={dropoffPoint}
                  onChange={(e) => onDropoffPointChange(e.target.value)}
                  placeholder="例如：學校"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {recentLocations.length > 0 ? (
                <div>
                  <p className="mb-1 mt-1 text-[10px] font-medium text-slate-500">
                    最近打卡地點
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {recentLocations.map((loc) => (
                      <button
                        key={loc.name}
                        onClick={() => onPickupPointChange(loc.name)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <MapPin className="h-2.5 w-2.5" /> {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

          {/* 未上車學生 */}
          <Section
            icon={<XCircle className="h-4 w-4 text-amber-600" />}
            title={`未上車學生 (${students.length - totalOn})`}
          >
            {(() => {
              const boardedSet = new Set(
                logs.filter((l) => l.type === "ON").map((l) => l.student_id)
              );
              const missing = students.filter((s) => !boardedSet.has(s.id));
              if (missing.length === 0) {
                return (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-center text-xs text-emerald-700">
                    🎉 全體同學已完成上車打卡
                  </div>
                );
              }
              return (
                <div className="space-y-1.5">
                  {missing.map((s) => (
                    <StudentRow key={s.id} student={s} location={null} variant="warning" />
                  ))}
                </div>
              );
            })()}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Local helper components ── */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0">
      <span className="flex items-center gap-1 text-slate-500">
        {icon}
        {label}
      </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function StudentRow({
  student,
  location,
  variant,
  timestamp,
  onCancel,
  showCancelButton,
  highlight = false,
}: {
  student: Student | null;
  location: string | null;
  variant: "success" | "warning" | "info";
  timestamp?: string | null;
  onCancel?: () => void;
  showCancelButton?: boolean;
  highlight?: boolean;
}) {
  const name = student?.name ?? "未知學生";
  const canCancel = showCancelButton && !!onCancel && variant !== "warning";

  const rowClass = [
    "flex items-center gap-3 rounded-md border p-3 text-sm transition-all duration-500",
    highlight
      ? variant === "success"
        ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/60 shadow-md"
        : variant === "info"
          ? "border-sky-400 bg-sky-50 ring-2 ring-sky-300/60 shadow-md"
          : "border-amber-400 bg-amber-50 ring-2 ring-amber-300/60 shadow-md"
      : "border-slate-200 bg-white",
  ].join(" ");

  return (
    <div className={rowClass}>
      <Avatar className="h-10 w-10">
        {student?.photo_url ? <AvatarImage src={student.photo_url} alt={name} className="object-cover" /> : null}
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-800">{name}</span>
          {student?.student_no ? (
            <span className="text-xs text-slate-400">{student.student_no}</span>
          ) : null}
          {highlight ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm animate-pulse">
              <CheckCircle2 className="h-2.5 w-2.5" /> 剛新增
            </span>
          ) : null}
        </div>
        {location ? (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" /> {location}
          </p>
        ) : (
          <p className="text-xs text-slate-400">未提供地點</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {variant === "success" ? (
            <Badge variant="success" className="text-xs">已上車</Badge>
          ) : variant === "info" ? (
            <Badge variant="secondary" className="text-xs">已落車</Badge>
          ) : (
            <Badge variant="warning" className="text-xs">未打卡</Badge>
          )}
          {canCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-700"
              aria-label="取消此筆打卡"
              title="取消打卡 (僅限管理員)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {timestamp ? (
          <span className="flex items-center gap-1 text-xs font-mono text-slate-500">
            <Clock className="h-3 w-3" /> {formatTime(timestamp)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-48 rounded-lg bg-slate-200" />
      <div className="h-10 rounded-lg bg-slate-200" />
    </div>
  );
}
