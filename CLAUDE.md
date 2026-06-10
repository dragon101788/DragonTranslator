# 龙图腾翻译 - 桌面翻译软件

## 项目概述

类似有道词典的桌面翻译应用，**用户自行配置大模型 API**，通过自定义提示词智能体实现不同风格的翻译。绿色便携，所有数据存本地。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript 6 + Vite 8 |
| 样式 | Tailwind CSS v4 (`@tailwindcss/vite` 插件) |
| 状态管理 | Zustand |
| 图标 | lucide-react |
| Markdown 渲染 | react-markdown + remark-gfm |
| 持久化 | `@tauri-apps/plugin-store`（存本地 JSON） |

## 关键架构决策

1. **LLM 调用在前端**：直接用 `fetch` 调 OpenAI 兼容 API，不走 Tauri HTTP 插件（保持轻量）
2. **流式输出**：SSE 逐 chunk 解析，AbortController 支持中断
3. **全局快捷键 Alt+Space**：Rust 端 `global-shortcut` 插件注册，注册前先 `unregister` 容错
4. **绿色便携**：配置文件 `dragon-translator-config.json` 紧跟 exe（通过 `resourceDir()` 获取 exe 路径 + 绝对路径传 store），用 `tauri-plugin-store` 持久化，不写注册表
5. **自定义主题色**：Tailwind v4 `@theme` 块定义 `lexi-*` 色系（深色主题）
6. **WebDAV 同步**：设置面板支持拉取/推送配置到 WebDAV 服务器
7. **双重持久化**：Tauri 环境下用文件存储，浏览器 `localhost:5175` 调试时自动降级到 `localStorage`
8. **静态链接 CRT**：`.cargo/config.toml` 配置 `crt-static`，生成的 exe 不依赖外部 VC++ 运行时

## 项目结构

```
lexi-desktop/
├── 运行.bat                    # 双击启动开发模式（自动配 MSVC 环境）
├── 打包.bat                    # 双击一键打包便携 exe
├── .vscode/
│   ├── tasks.json             # VSCode 任务：启动开发(Ctrl+Shift+B) / 打包 / 打开输出
│   └── launch.json            # VSCode 调试：MSVC 调试器附加 Rust 后端
├── src-tauri/                 # Rust 后端
│   ├── .cargo/
│   │   └── config.toml        # crt-static 静态链接，生成零依赖 exe
│   ├── src/lib.rs             # 插件注册 + Alt+Space 全局快捷键
│   ├── Cargo.toml             # 依赖：tauri, store, global-shortcut, log
│   └── tauri.conf.json        # 窗口 860×620, devUrl:5175, bundle 关闭
├── src/                       # React 前端
│   ├── types/index.ts         # 所有 TS 类型 + 5 个预置智能体 + 默认配置
│   ├── stores/
│   │   ├── agentStore.ts      # 智能体 CRUD（增删改查/复制/重置）
│   │   ├── configStore.ts     # API 服务商 + 应用设置
│   │   └── historyStore.ts    # 翻译历史（收藏/搜索/过滤）
│   ├── services/
│   │   ├── llm/adapter.ts     # LLM 适配器（chat, chatStream流式, fetchModels拉模型列表, testConnection）
│   │   ├── llm/types.ts       # Chat API 请求/响应类型
│   │   └── translation.ts     # translate, translateStream, createTranslationRecord
│   ├── hooks/
│   │   ├── useTranslate.ts    # 翻译 hook（流式输出 + AbortController 停止）
│   │   └── usePersistence.ts  # 持久化（Tauri 文件 + localStorage 降级，Zustand subscribe 驱动）
│   ├── components/
│   │   ├── layout/TitleBar.tsx      # 自定义标题栏（拖拽/窗口控制/历史/设置按钮+浏览器兼容）
│   │   ├── layout/Sidebar.tsx       # 侧边栏（可拖拽调宽/紧凑模式/智能体CRUD）
│   │   ├── layout/MainPanel.tsx     # 主面板（视图容器/翻译/历史/设置/编辑切换）
│   │   ├── layout/HistoryPanel.tsx  # 翻译历史（左右分栏：列表+详情）
│   │   ├── translation/InputArea.tsx  # 输入区（语言选择/交换/Enter翻译/停止按钮）
│   │   ├── translation/OutputArea.tsx # 输出区（Markdown渲染/自动滚底/复制）
│   │   ├── agents/AgentEditor.tsx     # 智能体编辑器（图标/名称/提示词/温度/Token）
│   │   └── settings/
│   │       ├── SettingsDialog.tsx     # 设置面板（API/WebDAV/快捷键/外观 四个Tab）
│   │       ├── ShortcutTab.tsx        # 快捷键录制器
│   │       └── ApiConfig.tsx          # API 配置（服务商管理/拉模型列表/测试连接）
│   ├── App.tsx                # 根组件（视图状态机 + 持久化 + 主题同步）
│   ├── main.tsx               # ReactDOM 入口
│   └── index.css              # Tailwind v4 @import + @theme 自定义色 + 动画
```

