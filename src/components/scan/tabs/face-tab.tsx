"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Eye,
  Loader2,
  Play,
  Square,
  Scan as ScanIcon,
  ShieldCheck,
  Trash2,
  Users,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-context";
import { formatTime } from "@/lib/utils";
import type { CheckLogType, CheckLogWithStudent, Student, Trip } from "@/lib/types";

type Props = {
  trip: Trip;
  students: Student[];
  logs: CheckLogWithStudent[];
  pickupPoint: string;
  onAfterCheck?: (studentId: string, log: CheckLogWithStudent) => void;
  /** 上/落車類型 — 由 FaceTab 自己選擇，但會呼叫父層把 log 加進去 */
  onLogInsert?: (log: CheckLogWithStudent) => void;
};

// face-api 模型 base URL — 從 jsDelivr CDN 載入，避免把所有模型 bundle 進專案
const FACE_MODEL_BASE_URL =
  "https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model/";

type ModelStatus = {
  tinyFaceDetector: "idle" | "loading" | "ready" | "error";
  faceLandmark68Net: "idle" | "loading" | "ready" | "error";
  faceRecognitionNet: "idle" | "loading" | "ready" | "error";
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
  timestamp: number;
};

type DetectionSample = {
  fps: number;
  detected: boolean;
  match: MatchResult | null;
  candidates: number; // 臉部數量
};

const MATCH_DISTANCE_THRESHOLD = 0.55; // 越小越嚴格（face-api.js 建議 0.6，本調嚴一點）
const MATCH_COOLDOWN_MS = 4000; // 同一學生命中後冷卻時間，避免重複觸發打卡

/**
 * 人臉辨識分頁：
 *  - 使用 @vladmandic/face-api fork
 *  - 載入模型 → 啟動相機 → 建立學生人臉特徵 (enroll) → 即時偵測比對
 *  - 首次使用提供「測試模式」只偵測人臉不打卡，方便人工驗證可用性
 */
