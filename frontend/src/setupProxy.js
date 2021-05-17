const proxy = require('http-proxy-middleware');

// We must manually configure our own proxy as the default behaviour
// (proxy everything without `Accept: text-html`) breaks PDF preview
module.exports = function(app) {
  app.use(proxy('/api', { target: 'http://localhost:9001/' }));
  app.use(proxy('/setup', { target: 'http://localhost:9001/' }));
  app.use(proxy('/third-party', { target: 'http://localhost:9001/' }));
};