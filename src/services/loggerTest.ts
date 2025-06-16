/**
 * Тестовый файл для проверки работы Yandex Cloud Logger
 *
 * Для запуска теста:
 * 1. Настройте переменные окружения в .env
 * 2. Запустите: npx ts-node src/services/loggerTest.ts
 */

// Загружаем переменные окружения из .env файла
import dotenv from 'dotenv';
dotenv.config();

import { getLoggerConfig, validateLoggerConfig } from './loggerConfig';
import { logger } from './loggerService';

async function testLogger(): Promise<void> {
  console.log('🧪 Начинаем тестирование Yandex Cloud Logger...\n');

  try {
    // Проверяем конфигурацию
    const config = getLoggerConfig();
    console.log('📋 Конфигурация логгера:');
    console.log(`  - Включен: ${config.enabled}`);
    console.log(`  - Folder ID: ${config.folderId}`);
    console.log(`  - Log Group ID: ${config.logGroupId}`);
    console.log(`  - IAM Token: ${config.iamToken ? '✅ Установлен' : '❌ Не установлен'}`);
    console.log(`  - OAuth Token: ${config.oauthToken ? '✅ Установлен' : '❌ Не установлен'}`);
    console.log(
      `  - Service Account Key: ${config.serviceAccountKey ? '✅ Установлен' : '❌ Не установлен'}\n`
    );

    if (!validateLoggerConfig(config)) {
      console.log('❌ Конфигурация невалидна. Тест остановлен.');
      return;
    }

    if (!config.enabled) {
      console.log('ℹ️  Логирование отключено. Будет использоваться консольный вывод.\n');
    }

    // Инициализируем логгер
    console.log('🔧 Инициализируем логгер...');
    await logger.initialize(config);
    console.log('✅ Логгер инициализирован\n');

    // Тестируем различные уровни логирования
    console.log('📝 Тестируем уровни логирования...');

    await logger.debug('Тестовое debug сообщение', {
      testData: 'debug_test',
      timestamp: new Date().toISOString(),
    });
    console.log('  ✅ DEBUG лог отправлен');

    await logger.info('Тестовое info сообщение', {
      testData: 'info_test',
      timestamp: new Date().toISOString(),
    });
    console.log('  ✅ INFO лог отправлен');

    await logger.warn('Тестовое warning сообщение', {
      testData: 'warn_test',
      timestamp: new Date().toISOString(),
    });
    console.log('  ✅ WARN лог отправлен');

    await logger.error('Тестовое error сообщение', {
      testData: 'error_test',
      timestamp: new Date().toISOString(),
    });
    console.log('  ✅ ERROR лог отправлен');

    // Тестируем специальные методы
    console.log('\n🎯 Тестируем специальные методы логирования...');

    await logger.logAppEvent('test_app_event', {
      version: '1.0.0-test',
      environment: 'test',
    });
    console.log('  ✅ App Event лог отправлен');

    await logger.logUserAction('test_user_action', {
      action: 'button_click',
      elementId: 'test_button',
    });
    console.log('  ✅ User Action лог отправлен');

    await logger.logSystemEvent('test_system_event', {
      deviceType: 'scanner',
      status: 'connected',
    });
    console.log('  ✅ System Event лог отправлен');

    const testError = new Error('Тестовая ошибка для демонстрации');
    await logger.logError(testError, {
      context: 'logger_test',
      severity: 'low',
    });
    console.log('  ✅ Error лог отправлен');

    // Тестируем пакетную отправку
    console.log('\n📦 Тестируем пакетную отправку логов...');

    await logger.logBatch([
      {
        level: 'INFO',
        message: 'Первый лог в пакете',
        jsonPayload: { batchIndex: 1 },
      },
      {
        level: 'INFO',
        message: 'Второй лог в пакете',
        jsonPayload: { batchIndex: 2 },
      },
      {
        level: 'WARN',
        message: 'Третий лог в пакете',
        jsonPayload: { batchIndex: 3 },
      },
    ]);
    console.log('  ✅ Пакет логов отправлен');

    console.log('\n🎉 Все тесты выполнены успешно!');
    console.log('\n📊 Проверьте логи в консоли Yandex Cloud Logging:');
    console.log(
      `   https://console.cloud.yandex.ru/folders/${config.folderId}/logging/log-groups/${config.logGroupId}`
    );
  } catch (error) {
    console.error('\n❌ Ошибка при тестировании логгера:', error);
    process.exit(1);
  }
}

// Запускаем тест, если файл выполняется напрямую
if (require.main === module) {
  testLogger()
    .then(() => {
      console.log('\n✅ Тест завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testLogger };
