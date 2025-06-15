import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const isDevelopment = process.env.NODE_ENV === 'development';

// Debug log to check environment variables
console.log('TARGET_PLATFORM:', process.env.TARGET_PLATFORM);
console.log('process.platform:', process.platform);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './build-resources/icons/', // Путь к иконке без расширения (Electron автоматически выберет нужный формат)
    // Don't prune native modules since we have serialport and usb dependencies
    prune: false,
    executableName: 'bottle-code-app', // Явно указываем имя исполняемого файла
    // Настраиваем имя приложения для разных платформ
    name: 'bottle-code-app',
  },
  rebuildConfig: {},
  makers: [
    // Windows makers
    new MakerSquirrel({
      name: 'bottle-code-app',
      // iconUrl: 'https://example.com/icon.ico', // URL для установщика Windows (добавить когда будет .ico файл)
      setupIcon: './build-resources/icons/win/icon.ico', // Локальная иконка для установщика (добавить когда будет .ico файл)
    }),

    // macOS makers
    new MakerZIP({}, ['darwin']),
    // DMG maker can only run on macOS, so we conditionally include it
    ...(process.platform === 'darwin'
      ? [
          new MakerDMG({
            name: 'bottle-code-app',
            icon: './build-resources/icons/mac/icon.icns',
          }),
        ]
      : []),

    // Linux makers - only include when building on Linux or when explicitly targeting Linux
    ...(process.platform === 'linux' || process.env.TARGET_PLATFORM === 'linux'
      ? [
          new MakerDeb({
            options: {
              name: 'bottle-code-app',
              icon: './icons/icon.png',
              bin: 'bottle-code-app', // Явно указываем имя исполняемого файла
            },
          }),
          // RPM maker commented out due to CI environment compatibility issues
          // If you need RPM support and your build environment supports it, uncomment:
          // new MakerRpm({
          //   options: {
          //     name: 'bottle-code-app',
          //     icon: './icons/icon.png',
          //   },
          // }),
        ]
      : []),
  ],
  plugins: [
    new VitePlugin({
      build: [],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
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
