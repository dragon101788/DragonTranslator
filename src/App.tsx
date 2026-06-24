import { useState, useCallback, useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import MainPanel from "./components/layout/MainPanel";
import TitleBar from "./components/layout/TitleBar";
import { usePersistence } from "./hooks/usePersistence";
import { useConfigStore } from "./stores/configStore";
import { useAgentStore } from "./stores/agentStore";
import { logger } from "./services/logger";
import type { TranslationAgent } from "./types";

type ViewType = "translation" | "agent-editor" | "history" | "settings";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function App() {
  usePersistence();

  // ---- Auto-start local model (llamafile) + register provider ----
  useEffect(() => {
    if (!isTauri()) return;
    const timer = setTimeout(async () => {
      const { localModel } = useConfigStore.getState().settings;
      if (!localModel.enabled) {
        logger.info("本地模型已禁用, 跳过启动");
        return;
      }
      logger.info(
        `正在启动本地模型: ${localModel.model} (端口 ${localModel.port})...`
      );
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const msg = await invoke<string>("start_local_model", {
          port: localModel.port,
          model: localModel.model,
        });
        console.log("[LocalModel]", msg);
        logger.info(`本地模型启动成功: ${msg}`);

        // Auto-register local provider
        const localUrl = `http://127.0.0.1:${localModel.port}/v1`;
        const state = useConfigStore.getState();
        const existing = state.providers.find((p) => p.id === "local");
        if (existing) {
          state.updateProvider("local", { baseUrl: localUrl, apiKey: "local" });
        } else {
          state.addProvider({
            id: "local",
            name: "本地模型 (Qwen3)",
            baseUrl: localUrl,
            apiKey: "local",
            models: [],
            isDefault: false,
            createdAt: Date.now(),
          });
        }
        // Set as active if no other provider configured
        if (state.providers.length === 1) {
          state.setActiveProvider("local");
        }

        // Fetch model list
        try {
          const { LLMAdapter } = await import(
            "./services/llm/adapter"
          );
          const adapter = new LLMAdapter({
            id: "local",
            name: "本地模型",
            baseUrl: localUrl,
            apiKey: "local",
            models: [],
            isDefault: false,
            createdAt: Date.now(),
          });
          const models = await adapter.fetchModels();
          if (models.length > 0) {
            state.updateProvider("local", { models });
            logger.info(`本地模型列表获取成功: ${models.length} 个模型`);
          } else {
            logger.warn("本地模型列表为空");
          }
        } catch (e: any) {
          logger.warn(`本地模型列表获取失败 (不影响使用): ${e?.message || e}`);
        }
      } catch (e: any) {
        const errMsg = `本地模型启动失败: ${e?.message || e}`;
        console.error("[LocalModel]", errMsg);
        logger.error(errMsg);
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
      }).catch((e: any) => logger.error(`快捷键注册失败: ${e?.message || e}`));
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
          invoke("configure_shortcut", { modifiers: mods, key }).catch(
            (e: any) => logger.error(`快捷键更新失败: ${e?.message || e}`)
          );
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
        }).catch((e: any) => {
          logger.warn(`默认服务商模型列表获取失败 (${provider.name}): ${e?.message || e}`);
        });
      });
    }
  }, []);

  // ---- View management ----
  const [view, setView] = useState<ViewType>("translation");
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

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
          />
        </div>
      </div>
    </div>
  );
}

export default App;
