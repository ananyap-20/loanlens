import { NextResponse } from "next/server";

// Normally public/sw.js answers the share POST in the browser. If the service worker is not active
// yet, the POST reaches here: send the user to the app, whose paper step has the file picker fallback.
// The shared file is NOT read or stored by the server.
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/?shared=failed", request.url), 303);
}
