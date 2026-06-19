"use client";

import { useEffect } from "react";

const LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const KEY = "tok:lastActivity";

/**
 * Signs the user out after 30 minutes with no interaction. Deliberately quiet:
 * no countdowns or pop-ups — it just returns you to a friendly "signed out for
 * inactivity" login screen. Activity in any tab keeps every tab alive (shared
 * timestamp via localStorage).
 */
export function IdleTimeout() {
  useEffect(() => {
    let last = Date.now();
    let throttled = false;

    const mark = () => {
      last = Date.now();
      try {
        localStorage.setItem(KEY, String(last));
      } catch {
        /* private mode / storage disabled — in-memory timer still works */
      }
    };
    const onActivity = () => {
      if (throttled) return;
      throttled = true;
      window.setTimeout(() => (throttled = false), 5000);
      mark();
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    mark();

    const tick = window.setInterval(() => {
      try {
        const stored = Number(localStorage.getItem(KEY));
        if (stored) last = Math.max(last, stored); // honour other tabs
      } catch {
        /* ignore */
      }
      if (Date.now() - last >= LIMIT_MS) {
        window.location.href = "/auth/signout?error=idle";
      }
    }, 30000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(tick);
    };
  }, []);

  return null;
}
