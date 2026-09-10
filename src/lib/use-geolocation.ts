"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeoState = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error: string | null;
};

const INITIAL: GeoState = {
  lat: null,
  lng: null,
  accuracy: null,
  timestamp: null,
  error: null,
};

type Options = {
  /** 自動更新間隔（毫秒）。設為 0 則只取一次。預設 30000ms（30 秒）。 */
  watchIntervalMs?: number;
};

/**
 * 取得瀏覽器地理位置。
 *  - 自動偵測 HTTPS / 非安全環境。
 *  - 在 insecure context 下會立即回傳 error，避免長時間 spinner。
 *  - 使用 watchPosition 持續追蹤，可選擇性週期性重新整理位置。
 */
export function useGeolocation(options: Options = {}) {
  const { watchIntervalMs = 30000 } = options;
  const [state, setState] = useState<GeoState>(INITIAL);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const requestOnce = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, error: "此裝置不支援定位功能" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          error: null,
        }),
      (err) => setState((s) => ({ ...s, error: err.message || "無法取得位置" })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ ...INITIAL, error: "此裝置不支援定位功能" });
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setState({ ...INITIAL, error: "需要 HTTPS 才能取得 GPS 位置" });
      return;
    }

    // 初次取得
    requestOnce();

    // 持續追蹤
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          error: null,
        }),
      (err) => setState((s) => ({ ...s, error: err.message || "無法取得位置" })),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    if (watchIntervalMs > 0) {
      intervalRef.current = setInterval(() => requestOnce(), watchIntervalMs);
    }

    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refresh: requestOnce };
}
