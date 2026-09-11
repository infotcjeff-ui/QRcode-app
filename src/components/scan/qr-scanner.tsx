"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import { isValidUuid } from "@/lib/utils";

type Props = {
  onScan: (decodedText: string) => void;
};

const SCANNER_ELEMENT_ID = "scan-qr-reader";
const SCANBOX_SIZE = 280;

/**
 * QR Code 掃描器：
 *  - 內建啟動 / 停止按鈕
 *  - 永遠使用後置 (環境) 鏡頭
 *  - 沒有 reload / 切換鏡頭選項
 */
export function QrScanner({ onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const { toast } = useToast();

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */ || state === 1 /* PAUSED */) {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        }
      }
    } catch (err) {
      console.warn("[QrScanner] stop error", err);
    }
    setIsRunning(false);
  };

  const startScanner = async () => {
    if (typeof window === "undefined") return;
    setCameraError(null);
    setIsStarting(true);
    try {
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = instance;

      await instance.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: SCANBOX_SIZE, height: SCANBOX_SIZE },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (!isValidUuid(decodedText)) {
            toast({
              title: "QR Code 無效",
              description: "掃描內容並非學生 UUID。請使用有效的學生 QR Code。",
              variant: "destructive",
              duration: 3000,
            });
            return;
          }
          onScan(decodedText);
        },
        () => {
          // ignore decode errors
        }
      );

      setIsRunning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法啟動鏡頭";
      setCameraError(message);
      toast({
        title: "鏡頭啟動失敗",
        description: message,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (active && !isRunning && !cameraError) {
      void startScanner();
    } else if (!active && isRunning) {
      void stopScanner();
    }
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const handleToggle = async () => {
    if (active) {
      await stopScanner();
      setActive(false);
    } else {
      setActive(true);
    }
  };

  return (
    <>
      <style>{`
        #${SCANNER_ELEMENT_ID} {
          border: none !important;
          padding: 0 !important;
        }
        #${SCANNER_ELEMENT_ID} > div {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
        }
        #${SCANNER_ELEMENT_ID} > div img,
        #${SCANNER_ELEMENT_ID} > div video {
          border: none !important;
        }
        #${SCANNER_ELEMENT_ID} .qr-shaded-region {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          display: none !important;
        }
      `}</style>
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
            <div
              id={SCANNER_ELEMENT_ID}
              data-scanbox-size={SCANBOX_SIZE}
              className="relative h-full w-full"
            />
            {!isRunning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/95 text-slate-100">
                <CameraOff className="h-10 w-10 opacity-70" />
                <p className="text-sm font-medium">相機未啟動</p>
                <p className="px-6 text-center text-xs text-slate-300">
                  點擊下方「開始掃描」啟動相機
                </p>
                {cameraError ? (
                  <p className="px-4 text-center text-[10px] text-amber-300">{cameraError}</p>
                ) : null}
              </div>
            ) : null}
            {isRunning ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-lg border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
                  style={{ width: SCANBOX_SIZE, height: SCANBOX_SIZE }}
                />
              </div>
            ) : null}
          </div>

          <Button
            onClick={handleToggle}
            disabled={isStarting}
            className="mt-3 w-full"
            variant={active ? "destructive" : "default"}
            size="lg"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                啟動中…
              </>
            ) : active ? (
              <>
                <CameraOff className="mr-2 h-4 w-4" />
                停止掃描
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                開始掃描
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
