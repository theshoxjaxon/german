/**
 * Small client-only hooks built on useSyncExternalStore, so the first client render
 * matches the server HTML and the browser-only value arrives right after hydration.
 */
import { useCallback, useSyncExternalStore } from 'react';

/* ---------- a clock that ticks every 15 s ---------- */
let now = 0;
const clockSubs = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

/** Refresh the clock now (after a review session, or when the tab becomes visible). */
export function tick() {
  now = Date.now();
  clockSubs.forEach((fn) => fn());
}
function subscribeClock(fn: () => void) {
  clockSubs.add(fn);
  now = Date.now();
  clockTimer ??= setInterval(tick, 15_000);
  return () => {
    clockSubs.delete(fn);
    if (!clockSubs.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
/** Current time in ms; 0 on the server. Changes every 15 s. */
export const useNow = () => useSyncExternalStore(subscribeClock, () => now, () => 0);

/* ---------- state remembered in localStorage (per device) ---------- */
const cache = new Map<string, unknown>();
const localSubs = new Set<() => void>();
const subscribeLocal = (fn: () => void) => {
  localSubs.add(fn);
  return () => {
    localSubs.delete(fn);
  };
};

function readLocal<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  if (!cache.has(key)) {
    let value: unknown = fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw);
        if (valid(parsed)) value = parsed;
      }
    } catch {
      /* storage blocked or bad JSON: use the fallback */
    }
    cache.set(key, value);
  }
  return cache.get(key) as T;
}

/** Like useState, but remembered on this device. `fallback` must be a stable constant. */
export function useLocalState<T>(key: string, fallback: T, valid: (v: unknown) => boolean = () => true): [T, (v: T) => void] {
  const value = useSyncExternalStore(subscribeLocal, () => readLocal(key, fallback, valid), () => fallback);
  const set = useCallback(
    (v: T) => {
      cache.set(key, v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
      localSubs.forEach((fn) => fn());
    },
    [key],
  );
  return [value, set];
}

/* ---------- browser feature checks ---------- */
const noopSubscribe = () => () => {};
export const useClientValue = <T,>(get: () => T, serverValue: T) => useSyncExternalStore(noopSubscribe, get, () => serverValue);
