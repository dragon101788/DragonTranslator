import { useCallback } from "react";
import InputArea from "../translation/InputArea";
import OutputArea from "../translation/OutputArea";
import { useTranslate } from "../../hooks/useTranslate";
import { useAgentStore } from "../../stores/agentStore";
import { useConfigStore } from "../../stores/configStore";

interface MainPanelProps {
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  onSwapLang: () => void;
}

export default function MainPanel({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLang,
}: MainPanelProps) {
  const { translate, stop, translating, result, error, latency, clear } =
    useTranslate();
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);
  const getActiveProvider = useConfigStore((s) => s.getActiveProvider);

  const handleTranslate = useCallback(
    (text: string) => {
      const agent = getActiveAgent();
      const provider = getActiveProvider();
      if (!agent || !provider) return;

      translate(text, agent, provider, sourceLang, targetLang);
    },
    [getActiveAgent, getActiveProvider, translate, sourceLang, targetLang]
  );

  const activeAgent = getActiveAgent();

  return (
    <div className="flex flex-col h-full bg-lexi-bg">
      {/* Agent info header */}
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

      {/* Translation area - Input/Output each half */}
      <div className="flex-1 flex flex-col p-5 gap-4 min-h-0">
        <div className="flex-1 min-h-0">
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

        <div className="flex-1 min-h-0">
          <OutputArea
            result={result}
            error={error}
            translating={translating}
            latency={latency}
          />
        </div>
      </div>
    </div>
  );
}
