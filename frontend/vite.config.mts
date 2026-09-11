import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: "esbuild",
    outDir: "build",
    sourcemap: false,
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      "/api": process.env.GIANT_BACKEND_URL ?? "http://localhost:9001",
      "/setup": process.env.GIANT_BACKEND_URL ?? "http://localhost:9001",
      "/third-party": process.env.GIANT_BACKEND_URL ?? "http://localhost:9001",
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", "seed.spec.ts"],
    environment: "jsdom",
    globals: true,
  },
});
