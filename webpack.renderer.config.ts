import type { Configuration } from 'webpack';

import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { plugins } from './webpack.plugins';
import { rules } from './webpack.rules';

const isDevelopment = process.env.NODE_ENV !== 'production';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

rules.push({
  test: /\.s[ac]ss$/i,
  use: [
    // Creates `style` nodes from JS strings
    'style-loader',
    // Translates CSS into CommonJS
    'css-loader',
    // Compiles Sass to CSS
    'sass-loader',
  ],
});

export const rendererConfig: Configuration = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: isDevelopment ? 'cheap-module-source-map' : 'source-map',
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    plugins: [new TsconfigPathsPlugin()],
  },
  target: 'web', // Используем 'web' вместо 'electron-renderer' для совместимости с React Refresh
  ...(isDevelopment && {
    devServer: {
      hot: true,
      liveReload: false, // Предотвращаем полную перезагрузку страницы
    },
    optimization: {
      splitChunks: false, // Отключаем code splitting для лучшей работы с HMR в Electron
    },
  }),
  // Настройки для Electron renderer процесса
  externals: {
    // Исключаем electron из bundle, так как он доступен глобально в renderer процессе
    electron: 'require("electron")',
  },
};
