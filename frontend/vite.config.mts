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
    port: 3000,
    proxy: {
      "/api": "http://localhost:9001",
      "/setup": "http://localhost:9001",
      "/third-party": "http://localhost:9001",
    },
  },
});
