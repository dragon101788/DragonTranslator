# 龙图腾翻译 · Dragon Translator

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="龙图腾翻译 logo" width="128" height="128">
</p>

<p align="center">
  类似有道词典的桌面翻译应用 — 自备大模型 API，自定义智能体，绿色便携
  <br>
  <em>A desktop translator like Youdao Dict — bring your own LLM API, customize agents, portable & green</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri" alt="Tauri v2">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript" alt="TypeScript 6">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss" alt="Tailwind CSS v4">
</p>

---

## ✨ 功能特性

- **自备 API，自由选择** — 配置任意 OpenAI 兼容 API（DeepSeek / GPT / Claude / 本地 Ollama 等）
- **自定义智能体** — 通过提示词定义翻译风格，内置 5 个预置智能体，支持增删改查
- **流式输出** — SSE 逐 token 实时显示翻译结果，支持中断
- **翻译历史** — 自动保存、收藏、搜索、详情回顾
- **WebDAV 同步** — 配置云端备份与多设备同步
- **全局快捷键** — Ctrl+Alt+X 一键唤出，支持自定义
- **系统托盘** — 最小化到托盘，后台常驻
- **多主题** — 深色 / 月光白 / 暗夜紫
- **字号调节** — 滑块全局缩放 12–20px
- **语音朗读** — 内置 Web Speech API 朗读译文
- **绿色便携** — 单 exe 零依赖，配置紧跟程序目录，不写注册表

## 🧰 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | [Tauri v2](https://v2.tauri.app/) (Rust) |
| 前端 | React 19 + TypeScript 6 + Vite 8 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 图标 | lucide-react |
| Markdown | react-markdown + remark-gfm |
| 持久化 | `@tauri-apps/plugin-store` (本地 JSON 文件) |

## 🚀 快速开始

### 前置条件

- Node.js ≥ 18
- Rust toolchain（通过 [rustup](https://rustup.rs/) 安装）
- Windows：VS Build Tools 2022（C++ 桌面开发工作负载）

> **Windows 注意**：项目路径不能包含中文字符，否则 MSVC 链接器会报错。

### 开发模式

```bash
git clone <your-repo-url>
cd lexi-desktop
npm install
npx tauri dev
```

或双击 `运行.bat`，或在 VSCode 中按 `Ctrl+Shift+B`。

Vite HMR 对前端代码（`src/`）自动生效。修改 Rust 代码（`src-tauri/`）后需重启 `npx tauri dev`。

### 构建便携 exe

```bash
# 方式一：双击 打包.bat
# 方式二：VSCode → Ctrl+Shift+P → "打包便携 EXE"
# 方式三：
npm run build && npx tauri build
```

构建产物为单 exe 文件，配置自动创建在同目录，拷走即用。

## ⚙️ 配置指南

1. 启动应用 → 点击设置 ⚙️
2. **API 配置** — 添加 API 服务商（名称 / Base URL / API Key），拉取模型列表，测试连接
3. **智能体** — 从侧边栏选择或新建智能体，自定义提示词、温度、最大 Token
4. **WebDAV**（可选）— 配置服务器地址和凭证，一键拉取/推送配置备份
5. **快捷键** — 自定义全局唤出快捷键

### 预置智能体

| 智能体 | 温度 | 风格 |
|--------|------|------|
| 💬 口语化翻译 | 0.7 | B1 词汇、英语思维 |
| 📚 学习翻译 | 0.5 | 翻译→语法→词汇→学习提示 |
| 🎓 学术翻译 | 0.3 | 正式学术风格 |
| ⚡ 快速翻译 | 0.1 | 极简输出 |
| 🎨 创意翻译 | 0.9 | 意译、文化适配 |

## 📁 项目结构

```
src/
├── types/index.ts           # 类型 + 预置智能体 + 默认配置
├── stores/
│   ├── agentStore.ts        # 智能体 CRUD
│   ├── configStore.ts       # API 服务商 + 应用设置
│   └── historyStore.ts      # 翻译历史（收藏/搜索/过滤）
├── services/
│   ├── llm/adapter.ts       # LLM 适配器（chat / streaming / fetchModels / test）
│   ├── llm/types.ts         # Chat API 类型
│   └── translation.ts       # 翻译 + 记录创建
├── hooks/
│   ├── useTranslate.ts      # 翻译 hook（流式 + AbortController）
│   └── usePersistence.ts    # 持久化（文件 + localStorage 双轨）
├── components/
│   ├── layout/              # 布局（TitleBar / Sidebar / MainPanel / HistoryPanel）
│   ├── translation/         # 翻译（InputArea / OutputArea）
│   ├── agents/              # AgentEditor
│   └── settings/            # 设置（SettingsDialog / ShortcutTab / ApiConfig）
├── App.tsx                  # 根组件
└── main.tsx                 # 入口
```

## 🔧 构建环境 (Windows)

- MSVC：14.44.35207
- Windows SDK：10.0.26100.0
- CRT：静态链接，生成零依赖 exe

`打包.bat` 已包含完整的 PATH 配置，双击即可。

## 📄 License

MIT
