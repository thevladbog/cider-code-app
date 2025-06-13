import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const isDevelopment = process.env.NODE_ENV === 'development';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Don't prune native modules
    prune: false,
    // Ensure native modules are included
    ignore: [
      /^\/src\//,
      /(.eslintrc.json)|(.gitignore)|(electron.vite.config.ts)|(forge.config.ts)|(tsconfig.*)/,
    ],
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
      // Улучшенная конфигурация для hot reload
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; connect-src 'self' ws: wss:;",
    }),
    // Only include FusesPlugin in production to avoid conflicts during development
    ...(isDevelopment
      ? []
      : [
          new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
          }),
        ]),
  ],
};

export default config;
