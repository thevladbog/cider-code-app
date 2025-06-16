import dotenv from 'dotenv';
import { createSDKLoggerConfig, getLoggerConfig } from './loggerConfig';
import { YandexCloudLogger } from './yandexCloudLogger';
import { YandexCloudLoggerSDK } from './yandexCloudLoggerSDK';

// Загружаем переменные окружения
dotenv.config();

/**
 * Тест для обеих реализаций Yandex Cloud Logger
 */
async function testYandexCloudLogging() {
  console.log('='.repeat(80));
  console.log('🧪 ЗАПУСК ТЕСТОВ YANDEX CLOUD LOGGING');
  console.log('='.repeat(80));

  // Получаем конфигурации
  const restConfig = getLoggerConfig();
  const sdkConfig = createSDKLoggerConfig();

  console.log('\n📋 КОНФИГУРАЦИЯ REST API:');
  console.log('Enabled:', restConfig.enabled);
  console.log('Use SDK:', restConfig.useSDK);
  console.log('IAM Token:', restConfig.iamToken ? '✅ Установлен' : '❌ Не установлен');
  console.log('OAuth Token:', restConfig.oauthToken ? '✅ Установлен' : '❌ Не установлен');
  console.log(
    'Service Account Key:',
    restConfig.serviceAccountKey ? '✅ Установлен' : '❌ Не установлен'
  );
  console.log('Folder ID:', restConfig.folderId);
  console.log('Log Group ID:', restConfig.logGroupId);

  console.log('\n📋 КОНФИГУРАЦИЯ SDK:');
  console.log('Enabled:', sdkConfig.enabled);
  console.log('Use SDK:', sdkConfig.useSDK);
  console.log('IAM Token:', sdkConfig.iamToken ? '✅ Установлен' : '❌ Не установлен');
  console.log('OAuth Token:', sdkConfig.oauthToken ? '✅ Установлен' : '❌ Не установлен');
  console.log(
    'Service Account Key:',
    sdkConfig.serviceAccountKey ? '✅ Установлен' : '❌ Не установлен'
  );
  console.log('Folder ID:', sdkConfig.folderId);
  console.log('Log Group ID:', sdkConfig.logGroupId);

  // Проверяем Service Account Key более детально
  if (restConfig.serviceAccountKey) {
    console.log('\n🔐 ДЕТАЛИ SERVICE ACCOUNT KEY:');
    console.log('Key ID:', restConfig.serviceAccountKey.id);
    console.log('Service Account ID:', restConfig.serviceAccountKey.service_account_id);
    console.log('Algorithm:', restConfig.serviceAccountKey.key_algorithm);
    console.log('Public Key Length:', restConfig.serviceAccountKey.public_key?.length || 0);
    console.log('Private Key Length:', restConfig.serviceAccountKey.private_key?.length || 0);
  }

  // Тестируем REST API версию
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ТЕСТИРОВАНИЕ REST API ВЕРСИИ');
  console.log('='.repeat(80));

  if (restConfig.enabled && !restConfig.useSDK) {
    try {
      const restLogger = new YandexCloudLogger(restConfig);

      console.log('\n⏳ Инициализация REST логгера...');
      await restLogger.initialize();

      console.log('\n📝 Отправка тестовых логов через REST API...');
      await restLogger.info('REST API: Тестовое сообщение INFO', {
        testData: 'REST API test',
        timestamp: new Date().toISOString(),
      });

      await restLogger.warn('REST API: Тестовое предупреждение', {
        warning: 'test warning',
        source: 'REST API',
      });

      await restLogger.error('REST API: Тестовая ошибка', {
        error: 'test error',
        severity: 'high',
      });

      // Тест пакетной отправки
      console.log('\n📦 Тестирование пакетной отправки через REST API...');
      await restLogger.logBatch([
        { level: 'INFO', message: 'REST API Batch: Сообщение 1', jsonPayload: { batch: 1 } },
        { level: 'DEBUG', message: 'REST API Batch: Сообщение 2', jsonPayload: { batch: 2 } },
        { level: 'WARN', message: 'REST API Batch: Сообщение 3', jsonPayload: { batch: 3 } },
      ]);

      console.log('✅ REST API тестирование завершено');
    } catch (error) {
      console.error('❌ Ошибка при тестировании REST API:', error);
    }
  } else {
    console.log('⚠️ REST API логирование отключено');
  }

  // Тестируем SDK версию
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ТЕСТИРОВАНИЕ SDK ВЕРСИИ');
  console.log('='.repeat(80));

  if (sdkConfig.enabled) {
    try {
      const sdkLogger = new YandexCloudLoggerSDK(sdkConfig);

      console.log('\n⏳ Инициализация SDK логгера...');
      await sdkLogger.initialize();

      console.log('\n📝 Отправка тестовых логов через SDK...');
      await sdkLogger.info('SDK: Тестовое сообщение INFO', {
        testData: 'SDK test',
        timestamp: new Date().toISOString(),
      });

      await sdkLogger.warn('SDK: Тестовое предупреждение', {
        warning: 'test warning',
        source: 'SDK',
      });

      await sdkLogger.error('SDK: Тестовая ошибка', {
        error: 'test error',
        severity: 'high',
      });

      // Тест пакетной отправки
      console.log('\n📦 Тестирование пакетной отправки через SDK...');
      await sdkLogger.logBatch([
        { level: 'INFO', message: 'SDK Batch: Сообщение 1', jsonPayload: { batch: 1 } },
        { level: 'DEBUG', message: 'SDK Batch: Сообщение 2', jsonPayload: { batch: 2 } },
        { level: 'WARN', message: 'SDK Batch: Сообщение 3', jsonPayload: { batch: 3 } },
      ]);

      console.log('✅ SDK тестирование завершено');
    } catch (error) {
      console.error('❌ Ошибка при тестировании SDK:', error);
    }
  } else {
    console.log('⚠️ SDK логирование отключено');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ');
  console.log('='.repeat(80));

  console.log('\n📋 ИТОГИ:');
  console.log('- REST API логирование:', restConfig.enabled ? '✅ Включено' : '❌ Отключено');
  console.log('- SDK логирование:', sdkConfig.enabled ? '✅ Включено' : '❌ Отключено');

  if (!restConfig.enabled && !sdkConfig.enabled) {
    console.log('\n⚠️ Для тестирования установите YANDEX_CLOUD_LOGGING_ENABLED=true в .env файле');
  }

  console.log('\n💡 Проверьте консоль Yandex Cloud Logging на наличие отправленных логов:');
  console.log('   https://console.yandex.cloud/folders/' + restConfig.folderId + '/logging');
}

// Запускаем тест
if (require.main === module) {
  testYandexCloudLogging().catch(console.error);
}

export { testYandexCloudLogging };
