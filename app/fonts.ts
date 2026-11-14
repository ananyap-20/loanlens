// Fonts via next/font (downloaded at BUILD time and served from our own domain; nothing is fetched from Google
// when the app runs). Poppins for Latin text and numbers, Noto Sans Devanagari for Hindi/Marathi.
// The Beta-language scripts get their matching Noto Sans family so their names never show as empty boxes.
// Each family only covers its own script (unicode-range), so a phone downloads a Beta font only when that
// script is actually on screen; they are not preloaded.
import {
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Poppins,
} from "next/font/google";

export const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-poppins" });
export const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-devanagari",
});

const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], display: "swap", preload: false, variable: "--font-bengali" });
const gujarati = Noto_Sans_Gujarati({ subsets: ["gujarati"], display: "swap", preload: false, variable: "--font-gujarati" });
const gurmukhi = Noto_Sans_Gurmukhi({ subsets: ["gurmukhi"], display: "swap", preload: false, variable: "--font-gurmukhi" });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], display: "swap", preload: false, variable: "--font-kannada" });
const malayalam = Noto_Sans_Malayalam({ subsets: ["malayalam"], display: "swap", preload: false, variable: "--font-malayalam" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], display: "swap", preload: false, variable: "--font-tamil" });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], display: "swap", preload: false, variable: "--font-telugu" });

/** All font CSS variables, for the <html> element. */
export const fontVariables = [poppins, devanagari, bengali, gujarati, gurmukhi, kannada, malayalam, tamil, telugu]
  .map((f) => f.variable)
  .join(" ");
