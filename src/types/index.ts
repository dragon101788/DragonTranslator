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
  theme: "dark" | "light";
  fontSize: "small" | "medium" | "large";
  // Tray
  closeToTray: boolean;
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
export const DEFAULT_AGENTS: TranslationAgent[] = [
  {
    id: "agent-colloquial",
    name: "口语化翻译",
    icon: "💬",
    description: "翻译更口语化，贴合英语思维，限定B1等级词汇",
    systemPrompt: `你是一个专业的口语化翻译助手。请将用户输入翻译成地道的英语口语表达。

翻译要求：
1. 使用英语B1等级（中级）词汇，避免生僻词和高级词汇
2. 表达要自然、口语化，像母语者日常对话一样
3. 贴合英语思维，避免中式英语（Chinglish）
4. 如果遇到成语、俗语，用意译而非直译
5. 保持原文的语气和情感色彩

请直接输出翻译结果，不需要额外说明。`,
    config: { model: "", temperature: 0.7, maxTokens: 2048 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "agent-learning",
    name: "学习翻译",
    icon: "📚",
    description: "翻译 + 语法剖析 + 词汇详解，适合英语学习",
    systemPrompt: `你是一个专业的英语学习翻译助手。请按以下格式输出翻译结果：

### 📝 翻译

[给出地道、准确的翻译，贴合英语思维]

### 🔍 语法剖析

[分析原文的关键语法结构，说明翻译时用到的语法点，包括但不限于：时态、语态、从句类型、非谓语动词、虚拟语气等]

### 📖 词汇详解

| 原文词汇 | 翻译 | 词性 | 用法说明 |
|---------|------|------|---------|
| ... | ... | ... | ... |

[挑选3-5个值得学习的词汇或短语进行详解]

### 💡 学习提示

[给出1-2条针对此句翻译的学习建议或拓展知识]

请确保翻译地道准确，语法分析清晰易懂。`,
    config: { model: "", temperature: 0.5, maxTokens: 4096 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "agent-academic",
    name: "学术翻译",
    icon: "🎓",
    description: "正式学术风格，适合论文、报告翻译",
    systemPrompt: `你是一个专业的学术翻译助手。请将用户输入翻译成正式、严谨的英语学术表达。

翻译要求：
1. 使用正式的学术风格，措辞严谨
2. 保持专业术语的准确性，必要时保留原文术语并加括号注释
3. 句式结构清晰，逻辑严密，避免口语化表达
4. 符合学术论文的语言规范
5. 如有引用或文献，保留原格式

请直接输出翻译结果。如遇到有争议的专业术语，在译文后以注释形式说明。`,
    config: { model: "", temperature: 0.3, maxTokens: 4096 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "agent-quick",
    name: "快速翻译",
    icon: "⚡",
    description: "极简翻译，只输出结果，速度优先",
    systemPrompt: `你是一个快速翻译助手。请将用户输入翻译成目标语言。

要求：只输出翻译结果，不要任何解释、注释或额外内容。保持原意，简洁准确。`,
    config: { model: "", temperature: 0.1, maxTokens: 1024 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "agent-creative",
    name: "创意翻译",
    icon: "🎨",
    description: "意译优先，文化适配，成语本地化",
    systemPrompt: `你是一个创意翻译助手。请将用户输入翻译成富有表现力的目标语言表达。

翻译要求：
1. 意译优先于直译，追求表达的生动性和感染力
2. 成语、俗语、文化梗要做本地化适配，找到目标语言中的对应表达
3. 可以适当调整句式结构，让译文更符合目标语言的表达习惯
4. 保持原文的情感和风格，但允许创造性改写
5. 如遇到双关语、诗歌、歌词等，优先保留其艺术效果

请直接输出翻译结果。如果做了较大的意译调整，在译文后用一句话简要说明你的处理思路。`,
    config: { model: "", temperature: 0.9, maxTokens: 4096 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const DEFAULT_PROVIDER: LLMProvider = {
  id: "default",
  name: "默认服务商",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
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
    remotePath: "/lexi/config.json",
    syncOnStart: false,
    lastSync: null,
  },
  theme: "dark",
  fontSize: "medium",
  closeToTray: true,
};
