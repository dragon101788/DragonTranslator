import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  // Tauri packages must NOT be pre-bundled — they rely on the
  // Tauri IPC bridge (window.__TAURI__) which only exists at
  // runtime inside the Tauri webview.
  optimizeDeps: {
    exclude: [
      "@tauri-apps/api",
      "@tauri-apps/plugin-store",
      "@tauri-apps/plugin-global-shortcut",
    ],
  },

  server: {
    port: 5175,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
