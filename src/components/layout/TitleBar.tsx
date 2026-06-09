import { useState, useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [appWindow, setAppWindow] = useState<ReturnType<typeof getCurrentWindow> | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    setAppWindow(win);

    win.isMaximized().then(setMaximized);

    let unlisten: (() => void) | undefined;
    win
      .onResized(async () => {
        const m = await win.isMaximized();
        setMaximized(m);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleMouseDown = useCallback(() => {
    if (appWindow) appWindow.startDragging();
  }, [appWindow]);

  const handleMinimize = useCallback(() => {
    appWindow?.minimize().catch(console.error);
  }, [appWindow]);

  const handleToggleMaximize = useCallback(() => {
    appWindow?.toggleMaximize().catch(console.error);
  }, [appWindow]);

  const handleClose = useCallback(() => {
    appWindow?.close().catch(console.error);
  }, [appWindow]);

  if (!isTauri()) return null;

  return (
    <div className="flex items-center h-8 bg-lexi-bg shrink-0 select-none">
      {/* Drag area */}
      <div
        className="flex-1 h-full pl-3 flex items-center"
        onMouseDown={handleMouseDown}
      >
        <span className="text-[11px] text-lexi-text-muted font-medium tracking-wide cursor-default">
          龙图腾翻译
        </span>
      </div>

      {/* Window controls */}
      <div className="flex h-full">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="titlebar-btn"
          aria-label="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line
              x1="1" y1="5" x2="9" y2="5"
              stroke="currentColor" strokeWidth="1.2"
            />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleToggleMaximize}
          className="titlebar-btn"
          aria-label={maximized ? "还原" : "最大化"}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2.5" y="0" width="6.5" height="6.5" rx="0.5"
                fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2.5" width="6.5" height="6.5" rx="0.5"
                fill="var(--color-lexi-bg)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5"
                fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="titlebar-btn titlebar-btn-close"
          aria-label="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1.5" y1="1.5" x2="8.5" y2="8.5"
              stroke="currentColor" strokeWidth="1.3" />
            <line x1="8.5" y1="1.5" x2="1.5" y2="8.5"
              stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
