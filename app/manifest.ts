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
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "file", accept: ["application/pdf", ".pdf", "image/*"] }] },
    },
  };
}
