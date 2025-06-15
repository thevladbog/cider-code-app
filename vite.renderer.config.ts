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
    },
    sourcemap: true,
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
  },
}));
