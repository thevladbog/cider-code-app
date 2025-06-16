import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  plugins: [
    react(), // Fast Refresh включен по умолчанию
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
    // Определяем Node.js переменные как undefined в renderer процессе
    global: 'globalThis',
    __dirname: 'undefined',
    __filename: 'undefined',
    process: 'undefined',
    Buffer: 'undefined',
  },
  optimizeDeps: {
    exclude: ['electron', 'fs', 'path', 'os', 'child_process'],
  },
}));
