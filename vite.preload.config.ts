import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig({
  build: {
    target: 'node18',
    lib: {
      entry: resolve(__dirname, 'src/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false, // чтобы не удалять другие dist-файлы
    rollupOptions: {
      external: ['electron'], // Только electron остается внешним
      output: {
        format: 'cjs',
        inlineDynamicImports: true, // Инлайнить все динамические импорты
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
