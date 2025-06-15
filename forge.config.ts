import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const isDevelopment = process.env.NODE_ENV === 'development';

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const linuxMakersCondition =
  process.platform === 'linux' || process.env.TARGET_PLATFORM === 'linux';
=======
// Debug log to check environment variables
console.log('TARGET_PLATFORM:', process.env.TARGET_PLATFORM);
console.log('process.platform:', process.platform);
>>>>>>> a537ae1 (fix: fixed linux release)
=======
const linuxMakersCondition =
  process.platform === 'linux' || process.env.TARGET_PLATFORM === 'linux';
>>>>>>> b68edcd (fix: fixed linux release)
=======
const linuxMakersCondition =
  process.platform === 'linux' || process.env.TARGET_PLATFORM === 'linux';
>>>>>>> 3b983a2b2cb7572e1724861821f055d2e974b90d

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './icons/icon', // Путь к иконке без расширения (Electron автоматически выберет нужный формат)
    // Don't prune native modules since we have serialport and usb dependencies
    prune: false,
    // Remove manual ignore configuration - let Webpack plugin handle this automatically
    // This prevents the "packaged app may be larger than expected" warning
  },
  rebuildConfig: {},
  makers: [
    // Windows makers
    new MakerSquirrel({
      // iconUrl: 'https://example.com/icon.ico', // URL для установщика Windows (добавить когда будет .ico файл)
      // setupIcon: './icons/icon.ico', // Локальная иконка для установщика (добавить когда будет .ico файл)
    }),

    // macOS makers
    new MakerZIP({}, ['darwin']),
    // DMG maker can only run on macOS, so we conditionally include it
    ...(process.platform === 'darwin'
      ? [
          new MakerDMG({
            icon: './icons/icon.png',
          }),
        ]
      : []),

    // Linux makers - only include when building on Linux or when explicitly targeting Linux
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 3b983a2b2cb7572e1724861821f055d2e974b90d
    ...(linuxMakersCondition
      ? [
          // Use ZIP maker as a universal fallback for Linux (works on all platforms)
          new MakerZIP({}, ['linux']),
          // DEB maker - only include when actually running on Linux AND when DEB_ENABLED is explicitly set
          // This prevents CI environment issues where DEB dependencies aren't available
          ...(process.platform === 'linux' && process.env.DEB_ENABLED === 'true'
            ? [
                new MakerDeb({
                  options: {
                    icon: './icons/icon.png',
                  },
                }),
              ]
            : []),
<<<<<<< HEAD
=======
    ...(process.platform === 'linux' || process.env.TARGET_PLATFORM === 'linux'
      ? [
          new MakerDeb({
            options: {
              icon: './icons/icon.png',
            },
          }),
>>>>>>> a537ae1 (fix: fixed linux release)
=======
    ...(linuxMakersCondition
      ? [
          // Use ZIP maker as a universal fallback for Linux (works on all platforms)
          new MakerZIP({}, ['linux']),
          // DEB maker - only include when actually running on Linux AND when DEB_ENABLED is explicitly set
          // This prevents CI environment issues where DEB dependencies aren't available
          ...(process.platform === 'linux' && process.env.DEB_ENABLED === 'true'
            ? [
                new MakerDeb({
                  options: {
                    icon: './icons/icon.png',
                  },
                }),
              ]
            : []),
>>>>>>> b68edcd (fix: fixed linux release)
=======
>>>>>>> 3b983a2b2cb7572e1724861821f055d2e974b90d
          // RPM maker commented out due to CI environment compatibility issues
          // If you need RPM support and your build environment supports it, uncomment:
          // new MakerRpm({
          //   options: {
          //     icon: './icons/icon.png',
          //   },
          // }),
        ]
      : []),
  ],
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
