const { createProxyMiddleware }  = require('http-proxy-middleware');

// We must manually configure our own proxy as the default behaviour
// (proxy everything without `Accept: text-html`) breaks PDF preview
module.exports = function(app) {
  app.use('/api', createProxyMiddleware({ target: 'http://localhost:9001/api', changeOrigin: true }));
  // Path rewrite required because http-proxy (unmaintained, upstream of http-proxy-middleware) adds a 
  // trailing slash and then Play is fussy and claims the route doesn't exist
  // https://github.com/chimurai/http-proxy-middleware/issues/1016
  // https://github.com/guardian/giant/issues/391
  app.use('/setup', createProxyMiddleware({
    target: 'http://localhost:9001',
    changeOrigin: true,
    pathRewrite: (_, req) => {
      return req.originalUrl;
    },
  }));
  app.use('/third-party', createProxyMiddleware({ target: 'http://localhost:9001/third-party', changeOrigin: true }));
};