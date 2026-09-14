"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { getSavedLang, nextLang, type SupportedLang } from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 套用已儲存的語言
    const saved = getSavedLang();
    if (i18n.language !== saved) {
      i18n.changeLanguage(saved);
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/* -------------------------------------------------------------------------- */
/*  Language cycling utility                                                   */
/* -------------------------------------------------------------------------- */

/** 切換到下一個語言，並 reload 頁面 */
export function cycleLanguage() {
  const current = (i18n.language ?? "zh-HK") as SupportedLang;
  const next = nextLang(current);
  applyLanguage(next);
}

/** 切換到指定語言，並 reload 頁面 */
export function setLanguage(target: SupportedLang) {
  applyLanguage(target);
}

function applyLanguage(target: SupportedLang) {
  i18n.changeLanguage(target);
  try {
    window.localStorage.setItem("bus-profile-lang", target);
  } catch {
    /* ignore */
  }
  // Reload 確保整個 UI 重新 render
  window.location.reload();
}
