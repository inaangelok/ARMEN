import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// `vite build --mode singlefile` produces one self-contained HTML file
// (used for the hosted click-through demo). Normal builds are code-split.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "singlefile" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: mode === "singlefile" ? { outDir: "dist-demo", chunkSizeWarningLimit: 5000 } : { chunkSizeWarningLimit: 1500 },
}));
