import { useState, useCallback } from "react";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import AgentEditor from "./components/agents/AgentEditor";
import SettingsDialog from "./components/settings/SettingsDialog";
import HistoryPanel from "./components/layout/HistoryPanel";
import { usePersistence } from "./hooks/usePersistence";
import type { TranslationAgent } from "./types";

type DialogType = "agent" | "settings" | "history" | null;

function App() {
  // Persistence: auto-load and auto-save
  usePersistence();

  const [dialog, setDialog] = useState<DialogType>(null);
  const [editingAgent, setEditingAgent] = useState<TranslationAgent | null>(null);

  // Language direction
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  const handleSwapLang = useCallback(() => {
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  }, [sourceLang, targetLang]);

  const handleOpenSettings = useCallback(() => {
    setDialog("settings");
  }, []);

  const handleOpenHistory = useCallback(() => {
    setDialog("history");
  }, []);

  const handleEditAgent = useCallback((agent: TranslationAgent | null) => {
    setEditingAgent(agent);
    setDialog("agent");
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialog(null);
    setEditingAgent(null);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-lexi-bg overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        onOpenSettings={handleOpenSettings}
        onOpenHistory={handleOpenHistory}
        onEditAgent={handleEditAgent}
      />

      {/* Main Panel */}
      <div className="flex-1 min-w-0">
        <MainPanel
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceLangChange={setSourceLang}
          onTargetLangChange={setTargetLang}
          onSwapLang={handleSwapLang}
        />
      </div>

      {/* Dialogs */}
      {dialog === "agent" && (
        <AgentEditor agent={editingAgent} onClose={handleCloseDialog} />
      )}
      {dialog === "settings" && (
        <SettingsDialog onClose={handleCloseDialog} />
      )}
      {dialog === "history" && (
        <HistoryPanel onClose={handleCloseDialog} />
      )}
    </div>
  );
}

export default App;
