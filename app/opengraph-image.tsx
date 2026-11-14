// Link-preview image (1200×630) for WhatsApp, LinkedIn, X. Built at request/build time by Next's ImageResponse
// with its default font only: nothing is fetched at runtime, so it cannot fail on a font download.
// The default font (Geist) has no Devanagari, and a Devanagari glyph would make ImageResponse download a font
// from Google at request time, so "अर्थ" is deliberately not drawn here (Latin text and shapes only).
import { ImageResponse } from "next/og";

export const alt = "Arth: know what it means before you sign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#FBF6EC";
const INK = "#1F2A44";
const MUTED = "#5B6479";
const SAFFRON = "#E8890C";
const BORDER = "#EADFCB";

const Tick = ({ color }: { color: string }) => (
  <svg width="40" height="40" viewBox="0 0 24 24">
    <path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Cross = ({ color }: { color: string }) => (
  <svg width="36" height="36" viewBox="0 0 24 24">
    <path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
  </svg>
);

function Status({ mark, color, bg }: { mark: React.ReactNode; color: string; bg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 76,
        height: 76,
        borderRadius: 38,
        background: bg,
        border: `4px solid ${color}`,
        color,
        fontSize: 44,
        fontWeight: 700,
      }}
    >
      {mark}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: CREAM,
          color: INK,
          border: `16px solid ${BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ fontSize: 168, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>Arth</div>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: SAFFRON, marginBottom: 22 }} />
        </div>
        <div style={{ fontSize: 40, color: MUTED, marginTop: 28 }}>Know what it means before you sign.</div>
        <div style={{ display: "flex", gap: 20, marginTop: 56 }}>
          {/* drawn shapes instead of emoji, so the image needs no emoji or symbol font */}
          <Status mark={<Tick color="#15803D" />} color="#15803D" bg="#ECFDF3" />
          <Status mark={<Cross color="#B91C1C" />} color="#B91C1C" bg="#FEF2F2" />
          <Status mark="?" color="#64748B" bg="#F1F5F9" />
        </div>
      </div>
    ),
    size,
  );
}
