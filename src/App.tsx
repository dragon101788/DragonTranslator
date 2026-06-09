import { useState, useCallback, useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import TitleBar from "./components/layout/TitleBar";
import { usePersistence } from "./hooks/usePersistence";
import { useConfigStore } from "./stores/configStore";
import { useAgentStore } from "./stores/agentStore";
import type { TranslationAgent } from "./types";

type ViewType = "translation" | "agent-editor" | "history" | "settings";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function App() {
  usePersistence();

  // ---- Sync theme & font-size to <html> ----
  useEffect(() => {
    const unsub = useConfigStore.subscribe((s) => {
      document.documentElement.setAttribute("data-theme", s.settings.theme);
      document.documentElement.style.setProperty("--lexi-font-size", `${s.settings.fontSize}px`);
    });
    const s = useConfigStore.getState().settings;
    document.documentElement.setAttribute("data-theme", s.theme);
    document.documentElement.style.setProperty("--lexi-font-size", `${s.fontSize}px`);
    return unsub;
  }, []);

  // ---- Persistence + sync shortcut from settings to Rust on startup ----
  useEffect(() => {
    if (!isTauri()) return;
    const s = useConfigStore.getState().settings;
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("configure_shortcut", {
        modifiers: s.shortcutModifiers,
        key: s.shortcutKey,
      }).catch(console.error);
    });
  }, []);

  // ---- View management ----
  const [view, setView] = useState<ViewType>("translation");
  const [editingAgent, setEditingAgent] = useState<TranslationAgent | null>(null);

  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  const handleSwapLang = useCallback(() => {
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  }, [sourceLang, targetLang]);

  // ---- Window close logic ----

  const handleCloseRequest = useCallback(() => {
    if (!isTauri()) return;
    const s = useConfigStore.getState().settings;
    if (s.closeToTray) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().hide();
      });
    } else {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().close();
      });
    }
  }, []);

  // ---- Navigation callbacks ----

  const goToTranslation = useCallback(() => setView("translation"), []);

  const handleSelectAgent = useCallback((agentId: string) => {
    useAgentStore.getState().setActiveAgent(agentId);
    setView("translation");
  }, []);

  const handleOpenAgentEditor = useCallback((agent: TranslationAgent | null) => {
    setEditingAgent(agent);
    setView("agent-editor");
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-lexi-bg overflow-hidden">
      <TitleBar
        onCloseRequest={handleCloseRequest}
        onOpenHistory={() => setView("history")}
        onOpenSettings={() => setView("settings")}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeView={view}
          onSelectAgent={handleSelectAgent}
          onNewAgent={() => handleOpenAgentEditor(null)}
          onOpenHistory={() => setView("history")}
          onOpenSettings={() => setView("settings")}
          onEditAgent={handleOpenAgentEditor}
        />
        <div className="flex-1 min-w-0">
          <MainPanel
            view={view}
            editingAgent={editingAgent}
            onCloseAgentEditor={() => {
              setEditingAgent(null);
              setView("translation");
            }}
            onBack={goToTranslation}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceLangChange={setSourceLang}
            onTargetLangChange={setTargetLang}
            onSwapLang={handleSwapLang}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
