import { useState, useCallback, useEffect } from "react";

interface ShortcutTabProps {
  modifiers: string[];
  keyCode: string;
  onSave: (modifiers: string[], keyCode: string) => void;
}

// Map physical keys to display labels
const KEY_LABELS: Record<string, string> = {
  "Space": "Space",
  "NumpadEnter": "Enter",
  "Enter": "Enter",
};
for (let i = 1; i <= 12; i++) KEY_LABELS[`F${i}`] = `F${i}`;

function isTextKey(code: string): boolean {
  return code.length === 1 && code >= "A" && code <= "Z";
}

function isDigitKey(code: string): boolean {
  return code >= "0" && code <= "9";
}

function keyLabel(code: string): string {
  return KEY_LABELS[code] ?? (isTextKey(code) ? code : isDigitKey(code) ? code : code);
}

const MODIFIER_KEYS = ["Ctrl", "Alt", "Shift", "Win"];

export default function ShortcutTab({ modifiers, keyCode, onSave }: ShortcutTabProps) {
  const [localMods, setLocalMods] = useState<string[]>(modifiers);
  const [localKey, setLocalKey] = useState(keyCode);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Sync from props
  useEffect(() => {
    setLocalMods(modifiers);
    setLocalKey(keyCode);
  }, [modifiers, keyCode]);

  const toggleMod = useCallback(
    (mod: string) => {
      setLocalMods((prev) =>
        prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!localMods.length) {
      setStatus("❌ 请至少选择一个修饰键 (Ctrl/Alt/Shift/Win)");
      return;
    }
    if (!localKey || localKey === "") {
      setStatus("❌ 请选择一个主键");
      return;
    }

    setStatus("⏳ 正在注册...");

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("configure_shortcut", {
        modifiers: localMods,
        key: localKey,
      });
      onSave(localMods, localKey);
      setStatus(`✅ 已更新: ${localMods.join("+")}+${keyLabel(localKey)}`);
    } catch (e: any) {
      setStatus(`❌ ${e}`);
    }
  }, [localMods, localKey, onSave]);

  // Shortcut recorder
  const handleStartListen = useCallback(() => {
    setIsListening(true);
    setStatus("⌨️ 按下你的快捷键组合...");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isListening) return;
      e.preventDefault();
      e.stopPropagation();

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Win");

      // Determine the main key (ignore pure modifier presses)
      const { key, code } = e;

      // Map key to our code format
      let mainKey = "";
      if (key.length === 1 && key >= "a" && key <= "z") {
        mainKey = key.toUpperCase();
      } else if (key >= "0" && key <= "9") {
        mainKey = key;
      } else if (key === " ") {
        mainKey = "Space";
      } else if (key === "Space") {
        mainKey = "Space";
      } else if (key === "Escape") {
        mainKey = "Escape";
      } else if (key === "Enter") {
        mainKey = "Enter";
      } else if (key === "Tab") {
        mainKey = "Tab";
      } else if (key.startsWith("F") && key.length <= 3) {
        mainKey = key;
      } else if (code.startsWith("F")) {
        mainKey = code;
      } else {
        // Ignore modifier-only keydowns
        if (["Control", "Shift", "Alt", "Meta", "OS"].includes(key)) return;
        mainKey = key.toUpperCase();
      }

      if (mainKey && mods.length > 0) {
        setLocalMods(mods);
        setLocalKey(mainKey);
        setIsListening(false);
        setStatus(`已录制: ${mods.join("+")}+${keyLabel(mainKey)}，记得点击保存`);
      } else if (mainKey && mods.length === 0) {
        setStatus("⚠️ 请配合修饰键使用 (Ctrl/Alt/Shift/Win)");
      }
    },
    [isListening]
  );

  // Global key listener for recording
  useEffect(() => {
    if (!isListening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setIsListening(false);
        setStatus(null);
        return;
      }

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Win");

      let mainKey = "";
      if (e.key.length === 1 && e.key >= "a" && e.key <= "z") {
        mainKey = e.key.toUpperCase();
      } else if (e.key === " ") {
        mainKey = "Space";
      } else if (e.key === "Escape") {
        return;
      } else if (e.key === "Enter") {
        mainKey = "Enter";
      } else if (e.code.startsWith("F")) {
        mainKey = e.code;
      } else if (e.key.length >= 1 && e.key.toUpperCase() !== e.key.toLowerCase()) {
        mainKey = e.key.toUpperCase();
      } else if (e.key.toUpperCase() !== e.key) {
        // non-printable / modifier only
        return;
      } else {
        mainKey = e.key.toUpperCase();
      }

      if (mainKey && mods.length > 0) {
        setLocalMods(mods);
        setLocalKey(mainKey);
        setIsListening(false);
        setStatus(`已录制: ${mods.join("+")}+${keyLabel(mainKey)}，记得点击保存`);
      } else if (mainKey) {
        setStatus("⚠️ 请配合修饰键使用 (Ctrl/Alt/Shift/Win)");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isListening]);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-lexi-text">全局快捷键</h3>
      <p className="text-sm text-lexi-text-muted">
        使用全局快捷键在任何应用中快速呼出 龙图腾翻译 窗口。
      </p>

      {/* Key display */}
      <div className="p-5 bg-lexi-input/50 rounded-xl border border-lexi-border text-center">
        <div
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border transition-all ${
            isListening
              ? "bg-lexi-accent/20 border-lexi-accent animate-pulse-glow"
              : "bg-lexi-card border-lexi-border"
          }`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={handleStartListen}
        >
          {localMods.length === 0 && !localKey && !isListening && (
            <span className="text-sm text-lexi-text-muted">点击此处录制</span>
          )}
          {localMods.map((m) => (
            <kbd
              key={m}
              className="px-3 py-1.5 bg-lexi-input border border-lexi-border rounded-lg text-sm font-mono text-lexi-text"
            >
              {m}
            </kbd>
          ))}
          {(localMods.length > 0 || localKey) && (
            <span className="text-lexi-text-muted">+</span>
          )}
          {localKey && (
            <kbd className="px-3 py-1.5 bg-lexi-accent/20 border border-lexi-accent/40 rounded-lg text-sm font-mono text-lexi-accent-hover font-semibold">
              {keyLabel(localKey)}
            </kbd>
          )}
          {isListening && (
            <span className="text-sm text-lexi-accent-hover font-medium ml-1 animate-pulse">
              ...
            </span>
          )}
        </div>
        <p className="text-xs text-lexi-text-muted mt-2">
          {isListening
            ? "按下快捷键组合 (Esc 取消)"
            : "点击上方区域开始录制"}
        </p>
      </div>

      {/* Manual modifier toggles */}
      <div>
        <p className="text-xs text-lexi-text-muted mb-2">修饰键：</p>
        <div className="flex gap-2">
          {MODIFIER_KEYS.map((mod) => (
            <button
              key={mod}
              onClick={() => toggleMod(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border ${
                localMods.includes(mod)
                  ? "bg-lexi-accent/20 border-lexi-accent/40 text-lexi-accent-hover"
                  : "bg-lexi-input border-lexi-border text-lexi-text-muted hover:text-lexi-text"
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-lexi-accent/20 hover:bg-lexi-accent/30 text-lexi-accent-hover text-sm font-medium transition-all"
        >
          保存快捷键
        </button>
        {status && (
          <span
            className={`text-sm animate-fade-in ${
              status.startsWith("✅")
                ? "text-green-400"
                : status.startsWith("❌")
                  ? "text-red-400"
                  : "text-lexi-text-muted"
            }`}
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
