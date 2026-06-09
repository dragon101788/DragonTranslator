import { useState } from "react";
import {
  Plus,
  Trash2,
  FlaskConical,
  Loader2,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import type { LLMProvider } from "../../types";
import { useConfigStore } from "../../stores/configStore";
import { LLMAdapter } from "../../services/llm/adapter";

export default function ApiConfig() {
  const providers = useConfigStore((s) => s.providers);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const addProvider = useConfigStore((s) => s.addProvider);
  const updateProvider = useConfigStore((s) => s.updateProvider);
  const deleteProvider = useConfigStore((s) => s.deleteProvider);
  const setActiveProvider = useConfigStore((s) => s.setActiveProvider);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  const handleAdd = () => {
    const newProvider: LLMProvider = {
      id: `provider-${Date.now()}`,
      name: "新服务商",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      models: ["gpt-4o-mini"],
      isDefault: false,
      createdAt: Date.now(),
    };
    addProvider(newProvider);
  };

  const handleTest = async () => {
    if (!activeProvider) return;
    setTesting(true);
    setTestResult(null);

    const adapter = new LLMAdapter(activeProvider);
    const model = activeProvider.models[0] || "gpt-4o-mini";
    const result = await adapter.testConnection(model);

    if (result.success) {
      setTestResult(`✅ 连接成功! 延迟: ${result.latency}ms, 模型: ${result.model}`);
    } else {
      setTestResult(`❌ 连接失败: ${result.error}`);
    }

    setTesting(false);
  };

  const handleFetchModels = async () => {
    if (!activeProvider) return;
    setFetchingModels(true);
    setTestResult(null);

    try {
      const adapter = new LLMAdapter(activeProvider);
      const models = await adapter.fetchModels();
      updateProvider(activeProvider.id, { models });
      setTestResult(`✅ 拉取成功! 共 ${models.length} 个模型`);
    } catch (e: any) {
      setTestResult(`❌ 拉取失败: ${e?.message || "未知错误"}`);
    }

    setFetchingModels(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-lexi-text">API 服务商</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text transition-colors"
        >
          <Plus size={14} />
          <span>添加</span>
        </button>
      </div>

      {/* Provider tabs */}
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => {
              setActiveProvider(provider.id);
              setTestResult(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              provider.id === activeProviderId
                ? "bg-lexi-accent/20 text-lexi-accent-hover ring-1 ring-lexi-accent/30"
                : "text-lexi-text-muted hover:bg-lexi-hover hover:text-lexi-text"
            }`}
          >
            {provider.name}
          </button>
        ))}
      </div>

      {/* Active provider config */}
      {activeProvider && (
        <div className="space-y-4 p-4 bg-lexi-input/50 rounded-xl border border-lexi-border">
          {/* Name */}
          <div>
            <label className="block text-xs text-lexi-text-muted mb-1">
              名称
            </label>
            <input
              type="text"
              value={activeProvider.name}
              onChange={(e) =>
                updateProvider(activeProvider.id, { name: e.target.value })
              }
              className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text focus:outline-none focus:ring-1 focus:ring-lexi-accent"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs text-lexi-text-muted mb-1">
              Base URL
            </label>
            <input
              type="text"
              value={activeProvider.baseUrl}
              onChange={(e) =>
                updateProvider(activeProvider.id, { baseUrl: e.target.value })
              }
              placeholder="https://api.openai.com/v1"
              className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent font-mono"
            />
            <div className="mt-1 text-xs text-lexi-text-muted">
              支持所有兼容 OpenAI 协议的 API（DeepSeek、通义千问、Kimi 等）
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs text-lexi-text-muted mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={activeProvider.apiKey}
                onChange={(e) =>
                  updateProvider(activeProvider.id, { apiKey: e.target.value })
                }
                placeholder="sk-..."
                className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 pr-10 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-lexi-hover text-lexi-text-muted"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Models */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-lexi-text-muted">
                模型列表 ({activeProvider.models.length})
              </label>
              <button
                onClick={handleFetchModels}
                disabled={fetchingModels || !activeProvider.apiKey}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-lexi-accent-hover hover:bg-lexi-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {fetchingModels ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                <span>拉取模型列表</span>
              </button>
            </div>
            {activeProvider.models.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {activeProvider.models.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-lexi-accent/10 text-lexi-accent-hover text-xs rounded-md font-mono"
                  >
                    {model}
                    <button
                      onClick={() =>
                        updateProvider(activeProvider.id, {
                          models: activeProvider.models.filter((m) => m !== model),
                        })
                      }
                      className="hover:text-red-400 transition-colors"
                      title="移除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={activeProvider.models.join(", ")}
              onChange={(e) =>
                updateProvider(activeProvider.id, {
                  models: e.target.value
                    .split(",")
                    .map((m) => m.trim())
                    .filter(Boolean),
                })
              }
              placeholder="gpt-4o-mini, gpt-4o（或点击上方按钮自动拉取）"
              className="w-full bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing || !activeProvider.apiKey}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lexi-success/20 hover:bg-lexi-success/30 disabled:opacity-40 disabled:cursor-not-allowed text-lexi-success text-sm font-medium transition-all"
            >
              {testing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FlaskConical size={15} />
              )}
              <span>测试连接</span>
            </button>

            {providers.length > 1 && (
              <button
                onClick={() => deleteProvider(activeProvider.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-all"
              >
                <Trash2 size={15} />
                <span>删除此服务商</span>
              </button>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm animate-fade-in ${
                testResult.startsWith("✅")
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {testResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
