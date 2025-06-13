import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

import { HotModuleReplacementPlugin, WebpackPluginInstance } from 'webpack';

const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// Добавляем React Refresh плагин только в development режиме
const isDevelopment = process.env.NODE_ENV !== 'production';

export const plugins: WebpackPluginInstance[] = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
];

// Добавляем плагины для hot reload в development режиме
if (isDevelopment) {
  const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

  // Добавляем HotModuleReplacementPlugin для включения HMR
  plugins.push(new HotModuleReplacementPlugin());

  plugins.push(
    new ReactRefreshWebpackPlugin({
      overlay: false, // Отключаем overlay, так как он может конфликтовать с Electron
    })
  );
}
