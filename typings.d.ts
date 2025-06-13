declare module '*.scss';
declare module '*.svg';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Типизация для Webpack Hot Module Replacement
declare let module: {
  hot?: {
    accept(path?: string, callback?: () => void): void;
  };
};
