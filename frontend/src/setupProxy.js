const { createProxyMiddleware }  = require('http-proxy-middleware');

// We must manually configure our own proxy as the default behaviour
// (proxy everything without `Accept: text-html`) breaks PDF preview
module.exports = function(app) {
  app.use('/api', createProxyMiddleware({ target: 'http://localhost:9001/', changeOrigin: true }));
  app.use('/setup', createProxyMiddleware({ target: 'http://localhost:9001/', changeOrigin: true }));
  app.use('/third-party', createProxyMiddleware({ target: 'http://localhost:9001/', changeOrigin: true }));
};