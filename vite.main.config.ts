// Этот файл больше не используется. Для сборки main process используйте tsc и tsconfig.json.

import { builtinModules } from 'module';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// Функция для определения external модулей
const isExternal = (id: string) => {
  // Все встроенные модули Node.js всегда external
  if (builtinModules.includes(id) || builtinModules.includes(id.replace('node:', ''))) {
    return true;
  }

  // Electron и связанные модули всегда external
  if (id === 'electron' || id.startsWith('electron/')) {
    return true;
  }

  // Native модули - всегда external (они должны быть в production environment)
  const nativeModules = [
    'serialport',
    '@serialport/bindings-cpp',
    '@serialport/bindings',
    '@serialport/parser-readline',
    '@serialport/stream',
    'usb',
    'bindings',
    'node-addon-api',
    'node-gyp-build',
    'prebuild-install',
    'conf',
  ];

  if (nativeModules.some(mod => id === mod || id.startsWith(mod + '/'))) {
    return true;
  }

  // Явно указываем модули, которые не должны быть external (должны быть включены в bundle)
  const includedDependencies = ['jsbarcode'];

  if (includedDependencies.some(mod => id === mod || id.startsWith(mod + '/'))) {
    return false;
  }

  // В production все остальные модули включаем в bundle (кроме системных и native)
  // Это гарантирует, что electron-store и другие зависимости будут включены
  return false;
};

// https://vitejs.dev/config
export default defineConfig({
  build: {
    target: 'node22',
    ssr: true, // Включаем SSR режим для лучшей совместимости с Node.js
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: isExternal,
      output: {
        format: 'cjs',
        exports: 'auto',
      },
    },
    minify: false, // Отключаем минификацию для лучшей отладки
    sourcemap: true,
    outDir: '.vite/build',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
