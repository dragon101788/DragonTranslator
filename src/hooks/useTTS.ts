import { useCallback, useRef, useState } from "react";
import { useConfigStore } from "../stores/configStore";

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

export function useTTS() {
  const speakingRef = useRef(false);
  const [state, setState] = useState<TtsState>({ isSpeaking: false, error: null });

  const speak = useCallback(
    async (text: string, lang?: string) => {
      if (!text || speakingRef.current) return;

      const clean = text.replace(/<[^>]*>/g, "");
      const isTauri = isTauriEnv();

      console.log(TAG, "speak() called", {
        lang: lang || "(auto)",
        textLen: clean.length,
        isTauri,
        preview: clean.slice(0, 30) + (clean.length > 30 ? "..." : ""),
      });

      if (isTauri) {
        // ---- Piper via Tauri invoke ----
        try {
          speakingRef.current = true;
          setState({ isSpeaking: true, error: null });

          const startTime = performance.now();
          console.log(TAG, "invoking tts_speak...");
          const { invoke } = await import("@tauri-apps/api/core");
          const voice = useConfigStore.getState().settings.ttsVoice?.[lang || ""] || null;
          console.log(TAG, `voice override: ${voice || "(auto)"}`);
          await invoke("tts_speak", {
            text: clean,
            lang: lang || "",
            voice,
          });
          const elapsed = (performance.now() - startTime).toFixed(0);

          console.log(TAG, `tts_speak OK (${elapsed}ms)`);
          speakingRef.current = false;
          setState({ isSpeaking: false, error: null });
        } catch (e: any) {
          speakingRef.current = false;
          const msg = typeof e === "string" ? e : e?.message || String(e);
          console.error(TAG, "tts_speak FAILED:", msg);
          console.error(TAG, "full error:", e);
          setState({ isSpeaking: false, error: msg });

          // Fallback to Web Speech API on error
          console.warn(TAG, "falling back to Web Speech API...");
          tryWebSpeech(clean, lang, speakingRef, setState);
        }
      } else {
        // ---- Browser mode: Web Speech API ----
        console.log(TAG, "browser mode, using Web Speech API");
        tryWebSpeech(clean, lang, speakingRef, setState);
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
