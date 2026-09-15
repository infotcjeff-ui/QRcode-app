"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import {
  Bus as BusIcon,
  Loader2,
  ClipboardList,
  QrCode,
  ScanFace,
  Zap,
  ZapOff,
  Users,
} from "lucide-react";
import { RollCallTab } from "@/components/scan/tabs/roll-call-tab";
import { QrCodeTab } from "@/components/scan/tabs/qrcode-tab";
import { FaceTab } from "@/components/scan/tabs/face-tab";
import { FaceApiProvider } from "@/lib/face-api-context";
import { supabase } from "@/lib/supabase";
import { getAuthUser, isAdmin } from "@/lib/auth";
import type {
  Bus,
  CheckLog,
  CheckLogWithStudent,
  Student,
  Trip,
  User,
} from "@/lib/types";

type Props = {
  attendant: User;
  trip: Trip;
  bus: Bus;
  initialStudents: Student[];
  initialLogs: CheckLogWithStudent[];
  supabaseConfigured: boolean;
  /** 「點名」與「人臉」分頁需要查看所有校巴與所有學生 */
  allBuses: Bus[];
  allStudents: Student[];
};

type ScanTab = "rollcall" | "qrcode" | "face";

const DEFAULT_PICKUP = "沙田A線 · 首站";
const DEFAULT_DROPOFF = "學校";

/**
 * 打卡儀表板 (新主頁) — `/scan-in`
 *
 * 以三個 Tab 分隔三種打卡方式：
 *  1. 點名 — 快速勾選已綁定校巴的學生完成打卡
 *  2. QR Code — 沿用原本 /scan 頁所有 section (掃瞄 / 確認 / 本次資訊)
 *  3. 人臉 — 使用 vladmandic/face-api 進行即時人臉辨識打卡
 */
