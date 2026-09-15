"use client";

/**
 * face-api 全域共享 Context
 *
 * 目的：整個應用程式只下載一次模型，所有元件共享同一份 SDK 狀態，
 * 避免 FaceEnrollment 和 FaceTab 各自下載模型，造成重複下載及等待。
 *
 * 用法：
 *   import { FaceApiProvider, useFaceApi } from "@/lib/face-api-context";
 *
 *   // 包住整個 admin 或 scan-in 區塊
 *   <FaceApiProvider>...</FaceApiProvider>
 *
 *   // 任何子元件
 *   const { sdk, modelState, allReady } = useFaceApi();
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** face-api 模型 CDN URL */
const FACE_MODEL_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

type ModelKey = "tinyFaceDetector" | "faceLandmark68Net" | "faceRecognitionNet";

type ModelState = {
  [K in ModelKey]: "idle" | "loading" | "ready" | "error";
};

type ContextValue = {
  /** face-api SDK（載入後可用） */
  sdk: typeof import("@vladmandic/face-api") | null;
  /** 三個模型各自的下載狀態 */
  modelState: ModelState;
  /** 是否有任何模型載入失敗 */
  anyError: boolean;
  /** 三個模型全部就緒 */
  allReady: boolean;
  /** 正在下載中（任一模型處於 loading） */
  isLoading: boolean;
  /** 手動觸發下載（可在任何時候呼叫，提前預熱） */
  preload: () => void;
};

const FaceApiContext = createContext<ContextValue | null>(null);

/** 提供給外層包住的元件 */
export function FaceApiProvider({ children }: { children: React.ReactNode }) {
  const [sdk, setSdk] = useState<typeof import("@vladmandic/face-api") | null>(null);
  const [modelState, setModelState] = useState<ModelState>({
    tinyFaceDetector: "idle",
    faceLandmark68Net: "idle",
    faceRecognitionNet: "idle",
  });
  const startedRef = useRef(false);
  const [sdkLoading, setSdkLoading] = useState(false);

  // ── 載入 SDK（只執行一次）────────────────────────────
  useEffect(() => {
    if (sdk || sdkLoading) return;
    setSdkLoading(true);
    let alive = true;
    (async () => {
      try {
        const mod = await import("@vladmandic/face-api");
        if (alive) {
          setSdk(mod);
        }
      } catch (e) {
        console.error("[FaceApiContext] SDK load failed", e);
      } finally {
        if (alive) setSdkLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sdk, sdkLoading]);

  // ── 自動下載模型（SDK 就緒後觸發，確保只觸發一次）────
  useEffect(() => {
    if (!sdk || startedRef.current) return;
    startedRef.current = true;
    void preloadModels(sdk, setModelState);
  }, [sdk]);

  const preload = useCallback(() => {
    if (!sdk) return;
    if (startedRef.current) return; // 已觸發過就跳過
    startedRef.current = true;
    void preloadModels(sdk, setModelState);
  }, [sdk]);

  const anyError =
    modelState.tinyFaceDetector === "error" ||
    modelState.faceLandmark68Net === "error" ||
    modelState.faceRecognitionNet === "error";

  const allReady =
    modelState.tinyFaceDetector === "ready" &&
    modelState.faceLandmark68Net === "ready" &&
    modelState.faceRecognitionNet === "ready";

  const isLoading =
    modelState.tinyFaceDetector === "loading" ||
    modelState.faceLandmark68Net === "loading" ||
    modelState.faceRecognitionNet === "loading";

  return (
    <FaceApiContext.Provider
      value={{ sdk, modelState, anyError, allReady, isLoading, preload }}
    >
      {children}
    </FaceApiContext.Provider>
  );
}

/** 供子元件取用的 Hook */
export function useFaceApi(): ContextValue {
  const ctx = useContext(FaceApiContext);
  if (!ctx) {
    throw new Error("useFaceApi must be used within <FaceApiProvider>");
  }
  return ctx;
}

/** 依序下載三個模型 */
async function preloadModels(
  faceApi: typeof import("@vladmandic/face-api"),
  setState: React.Dispatch<React.SetStateAction<ModelState>>
) {
  const models: Array<{ key: ModelKey; loader: () => Promise<void> }> = [
    {
      key: "tinyFaceDetector",
      loader: () => faceApi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_BASE_URL),
    },
    {
      key: "faceLandmark68Net",
      loader: () => faceApi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_BASE_URL),
    },
    {
      key: "faceRecognitionNet",
      loader: () => faceApi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_BASE_URL),
    },
  ];

  for (const m of models) {
    try {
      setState((s) => ({ ...s, [m.key]: "loading" }));
      await m.loader();
      setState((s) => ({ ...s, [m.key]: "ready" }));
    } catch (e) {
      console.error(`[FaceApiContext] ${m.key} load failed`, e);
      setState((s) => ({ ...s, [m.key]: "error" }));
    }
  }
}
