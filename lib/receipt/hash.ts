// SHA-256 fingerprints with the Web Crypto API (crypto.subtle). Not AI; works in browsers and Node 20+.
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const buf =
    data instanceof Blob ? await data.arrayBuffer() : data instanceof Uint8Array ? data.slice().buffer : data.slice(0);
  const digest = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
