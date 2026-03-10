module.exports = {
  type: "bundle",
  esbuild: {
    external: ["pg", "pg-format"],
  },
};
