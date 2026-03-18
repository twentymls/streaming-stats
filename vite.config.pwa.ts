import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "public-pwa",
  envPrefix: ["VITE_"],
  build: {
    outDir: "dist-pwa",
    target: "es2021",
    rollupOptions: {
      input: "index-pwa.html",
    },
  },
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "../lib/database": path.resolve(__dirname, "src/lib/database-web.ts"),
      "../lib/settings": path.resolve(__dirname, "src/lib/settings-web.ts"),
      "@tauri-apps/api/core": path.resolve(__dirname, "src/lib/tauri-stubs.ts"),
      "@tauri-apps/plugin-http": path.resolve(__dirname, "src/lib/tauri-stubs.ts"),
      "@tauri-apps/plugin-shell": path.resolve(__dirname, "src/lib/tauri-stubs.ts"),
      "@tauri-apps/plugin-store": path.resolve(__dirname, "src/lib/tauri-stubs.ts"),
    },
  },
});
