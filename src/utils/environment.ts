/**
 * Утилиты для работы с окружением приложения
 * Унифицированный подход к определению environment через VITE_APP_ENV
 */

// Используем console для логирования (облачное логирование отключено)
let loggerInstance: {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
} = console;

// Функция для установки логгера после его инициализации (заглушка)
export function setLogger(_logger: unknown): void {
  // Облачное логирование отключено, используем console
  loggerInstance = console;
}

export type AppEnvironment = 'development' | 'testing' | 'staging' | 'beta' | 'production';

/**
 * Получить текущее окружение приложения
 * Порядок проверки:
 * 1. VITE_APP_ENV (для Vite frontend)
 * 2. NODE_ENV (для Node.js backend/Electron)
 * 3. APP_ENVIRONMENT (альтернативная переменная)
 * 4. По умолчанию: 'production'
 */
export function getAppEnvironment(): AppEnvironment {
  // В Electron main process используем process.env
  if (typeof process !== 'undefined' && process.env) {
    const viteEnv = process.env.VITE_APP_ENV;
    const nodeEnv = process.env.NODE_ENV;
    const appEnv = process.env.APP_ENVIRONMENT;

    const env = viteEnv || nodeEnv || appEnv || 'production';
    return normalizeEnvironment(env);
  }

  // В renderer process (Vite) используем import.meta.env
  if (typeof window !== 'undefined' && 'import' in globalThis) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (globalThis as any).import?.meta;
      if (meta && meta.env) {
        const viteEnv = meta.env.VITE_APP_ENV;
        const dev = meta.env.DEV;
        const prod = meta.env.PROD;

        if (viteEnv) return normalizeEnvironment(viteEnv);
        if (dev) return 'development';
        if (prod) return 'production';
      }
    } catch (error) {
      loggerInstance.warn('Error accessing import.meta.env:', error);
    }
  }

  // Fallback
  return 'production';
}

/**
 * Нормализация значения environment к валидным типам
 */
function normalizeEnvironment(env: string): AppEnvironment {
  const normalized = env.toLowerCase().trim();

  switch (normalized) {
    case 'dev':
    case 'development':
    case 'local':
      return 'development';
    case 'test':
    case 'testing':
      return 'testing';
    case 'stage':
    case 'staging':
      return 'staging';
    case 'beta':
      return 'beta';
    case 'prod':
    case 'production':
      return 'production';
    default:
      loggerInstance.warn(`Unknown environment: ${env}, defaulting to production`);
      return 'production';
  }
}

/**
 * Проверяет, является ли текущее окружение продакшном
 */
export function isProduction(): boolean {
  return getAppEnvironment() === 'production';
}

/**
 * Проверяет, является ли текущее окружение разработкой
 */
export function isDevelopment(): boolean {
  return getAppEnvironment() === 'development';
}

/**
 * Проверяет, является ли текущее окружение тестовым
 */
export function isTesting(): boolean {
  return getAppEnvironment() === 'testing';
}

/**
 * Получить конфигурацию в зависимости от окружения
 */
export function getEnvironmentConfig() {
  const env = getAppEnvironment();

  return {
    environment: env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTesting: env === 'testing',
    isStaging: env === 'staging',
    isBeta: env === 'beta',

    // API URLs
    apiUrl: getApiUrl(env),

    // Логирование
    enableDetailedLogging: env === 'development' || env === 'testing',
    enableCloudLogging: false, // Облачное логирование отключено

    // Отладка
    enableDebugMode: env === 'development',
    showConsoleInProduction: false,
  };
}

/**
 * Получить URL API для окружения
 */
function getApiUrl(env: AppEnvironment): string {
  switch (env) {
    case 'development':
      return 'https://api.test.in.bottlecode.app:3035';
    case 'testing':
      return 'https://api.test.in.bottlecode.app:3035';
    case 'staging':
    case 'beta':
      return 'https://beta.api.bottlecode.app';
    case 'production':
    default:
      return 'https://api.bottlecode.app';
  }
}

/**
 * Логировать информацию об окружении
 */
export function logEnvironmentInfo(): void {
  const config = getEnvironmentConfig();
  loggerInstance.info('Environment Configuration:', {
    environment: config.environment,
    apiUrl: config.apiUrl,
    enableDetailedLogging: config.enableDetailedLogging,
    enableCloudLogging: config.enableCloudLogging,
    enableDebugMode: config.enableDebugMode,
  });
}
