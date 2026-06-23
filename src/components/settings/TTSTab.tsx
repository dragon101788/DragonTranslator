import { useState, useEffect, useCallback } from "react";
import {
  Download,
  FolderOpen,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useConfigStore } from "../../stores/configStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TtsVoiceInfo {
  name: string;
  lang: string;
  quality: string;
  size_mb: number;
  sample_rate: number;
}

// Simplified list of common Piper voices available for download
const AVAILABLE_VOICES: {
  lang: string;
  label: string;
  voice: string;
  quality: string;
  url_path: string;
}[] = [
  {
    lang: "zh",
    label: "中文 (女声 huihui)",
    voice: "huihui",
    quality: "medium",
    url_path: "zh/zh_CN/huihui/medium/zh_CN-huihui-medium",
  },
  {
    lang: "zh",
    label: "中文 (女声 huihui Low)",
    voice: "huihui",
    quality: "low",
    url_path: "zh/zh_CN/huihui/low/zh_CN-huihui-low",
  },
  {
    lang: "en",
    label: "英语 (女声 lessac)",
    voice: "lessac",
    quality: "medium",
    url_path: "en/en_US/lessac/medium/en_US-lessac-medium",
  },
  {
    lang: "en",
    label: "英语 (男声 ryan)",
    voice: "ryan",
    quality: "medium",
    url_path: "en/en_US/ryan/medium/en_US-ryan-medium",
  },
  {
    lang: "en",
    label: "英语 (女声 amy)",
    voice: "amy",
    quality: "medium",
    url_path: "en/en_US/amy/medium/en_US-amy-medium",
  },
  {
    lang: "ja",
    label: "日本語",
    voice: "japanes",
    quality: "medium",
    url_path: "ja/ja_JP/japanes/medium/ja_JP-japanes-medium",
  },
  {
    lang: "ko",
    label: "한국어",
    voice: "korean",
    quality: "medium",
    url_path: "ko/ko_KR/korean/medium/ko_KR-korean-medium",
  },
  {
    lang: "fr",
    label: "Français",
    voice: "french",
    quality: "medium",
    url_path: "fr/fr_FR/french/medium/fr_FR-french-medium",
  },
  {
    lang: "de",
    label: "Deutsch",
    voice: "german",
    quality: "medium",
    url_path: "de/de_DE/german/medium/de_DE-german-medium",
  },
  {
    lang: "es",
    label: "Español",
    voice: "spanish",
    quality: "medium",
    url_path: "es/es_ES/spanish/medium/es_ES-spanish-medium",
  },
];

