import { useCallback, useRef } from "react";
import { useConfigStore } from "../stores/configStore";

type LangCode = string;

/**
 * Hook wrapping the Web Speech API (SpeechSynthesis) for TTS.
 * Offline-capable on Windows 10+, Chrome, Edge.
 */
export function useTTS() {
  const speakingRef = useRef(false);

  const speak = useCallback(
    (text: string, lang?: LangCode) => {
      if (!text || speakingRef.current) return;
      const rate = useConfigStore.getState().settings.ttsRate;

      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1;

      // Map our lang codes to BCP 47 tags understood by SpeechSynthesis
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

      utterance.lang = (lang && langMap[lang]) || lang || "";

      utterance.onstart = () => {
        speakingRef.current = true;
      };
      utterance.onend = () => {
        speakingRef.current = false;
      };
      utterance.onerror = () => {
        speakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
  }, []);

  const isSpeaking = speakingRef.current;

  return { speak, stop, isSpeaking };
}
