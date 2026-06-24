import { useState, useEffect, useCallback } from "react";
import type { AgentConfig } from "../../types";
import { useAgentStore } from "../../stores/agentStore";

interface AgentEditorProps {
  agentId: string | null; // null = create new
  onClose: () => void;
}

const ICON_OPTIONS = ["💬", "📚", "🎓", "⚡", "🎨", "🤖", "✨", "🔮", "💡", "🌍", "📝", "🎯"];

export default function AgentEditor({ agentId, onClose }: AgentEditorProps) {
  const agents = useAgentStore((s) => s.agents);
  const addAgent = useAgentStore((s) => s.addAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const isNew = !agentId;
  const agent = agentId ? agents.find((a) => a.id === agentId) : null;

  const [name, setName] = useState(agent?.name ?? "");
  const [icon, setIcon] = useState(agent?.icon ?? "🤖");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? "");
  const [config, setConfig] = useState<AgentConfig>(
    agent?.config ?? { model: "", temperature: 0.7, maxTokens: 2048 }
  );

  // Sync when switching agents
  useEffect(() => {
    setName(agent?.name ?? "");
    setIcon(agent?.icon ?? "🤖");
    setDescription(agent?.description ?? "");
    setSystemPrompt(agent?.systemPrompt ?? "");
    setConfig(agent?.config ?? { model: "", temperature: 0.7, maxTokens: 2048 });
  }, [agentId, agent?.name, agent?.icon, agent?.description, agent?.systemPrompt, agent?.config]);

  const saveIfValid = useCallback(() => {
    if (!name.trim() || !systemPrompt.trim()) return;

    if (isNew) {
      const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addAgent({
        id,
        name: name.trim(),
        icon,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        config,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Select the newly created agent and go back to translation
      useAgentStore.getState().setActiveAgent(id);
      onClose();
    } else if (agentId) {
      updateAgent(agentId, {
        name: name.trim(),
        icon,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        config,
      });
    }
  }, [name, icon, description, systemPrompt, config, isNew, agentId, addAgent, updateAgent, onClose]);

  // Auto-save on blur for existing agents
  const handleBlur = useCallback(() => {
    if (!isNew && agentId && name.trim() && systemPrompt.trim()) {
      updateAgent(agentId, {
        name: name.trim(),
        icon,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        config,
      });
    }
  }, [isNew, agentId, name, icon, description, systemPrompt, config, updateAgent]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-lexi-card flex flex-col min-h-0 h-full">
        {/* Header */}
        <div className="flex items-center px-5 py-4">
          <h2 className="text-lg font-semibold text-lexi-text">
            {isNew ? "新增智能体" : "编辑智能体"}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name + Icon */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <label className="block text-xs text-lexi-text-muted mb-2">
                图标
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setIcon(emoji)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all ${
                      icon === emoji
                        ? "bg-lexi-accent/20 ring-1 ring-lexi-accent/40"
                        : "hover:bg-lexi-hover"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <div className="flex-1">
                  <label className="block text-xs text-lexi-text-muted mb-1">
                    名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="例如：口语化翻译"
                    className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-lexi-text-muted mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="简短描述这个智能体的翻译风格"
                  className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent"
                />
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs text-lexi-text-muted mb-1">
              系统提示词 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={handleBlur}
              placeholder="编写提示词，定义翻译风格、输出格式、约束条件..."
              rows={10}
              className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent resize-none font-mono"
            />
          </div>

          {/* Config */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                模型 (可选)
              </label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
                onBlur={handleBlur}
                placeholder="使用默认模型"
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                温度 ({config.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, temperature: parseFloat(e.target.value) }))
                }
                className="w-full accent-lexi-accent"
              />
              <div className="flex justify-between text-xs text-lexi-text-muted mt-0.5">
                <span>精确</span>
                <span>创意</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-lexi-text-muted mb-1">
                最大 Token
              </label>
              <select
                value={config.maxTokens}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxTokens: parseInt(e.target.value) }))
                }
                onBlur={handleBlur}
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text focus:outline-none focus:ring-1 focus:ring-lexi-accent"
              >
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
                <option value={16384}>16384</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer — only for new agents */}
        {isNew && (
          <div className="flex items-center justify-end gap-3 px-5 py-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-lexi-text-muted hover:bg-lexi-hover transition-colors"
            >
              取消
            </button>
            <button
              onClick={saveIfValid}
              disabled={!name.trim() || !systemPrompt.trim()}
              className="px-5 py-2 rounded-lg bg-lexi-accent hover:bg-lexi-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
            >
              创建
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
