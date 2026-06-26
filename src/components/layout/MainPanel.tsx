import { useCallback, useEffect, useRef, useState } from "react";
import InputArea from "../translation/InputArea";
import OutputCard from "../translation/OutputCard";
import SettingsDialog from "../settings/SettingsDialog";
import HistoryPanel from "./HistoryPanel";
import { useConfigStore } from "../../stores/configStore";
import { useHistoryStore } from "../../stores/historyStore";
import { useTTS } from "../../hooks/useTTS";
import { logger } from "../../services/logger";
import type { TranslationRecord } from "../../types";
import { Loader2, WifiOff } from "lucide-react";

type ViewType = "translation" | "history" | "settings";

interface CardData {
  cardId: string;
  providerId: string;
  providerName: string;
  providerIcon: string;
  model: string;
  result: string | null;
  error: string | null;
  translating: boolean;
  latency: number;
}

function makeRecord(source: string, translated: string, provider: string, model: string, latency: number): TranslationRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceText: source,
    translatedText: translated,
    sourceLang: /[一-鿿㐀-䶿]/.test(source) ? "中文" : "英文",
    targetLang: /[一-鿿㐀-䶿]/.test(translated) ? "中文" : "英文",
    providerName: provider,
    model,
    latency,
    timestamp: Date.now(),
    isFavorite: false,
  };
}

interface MainPanelProps {
  view: ViewType;
  onBack: () => void;
}

