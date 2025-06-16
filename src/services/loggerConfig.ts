import { getAppEnvironment } from '../utils/environment';
import { ServiceAccountKey } from './yandexCloudLogger';
import { YandexCloudLoggerSDKConfig } from './yandexCloudLoggerSDK';

/**
 * Конфигурация для Yandex Cloud Logging
 *
 * Для получения необходимых параметров:
 * 1. IAM токен: https://yandex.cloud/ru/docs/iam/operations/iam-token/create
 * 2. OAuth токен: https://yandex.cloud/ru/docs/iam/operations/iam-token/create-for-sa
 * 3. Service Account Key: https://yandex.cloud/ru/docs/iam/operations/sa/create-access-key
 * 4. Folder ID: можно найти в консоли Yandex Cloud
 * 5. Log Group ID: создайте лог-группу в Yandex Cloud Logging
 */

export interface AppLoggerConfig extends YandexCloudLoggerSDKConfig {
  enabled: boolean;
  useSDK?: boolean; // Использовать официальный SDK вместо REST API
}

export interface AppLoggerSDKConfig extends YandexCloudLoggerSDKConfig {
  enabled: boolean;
  useSDK: boolean;
}

/**
 * Парсинг Service Account Key из строки JSON
 */
function parseServiceAccountKey(keyString?: string): ServiceAccountKey | undefined {
  if (!keyString) return undefined;

  try {
    return JSON.parse(keyString) as ServiceAccountKey;
  } catch (error) {
    console.warn('Не удалось распарсить YANDEX_SERVICE_ACCOUNT_KEY:', error);
    return undefined;
  }
}

export const getLoggerConfig = (): AppLoggerConfig => {
  // Получаем конфигурацию из переменных окружения или настроек приложения
  const config: AppLoggerConfig = {
    // Логирование включено только при явном указании
    enabled: process.env.YANDEX_CLOUD_LOGGING_ENABLED === 'true',

    // IAM токен (предпочтительный способ для production)
    iamToken: process.env.YANDEX_IAM_TOKEN,

    // OAuth токен (альтернативный способ)
    oauthToken: process.env.YANDEX_OAUTH_TOKEN,

    // Service Account Key (рекомендуемый способ для production)
    serviceAccountKey: parseServiceAccountKey(process.env.YANDEX_SERVICE_ACCOUNT_KEY),

    // ID папки в Yandex Cloud
    folderId: process.env.YANDEX_FOLDER_ID || 'your-folder-id',

    // ID лог-группы
    logGroupId: process.env.YANDEX_LOG_GROUP_ID || 'your-log-group-id',

    // Ресурс, от имени которого отправляются логи
    resource: {
      type: 'bottle-code-app',
      id: process.env.APP_INSTANCE_ID || 'electron-app-instance',
    },

    // Использовать официальный SDK вместо REST API
    useSDK: process.env.YANDEX_USE_SDK === 'true',
  };

  return config;
};

/**
 * Создание конфигурации для SDK-версии логгера
 */
export const createSDKLoggerConfig = (): AppLoggerSDKConfig => {
  const config: AppLoggerSDKConfig = {
    enabled: process.env.YANDEX_CLOUD_LOGGING_ENABLED === 'true',
    useSDK: true,

    // IAM токен (для быстрого тестирования)
    iamToken: process.env.YANDEX_IAM_TOKEN,

    // OAuth токен (альтернативный способ аутентификации)
    oauthToken: process.env.YANDEX_OAUTH_TOKEN,

    // Service Account Key (рекомендуемый способ для production)
    serviceAccountKey: parseServiceAccountKey(process.env.YANDEX_SERVICE_ACCOUNT_KEY),

    // ID папки в Yandex Cloud
    folderId: process.env.YANDEX_FOLDER_ID || 'your-folder-id',

    // ID лог-группы
    logGroupId: process.env.YANDEX_LOG_GROUP_ID || 'your-log-group-id',

    // Тип окружения
    environment: getAppEnvironment(),

    // Ресурс, от имени которого отправляются логи
    resource: {
      type: 'bottle-code-app',
      id: process.env.APP_INSTANCE_ID || 'electron-app-instance',
    },
  };

  return config;
};

/**
 * Конфигурация для разработки (можно настроить mock-режим)
 */
export const getDevLoggerConfig = (): AppLoggerConfig => {
  return {
    enabled: false, // В разработке используем консольное логирование
    folderId: 'dev-folder',
    logGroupId: 'dev-log-group',
    resource: {
      type: 'bottle-code-app-dev',
      id: 'dev-instance',
    },
  };
};

/**
 * Проверка валидности конфигурации
 */
export const validateLoggerConfig = (config: AppLoggerConfig): boolean => {
  if (!config.enabled) {
    return true; // Если логирование отключено, конфигурация всегда валидна
  }

  if (!config.folderId || !config.logGroupId) {
    console.warn(
      'Yandex Cloud Logger: folderId и logGroupId обязательны при включенном логировании'
    );
    return false;
  }

  if (!config.iamToken && !config.oauthToken && !config.serviceAccountKey) {
    console.warn(
      'Yandex Cloud Logger: необходим iamToken, oauthToken или serviceAccountKey при включенном логировании'
    );
    return false;
  }

  return true;
};
