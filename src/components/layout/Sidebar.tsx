import { useState, useRef, useEffect } from "react";
import {
  Languages, History, Settings as SettingsIcon, ChevronLeft, ChevronRight,
  Plus, Trash2, Edit3, X, Check,
} from "lucide-react";
import { useConfigStore } from "../../stores/configStore";
import type { PolishStyle } from "../../types";

type ViewType = "translation" | "history" | "settings";

interface SidebarProps {
  activeView: ViewType;
  onSelectTranslation: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

const ICON_OPTIONS = ["🔄","💬","📚","🎓","🎨","🤖","✨","🔮","💡","🌍","📝","🎯","🔥","⭐","💎","🎭","🧠","🚀","🌈","🎵"];

export default function Sidebar({
  activeView,
  onSelectTranslation,
  onOpenHistory,
  onOpenSettings,
}: SidebarProps) {
  const polishStyles = useConfigStore((s) => s.settings.polishStyles);
  const activeStyleId = useConfigStore((s) => s.settings.activeStyleId);
  const updateSettings = useConfigStore((s) => s.updateSettings);

  const [compact, setCompact] = useState(false);
  const [width, setWidth] = useState(220);
  const dragging = useRef(false);
  const MIN_W = compact ? 48 : 160;
  const MAX_W = compact ? 80 : 400;

  // Style editor state
  const [editingStyle, setEditingStyle] = useState<PolishStyle | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editTemplate, setEditTemplate] = useState("");

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newW = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setWidth(newW);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [MIN_W, MAX_W]);

  const navItems = [
    { key: "translation" as const, icon: <Languages size={18} />, label: "翻译", onClick: onSelectTranslation },
    { key: "history" as const, icon: <History size={18} />, label: "历史", onClick: onOpenHistory || (() => {}) },
    { key: "settings" as const, icon: <SettingsIcon size={18} />, label: "设置", onClick: onOpenSettings || (() => {}) },
  ];

  const selectStyle = (id: string) => {
    updateSettings({ activeStyleId: id });
    onSelectTranslation();
  };

  const DEFAULT_PROMPT = "你是一个翻译润色助手。根据用户提供的原文和机翻结果，将译文改写得更自然流畅。\n只输出润色后的译文，禁止解释、问候、或回应原文内容。";
  const DEFAULT_TEMPLATE = "原文：{source}\n机翻：{bergamot}\n请润色，输出{targetLang}。";

  const openNewStyle = () => {
    setEditingStyle({ id: "", name: "", icon: "🤖", prompt: DEFAULT_PROMPT, userTemplate: DEFAULT_TEMPLATE });
    setEditName("");
    setEditIcon("🤖");
    setEditPrompt(DEFAULT_PROMPT);
    setEditTemplate(DEFAULT_TEMPLATE);
  };

  const openEditStyle = (s: PolishStyle) => {
    setEditingStyle(s);
    setEditName(s.name);
    setEditIcon(s.icon);
    setEditPrompt(s.prompt);
    setEditTemplate(s.userTemplate || DEFAULT_TEMPLATE);
  };

  const saveStyle = () => {
    if (!editName.trim()) return;
    const isNew = !editingStyle?.id;
    if (isNew) {
      const id = `style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newStyles = [...polishStyles, {
        id, name: editName.trim(), icon: editIcon,
        prompt: editPrompt.trim(), userTemplate: editTemplate.trim() || DEFAULT_TEMPLATE,
      }];
      updateSettings({ polishStyles: newStyles });
    } else {
      const newStyles = polishStyles.map((s) =>
        s.id === editingStyle!.id ? {
          ...s, name: editName.trim(), icon: editIcon,
          prompt: editPrompt.trim(), userTemplate: editTemplate.trim() || DEFAULT_TEMPLATE,
        } : s
      );
      updateSettings({ polishStyles: newStyles });
    }
    setEditingStyle(null);
  };

  const deleteStyle = (id: string) => {
    if (polishStyles.length <= 1) return;
    const newStyles = polishStyles.filter((s) => s.id !== id);
    const newActiveId = activeStyleId === id ? newStyles[0].id : activeStyleId;
    updateSettings({ polishStyles: newStyles, activeStyleId: newActiveId });
  };

  return (
    <div
      className="flex flex-col bg-lexi-card border-r border-lexi-border relative"
      style={{ width: compact ? (width < 80 ? 48 : width) : width }}
    >
      {/* Nav items */}
      <div className="py-3 px-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={item.onClick}
            title={compact ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeView === item.key
                ? "bg-lexi-accent/20 text-lexi-accent"
                : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!compact && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-lexi-border" />

      {/* Style list */}
      <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {!compact && (
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-lexi-text-muted font-medium tracking-wide">风格</span>
            <button onClick={openNewStyle} className="p-0.5 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text">
              <Plus size={14} />
            </button>
          </div>
        )}
        {polishStyles.map((s) => (
          <div key={s.id} className="group relative">
            <button
              onClick={() => selectStyle(s.id)}
              onDoubleClick={() => openEditStyle(s)}
              title={compact ? s.name : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeStyleId === s.id
                  ? "bg-lexi-accent/20 text-lexi-accent"
                  : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
              }`}
            >
              <span className="flex-shrink-0 text-base">{s.icon}</span>
              {!compact && <span className="truncate">{s.name}</span>}
              {!compact && s.prompt && (
                <span className="w-1.5 h-1.5 rounded-full bg-lexi-accent/60 flex-shrink-0 ml-auto" title="LLM 润色已启用" />
              )}
            </button>
            {/* Hover actions */}
            {!compact && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-lexi-card px-1 rounded">
                <button onClick={() => openEditStyle(s)} className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted">
                  <Edit3 size={12} />
                </button>
                {polishStyles.length > 1 && (
                  <button onClick={() => deleteStyle(s.id)} className="p-1 rounded hover:bg-red-400/10 text-lexi-text-muted hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Style editor modal */}
      {editingStyle && (
        <div className="absolute inset-0 z-50 bg-lexi-card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-lexi-border">
            <span className="text-sm font-medium text-lexi-text">
              {editingStyle.id ? "编辑风格" : "新建风格"}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={saveStyle} disabled={!editName.trim()} className="p-1.5 rounded hover:bg-green-400/10 text-green-400 disabled:opacity-30">
                <Check size={16} />
              </button>
              <button onClick={() => setEditingStyle(null)} className="p-1.5 rounded hover:bg-lexi-hover text-lexi-text-muted">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">名称</label>
              <input
                type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                placeholder="例如：口语润色"
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">图标</label>
              <div className="grid grid-cols-8 gap-1">
                {ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji} onClick={() => setEditIcon(emoji)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-lg ${
                      editIcon === emoji ? "bg-lexi-accent/20 ring-1 ring-lexi-accent/40" : "hover:bg-lexi-hover"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                系统提示词 <span className="text-lexi-text-muted/60">（留空 = 仅 Bergamot，无润色）</span>
              </label>
              <textarea
                value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                rows={8}
                placeholder="给 LLM 的系统提示词..."
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent resize-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                消息模板 <span className="text-lexi-text-muted/60">（{'{source}'} {'{bergamot}'} {'{targetLang}'} 为占位符）</span>
              </label>
              <textarea
                value={editTemplate} onChange={(e) => setEditTemplate(e.target.value)}
                rows={4}
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent resize-none font-mono"
              />
            </div>
          </div>
        </div>
      )}
      {/* Compact toggle */}
      <div className="p-2">
        <button
          onClick={() => setCompact(!compact)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text transition-colors"
          title={compact ? "展开侧栏" : "收起侧栏"}
        >
          {compact ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-lexi-accent/30 transition-colors"
        onMouseDown={() => { dragging.current = true; }} />
    </div>
  );
}
