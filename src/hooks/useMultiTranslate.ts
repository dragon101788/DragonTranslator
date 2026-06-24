import { useState, useCallback, useRef } from "react";
import {
  translateStream,
  createTranslationRecord,
} from "../services/translation";
import type { TranslationAgent, LLMProvider } from "../types";
import { useHistoryStore } from "../stores/historyStore";

export interface CardStream {
  providerId: string;
  providerName: string;
  providerIcon: string; // "local" or "cloud"
  model: string;
  result: string | null;
  error: string | null;
  translating: boolean;
  latency: number;
}

export function useMultiTranslate() {
  const [cards, setCards] = useState<CardStream[]>([]);
  const [anyTranslating, setAnyTranslating] = useState(false);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const addRecord = useHistoryStore((s) => s.addRecord);

  const initCards = useCallback(
    (providers: LLMProvider[], agent: TranslationAgent) => {
      setCards(
        providers.map((p) => ({
          providerId: p.id,
          providerName: p.name,
          providerIcon: p.id === "local" ? "local" : "cloud",
          model: agent.config.model || p.models[0] || "auto",
          result: null,
          error: p.id === "local" ? null : p.apiKey ? null : "未配置 API Key",
          translating: false,
          latency: 0,
        }))
      );
    },
    []
  );

  const translateAll = useCallback(
    async (
      text: string,
      agent: TranslationAgent,
      providers: LLMProvider[],
    ) => {
      if (!text.trim()) return;

      // Abort all previous
      abortRefs.current.forEach((c) => c.abort());
      abortRefs.current.clear();

      initCards(providers, agent);
      setAnyTranslating(true);

      // Start all providers in parallel (fire-and-forget per provider)
      for (const provider of providers) {
        const controller = new AbortController();
        abortRefs.current.set(provider.id, controller);

        const cardStart = Date.now();

        // Skip providers with no API key (except local)
        if (provider.id !== "local" && !provider.apiKey) {
          setCards((prev) =>
            prev.map((c) =>
              c.providerId === provider.id
                ? { ...c, error: "未配置 API Key" }
                : c
            )
          );
          if (providers.length === 1) setAnyTranslating(false);
          continue;
        }

        setCards((prev) =>
          prev.map((c) =>
            c.providerId === provider.id
              ? { ...c, translating: true, error: null, result: "" }
              : c
          )
        );

        // Run each translation independently
        (async () => {
          try {
            const output = await translateStream(
              { text, agent, provider },
              (chunk) => {
                setCards((prev) =>
                  prev.map((c) =>
                    c.providerId === provider.id
                      ? { ...c, result: chunk }
                      : c
                  )
                );
              },
              controller.signal
            );

            const elapsed = Date.now() - cardStart;
            setCards((prev) =>
              prev.map((c) =>
                c.providerId === provider.id
                  ? { ...c, result: output.content, translating: false, latency: elapsed }
                  : c
              )
            );

            const record = createTranslationRecord(
              { text, agent, provider },
              output,
              elapsed
            );
            addRecord(record);
          } catch (e: any) {
            if (e?.name === "AbortError") return;
            setCards((prev) =>
              prev.map((c) =>
                c.providerId === provider.id
                  ? {
                      ...c,
                      error: e?.message || "翻译失败",
                      translating: false,
                    }
                  : c
              )
            );
          } finally {
            // Check if all done
            setCards((prev) => {
              const stillRunning = prev.some((c) => c.translating);
              if (!stillRunning) setAnyTranslating(false);
              return prev;
            });
          }
        })();
      }
    },
    [initCards, addRecord]
  );

  const stopAll = useCallback(() => {
    abortRefs.current.forEach((c) => c.abort());
    abortRefs.current.clear();
    setCards((prev) =>
      prev.map((c) => ({ ...c, translating: false }))
    );
    setAnyTranslating(false);
  }, []);

  const stopOne = useCallback((providerId: string) => {
    abortRefs.current.get(providerId)?.abort();
    abortRefs.current.delete(providerId);
    setCards((prev) =>
      prev.map((c) =>
        c.providerId === providerId ? { ...c, translating: false } : c
      )
    );
  }, []);

  const clear = useCallback(() => {
    setCards([]);
    setAnyTranslating(false);
  }, []);

  return {
    cards,
    translateAll,
    stopAll,
    stopOne,
    clear,
    anyTranslating,
    setCards,
  };
}
