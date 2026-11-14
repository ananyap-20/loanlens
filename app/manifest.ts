import type { MetadataRoute } from "next";

// Web Share Target: after install, "Arth" appears in the Android share sheet for PDFs/images
// (for example a KFS PDF sent on WhatsApp). public/sw.js receives the POST and opens /paper.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arth",
    short_name: "Arth",
    description: "Proof of understanding, alongside the signature.",
    start_url: "/",
    display: "standalone",
    background_color: "#1f2a44", // launch screen = the icon's navy (--color-ink), so the icon blends in
    theme_color: "#1f2a44",
    icons: [
      { src: "/arth-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/arth-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "file", accept: ["application/pdf", ".pdf", "image/*"] }] },
    },
  };
}
