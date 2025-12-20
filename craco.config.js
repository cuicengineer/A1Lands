// CRACO webpack configuration to suppress source map warnings from third-party libraries
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Suppress the common source-map-loader warning:
      // "Failed to parse source map ..."
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
      ];

      // Additionally exclude stylis-plugin-rtl from source-map-loader
      webpackConfig.module.rules = webpackConfig.module.rules.map((rule) => {
        if (
          rule &&
          rule.enforce === 'pre' &&
          Array.isArray(rule.use) &&
          rule.use.some((u) =>
            typeof u === 'string'
              ? u.includes('source-map-loader')
              : (u.loader || '').includes('source-map-loader')
          )
        ) {
          const excludeStylis = /node_modules\/stylis-plugin-rtl/;
          if (Array.isArray(rule.exclude)) {
            rule.exclude.push(excludeStylis);
          } else if (rule.exclude) {
            rule.exclude = [rule.exclude, excludeStylis];
          } else {
            rule.exclude = excludeStylis;
          }
        }
        return rule;
      });

      return webpackConfig;
    },
  },
};