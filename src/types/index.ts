// ============== Translation Agent ==============
export interface TranslationAgent {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  config: AgentConfig;
  createdAt: number;
  updatedAt: number;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

// ============== LLM Provider ==============
export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isDefault: boolean;
  createdAt: number;
}

// ============== Translation Record ==============
export interface TranslationRecord {
  id: string;
  agentId: string;
  agentName: string;
  sourceText: string;
  translatedText: string; // Markdown
  sourceLang: string;
  targetLang: string;
  providerName: string;
  model: string;
  latency: number; // ms
  timestamp: number;
  isFavorite: boolean;
}

// ============== App Settings ==============
export interface AppSettings {
  // Global shortcut
  shortcutModifiers: string[];
  shortcutKey: string;
  // Default language direction
  defaultSourceLang: string;
  defaultTargetLang: string;
  // Window
  alwaysOnTop: boolean;
  // WebDAV sync
  webdav: WebDAVConfig;
  // Theme
  theme: "dark" | "light" | "geek";
  fontSize: number; // px
  // Tray
  closeToTray: boolean;
  // TTS
  ttsRate: number;
  ttsAutoRead: boolean;
}

export interface WebDAVConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  remotePath: string;
  syncOnStart: boolean;
  lastSync: number | null;
}

// ============== API Test Result ==============
export interface ApiTestResult {
  success: boolean;
  latency: number;
  model: string;
  error?: string;
}

// ============== Defaults ==============
export const DEFAULT_AGENTS: TranslationAgent[] = [];

export const DEFAULT_PROVIDER: LLMProvider = {
  id: "default",
  name: "",
  baseUrl: "",
  apiKey: "",
  models: [],
  isDefault: true,
  createdAt: Date.now(),
};

export const DEFAULT_SETTINGS: AppSettings = {
  shortcutModifiers: ["Ctrl", "Alt"],
  shortcutKey: "X",
  defaultSourceLang: "auto",
  defaultTargetLang: "en",
  alwaysOnTop: false,
  webdav: {
    enabled: false,
    url: "",
    username: "",
    password: "",
    remotePath: "/dragon-translator-config.json",
    syncOnStart: false,
    lastSync: null,
  },
  theme: "dark",
  fontSize: 14,
  closeToTray: true,
  ttsRate: 1.0,
  ttsAutoRead: false,
};
