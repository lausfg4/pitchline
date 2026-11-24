"use client";

import { useSyncExternalStore } from "react";

let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  now = Date.now();
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach(notify => notify());
  }, 30_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => now;
const serverSnapshot = () => null;

// Shared wall clock for age labels, the calendar and provider-supplied clock anchors.
export function useClientClock() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
