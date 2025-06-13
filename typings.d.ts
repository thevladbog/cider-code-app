import { ElectronAPI } from './src/app/types';

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
declare module '*.svg';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Типизация для Webpack Hot Module Replacement
declare global {
  namespace NodeJS {
    interface Module {
      hot?: {
        accept(path?: string, callback?: () => void): void;
      };
    }
  }
}
