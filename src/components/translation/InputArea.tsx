import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, X, ArrowLeftRight, StopCircle } from "lucide-react";

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

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [text]);

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
    <div className="flex flex-col h-full bg-lexi-card rounded-xl border border-lexi-border overflow-hidden">
      {/* Lang selector + controls bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-lexi-border/50">
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
            className="p-1 rounded hover:bg-white/10 text-lexi-text-muted hover:text-lexi-text transition-colors"
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
              className="p-1 rounded hover:bg-white/10 text-lexi-text-muted hover:text-lexi-text transition-colors"
              title="清空"
            >
              <X size={14} />
            </button>
          )}
          <span className="text-xs text-lexi-text-muted">{charCount}</span>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCharCount(e.target.value.length);
        }}
        onKeyDown={handleKeyDown}
        placeholder="输入要翻译的文本... Enter 翻译, Shift+Enter 换行"
        className="flex-1 w-full bg-transparent text-lexi-text placeholder-lexi-text-muted/50 px-4 py-3 resize-none focus:outline-none text-sm leading-relaxed"
        rows={1}
        maxLength={5000}
      />

      {/* Submit / Stop buttons */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-xs text-lexi-text-muted">
          {translating && "流式输出中..."}
        </div>
        <div className="flex items-center gap-2">
          {translating && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-all"
            >
              <StopCircle size={14} />
              <span>停止</span>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || translating}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-lexi-accent hover:bg-lexi-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            {translating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>生成中</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>翻译</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
