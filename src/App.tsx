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

  // ---- Auto-start local model (llamafile) if enabled ----
  useEffect(() => {
    if (!isTauri()) return;
    // Delay to allow persistence to load settings
    const timer = setTimeout(() => {
      const { localModel } = useConfigStore.getState().settings;
      if (localModel.enabled) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke<string>("start_local_model", { port: localModel.port })
            .then((msg) => console.log("[LocalModel]", msg))
            .catch(console.error);
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

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

  // ---- Sync shortcut from settings to Rust, reactively ----
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

  // Watch for settings changes that may be loaded from persistence
  // after mount, and re-register the shortcut if needed
  useEffect(() => {
    if (!isTauri()) return;
    const unsub = useConfigStore.subscribe((state, prev) => {
      const mods = state.settings.shortcutModifiers;
      const key = state.settings.shortcutKey;
      if (mods !== prev.settings.shortcutModifiers || key !== prev.settings.shortcutKey) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("configure_shortcut", { modifiers: mods, key }).catch(console.error);
        });
      }
    });
    return unsub;
  }, []);

  // ---- On first launch, fetch models for the default provider ----
  useEffect(() => {
    const provider = useConfigStore.getState().providers[0];
    if (provider && provider.models.length === 0) {
      import("./services/llm/adapter").then(({ LLMAdapter }) => {
        const adapter = new LLMAdapter(provider);
        adapter.fetchModels().then((models) => {
          if (models.length > 0) {
            useConfigStore.getState().updateProvider(provider.id, { models });
          }
        }).catch(() => {
          // Silently ignore — user can manually fetch in settings
        });
      });
    }
  }, []);

  // ---- View management ----
  const [view, setView] = useState<ViewType>("translation");
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

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
    setEditingAgentId(agent?.id ?? null);
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
          onEditAgent={handleOpenAgentEditor}
        />
        <div className="flex-1 min-w-0">
          <MainPanel
            view={view}
            editingAgentId={editingAgentId}
            onCloseAgentEditor={() => {
              setEditingAgentId(null);
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
