// LoanLens service worker: ONLY receives a file shared to the app (Web Share Target).
// The file stays on the phone: it is parked in the Cache API for one page load, then deleted by /paper.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share-target") return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.get("file");
        if (file && typeof file === "object" && "arrayBuffer" in file) {
          const cache = await caches.open("loanlens-shared");
          await cache.put(
            "/shared-file",
            new Response(file, { headers: { "Content-Type": file.type || "application/octet-stream" } }),
          );
          return Response.redirect("/paper?shared=1", 303);
        }
      } catch {
        /* fall through to the file-picker fallback */
      }
      return Response.redirect("/paper?shared=failed", 303);
    })(),
  );
});
