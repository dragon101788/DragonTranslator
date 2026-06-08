import { useEffect, useRef } from "react";
import { useAgentStore } from "../stores/agentStore";
import { useConfigStore } from "../stores/configStore";
import { useHistoryStore } from "../stores/historyStore";
import type { TranslationAgent, LLMProvider, AppSettings } from "../types";

const STORE_FILENAME = "lexi-data.json";

interface PersistedData {
  agents: TranslationAgent[];
  activeAgentId: string | null;
  providers: LLMProvider[];
  activeProviderId: string | null;
  settings: AppSettings;
  records: any[];
}

/**
 * Hook that handles loading and saving application state
 * using Tauri's Store plugin for local persistence.
 * Data is stored in the app's local directory for portability.
 */
export function usePersistence() {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const providers = useConfigStore((s) => s.providers);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const settings = useConfigStore((s) => s.settings);
  const records = useHistoryStore((s) => s.records);

  const loadedRef = useRef(false);

  // Load on mount — must complete before first save
  useEffect(() => {
    let cancelled = false;
    loadData().then(() => {
      if (!cancelled) loadedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // Save on changes — skip until initial load completes to avoid
  // overwriting stored data with default values
  useEffect(() => {
    if (!loadedRef.current) return;
    saveData();
  }, [agents, activeAgentId, providers, activeProviderId, settings, records]);

  async function loadData() {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
      const data = await store.get<PersistedData>("app");
      if (data) {
        if (data.agents) useAgentStore.setState({ agents: data.agents, activeAgentId: data.activeAgentId });
        if (data.providers) useConfigStore.setState({ providers: data.providers, activeProviderId: data.activeProviderId });
        if (data.settings) useConfigStore.setState({ settings: data.settings });
        if (data.records) useHistoryStore.setState({ records: data.records });
      }
    } catch (e) {
      // Store not available (e.g., in browser dev mode) — use defaults
      console.log("Store load skipped (dev mode):", e);
    }
  }

  async function saveData() {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
      const data: PersistedData = {
        agents: useAgentStore.getState().agents,
        activeAgentId: useAgentStore.getState().activeAgentId,
        providers: useConfigStore.getState().providers,
        activeProviderId: useConfigStore.getState().activeProviderId,
        settings: useConfigStore.getState().settings,
        records: useHistoryStore.getState().records,
      };
      await store.set("app", data);
      await store.save();
    } catch (e) {
      // Silent fail in dev mode
    }
  }

  return { loadData, saveData };
}
