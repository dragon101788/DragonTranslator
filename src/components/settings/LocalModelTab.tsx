import { useState, useEffect, useCallback } from "react";
import { Cpu, Play, Square, CheckCircle, XCircle, Loader2, FolderOpen, RotateCw } from "lucide-react";
import { useConfigStore } from "../../stores/configStore";

interface LocalModelStatus {
  running: boolean;
  port: number;
  model: string;
  llamafile: string;
}

function isTauriEnv() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function LocalModelTab() {
  const settings = useConfigStore((s) => s.settings);
  const updateSettings = useConfigStore((s) => s.updateSettings);
  const [status, setStatus] = useState<LocalModelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isTauri = isTauriEnv();

  const refreshStatus = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const s = await invoke<LocalModelStatus>("get_local_model_status", {
        port: settings.localModel.port,
      });
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, [settings.localModel.port, isTauri]);

  useEffect(() => {
    refreshStatus();
    if (!isTauri) return;
    const interval = setInterval(refreshStatus, 3000);
    return () => clearInterval(interval);
  }, [refreshStatus, isTauri]);

  const handleStart = async (modelToUse?: string) => {
    setLoading(true);
    setMessage("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const model = modelToUse || settings.localModel.model;
      const msg = await invoke<string>("start_local_model", {
        port: settings.localModel.port,
        model,
      });
      setMessage(msg);

      // Auto-register local provider in API config
      const { useConfigStore } = await import("../../stores/configStore");
      const state = useConfigStore.getState();
      const existing = state.providers.find((p) => p.id === "local");
      const localUrl = `http://127.0.0.1:${settings.localModel.port}/v1`;
      if (existing) {
        state.updateProvider("local", { baseUrl: localUrl, apiKey: "local" });
      } else {
        state.addProvider({
          id: "local",
          name: "本地模型 (Qwen3)",
          baseUrl: localUrl,
          apiKey: "local",
          models: [],
          isDefault: false,
          createdAt: Date.now(),
        });
      }
      // Set as active provider
      state.setActiveProvider("local");

      // Auto-fetch model list from local server
      try {
        const { LLMAdapter } = await import("../../services/llm/adapter");
        const adapter = new LLMAdapter({
          id: "local",
          name: "本地模型",
          baseUrl: localUrl,
          apiKey: "local",
          models: [],
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        const models = await adapter.fetchModels();
        if (models.length > 0) {
          state.updateProvider("local", { models });
        }
      } catch {
        // Model list fetch is optional
      }

      await refreshStatus();
    } catch (e: any) {
      setMessage(`❌ ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const msg = await invoke<string>("stop_local_model");
      setMessage(msg);
      await refreshStatus();
    } catch (e: any) {
      setMessage(`❌ ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status?.running ?? false;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-lexi-text">本地模型</h3>
      <p className="text-sm text-lexi-text-muted">
        使用 llamafile + Qwen3 在本地运行翻译模型，无需联网。
        首次启动需加载模型，约需 10–30 秒。
      </p>

      {/* Browser mode notice */}
      {!isTauri && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-sm text-yellow-400/80">
          本地模型仅在桌面应用中可用。请在 Tauri 环境下运行。
        </div>
      )}

      {/* Status card */}
      <div
        className={`p-4 rounded-xl border transition-colors ${
          !isTauri ? "opacity-50 pointer-events-none" : ""
        } ${
          isRunning
            ? "bg-green-500/5 border-green-500/20"
            : "bg-lexi-bg border-lexi-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isRunning ? "bg-green-500/10 text-green-400" : "bg-lexi-border/50 text-lexi-text-muted"
              }`}
            >
              <Cpu size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-lexi-text">
                  本地模型
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isRunning
                      ? "bg-green-500/10 text-green-400"
                      : "bg-lexi-border/50 text-lexi-text-muted"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <CheckCircle size={10} />
                      运行中
                    </>
                  ) : (
                    <>
                      <XCircle size={10} />
                      已停止
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-lexi-text-muted mt-0.5">
                {status ? `${status.llamafile} · ${status.model}` : "检查中..."}
              </p>
              {isRunning && status && (
                <p className="text-xs text-lexi-text-muted">
                  API: http://127.0.0.1:{status.port}/v1
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Square size={14} />
                )}
                <span>停止</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-lexi-accent/15 hover:bg-lexi-accent/25 text-lexi-accent-hover text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                <span>启动</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.startsWith("❌")
              ? "bg-red-500/10 text-red-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {message}
        </div>
      )}

      {/* Model path */}
      <div>
        <label className="block text-xs text-lexi-text-muted mb-1">
          GGUF 模型路径
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={settings.localModel.model}
            onChange={(e) =>
              updateSettings({
                localModel: { ...settings.localModel, model: e.target.value },
              })
            }
            placeholder="qwen3-0.6b-q4_k_m.gguf"
            className="flex-1 bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text placeholder-lexi-text-muted/40 focus:outline-none focus:ring-1 focus:ring-lexi-accent font-mono"
          />
          <button
            onClick={async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("open_user_dir");
              } catch {}
            }}
            className="p-2 rounded-lg bg-lexi-input border border-lexi-border text-lexi-text-muted hover:text-lexi-text hover:bg-lexi-hover transition-colors flex-shrink-0"
            title="打开模型目录"
          >
            <FolderOpen size={15} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-lexi-text-muted">
            路径相对于 ~/Dragon/Translator/，也支持绝对路径
          </p>
          {isRunning && (
            <button
              onClick={async () => {
                const model = settings.localModel.model;
                if (!model.endsWith(".gguf")) {
                  setMessage("❌ 模型文件必须以 .gguf 结尾");
                  return;
                }
                setMessage("⏳ 验证并重启中...");
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("stop_local_model");
                  await new Promise((r) => setTimeout(r, 1000));
                  const msg = await invoke<string>("start_local_model", {
                    port: settings.localModel.port,
                    model,
                  });
                  setMessage(msg);
                  await refreshStatus();
                } catch (e: any) {
                  setMessage(`❌ ${e}`);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-lexi-accent-hover hover:bg-lexi-accent/10 transition-colors"
            >
              <RotateCw size={12} />
              <span>验证并重启</span>
            </button>
          )}
        </div>
      </div>

      {/* Port config */}
      <div>
        <label className="block text-xs text-lexi-text-muted mb-1">
          API 端口
        </label>
        <input
          type="number"
          value={settings.localModel.port}
          onChange={(e) => {
            const port = parseInt(e.target.value) || 5158;
            updateSettings({
              localModel: { ...settings.localModel, port },
            });
          }}
          className="w-28 bg-lexi-input border border-lexi-border rounded-lg px-3 py-2 text-sm text-lexi-text focus:outline-none focus:ring-1 focus:ring-lexi-accent"
        />
        <p className="text-xs text-lexi-text-muted mt-1">
          默认 5158，避免与 Vite 开发端口 5157 冲突
        </p>
      </div>

      {/* Auto-start */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-lexi-text">开机自启本地模型</span>
          <p className="text-xs text-lexi-text-muted mt-0.5">
            启动应用时自动加载本地模型
          </p>
        </div>
        <button
          onClick={() =>
            updateSettings({
              localModel: {
                ...settings.localModel,
                enabled: !settings.localModel.enabled,
              },
            })
          }
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.localModel.enabled ? "bg-lexi-accent" : "bg-lexi-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.localModel.enabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
