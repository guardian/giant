module.exports = {
  webpack: {
    rules: [
      {
        test: /\/pdfjs-dist\//,
        loader: require.resolve("babel-loader"),
        options: {
          presets: [
            [
              // Latest stable ECMAScript features
              require("@babel/preset-env").default,
            ],
          ],
          plugins: ["@babel/plugin-syntax-nullish-coalescing-operator"],
        },
      },
    ],
  },
};
