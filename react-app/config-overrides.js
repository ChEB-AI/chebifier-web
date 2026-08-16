const evalSourceMapMiddleware = require('react-dev-utils/evalSourceMapMiddleware');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const paths = require('react-scripts/config/paths');

module.exports = {
  webpack: function override(config, env) {
    console.log("React app rewired works!")
    config.resolve.fallback = {
      fs: false,
      path: false,
      polyfill: false,
    };
    return config;
  },

  // react-scripts 5.0.1 emits a webpack-dev-server v4 config, but v4 has several
  // open advisories and is no longer patched, so package.json overrides v5.
  // v5 dropped `onBefore/onAfterSetupMiddleware` (-> `setupMiddlewares`) and
  // `https` (-> `server`), so translate CRA's config here. The middlewares below
  // are the same react-dev-utils ones CRA registers, in the same order.
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      delete config.onBeforeSetupMiddleware;
      delete config.onAfterSetupMiddleware;
      config.setupMiddlewares = (middlewares, devServer) => {
        middlewares.unshift({
          name: 'eval-source-map-middleware',
          middleware: evalSourceMapMiddleware(devServer),
        });
        middlewares.push(
          {
            name: 'redirect-served-path-middleware',
            middleware: redirectServedPath(paths.publicUrlOrPath),
          },
          {
            name: 'noop-service-worker-middleware',
            middleware: noopServiceWorkerMiddleware(paths.publicUrlOrPath),
          }
        );
        return middlewares;
      };

      if (config.https) {
        config.server = {
          type: 'https',
          options: config.https === true ? undefined : config.https,
        };
      }
      delete config.https;

      // v5 only accepts an array of proxy entries; CRA passes `undefined` when
      // no `proxy` is configured, which trips schema validation.
      if (!config.proxy) {
        delete config.proxy;
      }

      return config;
    };
  },
};
