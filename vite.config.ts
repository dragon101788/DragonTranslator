import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

// Serve user/default-config.json for browser/dev mode fallback
function defaultConfigPlugin() {
  const src = path.resolve(__dirname, "user", "default-config.json");
  return {
    name: "default-config",
    configureServer(server: any) {
      server.middlewares.use("/default-config.json", (_req: any, res: any) => {
        try {
          const data = fs.readFileSync(src, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end("{}");
        }
      });
    },
    // For production build: copy to dist/
    writeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      if (fs.existsSync(src)) {
        fs.mkdirSync(distDir, { recursive: true });
        fs.copyFileSync(src, path.join(distDir, "default-config.json"));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), defaultConfigPlugin()],

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
    port: 5157,
    strictPort: false, // fallback to 5158, 5159... if taken
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
