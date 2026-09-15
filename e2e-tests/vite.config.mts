import appConfig from "../frontend/vite.config.mts";

export default {
  ...appConfig,
  server: {
    ...appConfig.server,
    host: "127.0.0.1",
    port: 3100,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:19001",
      "/setup": "http://127.0.0.1:19001",
      "/third-party": "http://127.0.0.1:19001",
    },
  },
};
