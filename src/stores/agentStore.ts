import { create } from "zustand";
import type { TranslationAgent } from "../types";
import { DEFAULT_AGENTS } from "../types";

interface AgentStore {
  agents: TranslationAgent[];
  activeAgentId: string | null;

  // Actions
  setActiveAgent: (id: string) => void;
  addAgent: (agent: TranslationAgent) => void;
  updateAgent: (id: string, updates: Partial<TranslationAgent>) => void;
  deleteAgent: (id: string) => void;
  duplicateAgent: (id: string) => void;
  resetToDefaults: () => void;

  // Computed
  getActiveAgent: () => TranslationAgent | undefined;
  getAgentById: (id: string) => TranslationAgent | undefined;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [...DEFAULT_AGENTS],
  activeAgentId: DEFAULT_AGENTS[0]?.id ?? null,

  setActiveAgent: (id) => set({ activeAgentId: id }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, { ...agent, createdAt: Date.now(), updatedAt: Date.now() }],
      activeAgentId: agent.id,
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
      ),
    })),

  deleteAgent: (id) =>
    set((state) => {
      const filtered = state.agents.filter((a) => a.id !== id);
      return {
        agents: filtered,
        activeAgentId:
          state.activeAgentId === id
            ? filtered[0]?.id ?? null
            : state.activeAgentId,
      };
    }),

  duplicateAgent: (id) => {
    const original = get().agents.find((a) => a.id === id);
    if (!original) return;
    const copy: TranslationAgent = {
      ...original,
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${original.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    get().addAgent(copy);
  },

  resetToDefaults: () =>
    set({
      agents: [...DEFAULT_AGENTS],
      activeAgentId: DEFAULT_AGENTS[0]?.id ?? null,
    }),

  getActiveAgent: () => {
    const state = get();
    return state.agents.find((a) => a.id === state.activeAgentId);
  },

  getAgentById: (id) => get().agents.find((a) => a.id === id),
}));