export function FaceTab({
  trip,
  students,
  logs: _logs,
  pickupPoint,
  onAfterCheck,
  onLogInsert,
}: Props) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());

  const [faceApi, setFaceApi] = useState<typeof import("@vladmandic/face-api") | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    tinyFaceDetector: "idle",
    faceLandmark68Net: "idle",
    faceRecognitionNet: "idle",
  });
  const [camState, setCamState] = useState<CamState>("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<EnrollRecord[]>([]);
  const [enrollFailed, setEnrollFailed] = useState<{ studentId: string; reason: string }[]>([]);
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

  // ───────────────────────── 載入 SDK ─────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@vladmandic/face-api");
        if (mounted) setFaceApi(mod);
      } catch (err) {
        console.error("[FaceTab] Failed to load @vladmandic/face-api", err);
        toast({
          title: "人臉辨識 SDK 載入失敗",
          description: err instanceof Error ? err.message : "未知錯誤",
          variant: "destructive",
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  // 卸載時清理
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

  // ─────────────────────── 載入 face-api 模型 ───────────────────────
  const loadModels = useCallback(async () => {
    if (!faceApi) {
      toast({ title: "SDK 尚未載入完成", variant: "destructive" });
      return;
    }
    const setNext = (k: keyof ModelStatus, v: ModelStatus[keyof ModelStatus]) =>
      setModelStatus((s) => ({ ...s, [k]: v }));

    try {
      setNext("tinyFaceDetector", "loading");
      await faceApi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_BASE_URL);
      setNext("tinyFaceDetector", "ready");
    } catch (e) {
      console.error("[FaceTab] tinyFaceDetector load failed", e);
      setNext("tinyFaceDetector", "error");
    }
    try {
      setNext("faceLandmark68Net", "loading");
      await faceApi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_BASE_URL);
      setNext("faceLandmark68Net", "ready");
    } catch (e) {
      console.error("[FaceTab] faceLandmark68Net load failed", e);
      setNext("faceLandmark68Net", "error");
    }
    try {
      setNext("faceRecognitionNet", "loading");
      await faceApi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_BASE_URL);
      setNext("faceRecognitionNet", "ready");
    } catch (e) {
      console.error("[FaceTab] faceRecognitionNet load failed", e);
      setNext("faceRecognitionNet", "error");
    }
  }, [faceApi, toast]);

  // ─────────────────────── 啟動相機 ───────────────────────
  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamState("error");
      setCamError("此裝置/瀏覽器不支援 getUserMedia API");
      return;
    }
    setCamState("requesting");
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // 前鏡頭 (自拍適合人臉)
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
      const message = err instanceof Error ? err.message : "無法啟動相機";
      console.warn("[FaceTab] getUserMedia failed", err);
      setCamError(message);
      setCamState(
        message.toLowerCase().includes("denied") ||
          message.toLowerCase().includes("permission")
          ? "denied"
          : "error"
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopAll();
    setMode("off");
  }, [stopAll]);

  // 切換鏡頭 (前/後)
  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // 嘗試切換 facingMode
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
    } catch {
      // 如果環境鏡頭不可用，退回前鏡頭
      await startCamera();
    }
  }, [startCamera]);

  // ────────────────── 為每位學生建立人臉特徵 (enroll) ──────────────────
  const enrollStudents = useCallback(async () => {
    if (!faceApi) return;
    const withPhoto = students.filter((s) => s.photo_url);
    if (withPhoto.length === 0) {
      toast({
        title: "沒有可用的學生照片",
        description: "請先到「學生管理」上傳照片，再回到此頁。",
        variant: "destructive",
      });
      return;
    }

    setEnrolled([]);
    setEnrollFailed([]);
    setEnrollProgress({ done: 0, total: withPhoto.length });

    const success: EnrollRecord[] = [];
    const failed: { studentId: string; reason: string }[] = [];

    for (let i = 0; i < withPhoto.length; i++) {
      const s = withPhoto[i];
      try {
        const img = await faceApi.fetchImage(s.photo_url!);
        const det = await faceApi
          .detectSingleFace(
            img,
            new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!det) {
          failed.push({ studentId: s.id, reason: "未偵測到人臉" });
        } else {
          success.push({ studentId: s.id, descriptor: det.descriptor });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "未知錯誤";
        failed.push({ studentId: s.id, reason: msg });
      }
      setEnrollProgress({ done: i + 1, total: withPhoto.length });
    }

    setEnrolled(success);
    setEnrollFailed(failed);
    setEnrollProgress(null);

    toast({
      title: `建立人臉特徵完成`,
      description: `成功 ${success.length} 位 / 失敗 ${failed.length} 位`,
      duration: 3500,
    });
  }, [faceApi, students, toast]);

  // ────────────────────────── 偵測流程 ──────────────────────────
  const startTest = useCallback(async () => {
    if (!faceApi) return;
    if (modelStatus.tinyFaceDetector !== "ready") {
      await loadModels();
    }
    if (camState !== "active") {
      await startCamera();
    }
    setMode("test");
    runDetectionLoop("test");
  }, [faceApi, modelStatus, loadModels, startCamera, camState]);

  const startRecognize = useCallback(async () => {
    if (!faceApi) return;
    if (enrolled.length === 0) {
      toast({
        title: "尚未建立學生人臉特徵",
        description: "請先點擊下方「建立學生人臉特徵」按鈕。",
        variant: "destructive",
      });
      return;
    }
    if (
      modelStatus.tinyFaceDetector !== "ready" ||
      modelStatus.faceLandmark68Net !== "ready" ||
      modelStatus.faceRecognitionNet !== "ready"
    ) {
      await loadModels();
    }
    if (camState !== "active") {
      await startCamera();
    }
    setMode("recognize");
    runDetectionLoop("recognize");
  }, [faceApi, enrolled.length, modelStatus, loadModels, startCamera, camState]);

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

  function runDetectionLoop(mode: "test" | "recognize") {
    if (!faceApi || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTs = performance.now();
    let frameCount = 0;
    let fpsStart = performance.now();

    const detectorOptions = new faceApi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const tick = async () => {
      if (mode !== "test" && mode !== "recognize") return;
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // 調整 canvas 大小與 video 同步
      const { videoWidth: w, videoHeight: h } = video;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      // 為求型別相容，這裡用結構型別 (structural typing) 儲存偵測結果
      // 因為 face-api 多層 generic 太長，這層手動指定必要欄位
      type DetectionItem = {
        detection: import("@vladmandic/face-api").FaceDetection;
        descriptor?: Float32Array;
      };
      let detections: DetectionItem[] = [];
      try {
        const raw = await faceApi
          .detectAllFaces(video, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptors();
        // 將 face-api 強型別結果收斂成結構型別
        detections = raw.map((d) => ({
          detection: d.detection,
          descriptor: d.descriptor,
        }));
      } catch (err) {
        console.warn("[FaceTab] detection error", err);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // 計算 FPS
      frameCount++;
      const now = performance.now();
      if (now - fpsStart > 1000) {
        setSample((s) => ({ ...s, fps: Math.round((frameCount * 1000) / (now - fpsStart)) }));
        frameCount = 0;
        fpsStart = now;
      }
      lastTs = now;

      const detected = detections.length > 0;
      let bestMatch: MatchResult | null = null;

      if (mode === "recognize" && detected && enrolled.length > 0) {
        // 對每個偵測到的人臉，取 descriptor 比對
        for (const det of detections) {
          if (!det.descriptor) continue;
          let nearestDist = Infinity;
          let nearestStudentId: string | null = null;
          for (const record of enrolled) {
            const d = faceApi.euclideanDistance(det.descriptor, record.descriptor);
            if (d < nearestDist) {
              nearestDist = d;
              nearestStudentId = record.studentId;
            }
          }
          if (
            nearestStudentId &&
            nearestDist < MATCH_DISTANCE_THRESHOLD &&
            (!bestMatch || nearestDist < bestMatch.distance)
          ) {
            const student = students.find((s) => s.id === nearestStudentId);
            if (student) {
              bestMatch = {
                studentId: nearestStudentId,
                student,
                distance: nearestDist,
                timestamp: Date.now(),
              };
            }
          }
        }

        if (bestMatch) {
          const last = cooldownMapRef.current.get(bestMatch.studentId) ?? 0;
          if (Date.now() - last > MATCH_COOLDOWN_MS) {
            cooldownMapRef.current.set(bestMatch.studentId, Date.now());
            // 觸發人臉打卡
            void triggerCheckIn(bestMatch.student, bestMatch.distance);
            setCheckLogTriggeredIds((prev) => {
              const next = new Set(prev);
              next.add(bestMatch!.studentId);
              return next;
            });
          }
        }
      }

      // 繪製偵測框 (顏色：recognize 比對命中 → 綠色, miss → 紅色；test → 藍色)
      const resized = faceApi.resizeResults(detections, { width: w, height: h });
      if (mode === "recognize" && bestMatch) {
        const box = resized[0].detection.box;
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 18px sans-serif";
        const label = `${bestMatch.student.name} (${bestMatch.distance.toFixed(2)})`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(box.x, box.y - 26, textWidth + 12, 26);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, box.x + 6, box.y - 8);
      } else {
        faceApi.draw.drawDetections(canvas, resized);
      }

      setSample((s) => ({
        fps: s.fps,
        detected,
        match: bestMatch,
        candidates: detections.length,
      }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  // ─────────────────── 觸發人臉打卡 API ───────────────────
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
          // 重複或無效 → 不算錯，靜默即可 (因為可能多人同時經過)
          if (json.error_code === "DUPLICATE_ON" || json.error_code === "DUPLICATE_OFF") {
            // 已在 cooldown 內重複偵測到同一人，靜默忽略
            return;
          }
          toast({
            title: `${student.name} 打卡失敗`,
            description: json.error ?? "未知錯誤",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }
        if (json.data) {
          const enriched: CheckLogWithStudent = {
            ...json.data,
            student: json.data.student ?? student,
          };
          onLogInsert?.(enriched);
          onAfterCheck?.(student.id, enriched);
          toast({
            title: scanType === "ON" ? "✅ 人臉上車打卡" : "✅ 人臉落車打卡",
            description: `${student.name} (相似度 ${(1 - distance).toFixed(2)})`,
            duration: 2500,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "網絡錯誤";
        toast({
          title: "網絡錯誤",
          description: msg,
          variant: "destructive",
        });
      }
    },
    [pickupPoint, trip.id, scanType, onLogInsert, onAfterCheck, toast]
  );

  const allModelsReady =
    modelStatus.tinyFaceDetector === "ready" &&
    modelStatus.faceLandmark68Net === "ready" &&
    modelStatus.faceRecognitionNet === "ready";

  const anyModelError =
    modelStatus.tinyFaceDetector === "error" ||
    modelStatus.faceLandmark68Net === "error" ||
    modelStatus.faceRecognitionNet === "error";

  return (
    <div className="space-y-3">
      {/* ── 狀態總覽 ── */}
      <Card className="border-sky-200 bg-sky-50/70">
        <CardContent className="space-y-1 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-sky-900">
            <ShieldCheck className="h-4 w-4" />
            <span>人臉辨識系統 (vladmandic/face-api)</span>
          </div>
          <p className="text-slate-600">
            首次使用：點擊「下載模型」→ 啟動相機 → 建立學生特徵 → 開始識別。
          </p>
        </CardContent>
      </Card>

      {/* ── 模型 / 相機狀態 + 操作 ── */}
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
                variant={anyModelError ? "destructive" : "outline"}
                onClick={loadModels}
                disabled={!faceApi || modelStatus.tinyFaceDetector === "loading"}
                className="h-7"
              >
                {modelStatus.tinyFaceDetector === "loading" ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 下載中
                  </>
                ) : allModelsReady ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> 重新下載
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1 h-3 w-3" /> 下載模型
                  </>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-3">
              <ModelBadge
                name="tinyFaceDetector"
                status={modelStatus.tinyFaceDetector}
              />
              <ModelBadge
                name="faceLandmark68Net"
                status={modelStatus.faceLandmark68Net}
              />
              <ModelBadge
                name="faceRecognitionNet"
                status={modelStatus.faceRecognitionNet}
              />
            </div>
            {anyModelError ? (
              <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
                部分模型下載失敗。多數 CDN 為 https，需要 HTTPS 才能下載模型。若開發階段請改用
                <code>npm run dev:tunnel</code>。
              </p>
            ) : null}
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
                  <Button
                    size="sm"
                    onClick={startCamera}
                    disabled={camState === "requesting"}
                    className="h-7"
                  >
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
            <div className="text-[11px] text-slate-500">
              狀態：
              <Badge
                variant={
                  camState === "active"
                    ? "success"
                    : camState === "denied" || camState === "error"
                    ? "destructive"
                    : "secondary"
                }
                className="ml-1 text-[10px]"
              >
                {camState === "idle" && "未啟動"}
                {camState === "requesting" && "請求權限中…"}
                {camState === "active" && "已啟動"}
                {camState === "denied" && "權限被拒"}
                {camState === "error" && "啟動失敗"}
              </Badge>
              {camError ? <span className="ml-2 text-rose-600">{camError}</span> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 即時影像 / 偵測畫面 ── */}
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {camState !== "active" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/95 text-slate-100">
                <Eye className="h-8 w-8 opacity-60" />
                <p className="text-sm">相機未啟動</p>
                <p className="px-4 text-center text-[11px] text-slate-300">
                  點擊上方「啟動相機」以預覽。
                </p>
              </div>
            ) : null}

            {/* 偵測狀態 HUD */}
            {mode !== "off" ? (
              <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 text-[10px]">
                <span
                  className={`rounded-md px-2 py-0.5 font-semibold backdrop-blur ${
                    sample.detected
                      ? "bg-emerald-500/80 text-white"
                      : "bg-slate-700/70 text-slate-200"
                  }`}
                >
                  {sample.detected
                    ? `偵測到 ${sample.candidates} 張臉`
                    : "未偵測到臉"}
                </span>
                <span className="rounded-md bg-slate-700/70 px-2 py-0.5 text-slate-200 backdrop-blur">
                  FPS {sample.fps}
                </span>
              </div>
            ) : null}
          </div>

          {/* 模式選擇 */}
          <div className="mt-3 space-y-2">
            {/* 上 / 落車 */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
              <span
                className={`text-xs font-medium ${
                  scanType === "ON" ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                上車
              </span>
              <button
                onClick={() => setScanType(scanType === "ON" ? "OFF" : "ON")}
                className={`relative flex h-6 w-12 items-center rounded-full px-1 transition-colors ${
                  scanType === "OFF" ? "bg-sky-500" : "bg-emerald-500"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    scanType === "OFF" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-xs font-medium ${
                  scanType === "OFF" ? "text-sky-600" : "text-slate-400"
                }`}
              >
                落車
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {mode === "off" ? (
                <>
                  <Button
                    onClick={startTest}
                    variant="outline"
                    className="border-sky-300 text-sky-700 hover:bg-sky-50"
                  >
                    <Play className="mr-1 h-4 w-4" /> 測試模式
                  </Button>
                  <Button
                    onClick={startRecognize}
                    disabled={enrolled.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <ScanIcon className="mr-1 h-4 w-4" /> 識別模式
                  </Button>
                </>
              ) : (
                <Button
                  onClick={stopDetection}
                  variant="destructive"
                  className="col-span-2"
                >
                  <Square className="mr-1 h-4 w-4" />
                  停止偵測
                </Button>
              )}
            </div>
            <p className="text-center text-[10px] text-slate-500">
              {mode === "test"
                ? "🧪 測試模式 — 僅偵測人臉，不會自動打卡"
                : mode === "recognize"
                ? "🟢 識別模式 — 比對到學生後自動打卡 (相同人冷卻 4 秒)"
                : "未啟動偵測"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 學生人臉特徵 (enroll) ── */}
      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4" />
              學生人臉特徵庫
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {enrolled.length} / {students.filter((s) => s.photo_url).length}
              </Badge>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={enrollStudents}
              disabled={!faceApi || !allModelsReady || enrollProgress !== null}
              className="h-8"
            >
              {enrollProgress ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  建立中 {enrollProgress.done}/{enrollProgress.total}
                </>
              ) : (
                <>
                  <ImageIcon className="mr-1 h-3 w-3" />
                  建立 / 重建
                </>
              )}
            </Button>
          </div>

          {enrollProgress ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{
                  width: `${Math.round((enrollProgress.done / enrollProgress.total) * 100)}%`,
                }}
              />
            </div>
          ) : null}

          {enrolled.length === 0 && enrollFailed.length === 0 && !enrollProgress ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-500">
              尚未建立任何學生的人臉特徵。建議點擊「建立 / 重建」批次處理。
            </p>
          ) : null}

          {enrolled.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-emerald-700">
                ✅ 成功 ({enrolled.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {enrolled.slice(0, 12).map((r) => {
                  const s = students.find((x) => x.id === r.studentId);
                  return (
                    <span
                      key={r.studentId}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800"
                      title={s?.name ?? r.studentId}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {s?.name ?? r.studentId.slice(0, 6)}
                    </span>
                  );
                })}
                {enrolled.length > 12 ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                    +{enrolled.length - 12}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {enrollFailed.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-rose-700">
                ⚠️ 失敗 ({enrollFailed.length})
              </p>
              <div className="space-y-1">
                {enrollFailed.slice(0, 5).map((f) => {
                  const s = students.find((x) => x.id === f.studentId);
                  return (
                    <div
                      key={f.studentId}
                      className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50/60 px-2 py-1 text-[10px]"
                    >
                      <span className="text-rose-900">{s?.name ?? f.studentId}</span>
                      <span className="text-rose-700">{f.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── 最近命中 / 觸發的打卡 ── */}
      {checkLogTriggeredIds.size > 0 ? (
        <Card className="border-emerald-300 bg-emerald-50/60">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> 本次已自動打卡
            </div>
            <div className="space-y-1">
              {Array.from(checkLogTriggeredIds).map((sid) => {
                const s = students.find((x) => x.id === sid);
                return (
                  <div
                    key={sid}
                    className="flex items-center gap-2 rounded-md border border-emerald-300 bg-white p-2 text-xs"
                  >
                    <Avatar className="h-8 w-8">
                      {s?.photo_url ? (
                        <AvatarImage
                          src={s.photo_url}
                          alt={s.name}
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback>{s?.name?.slice(0, 1) ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-900">{s?.name ?? sid}</p>
                      <p className="text-[10px] text-emerald-700">
                        已於 {formatTime(new Date())}{" "}
                        {scanType === "ON" ? "上車" : "落車"} ({pickupPoint || "人臉辨識"})
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setCheckLogTriggeredIds(new Set())}
              className="text-[11px] text-emerald-700 underline hover:text-emerald-900"
            >
              <Trash2 className="mr-1 inline h-3 w-3" /> 清空本批紀錄
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── 測試小提示 ── */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="space-y-1 p-3 text-[11px] text-amber-900">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" /> 首次測試建議
          </div>
          <ul className="space-y-0.5 pl-4">
            <li>① 先按「下載模型」等待三個模型都變成 ✅。</li>
            <li>② 按「啟動相機」並允許瀏覽器存取鏡頭。</li>
            <li>③ 按「測試模式」確認畫面能正確框住人臉。</li>
            <li>④ 按「建立 / 重建特徵」處理所有有照片的學生。</li>
            <li>⑤ 切換到「識別模式」即可自動比對並打卡。</li>
            <li>門檻 <code>{MATCH_DISTANCE_THRESHOLD}</code> 越低越嚴格。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── 子組件 ── */

function ModelBadge({
  name,
  status,
}: {
  name: string;
  status: "idle" | "loading" | "ready" | "error";
}) {
  const variant =
    status === "ready"
      ? "success"
      : status === "loading"
      ? "secondary"
      : status === "error"
      ? "destructive"
      : "outline";
  const label =
    status === "idle"
      ? "未下載"
      : status === "loading"
      ? "下載中…"
      : status === "ready"
      ? "就緒"
      : "失敗";
  return (
    <span className="inline-flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1">
      <span className="text-slate-700">{name}</span>
      <Badge variant={variant} className="text-[10px]">
        {label}
      </Badge>
    </span>
  );
}
