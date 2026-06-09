import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { TranslationAgent } from "../../types";

type ViewType = "translation" | "agent-editor" | "history" | "settings";

interface SidebarProps {
  activeView: ViewType;
  onSelectAgent: (agentId: string) => void;
  onEditAgent: (agent: TranslationAgent | null) => void;
  onNewAgent: () => void;
}

const COLLAPSE_THRESHOLD = 120;

export default function Sidebar({
  activeView,
  onSelectAgent,
  onEditAgent,
  onNewAgent,
}: SidebarProps) {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const duplicateAgent = useAgentStore((s) => s.duplicateAgent);
  const [width, setWidth] = useState(256);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const w = Math.min(Math.max(e.clientX, 56), 400);
      setWidth(w);
    };
    const onMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleDragStart = useCallback(() => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const collapsed = width < COLLAPSE_THRESHOLD;

  return (
    <div className="flex">
      <div
        className="flex flex-col bg-lexi-sidebar border-r border-lexi-border h-full shrink-0"
        style={{ width }}
      >
        {collapsed ? (
          /* ---- Compact view ---- */
          <div className="flex-1 overflow-y-auto px-1 pt-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`relative mb-1 rounded-lg transition-all cursor-pointer ${
                  agent.id === activeAgentId && activeView === "translation"
                    ? "bg-lexi-accent/20 text-lexi-accent-hover"
                    : "hover:bg-lexi-hover"
                }`}
                onClick={() => onSelectAgent(agent.id)}
                onMouseEnter={() => setHoveredId(agent.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex items-center gap-2 p-2">
                  <span className="text-lg flex-shrink-0">{agent.icon}</span>
                  {width >= 80 && (
                    <span className="text-xs text-lexi-text truncate">
                      {agent.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={onNewAgent}
              className="flex items-center justify-center w-full p-2 rounded-lg text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text transition-colors"
              title="新增智能体"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          /* ---- Full view ---- */
          <>
            <div className="flex-1 overflow-y-auto px-2 pt-3">
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
                        onClick={(e) => { e.stopPropagation(); onEditAgent(agent); }}
                        className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
                        title="编辑"
                      >
                        <SettingsIcon size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateAgent(agent.id); }}
                        className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
                        title="复制"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (agents.length <= 1) return; deleteAgent(agent.id); }}
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

            <div className="border-t border-lexi-border p-2">
              <button
                onClick={onNewAgent}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text transition-colors"
              >
                <Plus size={16} />
                <span>新增智能体</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Drag handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-lexi-accent/30 active:bg-lexi-accent/50 transition-colors shrink-0"
        onMouseDown={handleDragStart}
      />
    </div>
  );
}
