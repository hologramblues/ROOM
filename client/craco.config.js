module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Fix for ESM modules like roughjs used by Excalidraw
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      });
      return webpackConfig;
    }
  }
};
