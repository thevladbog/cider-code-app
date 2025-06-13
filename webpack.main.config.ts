import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import { TsconfigPathsPlugin } from "tsconfig-paths-webpack-plugin";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    plugins: [new TsconfigPathsPlugin()]
  },
  externals: {
    'serialport': 'commonjs serialport',
    'usb': 'commonjs usb',
    '@serialport/bindings-cpp': 'commonjs @serialport/bindings-cpp',
    'bindings': 'commonjs bindings',
    'node-addon-api': 'commonjs node-addon-api'
  },
};
