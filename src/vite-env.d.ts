/// <reference types="vite/client" />

// Define environment variables for TypeScript
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    VITE_APP_ENV?: string;
  }
}

// Это определение уже указано через reference выше
// Мы просто расширим файл vite/client
