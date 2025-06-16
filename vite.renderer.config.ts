import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  plugins: [
    react(), // Fast Refresh включен по умолчанию
    // Plugin to exclude Node.js-only test files from being processed
    {
      name: 'exclude-node-test-files',
      resolveId(id) {
        // Exclude test files that use Node.js-only dependencies
        if (
          id.includes('testEnvironment') ||
          id.includes('testApiConfig') ||
          id.includes('loggerTest') ||
          id.includes('yandexCloudLoggerSDK')
        ) {
          return false;
        }
      },
    },
  ],
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      // Исключаем electron и Node.js модули из renderer bundle'а
      external: [
        'electron',
        'fs',
        'path',
        'os',
        'child_process',
        'crypto',
        'stream',
        'util',
        'buffer',
        'events',
        'http',
        'https',
        'url',
        'net',
        'tls',
        'zlib',
        'querystring',
        'punycode',
        'readline',
        'repl',
        'tty',
        'dgram',
        'dns',
        // Yandex Cloud SDK and gRPC dependencies - should not be bundled in renderer
        '@yandex-cloud/nodejs-sdk',
        '@grpc/grpc-js',
        '@grpc/proto-loader',
        'grpc',
        'dotenv',
        // Test files that use Node.js-only dependencies
        /.*testEnvironment.*/,
        /.*testApiConfig.*/,
        /.*loggerTest.*/,
        /.*yandexCloudLoggerSDK.*/,
      ],
      // Добавляем принудительное использование правильного бинарного файла Rollup
    },
    sourcemap: true,
    // Для macOS: устанавливаем явную конфигурацию для избежания проблем с нативными модулями
    ...(process.platform === 'darwin' && {
      commonjsOptions: {
        dynamicRequireTargets: [
          'node_modules/@rollup/rollup-darwin-arm64/rollup.darwin-arm64.node',
          'node_modules/@rollup/rollup-darwin-x64/rollup.darwin-x64.node',
        ],
      },
    }),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  base: './',
  server: {
    port: 3000,
    strictPort: true,
  },
  define: {
    // Делаем NODE_ENV доступным в renderer процессе через import.meta.env
    'import.meta.env.NODE_ENV': JSON.stringify(mode),
    // Передаем VITE_APP_ENV в renderer процесс
    'import.meta.env.VITE_APP_ENV': JSON.stringify(process.env.VITE_APP_ENV || mode),
    // Определяем Node.js переменные - используем легкие заглушки вместо undefined
    global: 'globalThis',
    // Proper object stubs for process and Buffer to avoid runtime errors
    process: JSON.stringify({
      env: {},
      platform: 'browser',
      versions: {},
      nextTick: function (callback) {
        setTimeout(callback, 0);
      },
      cwd: function () {
        return '/';
      },
      exit: function () {
        console.warn('process.exit() called in renderer process');
      },
    }),
    Buffer: JSON.stringify({
      isBuffer: function () {
        return false;
      },
      from: function () {
        throw new Error('Buffer not available in renderer');
      },
      alloc: function () {
        throw new Error('Buffer not available in renderer');
      },
      allocUnsafe: function () {
        throw new Error('Buffer not available in renderer');
      },
      concat: function () {
        throw new Error('Buffer not available in renderer');
      },
    }),
  },
  optimizeDeps: {
    exclude: [
      'electron',
      'fs',
      'path',
      'os',
      'child_process',
      '@yandex-cloud/nodejs-sdk',
      '@grpc/grpc-js',
      '@grpc/proto-loader',
      'grpc',
      'dotenv',
    ],
  },
}));
