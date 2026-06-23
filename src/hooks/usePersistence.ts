import { useEffect, useRef } from "react";
import { useAgentStore } from "../stores/agentStore";
import { useConfigStore } from "../stores/configStore";
import { useHistoryStore } from "../stores/historyStore";
import type { Store } from "@tauri-apps/plugin-store";
import type { TranslationAgent, LLMProvider, AppSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const STORE_FILENAME = "config.json";
const LS_KEY = "dragon-translator-config";

interface PersistedData {
  agents: TranslationAgent[];
  activeAgentId: string | null;
  providers: LLMProvider[];
  activeProviderId: string | null;
  settings: AppSettings;
  records: any[];
}

// ---- environment detection ----

function isTauriEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

// ---- gather / apply state snapshots ----

function getSnapshot(): PersistedData {
  return {
    agents: useAgentStore.getState().agents,
    activeAgentId: useAgentStore.getState().activeAgentId,
    providers: useConfigStore.getState().providers,
    activeProviderId: useConfigStore.getState().activeProviderId,
    settings: useConfigStore.getState().settings,
    records: useHistoryStore.getState().records,
  };
}

function applySnapshot(data: PersistedData) {
  if (data.agents)
    useAgentStore.setState({
      agents: data.agents,
      activeAgentId: data.activeAgentId,
    });
  if (data.providers)
    useConfigStore.setState({
      providers: data.providers,
      activeProviderId: data.activeProviderId,
    });
  if (data.settings) {
    // Merge saved settings with defaults so new fields (e.g. ttsRate)
    // don't remain undefined on old configs.
    useConfigStore.setState({
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
    });
  }
  if (data.records)
    useHistoryStore.setState({ records: data.records });
}

// ---- Tauri backend (file-based) ----

let _storePromise: Promise<Store> | null = null;

async function getStore(): Promise<Store> {
  if (!_storePromise) {
    _storePromise = (async () => {
      // Store config in ~/Dragon/Translator/config.json
      const { homeDir } = await import("@tauri-apps/api/path");
      const base = await homeDir();
      const storePath = `${base}${base.endsWith("\\") || base.endsWith("/") ? "" : "\\"}Dragon\\Translator\\${STORE_FILENAME}`;
      const { load } = await import("@tauri-apps/plugin-store");
      return load(storePath, { autoSave: true, defaults: {} });
    })().catch((e) => {
      _storePromise = null;
      throw e;
    });
  }
  return _storePromise;
}

async function loadFromFile(): Promise<boolean> {
  const store = await getStore();
  const data = await store.get<PersistedData>("app");
  if (data) {
    applySnapshot(data);
    console.log("[Persistence] ✅ Loaded from disk");
    return true;
  }
  return false;
}

async function saveToFile(data: PersistedData) {
  const store = await getStore();
  await store.set("app", data);
  await store.save();
  console.log("[Persistence] ✅ Written to disk");
}

// ---- Browser backend (localStorage) ----

function loadFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as PersistedData;
      applySnapshot(data);
      console.log("[Persistence] ✅ Loaded from localStorage");
      return true;
    }
  } catch (e) {
    console.error("[Persistence] ❌ localStorage load failed:", e);
  }
  return false;
}

function saveToLocalStorage(data: PersistedData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    console.log("[Persistence] ✅ Written to localStorage");
  } catch (e) {
    console.error("[Persistence] ❌ localStorage write failed:", e);
  }
}

// ---- debounced persist ----

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastWritten: string | null = null;

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 50);
}

async function persistNow() {
  saveTimer = null;
  try {
    const data = getSnapshot();
    const serialized = JSON.stringify(data);
    if (serialized === lastWritten) return;
    lastWritten = serialized;

    if (isTauriEnv()) {
      await saveToFile(data);
    } else {
      saveToLocalStorage(data);
    }
  } catch (e) {
    console.error("[Persistence] ❌ Write failed:", e);
  }
}

async function loadDefaults() {
  if (isTauriEnv()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const json = await invoke<string>("get_default_config");
      const raw = JSON.parse(json) as {
        providers: LLMProvider[];
        settings: AppSettings;
        agents: TranslationAgent[];
      };
      const data: PersistedData = {
        ...raw,
        activeAgentId: raw.agents[0]?.id ?? null,
        activeProviderId: raw.providers[0]?.id ?? null,
        records: [],
      };
      applySnapshot(data);
      console.log("[Persistence] ✅ Defaults loaded from embedded config");
      return;
    } catch (e) {
      console.error("[Persistence] ❌ get_default_config failed:", e);
    }
  }
  // Browser mode: fetch default-config.json from Vite dev server
  try {
    const resp = await fetch("/default-config.json");
    const raw = await resp.json() as {
      providers: LLMProvider[];
      settings: AppSettings;
      agents: TranslationAgent[];
    };
    const data: PersistedData = {
      ...raw,
      activeAgentId: raw.agents[0]?.id ?? null,
      activeProviderId: raw.providers[0]?.id ?? null,
      records: [],
    };
    applySnapshot(data);
    console.log("[Persistence] ✅ Defaults loaded from /default-config.json");
  } catch (e) {
    console.error("[Persistence] ❌ Browser defaults fetch failed:", e);
  }
}

async function loadPersisted() {
  if (isTauriEnv()) {
    try {
      const loaded = await loadFromFile();
      if (loaded) return;
      // No saved data → load embedded defaults
      await loadDefaults();
      return;
    } catch (e) {
      console.error("[Persistence] ❌ Load from disk failed:", e);
    }
  } else {
    const loaded = loadFromLocalStorage();
    if (!loaded) {
      await loadDefaults();
    }
  }
}

/**
 * Hybrid persistence: Tauri file store (desktop) → localStorage fallback (browser).
 * Uses Zustand `subscribe` for reliable auto-save on every state change.
 */
export function usePersistence() {
  const readyRef = useRef(false);
  const unsubRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let cancelled = false;

    // 1. Load saved state
    loadPersisted().then(() => {
      if (cancelled) return;
      readyRef.current = true;

      // 2. Subscribe to store changes → auto-persist
      const unsub1 = useAgentStore.subscribe(() => {
        if (readyRef.current) schedulePersist();
      });
      const unsub2 = useConfigStore.subscribe(() => {
        if (readyRef.current) schedulePersist();
      });
      const unsub3 = useHistoryStore.subscribe(() => {
        if (readyRef.current) schedulePersist();
      });
      unsubRef.current = [unsub1, unsub2, unsub3];
    });

    // 3. Best-effort flush before unload
    const onBeforeUnload = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        persistNow();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      unsubRef.current.forEach((fn) => fn());
      unsubRef.current = [];
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return { loadData: loadPersisted, saveData: persistNow };
}
