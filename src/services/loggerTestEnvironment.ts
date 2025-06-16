import dotenv from 'dotenv';
import { createSDKLoggerConfig } from './loggerConfig';
import { YandexCloudLoggerSDK } from './yandexCloudLoggerSDK';

// Загружаем переменные окружения
dotenv.config();

/**
 * Тест логгера с environment поддержкой
 */
async function testLoggerWithEnvironment() {
  console.log('='.repeat(80));
  console.log('🧪 ТЕСТИРОВАНИЕ YANDEX CLOUD LOGGER С ENVIRONMENT');
  console.log('='.repeat(80));

  try {
    // Получаем конфигурацию
    const config = createSDKLoggerConfig();

    console.log('\n📋 КОНФИГУРАЦИЯ:');
    console.log('Enabled:', config.enabled);
    console.log('Environment:', config.environment);
    console.log('Folder ID:', config.folderId);
    console.log('Log Group ID:', config.logGroupId);
    console.log('Resource ID:', config.resource?.id);

    if (!config.enabled) {
      console.log('\n⚠️ Логирование отключено, включите YANDEX_CLOUD_LOGGING_ENABLED=true');
      return;
    }

    // Создаем и инициализируем логгер
    const logger = new YandexCloudLoggerSDK(config);
    await logger.initialize();

    console.log('\n📝 ОТПРАВКА ТЕСТОВЫХ ЛОГОВ...');

    // Отправляем различные типы логов
    await logger.info('Environment Test: Application started', {
      feature: 'environment_support',
      testType: 'basic_logging',
      timestamp: new Date().toISOString(),
    });

    await logger.warn('Environment Test: This is a warning', {
      feature: 'environment_support',
      testType: 'warning_logging',
      warningLevel: 'medium',
    });

    await logger.error('Environment Test: This is an error', {
      feature: 'environment_support',
      testType: 'error_logging',
      errorType: 'test_error',
      severity: 'high',
    });

    // Тестируем batch отправку
    console.log('\n📦 ТЕСТИРОВАНИЕ BATCH ОТПРАВКИ...');
    await logger.logBatch([
      {
        level: 'INFO',
        message: 'Environment Batch Test: Message 1',
        jsonPayload: { batchNumber: 1, testType: 'batch_test' },
      },
      {
        level: 'DEBUG',
        message: 'Environment Batch Test: Message 2',
        jsonPayload: { batchNumber: 2, testType: 'batch_test' },
      },
      {
        level: 'WARN',
        message: 'Environment Batch Test: Message 3',
        jsonPayload: { batchNumber: 3, testType: 'batch_test' },
      },
    ]);

    console.log('\n✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ УСПЕШНО!');
    console.log(`💡 Проверьте логи в Yandex Cloud Logging для environment: ${config.environment}`);
    console.log('   https://console.yandex.cloud/folders/' + config.folderId + '/logging');
    console.log('\n🔍 В логах должны присутствовать следующие поля:');
    console.log('   - environment:', config.environment);
    console.log('   - platform:', process.platform);
    console.log('   - arch:', process.arch);
    console.log('   - appVersion: unknown (или версия из package.json)');
  } catch (error) {
    console.error('\n❌ ОШИБКА ПРИ ТЕСТИРОВАНИИ:', error);
  }
}

// Запускаем тест
testLoggerWithEnvironment().catch(console.error);
