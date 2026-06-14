"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable + works offline. */
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore registration errors */
      });
    }
  }, []);
  return null;
}
