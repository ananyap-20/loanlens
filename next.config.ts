import type { NextConfig } from "next";

/** Sent with every response. No full CSP (it would have to allow Next's inline scripts); frame-ancestors only. */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" }, // no other site may show Arth inside a frame (clickjacking)
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Microphone for recording, camera for the QR scan: Arth only. Nothing else.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=()" },
];

/** Developer test pages: usable under `next dev`, "not found" on the live site. */
export const DEV_ONLY_PAGES = ["/smoke", "/paper"];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    if (process.env.NODE_ENV === "development") return { beforeFiles: [] };
    return { beforeFiles: DEV_ONLY_PAGES.map((source) => ({ source, destination: "/not-available" })) };
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
