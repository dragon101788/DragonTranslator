import { useState, useEffect } from "react";
import { X, Check, Plus, Trash2, Edit3 } from "lucide-react";
import { useConfigStore } from "../../stores/configStore";
import type { PolishStyle } from "../../types";

const ICON_OPTIONS = ["🔄","💬","📚","🎓","🎨","🤖","✨","🔮","💡","🌍","📝","🎯","🔥","⭐","💎","🎭","🧠","🚀","🌈","🎵"];
const DEFAULT_PROMPT = "你是一个翻译润色助手。只输出润色后的译文，禁止解释或回应。\n\n原文：{source}\n机翻：{bergamot}\n请润色，输出{targetLang}。";

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
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setPrompt(existing.prompt);
      setTemperature(existing.temperature ?? 0.7);
      setMaxTokens(existing.maxTokens ?? 4096);
    } else if (isNew) {
      setName("");
      setIcon("🤖");
      setPrompt(DEFAULT_PROMPT);
      setTemperature(0.7);
      setMaxTokens(4096);
    }
  }, [editStyleId, existing?.id]);

  const save = () => {
    if (!name.trim()) return;
    const style = { id: "", name: name.trim(), icon, prompt: prompt.trim(), temperature, maxTokens };
    if (isNew) {
      style.id = `style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      updateSettings({ polishStyles: [...polishStyles, style] });
    } else {
      updateSettings({
        polishStyles: polishStyles.map((s) =>
          s.id === editStyleId ? { ...s, name: name.trim(), icon, prompt: prompt.trim(), temperature, maxTokens } : s
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
          </div>

          {/* Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">温度 ({temperature.toFixed(1)})</label>
              <input type="range" min="0" max="2" step="0.1" value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-lexi-accent" />
              <div className="flex justify-between text-xs text-lexi-text-muted mt-0.5">
                <span>精确</span><span>创意</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">最大 Token</label>
              <select value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text focus:outline-none focus:ring-1 focus:ring-lexi-accent">
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
                <option value={16384}>16384</option>
              </select>
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
