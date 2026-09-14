"use client";

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
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** localStorage key 前綴 */
const FACE_DESCRIPTORS_KEY = "bus-face-descriptors";
/** face-api 模型 CDN URL — 使用 gh-pages 靜態資源（最穩定） */
const FACE_MODEL_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

type EnrolledRecord = {
  /** Unix ms timestamp，記錄何時建立/更新 */
  enrolledAt: number;
  /** face-api 產生的 128 維 Float32Array 轉成普通 number[] */
  descriptor: number[];
};

type Props = {
  studentId: string;
  studentName: string;
  /** 外層可讀取目前是否已 Enroll（由父層管理顯示狀態） */
  onEnrollStatusChange?: (enrolled: boolean) => void;
};

/**
 * 人臉註冊元件：
 *  - 嵌入 EditStudentDialog，供管理員直接拍攝學生人臉
 *  - 使用 face-api 提取 128 維 descriptor，存入 localStorage
 *  - 讀取 / 寫入共用同一個 localStorage key，避免重複 Enroll
 *
 * Storage key: `bus-face-descriptors` → Map<studentId, EnrolledRecord>
 */
export function FaceEnrollment({ studentId, studentName, onEnrollStatusChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [faceApi, setFaceApi] = useState<typeof import("@vladmandic/face-api") | null>(null);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [camState, setCamState] = useState<"idle" | "requesting" | "active" | "denied" | "error">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false); // 正在取樣中
  const [sampleCount, setSampleCount] = useState(0); // 已取樣張數
  const [detected, setDetected] = useState(false); // 相機內是否有人臉
  const [previewBox, setPreviewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // ── 初始化：載入 face-api SDK ─────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@vladmandic/face-api");
        if (mounted) setFaceApi(mod);
      } catch (e) {
        console.error("[FaceEnrollment] SDK load failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 卸載清理 ────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ── 讀取 localStorage 確認是否已 Enroll ──────────────
  useEffect(() => {
    const stored = loadDescriptors();
    const record = stored.get(studentId);
    const isEnrolled = !!record;
    setEnrolled(isEnrolled);
    onEnrollStatusChange?.(isEnrolled);
  }, [studentId, onEnrollStatusChange]);

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
    setPreviewBox(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // 前鏡頭自拍
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

      // 模型還沒下載 → 自動下載
      if (modelStatus === "idle") {
        void loadModels();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "無法啟動相機";
      setCamError(msg);
      setCamState(msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission") ? "denied" : "error");
    }
  }, [modelStatus]);

  // ── 下載 face-api 模型 ────────────────────────────────
  const loadModels = useCallback(async () => {
    if (!faceApi) return;
    setModelStatus("loading");
    try {
      await faceApi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_BASE_URL);
      await faceApi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_BASE_URL);
      await faceApi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_BASE_URL);
      setModelStatus("ready");
    } catch (e) {
      console.error("[FaceEnrollment] model load failed", e);
      setModelStatus("error");
    }
  }, [faceApi]);

  // ── 拍攝並 Enroll ───────────────────────────────────
  // 對同一人取 3 次樣取平均，提升準確度
  const CAPTURE_SAMPLES = 3;
  const descriptors: Float32Array[] = [];

  const captureAndEnroll = useCallback(async () => {
    if (!faceApi || !videoRef.current || modelStatus !== "ready") return;

    setEnrolling(true);
    setSampleCount(0);
    descriptors.length = 0;

    const video = videoRef.current;
    const detectorOptions = new faceApi.TinyFaceDetectorOptions({
      inputSize: 320, // 輸入越小越快，default 416
      scoreThreshold: 0.3, // 放寬門檻，增加偵測成功率
    });

    const tick = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      try {
        const results = await faceApi
          .detectAllFaces(video, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (results.length > 0) {
          const r = results[0];
          // 繪製偵測框
          drawPreview(r.detection.box);
          setDetected(true);

          if (descriptors.length < CAPTURE_SAMPLES) {
            // 自動取樣：每隔 0.5s 取一張
            descriptors.push(r.descriptor);
            setSampleCount(descriptors.length);
            if (descriptors.length === CAPTURE_SAMPLES) {
              // 取樣完成 → 平均 → 存 localStorage
              cancelAnimationFrame(rafRef.current!);
              rafRef.current = null;
              const avg = averageDescriptors(descriptors);
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
          setPreviewBox(null);
        }
      } catch {
        // 忽略單幀失敗
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [faceApi, modelStatus, studentId, onEnrollStatusChange, stopCamera]);

  const cancelEnrollment = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setEnrolling(false);
    setSampleCount(0);
    descriptors.length = 0;
    setDetected(false);
    setPreviewBox(null);
  }, []);

  const deleteEnrollment = useCallback(() => {
    removeDescriptor(studentId);
    setEnrolled(false);
    onEnrollStatusChange?.(false);
  }, [studentId, onEnrollStatusChange]);

  // ── Canvas 繪製偵測框 ────────────────────────────────
  function drawPreview(box: { x: number; y: number; width: number; height: number }) {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 同步 canvas 大小
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 偵測框
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // 標籤
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 12px sans-serif";
    const label = `${studentName} (取樣 ${sampleCount}/${CAPTURE_SAMPLES})`;
    const textW = ctx.measureText(label).width;
    ctx.fillRect(box.x, box.y - 20, textW + 8, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, box.x + 4, box.y - 6);

    setPreviewBox({ x: box.x, y: box.y, w: box.width, h: box.height });
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

  return (
    <div className="space-y-3">
      {/* ── 狀態列 ── */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-700">人臉辨識</span>
        </div>
        {enrolled ? (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="mr-1 h-3 w-3" /> 已註冊
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">未註冊</Badge>
        )}
      </div>

      {/* ── 已註冊狀態 → 顯示操作 ── */}
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
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!faceApi) {
                  const mod = await import("@vladmandic/face-api");
                  setFaceApi(mod);
                }
                await startCamera();
              }}
              className="flex-1"
            >
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

      {/* ── 相機預覽 ── */}
      {!enrolled && (
        <div className="space-y-2">
          {/* 模型狀態提示 */}
          {modelStatus === "error" ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>模型下載失敗（需 HTTPS）。請使用 <code>npm run dev:tunnel</code> 或部署後操作。</span>
            </div>
          ) : modelStatus === "idle" || modelStatus === "loading" ? (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">
              {modelStatus === "loading" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ScanFace className="h-3 w-3" />
              )}
              {modelStatus === "loading" ? "下載模型中…" : "按下啟動相機後將自動下載模型"}
            </div>
          ) : null}

          {/* 預覽區 */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
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
            {!isCamActive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/90 text-slate-100">
                <CameraOff className="h-6 w-6 opacity-60" />
                <p className="text-xs">相機未啟動</p>
              </div>
            ) : null}
          </div>

          {/* 相機控制列 */}
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
                {/* 取樣進度 */}
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(sampleCount / CAPTURE_SAMPLES) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">
                    {sampleCount}/{CAPTURE_SAMPLES}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEnrollment}
                  className="shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopCamera}
                  className="shrink-0"
                >
                  <CameraOff className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={captureAndEnroll}
                  disabled={modelStatus !== "ready" || !isCamActive}
                >
                  <Camera className="mr-1 h-3 w-3" />
                  拍攝人臉
                </Button>
              </>
            )}
          </div>

          {/* 操作提示 */}
          {!enrolling && isCamActive && (
            <p className="text-center text-[10px] text-slate-400">
              {modelStatus === "ready"
                ? "✅ 請讓學生面向鏡頭，系統會自動取樣 3 張"
                : modelStatus === "loading"
                ? "模型下載完成後自動開始取樣…"
                : "等待相機啟動…"}
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
