/**
 * Тест унифицированной системы определения окружения
 * Проверяет корректную работу VITE_APP_ENV во всех компонентах
 */

// Загружаем переменные из .env для тестирования
try {
  require('dotenv').config();
} catch {
  console.log('dotenv not available, using system environment variables');
}

import { getAppEnvironment, getEnvironmentConfig, logEnvironmentInfo } from '../utils/environment';
import { createSDKLoggerConfig } from './loggerConfig';
import { YandexCloudLoggerSDK } from './yandexCloudLoggerSDK';

// Создаем инстанс логгера для тестирования
const loggerConfig = createSDKLoggerConfig();
const logger = new YandexCloudLoggerSDK(loggerConfig);

// Тестируем определение окружения
console.log('=== ENVIRONMENT UNIFIED TEST ===');

// 1. Проверяем функцию определения окружения
const environment = getAppEnvironment();
console.log('🌍 Current environment:', environment);

// 2. Проверяем конфигурацию окружения
const envConfig = getEnvironmentConfig();
console.log('⚙️ Environment config:', {
  environment: envConfig.environment,
  apiUrl: envConfig.apiUrl,
  enableCloudLogging: envConfig.enableCloudLogging,
  enableDetailedLogging: envConfig.enableDetailedLogging,
  enableDebugMode: envConfig.enableDebugMode,
});

// 3. Логируем информацию об окружении
logEnvironmentInfo();

// 4. Тестируем логгер с environment
logger.info('Environment unified test started', {
  testType: 'environment-unified',
  currentEnvironment: environment,
  apiUrl: envConfig.apiUrl,
  timestamp: new Date().toISOString(),
});

// 5. Проверяем переменные окружения напрямую
console.log('🔍 Environment variables check:');
console.log('- process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('- process.env.VITE_APP_ENV:', process.env.VITE_APP_ENV);
console.log('- process.env.APP_ENVIRONMENT:', process.env.APP_ENVIRONMENT);

// В Vite environment
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importMeta = (globalThis as any).import?.meta;
  if (importMeta && importMeta.env) {
    console.log('- import.meta.env.VITE_APP_ENV:', importMeta.env.VITE_APP_ENV);
    console.log('- import.meta.env.DEV:', importMeta.env.DEV);
    console.log('- import.meta.env.PROD:', importMeta.env.PROD);
  }
} catch {
  console.log('- import.meta.env not available in current context');
}

// 6. Тест логов с разными уровнями
const testData = {
  environment,
  testTimestamp: new Date().toISOString(),
  configuredApiUrl: envConfig.apiUrl,
};

logger.debug('Debug log with environment', testData);
logger.info('Info log with environment', testData);
logger.warn('Warning log with environment', testData);
logger.error('Error log with environment', { ...testData, errorType: 'test-error' });

console.log('✅ Environment unified test completed');
console.log('Check Yandex Cloud logs for environment field in jsonPayload');
