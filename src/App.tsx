import { useState, useCallback } from "react";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import TitleBar from "./components/layout/TitleBar";
import AgentEditor from "./components/agents/AgentEditor";
import SettingsDialog from "./components/settings/SettingsDialog";
import HistoryPanel from "./components/layout/HistoryPanel";
import { usePersistence } from "./hooks/usePersistence";
import { useConfigStore } from "./stores/configStore";
import type { TranslationAgent } from "./types";

type DialogType = "agent" | "settings" | "history" | "tray-close" | null;

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function App() {
  // Persistence: auto-load and auto-save
  usePersistence();

  const [dialog, setDialog] = useState<DialogType>(null);
  const [editingAgent, setEditingAgent] = useState<TranslationAgent | null>(null);

  // Language direction
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  // ---- Window close logic ----

  const handleCloseRequest = useCallback(() => {
    if (!isTauri()) return;
    const s = useConfigStore.getState().settings;
    if (s.closeToTray) {
      // Setting checked → hide directly
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().hide();
      });
    } else {
      // Show dialog to ask
      setDialog("tray-close");
    }
  }, []);

  const handleCloseToTray = useCallback(() => {
    setDialog(null);
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().hide();
    });
  }, []);

  const handleQuit = useCallback(() => {
    setDialog(null);
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().close();
    });
  }, []);

  // ---- Handlers ----

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

  // ---- Tray close dialog ----
  const showTrayDialog = dialog === "tray-close";

  return (
    <div className="flex flex-col h-screen w-screen bg-lexi-bg overflow-hidden">
      {/* Custom title bar (Tauri only) */}
      <TitleBar onCloseRequest={handleCloseRequest} />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
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

      {/* First-close dialog */}
      {showTrayDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-lexi-card rounded-xl border border-lexi-border w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-lexi-text mb-2">
              关闭窗口
            </h3>
            <p className="text-sm text-lexi-text-muted mb-5">
              你希望：
            </p>
            <div className="space-y-3">
              <button
                onClick={handleCloseToTray}
                className="w-full px-4 py-3 rounded-lg bg-lexi-accent/15 hover:bg-lexi-accent/25 text-lexi-accent-hover text-sm font-medium transition-all text-left"
              >
                📌 最小化到托盘
                <span className="block text-xs text-lexi-text-muted mt-0.5 font-normal">
                  窗口隐藏到系统托盘，继续运行
                </span>
              </button>
              <button
                onClick={handleQuit}
                className="w-full px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-lexi-text text-sm font-medium transition-all text-left"
              >
                ❌ 退出程序
                <span className="block text-xs text-lexi-text-muted mt-0.5 font-normal">
                  完全关闭应用程序
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
