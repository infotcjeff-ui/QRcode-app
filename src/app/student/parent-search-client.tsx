"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X, MapPin, User, Users, Bus as BusIcon, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTime } from "@/lib/utils";
import type { Bus, CheckLog, Student } from "@/lib/types";

type InitialStudent = Student & {
  bus: Bus | null;
  latestLog: (CheckLog & { type: string }) | null;
};

type Props = {
  initialStudents: InitialStudent[];
};

/**
 * 家長即時追蹤 · 搜尋頁
 *
 *  - 預設顯示所有學生 card
 *  - 上方搜尋 bar 接受學號 (STU No)、學生姓名、家長姓名等任一關鍵字
 *  - 完全匹配或子字串匹配皆可
 *  - 點擊 card 進入 /student/[id] 查看詳細即時狀態
 */
export function ParentSearchClient({ initialStudents }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialStudents;
    return initialStudents.filter((s) => {
      return (
        s.student_no.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q) ||
        s.parent_phone.toLowerCase().includes(q)
      );
    });
  }, [query, initialStudents]);

  return (
    <div className="space-y-3">
      {/* ── Search Bar ── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="輸入 STU No（例如 STU2026001）或學生姓名"
          className="h-12 pl-9 pr-10 text-base shadow-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="清除搜尋"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* ── Result meta ── */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          {query.trim()
            ? `搜尋「${query.trim()}」找到 ${filtered.length} 位學生`
            : `全部 ${filtered.length} 位學生`}
        </span>
        {query.trim() ? (
          <span className="text-[10px] text-slate-400">點擊 card 查看即時追蹤</span>
        ) : null}
      </div>

      {/* ── Student Cards ── */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
            <Search className="h-8 w-8 text-slate-300" />
            <p>找不到符合「{query}」的學生</p>
            <p className="text-xs text-slate-400">
              請嘗試輸入完整學號（例如 STU2026001），或姓名關鍵字。
            </p>
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              清除搜尋
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                href={`/student/${s.id}`}
                className="block rounded-lg border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    {s.photo_url ? (
                      <AvatarImage src={s.photo_url} alt={s.name} />
                    ) : null}
                    <AvatarFallback>{s.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {s.name}
                      </span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        {s.student_no}
                      </code>
                      {s.latestLog?.type === "ON" ? (
                        <Badge variant="success" className="text-[10px]">已上車</Badge>
                      ) : s.latestLog?.type === "OFF" ? (
                        <Badge variant="secondary" className="text-[10px]">已落車</Badge>
                      ) : null}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {s.parent_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {s.parent_phone}
                      </span>
                      {s.bus ? (
                        <span className="flex items-center gap-1">
                          <BusIcon className="h-3 w-3" />
                          {s.bus.plate_number} · {s.bus.route_name}
                        </span>
                      ) : (
                        <span className="text-amber-600">未指派校巴</span>
                      )}
                    </div>

                    {s.latestLog ? (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="h-2.5 w-2.5" />
                        最近打卡：{formatTime(s.latestLog.timestamp)} · {s.latestLog.location_name ?? "未提供地點"}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-slate-400">
                        暫無打卡紀錄
                      </div>
                    )}
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
