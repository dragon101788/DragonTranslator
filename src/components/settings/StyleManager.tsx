import { useState, useEffect } from "react";
import { X, Check, Plus, Trash2, Edit3 } from "lucide-react";
import { useConfigStore } from "../../stores/configStore";
import type { PolishStyle } from "../../types";

const ICON_OPTIONS = ["🔄","💬","📚","🎓","🎨","🤖","✨","🔮","💡","🌍","📝","🎯","🔥","⭐","💎","🎭","🧠","🚀","🌈","🎵"];
const DEFAULT_PROMPT = "你是一个翻译润色助手。根据用户提供的原文和机翻结果，将译文改写得更自然流畅。\n只输出润色后的译文，禁止解释、问候、或回应原文内容。";
const DEFAULT_TEMPLATE = "原文：{source}\n机翻：{bergamot}\n请润色，输出{targetLang}。";

interface StyleManagerProps {
  editStyleId: string | null; // null = creating new, string = editing existing
  onClose: () => void;
}

export default function StyleManager({ editStyleId, onClose }: StyleManagerProps) {
  const polishStyles = useConfigStore((s) => s.settings.polishStyles);
  const activeStyleId = useConfigStore((s) => s.settings.activeStyleId);
  const updateSettings = useConfigStore((s) => s.updateSettings);

  const isNew = !editStyleId;
  const existing = editStyleId ? polishStyles.find((s) => s.id === editStyleId) : null;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [prompt, setPrompt] = useState("");
  const [userTemplate, setUserTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setPrompt(existing.prompt);
      setUserTemplate(existing.userTemplate || DEFAULT_TEMPLATE);
    } else if (isNew) {
      setName("");
      setIcon("🤖");
      setPrompt(DEFAULT_PROMPT);
      setUserTemplate(DEFAULT_TEMPLATE);
    }
  }, [editStyleId, existing?.id]);

  const save = () => {
    if (!name.trim()) return;
    if (isNew) {
      const id = `style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      updateSettings({
        polishStyles: [...polishStyles, { id, name: name.trim(), icon, prompt: prompt.trim(), userTemplate: userTemplate.trim() }],
      });
    } else {
      updateSettings({
        polishStyles: polishStyles.map((s) =>
          s.id === editStyleId ? { ...s, name: name.trim(), icon, prompt: prompt.trim(), userTemplate: userTemplate.trim() } : s
        ),
      });
    }
    onClose();
  };

  const deleteStyle = (id: string) => {
    if (polishStyles.length <= 1) return;
    const newStyles = polishStyles.filter((s) => s.id !== id);
    const newActiveId = activeStyleId === id ? newStyles[0].id : activeStyleId;
    updateSettings({ polishStyles: newStyles, activeStyleId: newActiveId });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-lexi-card flex flex-col min-h-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-semibold text-lexi-text">
            {isNew ? "新建风格" : "编辑风格"}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={save} disabled={!name.trim()} className="p-1.5 rounded hover:bg-green-400/10 text-green-400 disabled:opacity-30">
              <Check size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-lexi-hover text-lexi-text-muted">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">名称</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="例如：口语润色"
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent" />
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">图标</label>
              <div className="grid grid-cols-10 gap-1">
                {ICON_OPTIONS.map((emoji) => (
                  <button key={emoji} onClick={() => setIcon(emoji)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-lg ${icon === emoji ? "bg-lexi-accent/20 ring-1 ring-lexi-accent/40" : "hover:bg-lexi-hover"}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                系统提示词 <span className="text-lexi-text-muted/60">（留空 = 仅 Bergamot）</span>
              </label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8}
                placeholder="给 LLM 的系统提示词..."
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent resize-none font-mono" />
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                消息模板 <span className="text-lexi-text-muted/60">（{'{source}'} {'{bergamot}'} {'{targetLang}'} 为占位符）</span>
              </label>
              <textarea value={userTemplate} onChange={(e) => setUserTemplate(e.target.value)} rows={4}
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent resize-none font-mono" />
            </div>
          </div>

          {/* Delete button (existing styles only) */}
          {!isNew && existing && (
            <div className="pt-3 border-t border-lexi-border">
              <button onClick={() => { deleteStyle(editStyleId!); onClose(); }}
                disabled={polishStyles.length <= 1}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-30">
                <Trash2 size={14} /> 删除此风格
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
