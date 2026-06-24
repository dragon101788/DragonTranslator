import { useCallback, useRef, useState } from "react";
import { useConfigStore } from "../stores/configStore";
import { logger } from "../services/logger";

// ---------------------------------------------------------------------------
// Detect Tauri environment
// ---------------------------------------------------------------------------

function isTauriEnv(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

// ---------------------------------------------------------------------------
// TTS hook — Piper (Tauri invoke) with Web Speech API fallback
// ---------------------------------------------------------------------------

export interface TtsState {
  isSpeaking: boolean;
  error: string | null;
}

const TAG = "[TTS-FE]";

/** Detect text language (simple heuristic: check for CJK characters) */
function detectTextLang(text: string): string {
  // If text contains mostly CJK characters, it's likely Chinese
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  if (cjkCount > text.length * 0.3) return "zh";
  // If mostly ASCII, it's likely English
  const asciiCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (asciiCount > text.length * 0.5) return "en";
  return "auto";
}

export function useTTS() {
  const speakingRef = useRef(false);
  const [state, setState] = useState<TtsState>({ isSpeaking: false, error: null });

  const speak = useCallback(
    async (text: string, lang?: string) => {
      if (!text || speakingRef.current) return;

      const clean = text.replace(/<[^>]*>/g, "");
      const isTauri = isTauriEnv();

      // Auto-detect language if not explicitly provided
      const effectiveLang = lang || detectTextLang(clean);
      const voice = useConfigStore.getState().settings.ttsVoice?.[effectiveLang] || null;

      console.log(TAG, "speak() called", {
        lang: lang || "(auto)",
        effectiveLang,
        textLen: clean.length,
        isTauri,
        voiceOverride: voice || "(none)",
        preview: clean.slice(0, 60) + (clean.length > 60 ? "..." : ""),
      });
      logger.info(
        `TTS speak: effectiveLang="${effectiveLang}" voice="${voice || "auto"}" text_len=${clean.length} preview="${clean.slice(0, 40)}"`
      );

      if (isTauri) {
        // ---- Piper via Tauri invoke ----
        try {
          speakingRef.current = true;
          setState({ isSpeaking: true, error: null });

          const startTime = performance.now();
          console.log(TAG, `invoking tts_speak lang="${effectiveLang}" voice="${voice || "auto"}"`);
          logger.info(`TTS invoking tts_speak lang="${effectiveLang}" voice="${voice || "auto"}"`);
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("tts_speak", {
            text: clean,
            lang: effectiveLang,
            voice,
          });
          const elapsed = (performance.now() - startTime).toFixed(0);

          console.log(TAG, `tts_speak OK (${elapsed}ms)`);
          logger.info(`TTS speak OK (${elapsed}ms) lang="${effectiveLang}"`);
          speakingRef.current = false;
          setState({ isSpeaking: false, error: null });
        } catch (e: any) {
          speakingRef.current = false;
          const msg = typeof e === "string" ? e : e?.message || String(e);
          console.error(TAG, "tts_speak FAILED:", msg);
          logger.error(`tts_speak failed (lang=${effectiveLang}): ${msg}`);
          setState({ isSpeaking: false, error: msg });

          // Fallback to Web Speech API on error
          console.warn(TAG, "falling back to Web Speech API...");
          logger.warn(`falling back to Web Speech API for lang=${effectiveLang}`);
          tryWebSpeech(clean, effectiveLang, speakingRef, setState);
        }
      } else {
        // ---- Browser mode: Web Speech API ----
        console.log(TAG, "browser mode, using Web Speech API");
        tryWebSpeech(clean, effectiveLang, speakingRef, setState);
      }
    },
    []
  );

  const stop = useCallback(async () => {
    console.log(TAG, "stop() called");
    speakingRef.current = false;

    if (isTauriEnv()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("tts_stop");
        console.log(TAG, "tts_stop OK");
      } catch (e) {
        console.warn(TAG, "tts_stop failed:", e);
      }
    } else {
      window.speechSynthesis.cancel();
    }
    setState({ isSpeaking: false, error: null });
  }, []);

  return { speak, stop, isSpeaking: state.isSpeaking, error: state.error };
}

// ---------------------------------------------------------------------------
// Web Speech API fallback
// ---------------------------------------------------------------------------

function tryWebSpeech(
  text: string,
  lang: string | undefined,
  speakingRef: React.MutableRefObject<boolean>,
  setState: (s: TtsState) => void
) {
  const TAG_WS = "[TTS-FE:WebSpeech]";
  console.log(TAG_WS, "using system voice for lang=", lang || "(auto)");

  window.speechSynthesis.cancel();

  const langMap: Record<string, string> = {
    zh: "zh-CN",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    ru: "ru-RU",
    pt: "pt-BR",
    ar: "ar-SA",
    th: "th-TH",
    vi: "vi-VN",
    auto: "",
  };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = (lang && langMap[lang]) || lang || "";
  utterance.rate = 1.0;

  utterance.onstart = () => {
    console.log(TAG_WS, "speaking started");
    speakingRef.current = true;
    setState({ isSpeaking: true, error: null });
  };
  utterance.onend = () => {
    console.log(TAG_WS, "speaking ended");
    speakingRef.current = false;
    setState({ isSpeaking: false, error: null });
  };
  utterance.onerror = (e) => {
    console.error(TAG_WS, "speaking error:", e.error);
    speakingRef.current = false;
    setState({ isSpeaking: false, error: e.error || "Speech synthesis error" });
  };

  window.speechSynthesis.speak(utterance);
}