## 预置智能体（5个）

| ID | 名称 | 温度 | 风格 |
|----|------|------|------|
| agent-colloquial | 💬 口语化翻译 | 0.7 | B1词汇、英语思维 |
| agent-learning | 📚 学习翻译 | 0.5 | 翻译→语法→词汇→学习提示 |
| agent-academic | 🎓 学术翻译 | 0.3 | 正式学术 |
| agent-quick | ⚡ 快速翻译 | 0.1 | 极简输出 |
| agent-creative | 🎨 创意翻译 | 0.9 | 意译/文化适配 |

## 运行方式

```bash
# 开发模式
cd C:\Users\dragon\Desktop\lexi-desktop
npx tauri dev
# 或在 VSCode 中 Ctrl+Shift+B

# 打包便携 exe
双击 打包.bat
# 或在 VSCode 中 Ctrl+Shift+P → "打包便携 EXE"
# 输出：根目录\app.exe（配置文件自动创建在同目录）
```

Vite 端口：**5175**（vite.config.ts strictPort 指定）
快捷键：**Ctrl+Alt+X**（全局切换窗口显隐，设置面板可自定义）

## 开发服务自动重启

- **每次修改 `src-tauri/` 下的 Rust 代码后**，必须重启 `npx tauri dev`（前端 HMR 只热更新 TS/JS，不更新 Rust）
- 重启步骤：先杀旧进程（cargo、app.exe、占用 5175 端口的 node），再 `npx tauri dev`
- 前端代码（`src/**`）改动无需重启，Vite HMR 自动生效

## 构建环境注意

- **项目必须在纯 ASCII 路径下构建**（MSVC 链接器不支持中文路径）
- 需要 VS Build Tools 2022（已通过 winget 安装到 `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`）
- MSVC 版本：14.44.35207，Windows SDK：10.0.26100.0
- `dev.bat` 已包含完整的 PATH 配置

## 持久化机制

- **Tauri 端**：通过 `resourceDir()` 获取 exe 所在目录，用绝对路径传给 `tauri-plugin-store`，配置文件紧跟 exe
- **浏览器端**：`localStorage` 兜底（`localhost:5175` 调试时可用）
- **驱动方式**：Zustand `subscribe` 直接订阅三 store（agent/config/history），50ms 去抖 + JSON 比对去重
- **保存时机**：每次状态变更自动保存 + `beforeunload` 事件 flush 最后数据

## 当前状态

- [x] 项目骨架 + Rust 后端（store + global-shortcut 插件）
- [x] 侧边栏可拖拽调整宽度 + 紧凑模式 + 右上角按钮
- [x] 翻译输入/输出面板（可拖拽分割 + 各占一半布局）
- [x] 流式翻译输出 + 停止按钮 + 自动滚底
- [x] API 配置 + 拉取模型列表 + 连接测试
- [x] 智能体编辑器（图标/名称/提示词/温度/Token）
- [x] 翻译历史（搜索/收藏/详情）
- [x] WebDAV 配置同步（拉取/推送）
- [x] 全局快捷键 Ctrl+Alt+X（设置面板可自定义）
- [x] 系统托盘（最小化到托盘 + 左键切换 + 右键菜单）
- [x] 持久化存储（文件 + localStorage 双轨，配置紧跟 exe）
- [x] 便携打包（静态链接 CRT，bundle 关闭，单 exe 绿色发布）
- [x] VSCode 集成（任务 + 调试配置）
- [x] 自绘标题栏（拖拽移动 + 窗口控制按钮）
- [x] 主题系统（深色 / 月光白 / 暗夜紫）
- [x] 字号滑块（12–20px，全局缩放）
- [ ] i18n 多语言界面