const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  jest: {
    configure: (jestConfig) => {
      // CRA 5 pins Jest 27, whose resolver predates the package.json "exports"
      // field. `@tiptap/pm/<sub>` has no "main", so Jest falls back to directory
      // resolution and picks `@tiptap/pm/<sub>/index.ts` — untranspiled ESM/TS
      // inside node_modules, which `transformIgnorePatterns` refuses to compile
      // ("SyntaxError: Unexpected token 'export'"). Point the subpaths at the
      // CJS builds the "exports" map would have chosen.
      // Webpack (the production build) resolves "exports" natively and is not
      // affected by anything in this block.
      jestConfig.moduleNameMapper = {
        ...(jestConfig.moduleNameMapper || {}),
        '^@tiptap/pm/(.*)$': '<rootDir>/node_modules/@tiptap/pm/dist/$1/index.cjs',
        '^@tiptap/core/(jsx-runtime|jsx-dev-runtime)$':
          '<rootDir>/node_modules/@tiptap/core/$1/index.cjs',
      };
      return jestConfig;
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      // Fix for ESM modules like roughjs used by Excalidraw
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      });
      if (process.env.ANALYZE === 'true') {
        webpackConfig.plugins.push(new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html'
        }));
      }
      return webpackConfig;
    }
  }
};
