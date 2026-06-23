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

type ViewType = "translation" | "agent-editor" | "history" | "settings";

interface MainPanelProps {
  view: ViewType;
  editingAgentId: string | null;
  onCloseAgentEditor: () => void;
  onBack: () => void;
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  onSwapLang: () => void;
}

export default function MainPanel({
  view,
  editingAgentId,
  onCloseAgentEditor,
  onBack,
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLang,
}: MainPanelProps) {
  const {
    cards,
    translateAll,
    stopAll,
    stopOne,
    clear,
    anyTranslating,
  } = useMultiTranslate();
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);
  const tts = useTTS();

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

  // Auto-read result when translation completes
  const prevTranslating = useRef(anyTranslating);
  useEffect(() => {
    if (prevTranslating.current && !anyTranslating) {
      const firstCard = cards.find((c) => c.result);
      if (firstCard?.result) {
        const s = useConfigStore.getState().settings;
        if (s.ttsAutoRead) {
          tts.speak(firstCard.result.replace(/<[^>]*>/g, ""), "");
        }
      }
    }
    prevTranslating.current = anyTranslating;
  }, [anyTranslating, cards, tts]);

  const handleTranslate = useCallback(
    (text: string) => {
      const agent = getActiveAgent();
      if (!agent) return;
      const providers = useConfigStore.getState().providers;
      if (providers.length === 0) return;
      translateAll(text, agent, providers, sourceLang, targetLang);
    },
    [getActiveAgent, translateAll, sourceLang, targetLang]
  );

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
        <div className="flex flex-col h-full min-h-0 overflow-y-auto">
          {/* Agent header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-lexi-border/50 flex-shrink-0">
            {activeAgent && (
              <>
                <span className="text-2xl">{activeAgent.icon}</span>
                <div>
                  <h2 className="text-base font-semibold text-lexi-text">
                    {activeAgent.name}
                  </h2>
                  <p className="text-xs text-lexi-text-muted">
                    {activeAgent.description}
                  </p>
                </div>
              </>
            )}
          </div>

          

          {/* Cards */}
          <div className="flex flex-col gap-3 px-5 py-5">
            {/* Input */}
            <InputArea
              onTranslate={handleTranslate}
              onStop={stopAll}
              translating={anyTranslating}
              onClear={clear}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceLangChange={onSourceLangChange}
              onTargetLangChange={onTargetLangChange}
              onSwapLang={onSwapLang}
            />
            {cards.map((card) => (
              <OutputCard
                key={card.providerId}
                card={card}
                onStop={stopOne}
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
