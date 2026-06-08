import { create } from "zustand";
import type { TranslationRecord } from "../types";

interface HistoryStore {
  records: TranslationRecord[];
  searchQuery: string;
  filterAgentId: string | null;

  // Actions
  addRecord: (record: TranslationRecord) => void;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
  toggleFavorite: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterAgentId: (agentId: string | null) => void;

  // Computed
  getFilteredRecords: () => TranslationRecord[];
  getFavoriteRecords: () => TranslationRecord[];
  getRecordsByAgent: (agentId: string) => TranslationRecord[];
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  records: [],
  searchQuery: "",
  filterAgentId: null,

  addRecord: (record) =>
    set((state) => ({
      records: [record, ...state.records].slice(0, 1000), // Keep max 1000
    })),

  deleteRecord: (id) =>
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    })),

  clearAll: () => set({ records: [] }),

  toggleFavorite: (id) =>
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
      ),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterAgentId: (agentId) => set({ filterAgentId: agentId }),

  getFilteredRecords: () => {
    const state = get();
    let records = state.records;

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      records = records.filter(
        (r) =>
          r.sourceText.toLowerCase().includes(q) ||
          r.translatedText.toLowerCase().includes(q)
      );
    }

    if (state.filterAgentId) {
      records = records.filter((r) => r.agentId === state.filterAgentId);
    }

    return records;
  },

  getFavoriteRecords: () => get().records.filter((r) => r.isFavorite),

  getRecordsByAgent: (agentId) =>
    get().records.filter((r) => r.agentId === agentId),
}));
