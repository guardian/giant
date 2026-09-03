import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: "esbuild",
    outDir: "build",
    sourcemap: false,
  },
  server: {
    proxy: {
      "/api": "http://localhost:9001",
      "/setup": "http://localhost:9001",
      "/third-party": "http://localhost:9001",
    },
  },
});
