/**
 * Тест унифицированной системы определения окружения
 * Проверяет корректную работу VITE_APP_ENV во всех компонентах
 */

// Проверяем, что мы работаем в Node.js окружении, а не в браузере
if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
  console.error(
    'This test file can only run in Node.js environment, not in browser/renderer context'
  );
  console.log('To run this test, use: npx tsx src/services/testEnvironmentUnified.ts');
  throw new Error('Node.js environment required');
}

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

// Асинхронная функция для тестирования
async function runEnvironmentTest() {
  console.log('=== ENVIRONMENT UNIFIED TEST ===');
  console.log('📋 Информация о конфигурации аутентификации:');

  if (process.env.YANDEX_SERVICE_ACCOUNT_KEY) {
    console.log('✅ Используется Service Account Key (рекомендуется)');
  } else if (process.env.YANDEX_IAM_TOKEN) {
    console.log('⚠️  Используется IAM токен (может истечь через некоторое время)');
    console.log('   Рекомендация: переключитесь на Service Account Key для стабильной работы');
  } else if (process.env.YANDEX_OAUTH_TOKEN) {
    console.log('⚠️  Используется OAuth токен');
  } else {
    console.log('❌ Аутентификация не настроена');
    console.log(
      '   Установите одну из переменных: YANDEX_SERVICE_ACCOUNT_KEY, YANDEX_IAM_TOKEN, или YANDEX_OAUTH_TOKEN'
    );
  }

  console.log('');

  // Инициализируем логгер перед использованием
  try {
    await logger.initialize();
    console.log('✅ Логгер успешно инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации логгера:', error);
    if (error instanceof Error && error.message.includes('expired')) {
      console.log('');
      console.log('🔧 РЕШЕНИЕ ПРОБЛЕМЫ ИСТЕЧЕНИЯ ТОКЕНА:');
      console.log('1. Получите Service Account Key из Yandex Cloud Console');
      console.log(
        '2. Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY с JSON содержимым'
      );
      console.log('3. Перезапустите приложение');
      console.log('');
      console.log('Service Account Key не истекает и обновляется автоматически.');
    }
    return;
  }

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
  await logger.info('Environment unified test started', {
    testType: 'environment-unified',
    currentEnvironment: environment,
    apiUrl: envConfig.apiUrl,
    timestamp: new Date().toISOString(),
  });

  // 5. Диагностика статуса логгера
  console.log('🔧 Статус логгера:');
  const loggerStatus = logger.getStatus();
  console.log('- Инициализирован:', loggerStatus.isInitialized);
  console.log('- Метод аутентификации:', loggerStatus.authMethod);
  console.log('- Облачное логирование доступно:', loggerStatus.canAttemptCloudLogging);
  console.log('- Количество попыток восстановления:', loggerStatus.authRetryCount);
  if (loggerStatus.isCloudLoggingDisabled) {
    console.log('⚠️  Облачное логирование временно отключено');
    console.log('- Время последней ошибки:', loggerStatus.lastFailureTime);
  }
  console.log('');

  // 6. Проверяем переменные окружения напрямую
  console.log('🔍 Environment variables check:');
  console.log('- process.env.NODE_ENV:', process.env.NODE_ENV);
  console.log('- process.env.VITE_APP_ENV:', process.env.VITE_APP_ENV);
  console.log('- process.env.APP_ENVIRONMENT:', process.env.APP_ENVIRONMENT);

  // В Vite environment
  try {
    interface ViteImportMeta extends ImportMeta {
      env?: {
        VITE_APP_ENV?: string;
        DEV?: boolean;
        PROD?: boolean;
      };
    }

    if (typeof import.meta !== 'undefined' && (import.meta as ViteImportMeta).env) {
      const viteEnv = (import.meta as ViteImportMeta).env!;
      console.log('- import.meta.env.VITE_APP_ENV:', viteEnv.VITE_APP_ENV);
      console.log('- import.meta.env.DEV:', viteEnv.DEV);
      console.log('- import.meta.env.PROD:', viteEnv.PROD);
    } else {
      console.log('- import.meta.env not available in current context');
    }
  } catch {
    console.log('- import.meta.env not available in current context');
  }

  // 7. Тест логов с разными уровнями
  const testData = {
    environment,
    testTimestamp: new Date().toISOString(),
    configuredApiUrl: envConfig.apiUrl,
  };

  // Await all logging calls to ensure they complete before proceeding
  await Promise.all([
    logger.debug('Debug log with environment', testData),
    logger.info('Info log with environment', testData),
    logger.warn('Warning log with environment', testData),
    logger.error('Error log with environment', { ...testData, errorType: 'test-error' }),
  ]);

  console.log('✅ Environment unified test completed');
  console.log('Check Yandex Cloud logs for environment field in jsonPayload');

  // 7. Финальная диагностика логгера
  const finalStatus = logger.getStatus();
  if (finalStatus.isCloudLoggingDisabled) {
    console.log('');
    console.log('⚠️  ВНИМАНИЕ: Облачное логирование отключено из-за ошибок аутентификации');
    console.log('🔧 Для восстановления облачного логирования:');
    console.log('1. Настройте Service Account Key (YANDEX_SERVICE_ACCOUNT_KEY)');
    console.log('2. Или обновите IAM токен (YANDEX_IAM_TOKEN)');
    console.log('3. Перезапустите приложение или вызовите logger.forceEnableCloudLogging()');
  } else {
    console.log('✅ Облачное логирование работает корректно');
  }
}

// Запускаем тест
runEnvironmentTest().catch(console.error);
