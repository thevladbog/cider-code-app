/**
 * Simple helper for accessing environment variables safely in the app
 * This abstraction layer helps avoid TypeScript errors related to import.meta
 */

// Declare the environment
declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

// Get if we're in development mode
export const isDev = (): boolean => {
  // In Vite environment, we can directly access import.meta.env
  // @ts-expect-error - We know import.meta exists in Vite browser context
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-expect-error - We know import.meta.env exists in Vite
    const devValue = import.meta.env.DEV;
    // @ts-expect-error - We know import.meta.env exists in Vite
    const nodeEnv = import.meta.env.NODE_ENV;
    // @ts-expect-error - We know import.meta.env exists in Vite
    const viteAppEnv = import.meta.env.VITE_APP_ENV;

    return devValue === true || nodeEnv === 'development' || viteAppEnv === 'development';
  }

  // Fallback for non-Vite environments (Electron main process)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }

  console.log('🔍 isDev() - fallback to false');
  return false;
};

// Get if we're in beta environment
export const isBeta = (): boolean => {
  // In Vite environment, we can directly access import.meta.env
  // @ts-expect-error - We know import.meta exists in Vite browser context
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-expect-error - We know import.meta.env exists in Vite
    const viteAppEnv = import.meta.env.VITE_APP_ENV;
    return viteAppEnv === 'beta';
  }

  // Fallback for non-Vite environments (Electron main process)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_APP_ENV === 'beta';
  }

  return false;
};

// Get environment variables safely
export const getEnvVar = (name: string): string | undefined => {
  // In Vite environment, we can directly access import.meta.env
  // @ts-expect-error - We know import.meta exists in Vite browser context
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-expect-error - We know import.meta.env exists in Vite
    return import.meta.env[name];
  }

  // Fallback for non-Vite environments (Electron main process)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }

  return undefined;
};
