import { useCallback, useEffect, useState, useRef } from "react";
import InputArea from "../translation/InputArea";
import OutputArea from "../translation/OutputArea";
import AgentEditor from "../agents/AgentEditor";
import SettingsDialog from "../settings/SettingsDialog";
import HistoryPanel from "./HistoryPanel";
import { useTranslate } from "../../hooks/useTranslate";
import { useAgentStore } from "../../stores/agentStore";
import { useConfigStore } from "../../stores/configStore";
import type { TranslationAgent } from "../../types";

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
  const { translate, stop, translating, result, error, latency, clear } =
    useTranslate();
  const activeAgent = useAgentStore((s) => s.getActiveAgent());
  const getActiveProvider = useConfigStore((s) => s.getActiveProvider);
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);

  const handleTranslate = useCallback(
    (text: string) => {
      const agent = getActiveAgent();
      const provider = getActiveProvider();
      if (!agent || !provider) return;
      translate(text, agent, provider, sourceLang, targetLang);
    },
    [getActiveAgent, getActiveProvider, translate, sourceLang, targetLang]
  );

  // Resizable split
  const [splitRatio, setSplitRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const ratio = Math.min(Math.max(offsetY / rect.height, 0.2), 0.8);
      setSplitRatio(ratio);
    };
    const onMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleBarDown = () => {
    draggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

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
        <>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-lexi-border/50">
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

          <div ref={containerRef} className="flex-1 flex flex-col p-5 min-h-0">
            <div style={{ flexGrow: splitRatio, minHeight: 0 }}>
              <InputArea
                onTranslate={handleTranslate}
                onStop={stop}
                translating={translating}
                onClear={clear}
                sourceLang={sourceLang}
                targetLang={targetLang}
                onSourceLangChange={onSourceLangChange}
                onTargetLangChange={onTargetLangChange}
                onSwapLang={onSwapLang}
              />
            </div>

            <div
              className="flex items-center justify-center h-2 cursor-row-resize flex-shrink-0 group -my-0.5"
              onMouseDown={handleBarDown}
            >
              <div className="w-8 h-0.5 rounded-full bg-lexi-border/30 group-hover:bg-lexi-accent/60 transition-colors" />
            </div>

            <div style={{ flexGrow: 1 - splitRatio, minHeight: 0 }}>
              <OutputArea
                result={result}
                error={error}
                translating={translating}
                latency={latency}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
