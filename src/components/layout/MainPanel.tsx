import { useCallback, useEffect, useState, useRef } from "react";
import InputArea from "../translation/InputArea";
import OutputCard from "../translation/OutputCard";
import AgentEditor from "../agents/AgentEditor";
import SettingsDialog from "../settings/SettingsDialog";
import HistoryPanel from "./HistoryPanel";
import { useMultiTranslate } from "../../hooks/useMultiTranslate";
import { useAgentStore } from "../../stores/agentStore";
import { useConfigStore } from "../../stores/configStore";
import { useTTS } from "../../hooks/useTTS";
import { logger } from "../../services/logger";
import type { CardStream } from "../../hooks/useMultiTranslate";

type ViewType = "translation" | "agent-editor" | "history" | "settings";

interface MainPanelProps {
  view: ViewType;
  editingAgentId: string | null;
  onCloseAgentEditor: () => void;
  onBack: () => void;
}

export default function MainPanel({
  view,
  editingAgentId,
  onCloseAgentEditor,
  onBack,
}: MainPanelProps) {
  const {
    cards,
    translateAll,
    stopAll: stopAllLLM,
    stopOne: stopOneLLM,
    clear: clearLLM,
    anyTranslating,
  } = useMultiTranslate();
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);
  const tts = useTTS();

  // Bergamot independent state (not part of LLM provider ecosystem)
  const [bergamotCard, setBergamotCard] = useState<CardStream | null>(null);
  const [bergamotTranslating, setBergamotTranslating] = useState(false);

  // Copy state per card
  const [copyState, setCopyState] = useState<Record<string, "idle" | "copied">>({});
  const handleCopy = useCallback(async (providerId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [providerId]: "copied" }));
      setTimeout(() => {
        setCopyState((prev) => ({ ...prev, [providerId]: "idle" }));
      }, 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }, []);

  const activeAgent = getActiveAgent();
  const isTranslating = anyTranslating || bergamotTranslating;

  // Auto-read result when translation completes
  const prevTranslating = useRef(isTranslating);
  useEffect(() => {
    if (prevTranslating.current && !isTranslating) {
      const source = cards.find((c) => c.result) || bergamotCard;
      if (source?.result) {
        const s = useConfigStore.getState().settings;
        if (s.ttsAutoRead) {
          tts.speak(source.result.replace(/<[^>]*>/g, ""), "");
        }
      }
    }
    prevTranslating.current = isTranslating;
  }, [isTranslating, cards, bergamotCard, tts]);

  // ---- Bergamot translation handler ----
  const handleBergamotTranslate = useCallback(async (text: string) => {
    setBergamotTranslating(true);
    setBergamotCard({
      providerId: "bergamot",
      providerName: "离线翻译",
      providerIcon: "local",
      model: "Bergamot NMT",
      result: null,
      error: null,
      translating: true,
      latency: 0,
    });

    const start = Date.now();
    try {
      const { initBergamot, translateBergamot } = await import("../../services/bergamot");
      const ok = await initBergamot();
      if (!ok) throw new Error("Bergamot 离线翻译引擎不可用（模型文件未找到）");

      const result = await translateBergamot(text);
      const elapsed = Date.now() - start;

      setBergamotCard({
        providerId: "bergamot",
        providerName: "离线翻译",
        providerIcon: "local",
        model: "Bergamot NMT",
        result,
        error: null,
        translating: false,
        latency: elapsed,
      });
      logger.info(`[Bergamot] 完成 chars=${result.length} latency=${elapsed}ms`);
    } catch (e: any) {
      setBergamotCard((prev) => prev ? {
        ...prev,
        error: e?.message || "翻译失败",
        translating: false,
      } : null);
      logger.warn(`[Bergamot] 错误: ${e?.message || e}`);
    } finally {
      setBergamotTranslating(false);
    }
  }, []);

  // ---- Unified translate dispatch ----
  const handleTranslate = useCallback(
    (text: string) => {
      const agent = getActiveAgent();
      if (!agent) {
        logger.error("翻译失败: 没有活跃的智能体");
        return;
      }

      if (agent.useBergamot) {
        handleBergamotTranslate(text);
        return;
      }

      // LLM path
      const state = useConfigStore.getState();
      const providers = state.providers;
      if (providers.length === 0) {
        logger.error("翻译失败: 没有配置任何 API 服务商");
        return;
      }
      logger.info(
        `翻译请求: agent="${agent.name}" text_len=${text.length} providers=${providers.map(p => p.id).join(",")}`
      );
      setBergamotCard(null); // clear any previous Bergamot card when switching to LLM
      translateAll(text, agent, providers);
    },
    [getActiveAgent, handleBergamotTranslate, translateAll]
  );

  // ---- Unified stop ----
  const handleStop = useCallback(() => {
    stopAllLLM();
    setBergamotTranslating(false);
    setBergamotCard((prev) => prev ? { ...prev, translating: false } : null);
  }, [stopAllLLM]);

  // ---- Unified clear ----
  const handleClear = useCallback(() => {
    clearLLM();
    setBergamotCard(null);
  }, [clearLLM]);

  return (
    <div className="flex flex-col h-full bg-lexi-bg">
      {view === "agent-editor" && (
        <AgentEditor agentId={editingAgentId} onClose={onCloseAgentEditor} />
      )}

      {view === "history" && (
        <HistoryPanel onClose={onBack} />
      )}

      {view === "settings" && (
        <SettingsDialog onClose={onBack} />
      )}

      {view === "translation" && (
        <div className="flex flex-col h-full min-h-0 overflow-y-auto pt-4">
          <div className="flex flex-col gap-3 px-5 py-5">
            <InputArea
              onTranslate={handleTranslate}
              onStop={handleStop}
              translating={isTranslating}
              onClear={handleClear}
            />
            {/* Bergamot card (if active) */}
            {bergamotCard && (
              <OutputCard
                key="bergamot"
                card={bergamotCard}
                onStop={() => {
                  setBergamotTranslating(false);
                  setBergamotCard((prev) => prev ? { ...prev, translating: false } : null);
                }}
                copyState={copyState}
                onCopy={handleCopy}
              />
            )}
            {/* LLM provider cards */}
            {cards.map((card) => (
              <OutputCard
                key={card.providerId}
                card={card}
                onStop={stopOneLLM}
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
