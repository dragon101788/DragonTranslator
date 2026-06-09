import { useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Settings,
  History,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { TranslationAgent } from "../../types";

type ViewType = "translation" | "agent-editor" | "history" | "settings";

interface SidebarProps {
  activeView: ViewType;
  onSelectAgent: (agentId: string) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onEditAgent: (agent: TranslationAgent | null) => void;
  onNewAgent: () => void;
}

export default function Sidebar({
  activeView,
  onSelectAgent,
  onOpenSettings,
  onOpenHistory,
  onEditAgent,
  onNewAgent,
}: SidebarProps) {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const duplicateAgent = useAgentStore((s) => s.duplicateAgent);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-14 bg-lexi-sidebar border-r border-lexi-border py-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
          title="展开侧边栏"
        >
          <ChevronRight size={18} />
        </button>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`p-2 rounded-lg transition-colors text-lg ${
              agent.id === activeAgentId
                ? "bg-lexi-accent/20 text-lexi-accent-hover"
                : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
            }`}
            title={agent.name}
          >
            {agent.icon}
          </button>
        ))}
        <div className="border-t border-lexi-border w-full my-1" />
        <button
          onClick={onOpenHistory}
          className={`p-2 rounded-lg transition-colors ${
            activeView === "history"
              ? "bg-lexi-accent/20 text-lexi-accent-hover"
              : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
          }`}
          title="翻译历史"
        >
          <History size={16} />
        </button>
        <button
          onClick={onOpenSettings}
          className={`p-2 rounded-lg transition-colors ${
            activeView === "settings"
              ? "bg-lexi-accent/20 text-lexi-accent-hover"
              : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
          }`}
          title="设置"
        >
          <Settings size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 bg-lexi-sidebar border-r border-lexi-border h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lexi-border">
        <h1 className="text-lg font-semibold tracking-tight text-lexi-text">
          龙图腾翻译
        </h1>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
          title="收起侧边栏"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Nav items */}
      <div className="px-2 pt-2">
        <button
          onClick={onOpenHistory}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            activeView === "history"
              ? "bg-lexi-accent/15 text-lexi-accent-hover font-medium"
              : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
          }`}
        >
          <History size={16} />
          <span>翻译历史</span>
        </button>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            activeView === "settings"
              ? "bg-lexi-accent/15 text-lexi-accent-hover font-medium"
              : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
          }`}
        >
          <Settings size={16} />
          <span>设置</span>
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-lexi-border mx-3 my-2" />

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-medium text-lexi-text-muted uppercase tracking-wider">
            智能体
          </span>
          <button
            onClick={onNewAgent}
            className="p-1 rounded-md hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-accent-hover transition-colors"
            title="新增智能体"
          >
            <Plus size={16} />
          </button>
        </div>

        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`group relative mb-1 rounded-lg transition-all cursor-pointer ${
              agent.id === activeAgentId && activeView === "translation"
                ? "bg-lexi-accent/15 ring-1 ring-lexi-accent/30"
                : "hover:bg-lexi-hover"
            }`}
            onClick={() => onSelectAgent(agent.id)}
            onMouseEnter={() => setHoveredId(agent.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="flex items-start gap-3 p-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-lexi-text truncate">
                  {agent.name}
                </div>
                <div className="text-xs text-lexi-text-muted line-clamp-2 mt-0.5">
                  {agent.description}
                </div>
              </div>
            </div>

            {hoveredId === agent.id && (
              <div className="absolute right-1 top-1 flex gap-0.5 bg-lexi-sidebar/95 rounded-lg p-0.5 shadow-lg animate-fade-in">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAgent(agent);
                  }}
                  className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
                  title="编辑"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateAgent(agent.id);
                  }}
                  className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
                  title="复制"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (agents.length <= 1) return;
                    deleteAgent(agent.id);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-lexi-text-muted hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer — new agent */}
      <div className="border-t border-lexi-border p-2">
        <button
          onClick={onNewAgent}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text transition-colors"
        >
          <Plus size={16} />
          <span>新增智能体</span>
        </button>
      </div>
    </div>
  );
}
