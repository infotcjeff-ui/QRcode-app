"use client";

import { useEffect, useState } from "react";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import type { CheckLog, CheckLogType, WhatsappStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, MapPin, Radio } from "lucide-react";
import { formatTime } from "@/lib/utils";

type Props = {
  studentId: string;
  initialTripId: string | null;
  initialLog: {
    id: string;
    type: CheckLogType;
    timestamp: string;
    location_name: string | null;
    whatsapp_status: WhatsappStatus;
  } | null;
};

export function ParentRealtimeTracker({ studentId, initialTripId, initialLog }: Props) {
  const [latest, setLatest] = useState<Props["initialLog"]>(initialLog);
  const [tripId, setTripId] = useState<string | null>(initialTripId);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    if (!studentId) return;

    const channel = supabase
      .channel(`parent-tracker-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "check_logs",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const newLog = payload.new as CheckLog;
          setLatest({
            id: newLog.id,
            type: newLog.type,
            timestamp: newLog.timestamp,
            location_name: newLog.location_name,
            whatsapp_status: newLog.whatsapp_status,
          });
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-emerald-800">
        <span className="flex items-center gap-1">
          <Radio className={`h-3 w-3 ${live ? "animate-pulse text-emerald-600" : "text-slate-400"}`} />
          {live ? "Realtime 已連線" : SUPABASE_CONFIGURED ? "Realtime 連線中…" : "Realtime 離線 (尚未設定 Supabase)"}
        </span>
        {tripId ? (
          <span className="text-[10px] text-slate-500">班次：{tripId.slice(0, 8)}…</span>
        ) : null}
      </div>

      {latest ? (
        <div className="rounded-lg border border-emerald-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-emerald-900">
              {latest.type === "ON" ? "已上車" : "已落車"}
            </span>
            <Badge variant={latest.whatsapp_status === "sent" ? "success" : "warning"} className="ml-auto text-[10px]">
              {latest.whatsapp_status === "sent"
                ? "WhatsApp 已通知"
                : latest.whatsapp_status === "failed"
                ? "通知失敗"
                : "通知排隊中"}
            </Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              {formatTime(latest.timestamp)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              {latest.location_name ?? "未提供地點"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-emerald-300 bg-white p-4 text-center text-sm text-emerald-700">
          尚未有打卡紀錄，請等候保姆掃描 QR Code。
        </div>
      )}
    </div>
  );
}