export function ScanInDashboardClient({
  attendant,
  trip,
  bus,
  initialStudents,
  initialLogs,
  supabaseConfigured,
  allBuses,
  allStudents,
}: Props) {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<ScanTab>("rollcall");
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [logs, setLogs] = useState<CheckLogWithStudent[]>(initialLogs);
  const [authChecked, setAuthChecked] = useState(false);
  const [authUser, setAuthUser] = useState<ReturnType<typeof getAuthUser>>(null);
  const [isInsecureContext, setIsInsecureContext] = useState(false);
  const [pickupPoint, setPickupPoint] = useState<string>(DEFAULT_PICKUP);
  const [dropoffPoint, setDropoffPoint] = useState<string>(DEFAULT_DROPOFF);

  // Realtime 連線狀態 (用於 Header 顯示)
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  // 最近新增的 log id 集合 (用於 QrCode 高亮)
  const [recentlyAddedLogIds, setRecentlyAddedLogIds] = useState<Set<string>>(
    () => new Set()
  );

  // 確保使用者已登入
  useEffect(() => {
    const u = getAuthUser();
    setAuthUser(u);
    setAuthChecked(true);
    if (!u) {
      router.replace("/login?role=attendant");
      return;
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    setIsInsecureContext(
      window.location.protocol !== "https:" && !isLocal
    );
  }, []);

  const isAdminUser = isAdmin(authUser);

  // 用 ref 保存最新的 logs，避免 realtime useEffect 反覆重訂閱
  const logsRef = useRef<CheckLogWithStudent[]>(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // 高亮動畫
  const flashNewLog = useCallback((logId: string) => {
    setRecentlyAddedLogIds((prev) => {
      const next = new Set(prev);
      next.add(logId);
      return next;
    });
    setTimeout(() => {
      setRecentlyAddedLogIds((prev) => {
        if (!prev.has(logId)) return prev;
        const next = new Set(prev);
        next.delete(logId);
        return next;
      });
    }, 2500);
  }, []);

  // Realtime 訂閱 (主層負責維護 logs；子層只 receive partial 通知以更新本地 UI)
  useEffect(() => {
    if (!supabaseConfigured) return;

    setRealtimeStatus("connecting");

    const channel = supabase
      .channel(`scan-in-dashboard-${trip.id}`)
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
          let student: Student | null = null;
          const cur = logsRef.current.find((l) => l.student_id === newRow.student_id);
          student = cur?.student ?? null;
          if (!student) {
            const { data } = await supabase
              .from("students")
              .select("*")
              .eq("id", newRow.student_id)
              .maybeSingle();
            if (data) {
              student = data as Student;
              setStudents((prev) =>
                prev.find((s) => s.id === student!.id)
                  ? prev
                  : [...prev, student!]
              );
            }
          }
          setLogs((prev) => {
            if (prev.find((l) => l.id === newRow.id)) return prev;
            return [{ ...newRow, student }, ...prev];
          });
          flashNewLog(newRow.id);
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
            prev.map((l) =>
              l.id === updatedRow.id ? { ...l, ...updatedRow } : l
            )
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
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          setRealtimeStatus("error");
        else setRealtimeStatus("connecting");
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeStatus("idle");
    };
  }, [supabaseConfigured, trip.id, flashNewLog]);

  // 「點名」批次送出後，重新從資料庫 reload (讓所有 tabs 的 logs 同步)
  const handleRollCallAfter = useCallback((studentIds: string[]) => {
    if (studentIds.length === 0) return;
    // 不立即更新 (父層的 Realtime 會在新 INSERT 後接住)
    // 但以防 Realtime 連線失敗，主動 reload:
    void reloadLogs();
    // 同時閃爍動畫
    studentIds.forEach((id) => flashNewLog(`${id}-batch`));
  }, [flashNewLog]);

  // 「人臉」辨識命中後，父層把新 log 推進來
  const handleFaceLogInsert = useCallback(
    (log: CheckLogWithStudent) => {
      setLogs((prev) => {
        if (prev.find((l) => l.id === log.id)) return prev;
        return [log, ...prev];
      });
      flashNewLog(log.id);
    },
    [flashNewLog]
  );

  // 「QrCode」觸發時使用 (signatures differ)
  const handleQrCodeLogInsert = useCallback(
    (log: CheckLog, student: Student | null) => {
      setLogs((prev) => {
        if (prev.find((l) => l.id === log.id)) return prev;
        return [{ ...log, student }, ...prev];
      });
      flashNewLog(log.id);
    },
    [flashNewLog]
  );

  const reloadLogs = useCallback(async () => {
    if (!supabaseConfigured) return;
    const { data } = await supabase
      .from("check_logs")
      .select("*, student:students(*)")
      .eq("trip_id", trip.id)
      .order("timestamp", { ascending: false })
      .limit(200);
    if (data) {
      setLogs(
        (data as CheckLogWithStudent[]).map((log) => ({
          ...(log as CheckLogWithStudent),
          student: log.student ?? null,
        }))
      );
    }
  }, [supabaseConfigured, trip.id]);

  const totalOn = useMemo(
    () => logs.filter((l) => l.type === "ON").length,
    [logs]
  );
  const totalOff = useMemo(
    () => logs.filter((l) => l.type === "OFF").length,
    [logs]
  );

  if (!authChecked) {
    return (
      <main className="flex w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  return (
    <main className="relative flex h-svh w-full flex-col bg-slate-50">
      <OverlayScrollbar className="flex-1">
        <div className="flex flex-col gap-3 px-3 py-4 pb-24 sm:px-4">
      {isInsecureContext ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠️ 偵測到非 HTTPS 連線。部分手機瀏覽器會封鎖相機權限。如無法啟動鏡頭或下載人臉模型，請改用 HTTPS tunnel (<code>npm run dev:tunnel</code>)。
        </div>
      ) : null}

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <BackButton
            parent="/system-setting"
            fallback="/system-setting"
            label=""
            iconOnly
            variant="ghost"
            className="text-white hover:bg-slate-700 hover:text-white"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {authUser?.name ?? attendant.name}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-300">
              <BusIcon className="h-3 w-3" />
              {bus.plate_number} · {bus.route_name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 統計標記 */}
          <span className="flex items-center gap-1 rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] font-medium text-slate-200 ring-1 ring-white/10">
            <Users className="h-3 w-3" /> 上 {totalOn} / 下 {totalOff}
          </span>
          <RealtimeBadge status={realtimeStatus} />
        </div>
      </header>

      {/* ── 三個主 Tab ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as ScanTab)}
          className="flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="rollcall" className="text-[13px] sm:text-sm">
              <ClipboardList className="mr-1 h-4 w-4" />
              點名
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="text-[13px] sm:text-sm">
              <QrCode className="mr-1 h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="face" className="text-[13px] sm:text-sm">
              <ScanFace className="mr-1 h-4 w-4" />
              人臉
            </TabsTrigger>
          </TabsList>

          {/* 點名 */}
          <TabsContent value="rollcall" className="mt-3 flex-1 min-h-0 overflow-hidden">
            <OverlayScrollbar className="h-full">
              <div className="space-y-3 pr-1">
                <RollCallTab
                  attendantAssignedBusId={attendant.assigned_bus_id}
                  allBuses={allBuses}
                  trip={trip}
                  bus={bus}
                  students={allStudents.length > 0 ? allStudents : students}
                  logs={logs}
                  onAfterCheck={handleRollCallAfter}
                  pickupPoint={pickupPoint}
                  onPickupPointChange={setPickupPoint}
                />
              </div>
            </OverlayScrollbar>
          </TabsContent>

          {/* QR Code */}
          <TabsContent value="qrcode" className="mt-3 flex-1 min-h-0 overflow-hidden">
            <OverlayScrollbar className="h-full">
              <div className="space-y-3 pr-1">
                <QrCodeTab
                  attendant={attendant}
                  trip={trip}
                  bus={bus}
                  initialStudents={students}
                  initialLogs={logs}
                  supabaseConfigured={supabaseConfigured}
                  authUser={authUser}
                  realtimeStatus={realtimeStatus}
                  recentlyAddedLogIds={recentlyAddedLogIds}
                  pickupPoint={pickupPoint}
                  onPickupPointChange={setPickupPoint}
                  dropoffPoint={dropoffPoint}
                  onDropoffPointChange={setDropoffPoint}
                  onLogInsert={handleQrCodeLogInsert}
                />
              </div>
            </OverlayScrollbar>
          </TabsContent>

          {/* 人臉 */}
          <TabsContent value="face" className="mt-3 flex-1 min-h-0 overflow-hidden">
            <OverlayScrollbar className="h-full">
              <div className="space-y-3 pr-1">
                <FaceApiProvider>
                  <FaceTab
                    trip={trip}
                    students={allStudents.length > 0 ? allStudents : students}
                    logs={logs}
                    pickupPoint={pickupPoint}
                    onAfterCheck={() => undefined}
                    onLogInsert={handleFaceLogInsert}
                  />
                </FaceApiProvider>
              </div>
            </OverlayScrollbar>
          </TabsContent>
        </Tabs>
      </div>
        </div>
      </OverlayScrollbar>
    </main>
  );
}

/* ── Realtime 連線狀態指示 ── */
function RealtimeBadge({
  status,
}: {
  status: "idle" | "connecting" | "connected" | "error";
}) {
  if (status === "connected") {
    return (
      <span
        title="Realtime 已連線，新打卡會自動即時更新"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/40"
      >
        <Zap className="h-3 w-3 animate-pulse" /> 即時
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span
        title="正在連線到 Realtime…"
        className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-400/40"
      >
        <Loader2 className="h-3 w-3 animate-spin" /> 連線中
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        title="Realtime 連線失敗，請重新整理頁面"
        className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-200 ring-1 ring-rose-400/40"
      >
        <ZapOff className="h-3 w-3" /> 連線失敗
      </span>
    );
  }
  return null;
}
