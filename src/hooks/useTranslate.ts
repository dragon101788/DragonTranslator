import { useState, useCallback, useRef } from "react";
import {
  translateStream,
  createTranslationRecord,
} from "../services/translation";
import type { TranslationAgent, LLMProvider } from "../types";
import { useHistoryStore } from "../stores/historyStore";
import { logger } from "../services/logger";

export function useTranslate() {
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const addRecord = useHistoryStore((s) => s.addRecord);
  const abortRef = useRef<AbortController | null>(null);

  const translate = useCallback(
    async (
      text: string,
      agent: TranslationAgent,
      provider: LLMProvider,
    ) => {
      if (!text.trim()) return;
      if (!provider.apiKey) {
        setError("请先在设置中配置 API Key");
        return;
      }

      // Cancel previous request if any
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setTranslating(true);
      setError(null);
      setResult(""); // Start with empty, stream will fill

      const start = Date.now();
      try {
        const output = await translateStream(
          { text, agent, provider },
          (chunk) => {
            setResult(chunk);
          },
          controller.signal
        );

        const elapsed = Date.now() - start;
        setLatency(elapsed);
        logger.info(`翻译完成 ${elapsed}ms`);

        // Save complete result to history
        const record = createTranslationRecord(
          { text, agent, provider },
          output,
          elapsed
        );
        addRecord(record);
      } catch (e: any) {
        if (e?.name === "AbortError") { logger.info("翻译已中止"); return; }
        logger.error(`翻译失败: ${e?.message || "未知错误"}`);
        setError(e?.message || "翻译失败，请检查网络和 API 配置");
      } finally {
        setTranslating(false);
        abortRef.current = null;
      }
    },
    [addRecord]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setLatency(0);
  }, []);

  return { translate, stop, translating, result, error, latency, clear };
}
