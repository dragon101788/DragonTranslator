/**
 * Write a log line to ~/Dragon/Translator/logs/frontend.log via Tauri backend.
 * Falls back to console.log in browser mode.
 */
export async function log(level: "info" | "warn" | "error", message: string) {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  console.log("[Log]", line);

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("log_frontend", { level, message });
    } catch {
      // silent — don't cause log loops
    }
  }
}

export const logger = {
  info: (msg: string) => log("info", msg),
  warn: (msg: string) => log("warn", msg),
  error: (msg: string) => log("error", msg),
};