export default function MainPanel({ view, onBack }: MainPanelProps) {
  const settings = useConfigStore((s) => s.settings);
  const tts = useTTS();

  const activeStyle = settings.polishStyles.find((s) => s.id === settings.activeStyleId) || settings.polishStyles[0];
  const activeProvider = useConfigStore((s) => {
    const p = s.providers;
    return p.find((pp) => pp.id === s.activeProviderId) || p[0];
  });

  // ---- Cards state ----
  const [cards, setCards] = useState<CardData[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Copy state
  const [copyState, setCopyState] = useState<Record<string, "idle" | "copied">>({});
  const handleCopy = useCallback(async (providerId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [providerId]: "copied" }));
      setTimeout(() => setCopyState((prev) => ({ ...prev, [providerId]: "idle" })), 1500);
    } catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
  }, []);

  // Auto-read on completion
  const prevTranslating = useRef(false);
  useEffect(() => {
    if (prevTranslating.current && !isTranslating) {
      const first = cards.find((c) => c.result);
      if (first?.result) {
        const s = useConfigStore.getState().settings;
        if (s.ttsAutoRead) tts.speak(first.result.replace(/<[^>]*>/g, ""), "");
      }
    }
    prevTranslating.current = isTranslating;
  }, [isTranslating, cards, tts]);

  // ---- Translate ----
  const handleTranslate = useCallback(async (text: string) => {
    setIsTranslating(true);
    setCards([]);

    // Stage 1: Bergamot
    const start = Date.now();
    const bergamotCard: CardData = {
      cardId: "bergamot", providerId: "bergamot", providerName: "离线翻译",
      providerIcon: "local", model: "Bergamot NMT", result: null, error: null, translating: true, latency: 0,
    };
    setCards([bergamotCard]);

    let bergamotResult = "";
    try {
      const { initBergamot, translateBergamot } = await import("../../services/bergamot");
      const ok = await initBergamot();
      if (!ok) throw new Error("Bergamot 离线翻译引擎不可用");
      bergamotResult = await translateBergamot(text);
      const elapsed = Date.now() - start;
      setCards((prev) => prev.map((c) => c.cardId === "bergamot"
        ? { ...c, result: bergamotResult, translating: false, latency: elapsed }
        : c
      ));
      logger.info(`[Bergamot] 完成 chars=${bergamotResult.length} latency=${elapsed}ms`);
      // Record history
      useHistoryStore.getState().addRecord(makeRecord(text, bergamotResult, "离线翻译", "Bergamot NMT", elapsed));
    } catch (e: any) {
      setCards((prev) => prev.map((c) => c.cardId === "bergamot"
        ? { ...c, error: e?.message || "翻译失败", translating: false }
        : c
      ));
      logger.warn(`[Bergamot] 错误: ${e?.message || e}`);
      setIsTranslating(false);
      return;
    }

    // Stage 2: LLM polish (if style has prompt and provider configured)
    if (!activeStyle.prompt || !activeProvider) {
      setIsTranslating(false);
      return;
    }

    const polishCard: CardData = {
      cardId: "polish", providerId: activeProvider.id, providerName: activeProvider.name,
      providerIcon: "cloud", model: activeProvider.models[0] || "auto",
      result: "", error: null, translating: true, latency: 0,
    };
    const polishStart = Date.now();
    setCards((prev) => [...prev, polishCard]);

    const controller = new AbortController();
    abortRef.current = controller;
    let polishText = "";

    try {
      const { LLMAdapter } = await import("../../services/llm/adapter");
      const adapter = new LLMAdapter(activeProvider);
      const model = activeProvider.models[0] || "gpt-4o-mini";

      await adapter.chatStream(
        {
          model,
          messages: [
            { role: "system", content: activeStyle.prompt },
            { role: "user", content: (() => {
              const targetLang = /[一-鿿㐀-䶿]/.test(bergamotResult) ? "中文" : "英文";
              const tpl = (activeStyle as any).userTemplate || "原文：{source}\n机翻：{bergamot}";
              return tpl.replace("{source}", text).replace("{bergamot}", bergamotResult).replace("{targetLang}", targetLang).replace("{style}", activeStyle.name);
            })() },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        },
        (delta: string) => {
          polishText += delta;
          setCards((prev) => prev.map((c) => c.cardId === "polish"
            ? { ...c, result: (c.result || "") + delta }
            : c
          ));
        },
        controller.signal,
      );

      setCards((prev) => prev.map((c) => c.cardId === "polish"
        ? { ...c, translating: false, latency: Date.now() - polishStart }
        : c
      ));
      logger.info(`[Polish] 完成 chars=${polishText.length} latency=${Date.now() - polishStart}ms\n  result: ${polishText.slice(0, 500)}`);
      // Record polish history
      const polishMs = Date.now() - polishStart;
      const providerName = activeProvider?.name || "本地模型";
      const modelName = activeProvider?.models[0] || "auto";
      useHistoryStore.getState().addRecord(makeRecord(text, polishText, providerName, modelName, polishMs));
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setCards((prev) => prev.map((c) => c.cardId === "polish"
          ? { ...c, error: e?.message || "润色失败", translating: false }
          : c
        ));
      }
    } finally {
      abortRef.current = null;
      setIsTranslating(false);
    }
  }, [activeStyle, activeProvider]);

  // ---- Stop ----
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTranslating(false);
    setCards((prev) => prev.map((c) => c.translating ? { ...c, translating: false } : c));
  }, []);

  // ---- Clear ----
  const handleClear = useCallback(() => {
    setCards([]);
  }, []);

  const polishOn = !!(activeStyle.prompt && activeProvider);

  return (
    <div className="flex flex-col h-full bg-lexi-bg">
      {view === "history" && <HistoryPanel onClose={onBack} />}
      {view === "settings" && <SettingsDialog onClose={onBack} />}

      {view === "translation" && (
        <div className="flex flex-col h-full min-h-0 overflow-y-auto pt-4">
          {/* Status bar */}
          <div className="flex items-center gap-2 px-5 py-1.5 text-xs text-lexi-text-muted border-b border-lexi-border/50">
            <span>{activeStyle.icon}</span>
            <span className="font-medium text-lexi-text">{activeStyle.name}</span>
            <span className="text-lexi-border">|</span>
            {polishOn ? (
              <>
                <span>{activeProvider.name}</span>
                <span className="text-lexi-text-muted/60">{activeProvider.models[0] || "auto"}</span>
                {isTranslating && cards.some((c) => c.cardId === "polish" && c.translating) && (
                  <span className="flex items-center gap-1 text-lexi-accent">
                    <Loader2 size={10} className="animate-spin" /> 润色中...
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1"><WifiOff size={10} /> 离线模式</span>
            )}
            {isTranslating && !cards.some((c) => c.cardId === "polish" && c.translating) && (
              <span className="text-lexi-accent">翻译中...</span>
            )}
          </div>

          {/* Main content */}
          <div className="flex flex-col gap-3 px-5 py-5">
            <InputArea
              onTranslate={handleTranslate}
              onStop={handleStop}
              translating={isTranslating}
              onClear={handleClear}
            />
            {cards.map((card) => (
              <OutputCard
                key={card.cardId}
                card={card}
                onStop={handleStop}
                copyState={copyState}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
