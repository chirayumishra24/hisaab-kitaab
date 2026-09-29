"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Helpers for the Android app, which is a Capacitor shell around this site.
 * The `native` class on <html> is set before first paint by the boot script in
 * app/layout.tsx, so it is the single source of truth here.
 */

type SystemBarsPlugin = { setStyle(options: { style: "DARK" | "LIGHT" | "DEFAULT"; bar?: string }): Promise<void> };
type CapacitorGlobal = { Plugins?: { SystemBars?: SystemBarsPlugin } };

export function isNativeApp(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("native");
}

const noopSubscribe = () => () => undefined;

/** True inside the Android app. Always false during SSR and the first hydration pass. */
export function useNativeApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isNativeApp, () => false);
}

/**
 * Status bar icon colour. "DARK" means a dark background behind the bar, so the
 * icons turn light. No-op outside the app.
 */
export function useStatusBarStyle(style: "DARK" | "DEFAULT") {
  useEffect(() => {
    if (!isNativeApp()) return;
    const bars = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.Plugins?.SystemBars;
    if (!bars) return;
    bars.setStyle({ style, bar: "StatusBar" }).catch(() => undefined);
    return () => {
      bars.setStyle({ style: "DEFAULT", bar: "StatusBar" }).catch(() => undefined);
    };
  }, [style]);
}
