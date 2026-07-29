//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    clean: true
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'src/code_analysis/python',
          to: 'code_analysis/python',
          globOptions: {
            ignore: ['**/*.ts', '**/__pycache__/**'],
          },
          noErrorOnMissing: true
        },
        {
          from: 'templates',
          to: 'templates',
          noErrorOnMissing: true,
          // Copied as data, not built: multi-part runtimes under
          // templates/components/codexr/*/<runtimeBase>/*.js are fragments that
          // only parse once concatenated per their manifest.json, so the
          // production minifier must never touch them.
          info: { minimized: true }
        },
        {
          from: 'examples',
          to: 'examples',
          noErrorOnMissing: true
        }
      ],
    }),
  ],
  // Source maps help the F5 dev flow; the packaged VSIX must not carry them
  // (extension.js.map alone is ~3.5 MB). scripts/package-vsix.mjs sets this
  // variable for the vsce run, whose vscode:prepublish hook re-runs webpack.
  devtool: process.env.CODEXR_NO_SOURCEMAPS ? false : 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = config;

