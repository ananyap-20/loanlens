"use client";

// Selected language pack + voice gender, remembered for this browser session only (sessionStorage).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { preloadSpeech, setStaticKey, setVoiceConfig, warmUp } from "@/lib/audio/voice";
import { staticKeyFor } from "@/lib/audio/staticAudio";
import { getPack, voiceFor, type LangPack, type VoiceGender } from "@/lib/i18n";

type Pack = ReturnType<typeof getPack>;
type Lang = {
  pack: Pack;
  gender: VoiceGender;
  setLang: (code: string) => void;
  setGender: (g: VoiceGender) => void;
  /** Prisma language_code for this pack; undefined for Hindi = the route's verified default. */
  prismaLanguage: string | undefined;
};

const Ctx = createContext<Lang | null>(null);
const KEY = "loanlens.lang";

function read(): { code: string; gender: VoiceGender } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(code: string, gender: VoiceGender) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, gender }));
  } catch {
    /* private mode: session-only memory still works */
  }
}

/** Points Timbre at the pack's voice. Hindi + female sends nothing extra (server default = Nalini, hi-IN). */
export function applyVoice(pack: LangPack, gender: VoiceGender) {
  const v = voiceFor(pack, gender);
  if (pack.code === "hi" && gender === "female") setVoiceConfig({});
  else setVoiceConfig({ voice: v.voice, language: pack.timbre.language });
  setStaticKey(staticKeyFor(pack.code, v.gender)); // which pre-generated clips match this voice
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState("hi");
  const [gender, setGenderState] = useState<VoiceGender>("female");

  useEffect(() => {
    warmUp(); // wake the API routes and load the static clip list while the person reads the screen
    const saved = read();
    if (!saved) {
      preloadSpeech([getPack("hi").greeting, getPack("hi").say.who]);
      return;
    }
    applyVoice(getPack(saved.code), saved.gender);
    preloadSpeech([getPack(saved.code).greeting, getPack(saved.code).say.who]);
    queueMicrotask(() => {
      setCode(getPack(saved.code).code);
      setGenderState(saved.gender);
    });
  }, []);

  const setLang = useCallback(
    (c: string) => {
      const p = getPack(c);
      applyVoice(p, gender);
      preloadSpeech([p.say.who, p.say.paper]); // the screens after the language tap
      setCode(p.code);
      write(p.code, gender);
    },
    [gender],
  );
  const setGender = useCallback(
    (g: VoiceGender) => {
      const p = getPack(code);
      const actual = voiceFor(p, g).gender;
      applyVoice(p, actual);
      setGenderState(actual);
      write(p.code, actual);
    },
    [code],
  );

  const value = useMemo(() => {
    const pack = getPack(code);
    return { pack, gender, setLang, setGender, prismaLanguage: pack.code === "hi" ? undefined : pack.prisma.language_code };
  }, [code, gender, setLang, setGender]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  const l = useContext(Ctx);
  if (!l) throw new Error("useLang outside LangProvider");
  return l;
}
