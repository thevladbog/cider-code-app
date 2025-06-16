/**
 * Comprehensive test for Yandex Cloud authentication
 * This file tests the authentication in different contexts and ensures metadata service is never used
 */

import { getExecutionContext } from '../utils/executionContext';

// Mock HTTP requests to detect metadata service attempts
function setupMetadataDetection() {
  const originalFetch = global.fetch;
  let metadataAttempts = 0;

  // Override fetch to detect metadata service requests
  global.fetch = function (url: string | URL | Request, init?: RequestInit) {
    const urlString = typeof url === 'string' ? url : url.toString();

    if (urlString.includes('169.254.169.254') || urlString.includes('metadata.google.internal')) {
      metadataAttempts++;
      console.error(`🚫 DETECTED METADATA SERVICE REQUEST #${metadataAttempts}:`, urlString);
      console.error('🚫 Stack trace:', new Error().stack);

      // Reject with a specific error that matches what would happen in production
      return Promise.reject(
        new Error(`ECONNREFUSED: Connection refused to metadata service ${urlString}`)
      );
    }

    return originalFetch
      ? originalFetch(url, init)
      : Promise.reject(new Error('No fetch available'));
  };

  return {
    getMetadataAttempts: () => metadataAttempts,
    restore: () => {
      if (originalFetch) {
        global.fetch = originalFetch;
      }
    },
  };
}

// Test environment variables setup
function testEnvironmentSetup() {
  console.log('\n🔍 Проверка переменных окружения...');

  const requiredEnvVars = ['YANDEX_SERVICE_ACCOUNT_KEY', 'YANDEX_FOLDER_ID', 'YANDEX_LOG_GROUP_ID'];

  const metadataDisableVars = [
    'YC_METADATA_CREDENTIALS',
    'DISABLE_YC_METADATA',
    'YC_DISABLE_METADATA',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'AWS_EC2_METADATA_DISABLED',
    'METADATA_SERVICE_DISABLED',
  ];

  console.log('✅ Обязательные переменные:');
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName.includes('KEY') ? `[${value.length} символов]` : value;
      console.log(`  ${varName}: ${displayValue}`);
    } else {
      console.error(`  ❌ ${varName}: НЕ УСТАНОВЛЕНА`);
    }
  }

  console.log('\n🚫 Переменные для отключения metadata service:');
  for (const varName of metadataDisableVars) {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value || 'не установлена'}`);
  }
}

// Test execution context
function testExecutionContext() {
  console.log('\n🔍 Проверка контекста выполнения...');

  const context = getExecutionContext();
  console.log(`Контекст: ${context.context}`);
  console.log(`Описание: ${context.description}`);
  console.log(`Node.js модули: ${context.canUseNodeModules ? '✅ доступны' : '❌ недоступны'}`);

  // Additional context checks
  console.log(
    `process.type: ${(process as NodeJS.Process & { type?: string }).type || 'undefined'}`
  );
  console.log(`window: ${typeof window !== 'undefined' ? 'defined' : 'undefined'}`);
  console.log(`process.versions.electron: ${process.versions?.electron || 'undefined'}`);
  console.log(`process.versions.node: ${process.versions?.node || 'undefined'}`);
}

// Test Yandex Cloud Logger initialization
async function testYandexCloudLogger() {
  console.log('\n🔍 Тестирование Yandex Cloud Logger...');

  const metadataDetector = setupMetadataDetection();

  try {
    // Import logger dynamically to avoid issues in different contexts
    const { YandexCloudLoggerSDK } = await import('./yandexCloudLoggerSDK');

    const config = {
      folderId: process.env.YANDEX_FOLDER_ID || 'test-folder',
      logGroupId: process.env.YANDEX_LOG_GROUP_ID || 'test-log-group',
      environment: 'test',
    };

    console.log('📝 Создание экземпляра логгера...');
    const logger = new YandexCloudLoggerSDK(config);

    console.log('🔄 Инициализация логгера...');
    await logger.initialize();

    console.log('📨 Отправка тестового лога...');
    await logger.log({
      level: 'INFO',
      message: 'Test log from authentication test',
      jsonPayload: {
        test: true,
        timestamp: new Date().toISOString(),
        context: getExecutionContext().context,
      },
    });

    console.log('✅ Логгер успешно инициализирован и отправил лог');
  } catch (error) {
    console.error('❌ Ошибка при тестировании логгера:', error);

    // Analyze the error
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('169.254.169.254') || errorMessage.includes('ECONNREFUSED')) {
      console.error('🚫 КРИТИЧЕСКАЯ ПРОБЛЕМА: SDK пытается обратиться к metadata service!');
      console.error('🔧 Это означает, что наши меры по отключению metadata service не сработали');
    } else if (errorMessage.includes('YANDEX_SERVICE_ACCOUNT_KEY')) {
      console.error('🔧 РЕШЕНИЕ: Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY');
    } else if (errorMessage.includes('UNAUTHENTICATED')) {
      console.error('🔧 РЕШЕНИЕ: Проверьте правильность Service Account Key');
    } else {
      console.error('🔧 Неизвестная ошибка аутентификации');
    }

    throw error;
  } finally {
    const attempts = metadataDetector.getMetadataAttempts();
    if (attempts > 0) {
      console.error(`🚫 ОБНАРУЖЕНО ${attempts} попыток обращения к metadata service!`);
    } else {
      console.log('✅ Попыток обращения к metadata service не обнаружено');
    }

    metadataDetector.restore();
  }
}

// Main test function
export async function runAuthenticationTests() {
  console.log('🧪 ЗАПУСК ТЕСТОВ АУТЕНТИФИКАЦИИ YANDEX CLOUD');
  console.log('='.repeat(60));

  try {
    testEnvironmentSetup();
    testExecutionContext();
    await testYandexCloudLogger();

    console.log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО');
    console.log('✅ Metadata service не используется');
    console.log('✅ Аутентификация работает корректно');
  } catch (error) {
    console.error('\n❌ ТЕСТЫ ЗАВЕРШИЛИСЬ С ОШИБКОЙ');
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAuthenticationTests().catch(error => {
    console.error('Критическая ошибка при выполнении тестов:', error);
    process.exit(1);
  });
}
