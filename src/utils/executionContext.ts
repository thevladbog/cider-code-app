/**
 * Утилиты для определения контекста выполнения (main/renderer процесс)
 */

/**
 * Проверяет, выполняется ли код в main процессе Electron
 */
export function isMainProcess(): boolean {
  try {
    // В main процессе доступен process.type === 'browser' или process.versions.electron без window
    return (
      typeof process !== 'undefined' &&
      !!process.versions &&
      !!process.versions.electron &&
      typeof window === 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Проверяет, выполняется ли код в renderer процессе Electron
 */
export function isRendererProcess(): boolean {
  try {
    // В renderer процессе есть window и process.type === 'renderer'
    return (
      typeof window !== 'undefined' &&
      typeof process !== 'undefined' &&
      !!process.versions &&
      !!process.versions.electron
    );
  } catch {
    return false;
  }
}

/**
 * Проверяет, выполняется ли код в браузере (не Electron)
 */
export function isBrowser(): boolean {
  try {
    return typeof window !== 'undefined' && !process.versions?.electron;
  } catch {
    return typeof window !== 'undefined';
  }
}

/**
 * Проверяет, выполняется ли код в Node.js окружении
 */
export function isNodeJs(): boolean {
  try {
    return (
      typeof process !== 'undefined' &&
      !!process.versions &&
      !!process.versions.node &&
      typeof window === 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Получает описание текущего контекста выполнения
 */
export function getExecutionContext(): {
  context: 'main' | 'renderer' | 'browser' | 'nodejs' | 'unknown';
  canUseNodeModules: boolean;
  description: string;
} {
  if (isMainProcess()) {
    return {
      context: 'main',
      canUseNodeModules: true,
      description: 'Electron Main Process - полный доступ к Node.js API',
    };
  }

  if (isRendererProcess()) {
    return {
      context: 'renderer',
      canUseNodeModules: false,
      description: 'Electron Renderer Process - ограниченный доступ к Node.js API',
    };
  }

  if (isBrowser()) {
    return {
      context: 'browser',
      canUseNodeModules: false,
      description: 'Browser - только Web API',
    };
  }

  if (isNodeJs()) {
    return {
      context: 'nodejs',
      canUseNodeModules: true,
      description: 'Node.js - полный доступ к Node.js API',
    };
  }

  return {
    context: 'unknown',
    canUseNodeModules: false,
    description: 'Неизвестный контекст выполнения',
  };
}
