/**
 * Path polyfill for ESM modules
 *
 * Provides __dirname and __filename functionality for ESM modules
 * where these globals are not available. Use this instead of the
 * global __dirname and __filename variables.
 *
 * @example
 * ```typescript
 * import { __dirname, __filename } from './pathPolyfill';
 *
 * console.log('Current directory:', __dirname);
 * console.log('Current file:', __filename);
 * ```
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Gets the directory name of the current module
 * Equivalent to __dirname in CommonJS
 */
export const __dirname = import.meta.url ? dirname(fileURLToPath(import.meta.url)) : process.cwd();

/**
 * Gets the file path of the current module
 * Equivalent to __filename in CommonJS
 */
export const __filename = import.meta.url ? fileURLToPath(import.meta.url) : '';
