"use client";

/**
 * 人臉註冊元件（使用 FaceApiContext 共享模型）
 *
 * 使用流程：
 *  1. 掛載時從 localStorage 讀取是否已 Enroll
 *  2. 啟動相機後使用 context 已預載入的模型，無需重複下載
 *  3. 取樣 3 張後平均，取出 128 維 descriptor 存入 localStorage
 *  4. FaceTab 啟動時自動從 localStorage 讀取，命中後打卡
 *
 * Storage key: `bus-face-descriptors` → Map<studentId, EnrolledRecord>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanFace,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFaceApi } from "@/lib/face-api-context";

const FACE_DESCRIPTORS_KEY = "bus-face-descriptors";

type EnrolledRecord = {
  enrolledAt: number;
  descriptor: number[];
};

type Props = {
  studentId: string;
  studentName: string;
  onEnrollStatusChange?: (enrolled: boolean) => void;
};

type RawDetection = {
  detection: { box: { x: number; y: number; width: number; height: number } };
  descriptor?: Float32Array;
};

export function FaceEnrollment({ studentId, studentName, onEnrollStatusChange }: Props) {
  const { sdk, modelState, allReady, anyError, isLoading, preload } = useFaceApi();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [camState, setCamState] = useState<"idle" | "requesting" | "active" | "denied" | "error">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [detected, setDetected] = useState(false);

  const CAPTURE_SAMPLES = 3;
  const descriptorsRef = useRef<Float32Array[]>([]);

  // ── 讀取 localStorage ──────────────────────────────
  useEffect(() => {
    const stored = loadDescriptors();
    const isEnrolled = stored.has(studentId);
    setEnrolled(isEnrolled);
    onEnrollStatusChange?.(isEnrolled);
  }, [studentId, onEnrollStatusChange]);

  // ── 卸載清理 ────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
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
    setDetected(false);
  }, []);

  // ── 啟動相機 ────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamState("error");
      setCamError("此裝置不支援相機");
      return;
    }
    setCamState("requesting");
    setCamError(null);
    try {
      // 模型若尚未開始下載，先觸發一次（提前預熱）
      preload();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 320 },
          height: { ideal: 240 },
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

  // ── 拍攝取樣 + 存入 localStorage ─────────────────────
  const captureAndEnroll = useCallback(async () => {
    if (!sdk || !videoRef.current || !allReady) return;

    setEnrolling(true);
    setSampleCount(0);
    descriptorsRef.current = [];

    const video = videoRef.current;
    const detectorOptions = new sdk.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.3,
    });

    const tick = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      try {
        const task = sdk.detectAllFaces(video, detectorOptions).withFaceLandmarks().withFaceDescriptors() as unknown as Promise<RawDetection[]>;
        const results = await task;

        if (results && results.length > 0) {
          const r = results[0];
          drawPreview(r.detection.box);
          setDetected(true);

          if (descriptorsRef.current.length < CAPTURE_SAMPLES) {
            const desc = r.descriptor;
            if (desc) descriptorsRef.current.push(desc);
            setSampleCount(descriptorsRef.current.length);

            if (descriptorsRef.current.length === CAPTURE_SAMPLES) {
              cancelAnimationFrame(rafRef.current!);
              rafRef.current = null;
              const avg = averageDescriptors(descriptorsRef.current);
              saveDescriptor(studentId, avg);
              setEnrolled(true);
              onEnrollStatusChange?.(true);
              setEnrolling(false);
              stopCamera();
              return;
            }
          }
        } else {
          setDetected(false);
          clearCanvas();
        }
      } catch {
        // 忽略單幀失敗
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [sdk, allReady, studentId, onEnrollStatusChange, stopCamera]);

  const cancelEnrollment = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setEnrolling(false);
    setSampleCount(0);
    descriptorsRef.current = [];
    setDetected(false);
    clearCanvas();
  }, []);

  const deleteEnrollment = useCallback(() => {
    removeDescriptor(studentId);
    setEnrolled(false);
    onEnrollStatusChange?.(false);
  }, [studentId, onEnrollStatusChange]);

  // ── Canvas helpers ──────────────────────────────────
  function clearCanvas() {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth || 320;
    canvasRef.current.height = videoRef.current.videoHeight || 240;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function drawPreview(box: { x: number; y: number; width: number; height: number }) {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 12px sans-serif";
    const label = `${studentName} (取樣 ${sampleCount}/${CAPTURE_SAMPLES})`;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(box.x, box.y - 20, tw + 8, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, box.x + 4, box.y - 6);
  }

  // ── Descriptor 平均 ─────────────────────────────────
  function averageDescriptors(arrays: Float32Array[]): number[] {
    const dim = arrays[0].length;
    const result: number[] = Array(dim).fill(0);
    for (const arr of arrays) {
      for (let i = 0; i < dim; i++) result[i] += arr[i];
    }
    for (let i = 0; i < dim; i++) result[i] /= arrays.length;
    return result;
  }

  // ── localStorage helpers ──────────────────────────────
  function loadDescriptors(): Map<string, EnrolledRecord> {
    if (typeof window === "undefined") return new Map();
    try {
      const raw = window.localStorage.getItem(FACE_DESCRIPTORS_KEY);
      if (!raw) return new Map();
      const obj = JSON.parse(raw) as Record<string, EnrolledRecord>;
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  function saveDescriptor(sid: string, descriptor: number[]) {
    const map = loadDescriptors();
    map.set(sid, { enrolledAt: Date.now(), descriptor });
    try {
      window.localStorage.setItem(FACE_DESCRIPTORS_KEY, JSON.stringify(Object.fromEntries(map)));
    } catch (e) {
      console.error("[FaceEnrollment] localStorage write failed", e);
    }
  }

  function removeDescriptor(sid: string) {
    const map = loadDescriptors();
    map.delete(sid);
    try {
      window.localStorage.setItem(FACE_DESCRIPTORS_KEY, JSON.stringify(Object.fromEntries(map)));
    } catch {}
  }

  const isCamActive = camState === "active";

  // ── 提前下載模型按鈕（可隨時呼叫）───────────────────
  const handlePreload = useCallback(() => {
    preload();
  }, [preload]);

  return (
    <div className="space-y-2">
      {/* 狀態列 */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-700">人臉辨識</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 提前下載按鈕 */}
          {!allReady && !anyError && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-700"
              onClick={handlePreload}
              disabled={isLoading || !sdk}
              title="提前下載模型，加快日後使用速度"
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              {isLoading ? "下載中…" : "預載模型"}
            </Button>
          )}
          {enrolled ? (
            <Badge variant="success" className="text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" /> 已註冊
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">未註冊</Badge>
          )}
        </div>
      </div>

      {/* ── 已註冊 → 顯示操作 ── */}
      {enrolled ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <strong>{studentName}</strong> 的人臉特徵已註冊。
              前往「打卡 → 人臉」Tab 即可使用人臉打卡。
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={startCamera} className="flex-1">
              <RefreshCw className="mr-1 h-3 w-3" /> 重新拍攝
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={deleteEnrollment}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="mr-1 h-3 w-3" /> 移除
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── 未註冊 → 相機預覽 ── */}
      {!enrolled && (
        <div className="space-y-2">
          {/* 模型 / 相機狀態提示 */}
          {anyError ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>模型下載失敗（需 HTTPS）。請使用 <code>npm run dev:tunnel</code> 或部署後操作。</span>
            </div>
          ) : !sdk ? (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              載入 face-api SDK 中…
            </div>
          ) : !allReady && !isLoading ? (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">
              <RefreshCw className="h-3 w-3" />
              按「預載模型」可提前下載，節省相機啟動時間
            </div>
          ) : null}

          {/* 預覽區 */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
            {!isCamActive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/90 text-slate-100">
                <CameraOff className="h-6 w-6 opacity-60" />
                <p className="text-xs">相機未啟動</p>
              </div>
            ) : null}
          </div>

          {/* 控制列 */}
          <div className="flex items-center gap-2">
            {!isCamActive ? (
              <Button
                size="sm"
                onClick={startCamera}
                disabled={camState === "requesting"}
                className="flex-1"
              >
                {camState === "requesting" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="mr-1 h-3 w-3" />
                )}
                啟動相機
              </Button>
            ) : enrolling ? (
              <>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(sampleCount / CAPTURE_SAMPLES) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 whitespace-nowrap">
                    {sampleCount}/{CAPTURE_SAMPLES}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={cancelEnrollment} className="shrink-0">
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={stopCamera} className="shrink-0">
                  <CameraOff className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={captureAndEnroll}
                  disabled={!allReady}
                >
                  <Camera className="mr-1 h-3 w-3" />
                  拍攝人臉
                </Button>
              </>
            )}
          </div>

          {/* 提示文字 */}
          {!enrolling && isCamActive && (
            <p className="text-center text-[10px] text-slate-400">
              {allReady
                ? "✅ 請讓學生面向鏡頭，系統會自動取樣 3 張"
                : "等待模型下載完成…"}
            </p>
          )}
          {enrolling && (
            <p className="text-center text-[10px] text-emerald-600">
              {detected
                ? `✅ 偵測到人臉，正在取樣… 請保持姿勢不動`
                : "⚠️ 未偵測到人臉，請調整角度或光線"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
