import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, ArrowLeftRight, StopCircle, Volume2 } from "lucide-react";
import { useTTS } from "../../hooks/useTTS";

interface InputAreaProps {
  onTranslate: (text: string) => void;
  onStop: () => void;
  translating: boolean;
  onClear: () => void;
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  onSwapLang: () => void;
}

const LANGUAGES: Record<string, string> = {
  auto: "自动检测",
  zh: "中文",
  en: "英语",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ru: "Русский",
  pt: "Português",
  ar: "العربية",
  th: "ไทย",
  vi: "Tiếng Việt",
};

export default function InputArea({
  onTranslate,
  onStop,
  translating,
  onClear,
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLang,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tts = useTTS();

  // Auto-focus on mount and whenever window becomes visible
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Set initial height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  // Reset textarea height when cleared
  useEffect(() => {
    if (!text && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text]);

  // Re-focus when the Tauri window is shown (shortcut toggles visibility)
  useEffect(() => {
    const focusInput = () => {
      // Small delay so the window has fully surfaced before focusing
      setTimeout(() => textareaRef.current?.focus(), 0);
    };
    window.addEventListener("focus", focusInput);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") focusInput();
    });
    return () => {
      window.removeEventListener("focus", focusInput);
      document.removeEventListener("visibilitychange", focusInput);
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || translating) return;
    onTranslate(text.trim());
  }, [text, translating, onTranslate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter to translate (with or without Ctrl)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      // Shift+Enter for newline
    },
    [handleSubmit]
  );

  const handleClear = () => {
    setText("");
    setCharCount(0);
    onClear();
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col bg-lexi-card border border-lexi-border rounded-xl overflow-hidden">
      {/* Lang selector + controls bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-lexi-border/50 select-none">
        <div className="flex items-center gap-2 text-sm">
          <select
            value={sourceLang}
            onChange={(e) => onSourceLangChange(e.target.value)}
            className="bg-lexi-input text-lexi-text border border-lexi-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-lexi-accent"
          >
            {Object.entries(LANGUAGES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <button
            onClick={onSwapLang}
            className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
            title="交换语言方向"
          >
            <ArrowLeftRight size={14} />
          </button>

          <select
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
            className="bg-lexi-input text-lexi-text border border-lexi-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-lexi-accent"
          >
            {Object.entries(LANGUAGES)
              .filter(([k]) => k !== "auto")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {text && (
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
              title="清空"
            >
              <X size={14} />
            </button>
          )}
          {text && (
            <button
              onClick={() => tts.speak(text, sourceLang)}
              className="p-1 rounded hover:bg-lexi-hover text-lexi-text-muted hover:text-lexi-text transition-colors"
              title="朗读原文"
            >
              <Volume2 size={14} />
            </button>
          )}
          <span className="text-xs text-lexi-text-muted">{charCount}</span>
        </div>
      </div>

      {/* Textarea — auto-grow with content */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCharCount(e.target.value.length);
          // Auto-resize height
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onKeyDown={handleKeyDown}
        placeholder="输入要翻译的文本... Enter 翻译, Shift+Enter 换行"
        className="w-full bg-transparent text-lexi-text placeholder-lexi-text-muted/50 px-4 py-3 resize-none focus:outline-none text-sm leading-relaxed min-h-[250px]"
        rows={1}
        maxLength={5000}
      />

      {/* Submit / Stop buttons */}
      <div className="flex items-center justify-between px-3 py-2 gap-2 select-none">
        <div className="text-xs text-lexi-text-muted whitespace-nowrap">
          {translating && "流式输出中..."}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {translating ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-all whitespace-nowrap min-w-[90px] justify-center"
            >
              <StopCircle size={14} />
              <span>停止</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-lexi-accent hover:bg-lexi-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all whitespace-nowrap min-w-[90px] justify-center"
            >
              <Send size={15} />
              <span>翻译</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
