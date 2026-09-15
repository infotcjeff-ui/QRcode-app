"use client";

/**
 * FaceTab — 人臉辨識打卡分頁
 *
 * 所有人臉模型由 FaceApiContext 統一管理，Tab 啟動時直接使用。
 * Descriptor 從 localStorage 預先讀取，命中後自動打卡。
 *
 * 流程：
 *  1. Tab 掛載 → 從 localStorage 讀取已註冊的 Descriptor
 *  2. 用戶啟動相機 → 立刻偵測（模型已由 context 預載入）
 *  3. 識別模式 → 比對 128 維向量，命中後呼叫 /api/check-log 打卡
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Scan as ScanIcon,
  ShieldCheck,
  Trash2,
  Users,
  AlertTriangle,
  Image as ImageIcon,
  Info,
  Wifi,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-context";
import { formatTime } from "@/lib/utils";
import { useFaceApi } from "@/lib/face-api-context";
import type { CheckLogType, CheckLogWithStudent, Student, Trip } from "@/lib/types";

type Props = {
  trip: Trip;
  students: Student[];
  logs: CheckLogWithStudent[];
  pickupPoint: string;
  onAfterCheck?: (studentId: string, log: CheckLogWithStudent) => void;
  onLogInsert?: (log: CheckLogWithStudent) => void;
};

const FACE_DESCRIPTORS_KEY = "bus-face-descriptors";

type EnrolledRecord = {
  enrolledAt: number;
  descriptor: number[];
};

type RawDetection = {
  detection: { box: { x: number; y: number; width: number; height: number } };
  descriptor?: Float32Array;
};

type EnrollRecord = {
  studentId: string;
  descriptor: Float32Array;
};

type CamState = "idle" | "requesting" | "active" | "denied" | "error";

type MatchResult = {
  studentId: string;
  student: Student;
  distance: number;
};

type DetectionSample = {
  fps: number;
  detected: boolean;
  match: MatchResult | null;
  candidates: number;
};

const MATCH_THRESHOLD = 0.55;
const MATCH_COOLDOWN_MS = 4000;

export function FaceTab({
  trip,
  students,
  logs: _logs,
  pickupPoint,
  onAfterCheck,
  onLogInsert,
}: Props) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());

  // ── 共享 Context（全域只下載一次模型）─────────────
  const { sdk, modelState, allReady, anyError, isLoading, preload } = useFaceApi();

  const [camState, setCamState] = useState<CamState>("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<EnrollRecord[]>([]);
  const [enrollProgress, setEnrollProgress] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"off" | "test" | "recognize">("off");
  const [sample, setSample] = useState<DetectionSample>({
    fps: 0,
    detected: false,
    match: null,
    candidates: 0,
  });
  const [scanType, setScanType] = useState<CheckLogType>("ON");
  const [checkLogTriggeredIds, setCheckLogTriggeredIds] = useState<Set<string>>(new Set());

  // ── 卸載清理 ────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const stopAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCamState("idle");
  }, []);

  // ── 從 localStorage 讀取 Descriptor ─────────────────
  const loadFromStorage = useCallback((): EnrollRecord[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(FACE_DESCRIPTORS_KEY);
      if (!raw) return [];
      const obj = JSON.parse(raw) as Record<string, EnrolledRecord>;
      return Object.entries(obj)
        .filter(([sid]) => students.some((s) => s.id === sid))
        .map(([sid, rec]) => ({
          studentId: sid,
          descriptor: new Float32Array(rec.descriptor),
        }));
    } catch {
      return [];
    }
  }, [students]);

  useEffect(() => {
    const stored = loadFromStorage();
    setEnrolled(stored);
  }, [loadFromStorage]);

  // ── 啟動相機 ────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamState("error");
      setCamError("此裝置不支援相機");
      return;
    }
    setCamState("requesting");
    setCamError(null);
    // 確保模型已預載
    preload();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("active");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "無法啟動相機";
      setCamError(msg);
      setCamState(
        msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")
          ? "denied"
          : "error"
      );
    }
  }, [preload]);

  const stopCamera = useCallback(() => {
    stopAll();
    setMode("off");
  }, [stopAll]);

  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      await startCamera();
    }
  }, [startCamera]);

  // ── 從 URL 建立 Descriptor ───────────────────────────
  const enrollFromPhotos = useCallback(async () => {
    if (!sdk) return;
    const withPhoto = students.filter((s) => s.photo_url);
    if (withPhoto.length === 0) {
      toast({ title: "沒有可用的學生照片", description: "請先上傳照片", variant: "destructive" });
      return;
    }

    setEnrolled([]);
    setEnrollProgress({ done: 0, total: withPhoto.length });
    const success: EnrollRecord[] = [];

    for (let i = 0; i < withPhoto.length; i++) {
      const s = withPhoto[i];
      try {
        const img = await sdk.fetchImage(s.photo_url!);
        const det = await sdk
          .detectSingleFace(
            img,
            new sdk.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (det) {
          success.push({ studentId: s.id, descriptor: det.descriptor });
        }
      } catch {
        // 跳過錯誤的
      }
      setEnrollProgress({ done: i + 1, total: withPhoto.length });
    }

    const fromStorage = loadFromStorage();
    const existingIds = new Set(fromStorage.map((r) => r.studentId));
    const combined = [
      ...fromStorage,
      ...success.filter((r) => !existingIds.has(r.studentId)),
    ];

    setEnrolled(combined);
    setEnrollProgress(null);

    // 存入 localStorage
    const map: Record<string, EnrolledRecord> = {};
    for (const r of combined) {
      map[r.studentId] = { enrolledAt: Date.now(), descriptor: Array.from(r.descriptor) };
    }
    try {
      window.localStorage.setItem(FACE_DESCRIPTORS_KEY, JSON.stringify(map));
    } catch {}

    toast({
      title: "建立人臉特徵完成",
      description: `成功 ${success.length} / ${withPhoto.length} 位（另有 ${fromStorage.length} 位已從本地載入）`,
      duration: 4000,
    });
  }, [sdk, students, loadFromStorage, toast]);

  // ── 停止偵測 ────────────────────────────────────────
  const stopDetection = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMode("off");
    setSample({ fps: 0, detected: false, match: null, candidates: 0 });
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // ── 測試模式 ────────────────────────────────────────
  const startTest = useCallback(async () => {
    if (!allReady) {
      toast({ title: "模型尚未就緒", description: "請稍等模型下載完成", variant: "destructive" });
      return;
    }
    if (camState !== "active") {
      await startCamera();
    }
    setMode("test");
    runDetectionLoop("test");
  }, [allReady, camState, startCamera]);

  // ── 識別模式 ────────────────────────────────────────
  const startRecognize = useCallback(async () => {
    if (enrolled.length === 0) {
      toast({
        title: "尚未建立學生人臉特徵",
        description: "請先「從本地載入」或「從照片建立」特徵庫。",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    if (!allReady) {
      toast({ title: "模型尚未就緒", description: "請稍等模型下載完成", variant: "destructive" });
      return;
    }
    if (camState !== "active") {
      await startCamera();
    }
    setMode("recognize");
    runDetectionLoop("recognize");
  }, [enrolled.length, allReady, camState, startCamera]);

  // ── 偵測迴圈 ────────────────────────────────────────
  const runDetectionLoop = useCallback((runMode: "test" | "recognize") => {
    if (!sdk || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let fpsStart = performance.now();
    let frameCount = 0;

    const detectorOptions = new sdk.TinyFaceDetectorOptions({
      inputSize: 256,
      scoreThreshold: 0.3,
    });

    const tick = async () => {
      if (runMode !== "test" && runMode !== "recognize") return;
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const { videoWidth: w, videoHeight: h } = video;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      try {
        const task = sdk.detectAllFaces(video, detectorOptions).withFaceLandmarks().withFaceDescriptors() as unknown as Promise<RawDetection[]>;
        const raw = await task;

        if (!raw || raw.length === 0) {
          setSample((s) => ({ ...s, detected: false, candidates: 0 }));
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const detected = raw.length > 0;

        // FPS 計算
        frameCount++;
        const now = performance.now();
        if (now - fpsStart > 1000) {
          setSample((s) => ({ ...s, fps: Math.round((frameCount * 1000) / (now - fpsStart)) }));
          frameCount = 0;
          fpsStart = now;
        }

        let bestMatch: MatchResult | null = null;

        if (runMode === "recognize" && enrolled.length > 0) {
          for (const det of raw) {
            if (!det.descriptor) continue;
            let nearestDist = Infinity;
            let nearestStudentId: string | null = null;
            for (const record of enrolled) {
              const d = sdk.euclideanDistance(det.descriptor, record.descriptor);
              if (d < nearestDist) {
                nearestDist = d;
                nearestStudentId = record.studentId;
              }
            }
            if (nearestStudentId && nearestDist < MATCH_THRESHOLD) {
              if (!bestMatch || nearestDist < bestMatch.distance) {
                const student = students.find((s) => s.id === nearestStudentId);
                if (student) {
                  bestMatch = { studentId: nearestStudentId, student, distance: nearestDist };
                }
              }
            }
          }

          if (bestMatch) {
            const last = cooldownMapRef.current.get(bestMatch.studentId) ?? 0;
            if (now - last > MATCH_COOLDOWN_MS) {
              cooldownMapRef.current.set(bestMatch.studentId, now);
              void triggerCheckIn(bestMatch.student, bestMatch.distance);
              setCheckLogTriggeredIds((prev) => {
                const next = new Set(prev);
                next.add(bestMatch!.studentId);
                return next;
              });
            }
          }
        }

        // 繪製偵測框
        if (runMode === "recognize" && bestMatch) {
          const box = raw[0].detection.box;
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 16px sans-serif";
          const label = `${bestMatch.student.name} (${(1 - bestMatch.distance).toFixed(1)})`;
          const tw = ctx.measureText(label).width;
          ctx.fillRect(box.x, box.y - 22, tw + 10, 22);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, box.x + 5, box.y - 7);
        }

        setSample((s) => ({
          fps: s.fps,
          detected,
          match: bestMatch,
          candidates: raw.length,
        }));

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn("[FaceTab] detection tick error", err);
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [sdk, enrolled, students]);

  // ── 觸發打卡 ────────────────────────────────────────
  const triggerCheckIn = useCallback(
    async (student: Student, distance: number) => {
      const location = pickupPoint || "人臉辨識";
      try {
        const res = await fetch("/api/check-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: student.id,
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
          if (json.error_code === "DUPLICATE_ON" || json.error_code === "DUPLICATE_OFF") return;
          toast({ title: `${student.name} 打卡失敗`, description: json.error ?? "未知錯誤", variant: "destructive" });
          return;
        }
        if (json.data) {
          const enriched: CheckLogWithStudent = { ...json.data, student: json.data.student ?? student };
          onLogInsert?.(enriched);
          onAfterCheck?.(student.id, enriched);
          toast({
            title: scanType === "ON" ? "✅ 人臉上車打卡" : "✅ 人臉落車打卡",
            description: `${student.name} (相似度 ${(1 - distance).toFixed(2)})`,
            duration: 2500,
          });
        }
      } catch (err) {
        toast({ title: "網絡錯誤", description: String(err), variant: "destructive" });
      }
    },
    [pickupPoint, trip.id, scanType, onLogInsert, onAfterCheck, toast]
  );

  // ── 重新讀取 localStorage ──────────────────────────
  const reloadFromStorage = useCallback(() => {
    const stored = loadFromStorage();
    setEnrolled(stored);
    toast({ title: "已重新載入", description: `從本地讀取 ${stored.length} 位學生的人臉特徵。`, duration: 2500 });
  }, [loadFromStorage, toast]);

  const enrolledCount = enrolled.length;
  const totalWithPhoto = students.filter((s) => s.photo_url).length;

  return (
    <div className="space-y-3">
      {/* 狀態總覽 */}
      <Card className="border-sky-200 bg-sky-50/70">
        <CardContent className="space-y-1 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-sky-900">
            <ShieldCheck className="h-4 w-4" />
            <span>人臉辨識系統（已預先註冊：{enrolledCount} 位）</span>
          </div>
          <p className="text-slate-600">
            模型已由系統提前下載，開啟相機後即可直接使用。
            可在「編輯學生」頁面拍攝人臉，或直接從 URL 建立。
          </p>
        </CardContent>
      </Card>

      {/* 模型 / 相機狀態 */}
      <Card>
        <CardContent className="space-y-3 p-3">
          {/* 模型狀態 */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Info className="h-3 w-3" /> 模型狀態
              </span>
              <Button
                size="sm"
                variant={anyError ? "destructive" : "outline"}
                onClick={preload}
                disabled={!sdk || isLoading}
                className="h-7"
              >
                {isLoading ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> 下載中</>
                ) : allReady ? (
                  <><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> 就緒</>
                ) : (
                  <><RefreshCw className="mr-1 h-3 w-3" /> 下載模型</>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <ModelBadge name="tinyFace" status={modelState.tinyFaceDetector} />
              <ModelBadge name="landmark68" status={modelState.faceLandmark68Net} />
              <ModelBadge name="recognition" status={modelState.faceRecognitionNet} />
            </div>
          </div>

          {/* 相機控制 */}
          <div className="border-t border-slate-100 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Camera className="h-3 w-3" /> 相機
              </span>
              <div className="flex gap-1">
                {camState === "active" ? (
                  <>
                    <Button size="sm" variant="outline" className="h-7" onClick={flipCamera}>
                      <RefreshCw className="mr-1 h-3 w-3" /> 翻轉
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7" onClick={stopCamera}>
                      <CameraOff className="mr-1 h-3 w-3" /> 停止
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={startCamera} disabled={camState === "requesting"} className="h-7">
                    {camState === "requesting" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="mr-1 h-3 w-3" />
                    )}
                    啟動相機
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Badge
                variant={
                  camState === "active" ? "success" : camState === "denied" || camState === "error" ? "destructive" : "secondary"
                }
                className="text-[10px]"
              >
                {camState === "idle" && "未啟動"}
                {camState === "requesting" && "請求中…"}
                {camState === "active" && "已啟動（後鏡頭）"}
                {camState === "denied" && "權限被拒"}
                {camState === "error" && "啟動失敗"}
              </Badge>
              {camError ? <span className="text-rose-600">{camError}</span> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 即時影像 */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-3 p-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
            {camState !== "active" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/95 text-slate-100">
                <Eye className="h-8 w-8 opacity-60" />
                <p className="text-sm">相機未啟動</p>
                <p className="px-4 text-center text-[11px] text-slate-300">
                  啟動相機後即可使用偵測 / 識別功能
                </p>
              </div>
            ) : null}

            {/* HUD */}
            {mode !== "off" ? (
              <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 text-[10px]">
                <span className={`rounded-md px-2 py-0.5 font-semibold backdrop-blur ${
                  sample.detected ? "bg-emerald-500/80 text-white" : "bg-slate-700/70 text-slate-200"
                }`}>
                  {sample.detected ? `偵測到 ${sample.candidates} 張臉` : "未偵測到"}
                </span>
                <span className="rounded-md bg-slate-700/70 px-2 py-0.5 text-slate-200 backdrop-blur">
                  FPS {sample.fps}
                </span>
                {sample.match && (
                  <span className="rounded-md bg-emerald-500/90 px-2 py-0.5 font-semibold text-white backdrop-blur">
                    命中：{sample.match.student.name}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* 上 / 落車切換 */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
            <span className={`text-xs font-medium ${scanType === "ON" ? "text-emerald-600" : "text-slate-400"}`}>上車</span>
            <button
              onClick={() => setScanType(scanType === "ON" ? "OFF" : "ON")}
              className={`relative flex h-6 w-12 items-center rounded-full px-1 transition-colors ${
                scanType === "OFF" ? "bg-sky-500" : "bg-emerald-500"
              }`}
            >
              <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                scanType === "OFF" ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
            <span className={`text-xs font-medium ${scanType === "OFF" ? "text-sky-600" : "text-slate-400"}`}>落車</span>
          </div>

          {/* 模式按鈕 */}
          <div className="grid grid-cols-2 gap-2">
            {mode === "off" ? (
              <>
                <Button onClick={startTest} variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50">
                  <Play className="mr-1 h-4 w-4" /> 測試模式
                </Button>
                <Button onClick={startRecognize} disabled={enrolled.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                  <ScanIcon className="mr-1 h-4 w-4" /> 識別模式
                </Button>
              </>
            ) : (
              <Button onClick={stopDetection} variant="destructive" className="col-span-2">
                <Square className="mr-1 h-4 w-4" /> 停止偵測
              </Button>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-500">
            {mode === "test"
              ? "🧪 測試模式 — 僅偵測人臉，不會自動打卡"
              : mode === "recognize"
              ? `🟢 識別模式 — 比對 ${enrolled.length} 位學生，命中後自動打卡（冷卻 ${MATCH_COOLDOWN_MS / 1000}s）`
              : "選擇模式開始偵測"}
          </p>
        </CardContent>
      </Card>

      {/* 特徵庫管理 */}
      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4" />
              人臉特徵庫
              <Badge variant="secondary" className="ml-1 text-[10px]">{enrolled.length} 位</Badge>
            </span>
            <Button size="sm" variant="outline" onClick={reloadFromStorage} className="h-7" title="從 localStorage 重新讀取">
              <Wifi className="mr-1 h-3 w-3" /> 從本地讀取
            </Button>
          </div>

          {enrolled.length === 0 ? (
            <div className="space-y-2">
              <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-500">
                目前沒有已註冊的人臉特徵。
                <br />
                方式①：在「編輯學生」頁面拍攝人臉
                <br />
                方式②：按下方的「從 URL 建立」
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={enrollFromPhotos}
                disabled={!sdk || !allReady || enrollProgress !== null}
                className="w-full"
              >
                {enrollProgress ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> 建立中…</>
                ) : (
                  <><ImageIcon className="mr-1 h-3 w-3" /> 從學生照片 URL 建立</>
                )}
              </Button>
              {totalWithPhoto === 0 && (
                <p className="text-center text-[10px] text-amber-600">⚠️ 尚無學生的照片 URL，請先上傳</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {enrolled.map((r) => {
                const s = students.find((x) => x.id === r.studentId);
                return (
                  <span key={r.studentId} className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800" title={s?.name ?? r.studentId}>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {s?.name ?? r.studentId.slice(0, 6)}
                  </span>
                );
              })}
            </div>
          )}

          {enrollProgress ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round((enrollProgress.done / enrollProgress.total) * 100)}%` }} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 最近自動打卡 */}
      {checkLogTriggeredIds.size > 0 ? (
        <Card className="border-emerald-300 bg-emerald-50/60">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> 已自動打卡
              </div>
              <button onClick={() => setCheckLogTriggeredIds(new Set())} className="text-[11px] text-emerald-700 underline hover:text-emerald-900">
                <Trash2 className="mr-1 inline h-3 w-3" /> 清空
              </button>
            </div>
            <div className="space-y-1">
              {Array.from(checkLogTriggeredIds).map((sid) => {
                const s = students.find((x) => x.id === sid);
                return (
                  <div key={sid} className="flex items-center gap-2 rounded-md border border-emerald-300 bg-white p-2 text-xs">
                    <Avatar className="h-7 w-7">
                      {s?.photo_url ? <AvatarImage src={s.photo_url} alt={s.name} className="object-cover" /> : null}
                      <AvatarFallback>{s?.name?.slice(0, 1) ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-900">{s?.name ?? sid}</p>
                      <p className="text-[10px] text-emerald-700">
                        {formatTime(new Date())} · {scanType === "ON" ? "上車" : "落車"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 除錯提示 */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="space-y-1 p-3 text-[11px] text-amber-900">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" /> 如偵測不到人臉
          </div>
          <ul className="ml-4 space-y-0.5">
            <li>① 確認臉部光線充足，無遮擋</li>
            <li>② 確認使用 HTTPS（模型需從 CDN 下載）</li>
            <li>③ 嘗試切換「翻轉」使用前鏡頭</li>
            <li>④ 若模型下載失敗，嘗試 <code>npm run dev:tunnel</code></li>
            <li>⑤ threshold 設為 0.3（已放寬），仍失敗請更新瀏覽器</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ModelBadge({ name, status }: { name: string; status: "idle" | "loading" | "ready" | "error" }) {
  const variant = status === "ready" ? "success" : status === "loading" ? "secondary" : status === "error" ? "destructive" : "outline";
  const label = status === "idle" ? "未下載" : status === "loading" ? "…" : status === "ready" ? "✅" : "❌";
  return (
    <span className="inline-flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
      <span>{name}</span>
      <Badge variant={variant} className="text-[10px]">{label}</Badge>
    </span>
  );
}
