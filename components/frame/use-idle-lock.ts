"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lockSessionAction } from "@/app/actions/session-lock.actions";
import { IDLE_LOCK_MS, IDLE_WARNING_MS } from "@/lib/frame/session-policy";

const ACTIVITY_KEY = "aakash.lastActivity";
const LOCKED_KEY = "aakash.locked";
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

function readShared(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage blocked: the lock still works per tab
  }
}

/**
 * Locks the session after IDLE_LOCK_MS without input in ANY tab (activity is
 * shared through localStorage, timestamps only). The lock itself is enforced
 * on the server (signed session flag + route guard); this hook only decides
 * when to ask for it.
 */
export function useIdleLock(enabled: boolean) {
  const lastActivity = useRef(0);
  const locking = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const lockNow = useCallback(async () => {
    if (locking.current) return;
    locking.current = true;
    try {
      await lockSessionAction();
    } finally {
      writeShared(LOCKED_KEY, Date.now());
      const returnTo = window.location.pathname;
      // Full navigation on purpose: drops all client-side data from memory
      // and picks up the locked session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/locked?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    lastActivity.current = Date.now();
    writeShared(ACTIVITY_KEY, lastActivity.current);
    let lastWrite = 0;

    const onActivity = () => {
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastWrite > 5000) {
        lastWrite = now;
        writeShared(ACTIVITY_KEY, now);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCKED_KEY && e.newValue) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/locked?returnTo=${encodeURIComponent(window.location.pathname)}`);
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      const latest = Math.max(lastActivity.current, readShared(ACTIVITY_KEY));
      const remaining = IDLE_LOCK_MS - (Date.now() - latest);
      if (remaining <= 0) {
        setCountdown(null);
        void lockNow();
      } else if (remaining <= IDLE_WARNING_MS) {
        setCountdown(Math.ceil(remaining / 1000));
      } else {
        setCountdown((c) => (c === null ? c : null));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [enabled, lockNow]);

  return { lockNow: enabled ? lockNow : undefined, countdown: enabled ? countdown : null };
}
