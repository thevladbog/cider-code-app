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

/**
 * Check if code is running in browser environment
 * Used to determine if we can access window and import.meta
 */
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Safely access a property on an object without TypeScript errors
 * @param obj The object to access
 * @param prop The property to access
 */
const safeGet = <T, K extends PropertyKey>(obj: T, prop: K): unknown => {
  // @ts-expect-error - We're intentionally using bracket notation for dynamic access
  return obj[prop];
};

// Get if we're in development mode
export const isDev = (): boolean => {
  // Only try to use import.meta in browser context
  if (isBrowser()) {
    try {
      // We need to use eval to avoid TypeScript errors during compilation
      // This code will only run in the browser context where import.meta is available

      const meta = eval('import.meta');
      if (typeof meta === 'object' && meta !== null) {
        const env = safeGet(meta, 'env');
        return safeGet(env, 'DEV') === true;
      }
    } catch {
      // import.meta is not available in this context
    }
  }

  // Fallback for non-Vite environments (Electron main process)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }

  return false;
};

// Get environment variables safely
export const getEnvVar = (name: string): string | undefined => {
  // Only try to use import.meta in browser context
  if (isBrowser()) {
    try {
      const meta = eval('import.meta');
      if (typeof meta === 'object' && meta !== null) {
        const env = safeGet(meta, 'env');
        return safeGet(env, name) as string | undefined;
      }
    } catch {
      // import.meta is not available in this context
    }
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }

  return undefined;
};
