"use client";

import { useEffect } from "react";

// Registers /sw.js once on app load, on every page, so the Web Share Target works after install.
export default function RegisterSw() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