const BASE_URLS = [
  {
    label: "HuggingFace",
    base: "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0",
  },
  {
    label: "hf-mirror.com (国内镜像)",
    base: "https://hf-mirror.com/rhasspy/piper-voices/resolve/v1.0.0",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function fmtMB(mb: number): string {
  if (mb < 0.01) return "-";
  return `${mb.toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTSTab() {
  const settings = useConfigStore((s) => s.settings);
  const updateSettings = useConfigStore((s) => s.updateSettings);

  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [voicesDir, setVoicesDir] = useState("");
  const [loading, setLoading] = useState(true);
  const [mirrorIdx, setMirrorIdx] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [dlSuccess, setDlSuccess] = useState<string | null>(null);

  const isTauri = isTauriEnv();

  // ---- Refresh voice list ----
  const refreshVoices = useCallback(async () => {
    setLoading(true);
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const list = await invoke<TtsVoiceInfo[]>("tts_get_voices");
        setVoices(list);
        const dir = await invoke<string>("tts_get_voices_dir");
        setVoicesDir(dir);
      } catch (e) {
        console.warn("[TTS] Failed to get voices:", e);
      }
    }
    setLoading(false);
  }, [isTauri]);

  useEffect(() => {
    refreshVoices();
  }, [refreshVoices]);

  // ---- Download voice ----
  const downloadVoice = async (voice: (typeof AVAILABLE_VOICES)[0]) => {
    if (!isTauri || downloading) return;

    setDownloading(voice.label);
    setDlError(null);
    setDlSuccess(null);

    try {
      const base = BASE_URLS[mirrorIdx].base;
      const onnxUrl = `${base}/${voice.url_path}.onnx`;
      const jsonUrl = `${base}/${voice.url_path}.onnx.json`;

      // Fetch .onnx
      const onnxResp = await fetch(onnxUrl);
      if (!onnxResp.ok) {
        throw new Error(`HTTP ${onnxResp.status}: ${onnxResp.statusText}`);
      }
      const onnxData = await onnxResp.arrayBuffer();

      // Fetch .onnx.json
      const jsonResp = await fetch(jsonUrl);
      const jsonData = jsonResp.ok
        ? await jsonResp.text()
        : null;

      // Write files via Tauri FS (invoke a simple write command, or use the path)
      // Since we can't write to user dir directly from frontend, ask user to save
      // For now: download the data and prompt user with instructions

      // Use fetch + blob, then let browser download
      const onnxBlob = new Blob([onnxData]);
      const onnxName = `${voice.url_path.split("/").pop()}.onnx`;

      // Trigger browser download to the voices directory
      const a = document.createElement("a");
      a.href = URL.createObjectURL(onnxBlob);
      a.download = onnxName;
      a.click();
      URL.revokeObjectURL(a.href);

      if (jsonData) {
        const jsonBlob = new Blob([jsonData], { type: "application/json" });
        const jsonName = `${voice.url_path.split("/").pop()}.onnx.json`;
        const a2 = document.createElement("a");
        a2.href = URL.createObjectURL(jsonBlob);
        a2.download = jsonName;
        // Slight delay so browser doesn't block multiple downloads
        setTimeout(() => {
          a2.click();
          URL.revokeObjectURL(a2.href);
        }, 500);
      }

      setDlSuccess(voice.label);
      setDownloading(null);
    } catch (e: any) {
      setDlError(e.message || String(e));
      setDownloading(null);
    }
  };

  // ---- Open voices dir ----
  const openVoicesDir = async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("tts_open_voices_dir");
    } catch (e) {
      console.warn("[TTS] Failed to open dir:", e);
    }
  };

  // ---- Check if a voice is installed ----
  const isVoiceInstalled = (voice: (typeof AVAILABLE_VOICES)[0]) => {
    const name = voice.url_path.split("/").pop()!;
    return voices.some((v) => v.name === name);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-lexi-text">
        语音朗读 (Piper TTS)
      </h3>
      <p className="text-sm text-lexi-text-muted">
        使用 Piper 神经网络语音合成引擎，离线可用，音质自然。
        浏览器模式下自动降级为系统内置语音。
      </p>

      {/* Browser mode notice */}
      {!isTauri && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-sm text-yellow-400/80">
          语音模型管理仅在桌面应用中可用。当前使用浏览器内置语音引擎。
        </div>
      )}

      {/* ---- Playback settings ---- */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-lexi-text-muted mb-1">
            语速 ({settings.ttsRate.toFixed(1)}x)
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-lexi-text-muted">慢</span>
            <input
              type="range"
              min="0.3"
              max="2.0"
              step="0.1"
              value={settings.ttsRate}
              onChange={(e) =>
                updateSettings({ ttsRate: parseFloat(e.target.value) })
              }
              className="flex-1 accent-lexi-accent cursor-pointer"
            />
            <span className="text-xs text-lexi-text-muted">快</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-lexi-text">自动朗读译文</span>
            <p className="text-xs text-lexi-text-muted mt-0.5">
              翻译完成后自动朗读译文
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ ttsAutoRead: !settings.ttsAutoRead })
            }
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.ttsAutoRead
                ? "bg-lexi-accent"
                : "bg-lexi-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                settings.ttsAutoRead ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ---- Voice model management ---- */}
      {isTauri && (
        <>
          <div className="border-t border-lexi-border pt-4">
            <h4 className="text-sm font-medium text-lexi-text mb-3">
              语音模型管理
            </h4>

            {/* Mirror selector */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-lexi-text-muted">下载源:</span>
              <select
                value={mirrorIdx}
                onChange={(e) => setMirrorIdx(Number(e.target.value))}
                className="bg-lexi-input text-lexi-text border border-lexi-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-lexi-accent"
              >
                {BASE_URLS.map((b, i) => (
                  <option key={i} value={i}>
                    {b.label}
                  </option>
                ))}
              </select>
              <button
                onClick={refreshVoices}
                className="p-1.5 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
                title="刷新语音列表"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Status messages */}
            {dlSuccess && (
              <div className="p-2 mb-3 rounded-lg bg-green-500/10 text-green-400 text-xs flex items-center gap-1.5">
                <Check size={12} />
                下载完成: {dlSuccess}
                <span className="ml-1 opacity-70">
                  请将下载的文件移动到 {voicesDir}
                </span>
              </div>
            )}
            {dlError && (
              <div className="p-2 mb-3 rounded-lg bg-red-500/10 text-red-400 text-xs flex items-center gap-1.5">
                <AlertTriangle size={12} />
                下载失败: {dlError}
              </div>
            )}

            {/* Installed voices */}
            <div className="mb-2">
              <span className="text-xs text-lexi-text-muted">
                已安装 ({voices.length})
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto mb-4">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-lexi-text-muted py-2">
                  <Loader2 size={12} className="animate-spin" />
                  扫描中...
                </div>
              ) : voices.length === 0 ? (
                <p className="text-xs text-lexi-text-muted/60 py-2">
                  未检测到语音模型。请下载或手动放置 .onnx 文件到:
                  <br />
                  <code className="text-[10px] bg-lexi-input px-1 py-0.5 rounded">
                    {voicesDir || "~/Dragon/Translator/piper-voices/"}
                  </code>
                </p>
              ) : (
                voices.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-lexi-bg/30 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lexi-text truncate">{v.name}</span>
                      <span className="text-lexi-text-muted/50 flex-shrink-0">
                        {v.lang} · {v.quality}
                      </span>
                    </div>
                    <span className="text-lexi-text-muted flex-shrink-0 ml-2">
                      {fmtMB(v.size_mb)} @ {v.sample_rate}Hz
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Available for download */}
            <div className="mb-2">
              <span className="text-xs text-lexi-text-muted">可下载</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {AVAILABLE_VOICES.map((v) => {
                const installed = isVoiceInstalled(v);
                const isDownloading = downloading === v.label;
                const voiceName = v.url_path.split("/").pop()!;

                return (
                  <div
                    key={voiceName}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-lexi-bg/30 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {installed ? (
                        <Check size={12} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <Download size={12} className="text-lexi-text-muted flex-shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          installed ? "text-lexi-text-muted" : "text-lexi-text"
                        }`}
                      >
                        {v.label}
                      </span>
                    </div>
                    <button
                      onClick={() => downloadVoice(v)}
                      disabled={installed || !!downloading}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex-shrink-0 ml-2 ${
                        installed
                          ? "text-green-400/50 cursor-default"
                          : isDownloading
                            ? "text-lexi-accent bg-lexi-accent/10"
                            : "text-lexi-accent-hover hover:bg-lexi-accent/10"
                      }`}
                    >
                      {installed ? (
                        "已安装"
                      ) : isDownloading ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        "下载"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Open directory button */}
            <button
              onClick={openVoicesDir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-lexi-accent-hover hover:bg-lexi-accent/10 transition-colors w-full justify-center"
            >
              <FolderOpen size={13} />
              <span>打开语音模型目录</span>
            </button>

            <p className="text-[10px] text-lexi-text-muted/50 mt-2 text-center">
              将 .onnx 和 .onnx.json 文件放入上述目录即可自动识别
            </p>
          </div>
        </>
      )}
    </div>
  );
}
