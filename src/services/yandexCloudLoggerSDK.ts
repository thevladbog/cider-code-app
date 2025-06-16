import { getExecutionContext } from '../utils/executionContext';
import { ServiceAccountKey, ServiceAccountKeyConfig, ServiceAccountKeyLoader } from './types';
import { YandexCloudLoggerDirectAPI } from './yandexCloudLoggerDirectAPI';

// Dynamic imports for Node.js-only modules to prevent browser bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let YandexSDK: any = null;

// Агрессивное отключение metadata service для Yandex Cloud SDK
// Устанавливаем переменные окружения перед любой работой с SDK
function disableMetadataService() {
  // Google Cloud metadata service
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
  process.env.GOOGLE_CLOUD_PROJECT = '';
  process.env.GCLOUD_PROJECT = '';

  // Yandex Cloud metadata service
  process.env.YC_METADATA_CREDENTIALS = 'false';
  process.env.DISABLE_YC_METADATA = 'true';
  process.env.YC_DISABLE_METADATA = 'true';

  // AWS metadata service (для полноты)
  process.env.AWS_EC2_METADATA_DISABLED = 'true';

  // Общие переменные для отключения metadata
  process.env.METADATA_SERVICE_DISABLED = 'true';
  process.env.DISABLE_METADATA_SERVICE = 'true';

  console.log('🚫 Metadata service принудительно отключен через переменные окружения');
}

// Агрессивный перехват сетевых запросов к metadata service
function blockMetadataRequests() {
  try {
    // Перехватываем HTTP запросы через Node.js http модуль
    const http = require('http');
    const https = require('https');
    const originalHttpRequest = http.request;
    const originalHttpsRequest = https.request;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function interceptRequest(original: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function (this: any, options: any, callback?: any) {
        const url = typeof options === 'string' ? options : options.hostname || options.host || '';

        if (
          url.includes('169.254.169.254') ||
          url.includes('metadata.google.internal') ||
          url.includes('metadata.yandexcloud.net')
        ) {
          console.error('🚫 ЗАБЛОКИРОВАН HTTP запрос к metadata service:', url);
          const error = new Error(`BLOCKED: Metadata service access denied - ${url}`);
          if (callback) {
            process.nextTick(() => callback(error));
            return;
          }
          throw error;
        }

        return original.call(this, options, callback);
      };
    }

    http.request = interceptRequest(originalHttpRequest);
    https.request = interceptRequest(originalHttpsRequest);

    console.log('🚫 HTTP/HTTPS запросы к metadata service заблокированы');
  } catch (error) {
    console.warn('⚠️ Не удалось установить перехват HTTP запросов:', error);
  }
}

// Вызываем отключение сразу при загрузке модуля
disableMetadataService();
blockMetadataRequests();

// Function to dynamically load Yandex Cloud SDK
async function loadYandexSDK() {
  if (YandexSDK) return YandexSDK;

  try {
    // Принудительно отключаем metadata service перед загрузкой SDK
    disableMetadataService();

    // Дополнительная защита: перехватываем HTTP-запросы к metadata service
    const originalFetch = global.fetch;
    if (originalFetch) {
      global.fetch = function (url: string | URL | Request, init?: RequestInit) {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('169.254.169.254') || urlString.includes('metadata')) {
          console.error('🚫 ЗАБЛОКИРОВАН запрос к metadata service:', urlString);
          return Promise.reject(new Error('Metadata service disabled for security'));
        }
        return originalFetch(url, init);
      };
    }

    YandexSDK = await import('@yandex-cloud/nodejs-sdk');

    console.log('✅ Yandex Cloud SDK загружен с отключенным metadata service');

    return YandexSDK;
  } catch (error) {
    throw new Error(`Failed to load Yandex Cloud SDK: ${(error as Error).message}`);
  }
}

// Helper function to get SDK components
async function getSDKComponents() {
  const sdk = await loadYandexSDK();
  const { Session, cloudApi, serviceClients } = sdk;
  const {
    logging: {
      log_ingestion_service: { WriteRequest },
      log_entry: { LogLevel_Level },
    },
  } = cloudApi;

  return { Session, cloudApi, serviceClients, WriteRequest, LogLevel_Level };
}

export interface YandexCloudLoggerSDKConfig {
  iamToken?: string;
  oauthToken?: string;
  serviceAccountKey?: ServiceAccountKey;
  // Enhanced security: load service account key from secure sources
  serviceAccountKeyConfig?: ServiceAccountKeyConfig;
  folderId: string;
  logGroupId: string;
  environment?: string; // Тип окружения: development, production, staging и т.д.
  resource?: {
    type: string;
    id: string;
  };
}

export interface LogMessage {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  timestamp?: Date;
  jsonPayload?: Record<string, unknown>;
  streamName?: string;
}

export enum LogLevel {
  LEVEL_UNSPECIFIED = 0,
  TRACE = 1,
  DEBUG = 2,
  INFO = 3,
  WARN = 4,
  ERROR = 5,
  FATAL = 6,
}

export class YandexCloudLoggerSDK {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any; // Will be initialized as Session from SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logIngestionService: any; // Will be initialized as LogIngestionServiceClient from SDK
  private directAPI: YandexCloudLoggerDirectAPI | null = null; // Fallback to direct API
  private useFallbackAPI = false; // Flag to use direct API instead of SDK
  private config: Required<
    Omit<
      YandexCloudLoggerSDKConfig,
      'iamToken' | 'oauthToken' | 'serviceAccountKey' | 'serviceAccountKeyConfig'
    >
  > &
    Pick<
      YandexCloudLoggerSDKConfig,
      'iamToken' | 'oauthToken' | 'serviceAccountKey' | 'serviceAccountKeyConfig'
    >;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null; // Shared promise for ongoing initialization
  private lastAuthError: Error | null = null;
  private authRetryCount = 0;
  private readonly maxAuthRetries = 3;
  private isCloudLoggingDisabled = false; // Флаг для временного отключения облачного логирования
  private lastFailureTime: Date | null = null;
  private readonly cooldownPeriod = 5 * 60 * 1000; // 5 минут в миллисекундах

  constructor(config: YandexCloudLoggerSDKConfig) {
    // Load service account key securely if config is provided
    let resolvedServiceAccountKey = config.serviceAccountKey;

    if (!resolvedServiceAccountKey && config.serviceAccountKeyConfig) {
      const loadedKey = ServiceAccountKeyLoader.loadSafely(config.serviceAccountKeyConfig);

      if (loadedKey && ServiceAccountKeyLoader.validate(loadedKey)) {
        resolvedServiceAccountKey = loadedKey;
      } else if (loadedKey) {
        console.error('Loaded service account key failed validation');
      }
    }

    // If no direct key provided, try loading from environment by default
    if (!resolvedServiceAccountKey && !config.iamToken && !config.oauthToken) {
      console.log(
        'No authentication provided, attempting to load service account key from environment...'
      );
      const envKey = ServiceAccountKeyLoader.loadSafely({});
      if (envKey) {
        resolvedServiceAccountKey = envKey;
      }
    }

    this.config = {
      iamToken: config.iamToken,
      oauthToken: config.oauthToken,
      serviceAccountKey: resolvedServiceAccountKey,
      serviceAccountKeyConfig: config.serviceAccountKeyConfig,
      folderId: config.folderId,
      logGroupId: config.logGroupId,
      environment: config.environment || 'production', // По умолчанию production
      resource: config.resource || {
        type: 'bottle-code-app',
        id: 'electron-app',
      },
    };

    // Инициализируем пустую сессию, будет настроена в initialize()
    this.session = null;

    // Инициализируем Direct API как fallback
    this.directAPI = new YandexCloudLoggerDirectAPI({
      iamToken: this.config.iamToken,
      serviceAccountKey: resolvedServiceAccountKey,
      folderId: this.config.folderId,
      logGroupId: this.config.logGroupId,
      resource: this.config.resource,
    });

    // ПРОАКТИВНАЯ ЗАЩИТА: В Electron-приложениях сразу используем Direct API
    // чтобы избежать проблем с metadata service
    const context = getExecutionContext();
    if (context.context === 'main' || context.context === 'renderer') {
      console.warn(
        '🔄 ПРОАКТИВНОЕ ПЕРЕКЛЮЧЕНИЕ: В Electron контексте используем Direct API ' +
          'для предотвращения проблем с metadata service'
      );
      this.useFallbackAPI = true;
    }

    // Также переключаемся на Direct API если в переменных окружения есть признаки отключения metadata
    if (
      process.env.YC_METADATA_CREDENTIALS === 'false' ||
      process.env.DISABLE_YC_METADATA === 'true' ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS === ''
    ) {
      console.warn(
        '🔄 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ: Обнаружено принудительное отключение metadata service, ' +
          'используем Direct API'
      );
      this.useFallbackAPI = true;
    }
  }

  /**
   * Проверка, можно ли попытаться отправить лог в облако
   */
  private canAttemptCloudLogging(): boolean {
    if (!this.isCloudLoggingDisabled) {
      return true;
    }

    // Проверяем, прошел ли cooldown период
    if (this.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
      if (timeSinceFailure > this.cooldownPeriod) {
        console.log('Cooldown период истек. Возобновляем попытки облачного логирования.');
        this.isCloudLoggingDisabled = false;
        this.lastFailureTime = null;
        this.authRetryCount = 0;
        this.lastAuthError = null;
        return true;
      }
    }

    return false;
  }

  /**
   * Отключение облачного логирования на время cooldown
   */
  private disableCloudLoggingTemporarily(): void {
    this.isCloudLoggingDisabled = true;
    this.lastFailureTime = new Date();
    console.warn(
      `Облачное логирование временно отключено на ${this.cooldownPeriod / 1000 / 60} минут ` +
        'из-за проблем с аутентификацией. Логи будут записываться только локально.'
    );
    console.warn(
      '🔧 РЕШЕНИЕ: Используйте Service Account Key для надежного облачного логирования. ' +
        'Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY.'
    );
  }

  /**
   * Проверка и обновление аутентификации при необходимости
   */
  private async refreshAuthIfNeeded(): Promise<void> {
    // Если используется Service Account Key, токен обновляется автоматически SDK
    if (this.config.serviceAccountKey) {
      console.log('Используется Service Account Key - автоматическое обновление токена');
      return;
    }

    // Для IAM и OAuth токенов проверяем последнюю ошибку аутентификации
    if (this.lastAuthError) {
      if (this.authRetryCount >= this.maxAuthRetries) {
        throw new Error(
          `Превышено максимальное количество попыток аутентификации (${this.maxAuthRetries}). ` +
            'Рекомендуется использовать Service Account Key для более надежной аутентификации. ' +
            'Последняя ошибка: ' +
            this.lastAuthError.message
        );
      }

      console.log(
        `Попытка обновления аутентификации ${this.authRetryCount + 1}/${this.maxAuthRetries}`
      );
      this.authRetryCount++;

      // Для IAM токена пытаемся получить новый токен
      if (this.config.iamToken) {
        console.warn(
          'IAM токен истек. Требуется обновление токена вручную или переход на Service Account Key.'
        );
        console.warn(
          'РЕКОМЕНДАЦИЯ: Используйте Service Account Key (YANDEX_SERVICE_ACCOUNT_KEY) для автоматического обновления токенов.'
        );

        // Проверяем, есть ли Service Account Key в переменных окружения
        const envServiceAccountKey = process.env.YANDEX_SERVICE_ACCOUNT_KEY;
        if (envServiceAccountKey) {
          try {
            const serviceAccountKey = JSON.parse(envServiceAccountKey);
            console.log(
              'Найден Service Account Key в переменных окружения. Переключаемся на него...'
            );
            this.config.serviceAccountKey = serviceAccountKey;
            this.config.iamToken = undefined; // Убираем устаревший IAM токен
          } catch (parseError) {
            console.error('Ошибка парсинга YANDEX_SERVICE_ACCOUNT_KEY:', parseError);
          }
        }
      }

      // Сбрасываем состояние и пытаемся переинициализировать
      this.isInitialized = false;
      this.initPromise = null; // Reset the initialization promise to allow re-initialization
      await this.initialize();
    }
  } /**
   * Проверка, является ли ошибка связанной с аутентификацией
   */
  private isAuthenticationError(error: unknown): boolean {
    if (!error) return false;

    // Безопасное приведение типов для проверки свойств ошибки
    const err = error as { message?: string; code?: string | number; toString?: () => string };
    const errorMessage = err.message || (err.toString ? err.toString() : String(error));

    return (
      errorMessage.includes('UNAUTHENTICATED') ||
      errorMessage.includes('expired') ||
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('Invalid token') ||
      err.code === 'UNAUTHENTICATED' ||
      err.code === 16 // gRPC UNAUTHENTICATED code
    );
  }

  /**
   * Инициализация логгера с аутентификацией
   */
  async initialize(): Promise<void> {
    // If initialization is already in progress, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // If already initialized, return immediately
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // Create and store the initialization promise
    this.initPromise = this.performInitialization();

    try {
      await this.initPromise;
    } finally {
      // Clear the promise once initialization is complete (success or failure)
      this.initPromise = null;
    }
  }

  /**
   * Performs the actual initialization logic
   */
  private async performInitialization(): Promise<void> {
    try {
      // Если уже переключились на Direct API, пропускаем инициализацию SDK
      if (this.useFallbackAPI) {
        console.log('✅ Direct API режим уже активен, пропускаем инициализацию SDK');
        this.isInitialized = true;
        this.lastAuthError = null;
        this.authRetryCount = 0;
        return;
      }

      // Принудительно отключаем metadata service перед каждой инициализацией
      disableMetadataService();

      // Проверяем контекст выполнения
      const context = getExecutionContext();
      console.log(`Инициализация Yandex Cloud Logger в контексте: ${context.description}`);

      // В renderer процессе Electron или браузере используем упрощенную логику
      if (context.context === 'renderer' || context.context === 'browser') {
        console.log(
          '🔄 Renderer/Browser контекст: используем fallback логику без metadata service'
        );

        if (!this.config.serviceAccountKey) {
          throw new Error(
            'В renderer/browser контексте требуется Service Account Key. ' +
              'Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY.'
          );
        }

        // В renderer контексте НЕ используем Yandex SDK напрямую
        // Вместо этого отправляем логи через IPC к main процессу
        console.warn(
          '⚠️ В renderer контексте Yandex Cloud SDK может работать нестабильно. ' +
            'Рекомендуется отправка логов через IPC к main процессу.'
        );

        // Создаем mock session для renderer контекста
        this.session = {
          client: () => ({
            write: async () => {
              console.log('📨 Лог будет отправлен через IPC к main процессу');
              // Здесь должна быть логика отправки через IPC
              return Promise.resolve();
            },
          }),
        };

        this.isInitialized = true;
        return;
      }

      // Load Yandex Cloud SDK dynamically (только для main/nodejs контекста)
      const sdk = await loadYandexSDK();
      const { Session, serviceClients } = sdk;

      // Создаем session с максимальной защитой от metadata service
      let sessionConfig: Record<string, unknown> = {};

      // Настройка аутентификации в зависимости от типа токена
      if (this.config.iamToken) {
        console.log('Инициализация с IAM токеном...');
        sessionConfig.iamToken = this.config.iamToken;
      } else if (this.config.serviceAccountKey) {
        console.log('Инициализация с Service Account Key...');
        console.log('Service Account ID:', this.config.serviceAccountKey.service_account_id);
        console.log('Key ID:', this.config.serviceAccountKey.id);

        // ВАЖНО: Используем напрямую Service Account Key в SDK
        // Не генерируем IAM токен вручную, пусть SDK делает это сам
        sessionConfig.serviceAccountKey = this.config.serviceAccountKey;

        console.log('✅ Service Account Key настроен для автоматического управления токенами');
      } else if (this.config.oauthToken) {
        console.log('Инициализация с OAuth токеном...');
        sessionConfig.oauthToken = this.config.oauthToken;
      } else {
        throw new Error('Необходимо указать iamToken, oauthToken или serviceAccountKey');
      }

      // Добавляем дополнительные параметры для стабильной работы
      sessionConfig = {
        ...sessionConfig,
        endpoint: 'api.cloud.yandex.net:443',
        ssl: true,
        timeout: 30000,
      };

      console.log('🔧 Конфигурация сессии:', {
        hasIamToken: !!sessionConfig.iamToken,
        hasServiceAccountKey: !!sessionConfig.serviceAccountKey,
        hasOauthToken: !!sessionConfig.oauthToken,
        endpoint: sessionConfig.endpoint,
      });

      // Создаем session с защитой от metadata service
      this.session = new Session(sessionConfig);

      // Создаем клиент для Log Ingestion с помощью сессии
      this.logIngestionService = this.session.client(serviceClients.LogIngestionServiceClient);

      this.isInitialized = true;
      this.lastAuthError = null; // Сбрасываем предыдущие ошибки аутентификации
      this.authRetryCount = 0; // Сбрасываем счетчик попыток

      console.log('✅ Yandex Cloud Logger SDK успешно инициализирован');

      // Если используется IAM токен, предупреждаем о возможном истечении
      if (this.config.iamToken) {
        console.warn(
          'ВНИМАНИЕ: Используется IAM токен, который может истечь через некоторое время. ' +
            'Для production-окружения рекомендуется использовать Service Account Key.'
        );
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации Yandex Cloud Logger SDK:', error);
      this.lastAuthError = error instanceof Error ? error : new Error(String(error));

      // Проверяем, связана ли ошибка с metadata service
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('169.254.169.254') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('metadata')
      ) {
        console.error(
          '🚫 КРИТИЧЕСКАЯ ОШИБКА: SDK пытается использовать metadata service несмотря на запрет!'
        );
        console.warn('🔄 ПЕРЕКЛЮЧАЕМСЯ НА DIRECT API для обхода проблемы с metadata service');

        // Переключаемся на Direct API
        this.useFallbackAPI = true;
        this.isInitialized = true;
        this.lastAuthError = null;
        this.authRetryCount = 0;

        console.log('✅ Fallback на Direct API выполнен успешно');
        return;
      }

      throw error;
    }
  }

  /**
   * Отправка лога в Yandex Cloud Logging
   */
  async log(logMessage: LogMessage): Promise<void> {
    // Проверяем, можно ли отправлять в облако
    if (!this.canAttemptCloudLogging()) {
      // Если облачное логирование отключено, только локальное логирование
      console.log(`[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`, logMessage.jsonPayload);
      return;
    }

    if (!this.isInitialized) {
      console.warn('Logger не инициализирован. Инициализируем...');
      try {
        await this.initialize();
      } catch (initError) {
        console.error('Не удалось инициализировать логгер:', initError);
        // Fallback к локальному логированию
        console.log(
          `[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`,
          logMessage.jsonPayload
        );
        return;
      }
    }

    // Если используем fallback API (из-за проблем с SDK)
    if (this.useFallbackAPI && this.directAPI) {
      try {
        console.log('📨 Отправляем лог через Direct API (fallback)...');

        await this.directAPI.log({
          timestamp: (logMessage.timestamp || new Date()).toISOString(),
          level: logMessage.level,
          message: logMessage.message,
          jsonPayload: {
            ...(logMessage.jsonPayload || {}),
            environment: this.config.environment,
            appVersion: process.env.npm_package_version || 'unknown',
            platform: process.platform,
            arch: process.arch,
          },
          streamName: logMessage.streamName || 'default',
        });

        console.log(
          `✅ Лог успешно отправлен через Direct API: ${logMessage.level} - ${logMessage.message}`
        );
        return;
      } catch (directAPIError) {
        console.error('❌ Ошибка отправки лога через Direct API:', directAPIError);
        // Fallback к локальному логированию
        console.log(
          `[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`,
          logMessage.jsonPayload
        );
        return;
      }
    }

    try {
      const timestamp = logMessage.timestamp || new Date();

      // Get SDK components dynamically
      const { WriteRequest } = await getSDKComponents();

      // Добавляем environment в jsonPayload
      const enrichedPayload = {
        ...(logMessage.jsonPayload || {}),
        environment: this.config.environment,
        appVersion: process.env.npm_package_version || 'unknown',
        platform: process.platform,
        arch: process.arch,
      };

      // Формируем entry согласно IncomingLogEntry API
      const entry = {
        timestamp: timestamp, // SDK ожидает Date объект
        level: await this.mapLogLevel(logMessage.level),
        message: logMessage.message,
        jsonPayload: enrichedPayload,
        streamName: logMessage.streamName || 'default',
      };

      // Создаем запрос с помощью WriteRequest.fromPartial
      const request = WriteRequest.fromPartial({
        destination: {
          logGroupId: this.config.logGroupId,
        },
        resource: this.config.resource,
        entries: [entry],
      });

      console.log('📨 Отправляем лог через Yandex Cloud SDK...');

      await this.logIngestionService.write(request);

      console.log(
        `✅ Лог успешно отправлен в Yandex Cloud: ${logMessage.level} - ${logMessage.message} [${this.config.environment}]`
      );

      // Успешная отправка - сбрасываем счетчики ошибок
      this.authRetryCount = 0;
      this.lastAuthError = null;
    } catch (error) {
      console.error('❌ Ошибка отправки лога в Yandex Cloud через SDK:', error);

      // Проверяем, связана ли ошибка с metadata service
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('169.254.169.254') ||
        errorMessage.includes('metadata') ||
        errorMessage.includes('ENETUNREACH')
      ) {
        console.warn(
          '🔄 SDK пытается использовать metadata service. Переключаемся на Direct API...'
        );

        // Переключаемся на Direct API для этого запроса и будущих
        this.useFallbackAPI = true;

        try {
          await this.directAPI?.log({
            timestamp: (logMessage.timestamp || new Date()).toISOString(),
            level: logMessage.level,
            message: logMessage.message,
            jsonPayload: {
              ...(logMessage.jsonPayload || {}),
              environment: this.config.environment,
              appVersion: process.env.npm_package_version || 'unknown',
              platform: process.platform,
              arch: process.arch,
            },
            streamName: logMessage.streamName || 'default',
          });

          console.log(
            `✅ Лог успешно отправлен через Direct API (fallback): ${logMessage.level} - ${logMessage.message}`
          );
          return;
        } catch (directAPIError) {
          console.error('❌ Ошибка отправки лога через Direct API fallback:', directAPIError);
        }
      }

      // Проверяем, является ли ошибка связанной с аутентификацией
      if (this.isAuthenticationError(error)) {
        console.warn('Обнаружена ошибка аутентификации. Попытка обновления...');
        try {
          this.lastAuthError = error instanceof Error ? error : new Error(String(error));
          await this.refreshAuthIfNeeded();

          // Повторная попытка отправки после обновления аутентификации
          console.log('Повторная попытка отправки лога после обновления аутентификации...');
          await this.log(logMessage);
          return;
        } catch (authError) {
          console.error('Не удалось обновить аутентификацию:', authError);

          // Если превышено количество попыток, отключаем облачное логирование
          if (this.authRetryCount >= this.maxAuthRetries) {
            this.disableCloudLoggingTemporarily();
          }

          console.error(
            'РЕКОМЕНДАЦИЯ: Для решения проблем с истечением токенов используйте Service Account Key ' +
              'вместо IAM токена. Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY с JSON ключом.'
          );
        }
      }

      // В случае ошибки записываем в консоль локально
      console.log(`[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`, logMessage.jsonPayload);
    }
  }

  /**
   * Преобразование уровня логирования в формат Yandex Cloud SDK
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async mapLogLevel(level: string): Promise<any> {
    const { LogLevel_Level } = await getSDKComponents();

    switch (level) {
      case 'DEBUG':
        return LogLevel_Level.DEBUG;
      case 'INFO':
        return LogLevel_Level.INFO;
      case 'WARN':
        return LogLevel_Level.WARN;
      case 'ERROR':
        return LogLevel_Level.ERROR;
      case 'FATAL':
        return LogLevel_Level.FATAL;
      default:
        return LogLevel_Level.INFO;
    }
  }

  /**
   * Удобные методы для различных уровней логирования
   */
  async debug(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    await this.log({ level: 'DEBUG', message, jsonPayload, streamName });
  }

  async info(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    await this.log({ level: 'INFO', message, jsonPayload, streamName });
  }

  async warn(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    await this.log({ level: 'WARN', message, jsonPayload, streamName });
  }

  async error(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    await this.log({ level: 'ERROR', message, jsonPayload, streamName });
  }

  async fatal(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    await this.log({ level: 'FATAL', message, jsonPayload, streamName });
  }

  /**
   * Пакетная отправка логов
   */
  async logBatch(logMessages: LogMessage[]): Promise<void> {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (initError) {
        console.error('Не удалось инициализировать логгер для пакетной отправки:', initError);
        // Fallback к локальному логированию
        logMessages.forEach(logMessage => {
          console.log(
            `[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`,
            logMessage.jsonPayload
          );
        });
        return;
      }
    }

    try {
      // Get SDK components dynamically
      const { WriteRequest } = await getSDKComponents();

      const entries = await Promise.all(
        logMessages.map(async logMessage => {
          const timestamp = logMessage.timestamp || new Date();

          // Добавляем environment в jsonPayload для каждого сообщения
          const enrichedPayload = {
            ...(logMessage.jsonPayload || {}),
            environment: this.config.environment,
            appVersion: process.env.npm_package_version || 'unknown',
            platform: process.platform,
            arch: process.arch,
          };

          return {
            timestamp: timestamp, // SDK ожидает Date объект
            level: await this.mapLogLevel(logMessage.level),
            message: logMessage.message,
            jsonPayload: enrichedPayload,
            streamName: logMessage.streamName || 'default',
          };
        })
      );

      const request = WriteRequest.fromPartial({
        destination: {
          logGroupId: this.config.logGroupId,
        },
        resource: this.config.resource,
        entries: entries,
      });

      console.log(
        `Отправляем пакет из ${logMessages.length} логов через Yandex Cloud SDK [${this.config.environment}]`
      );

      const response = await this.logIngestionService.write(request);

      console.log(
        `Пакет из ${logMessages.length} логов успешно отправлен в Yandex Cloud [${this.config.environment}]`
      );
      console.log('Response:', response);
    } catch (error) {
      console.error('Ошибка отправки пакета логов в Yandex Cloud через SDK:', error);

      // Проверяем, является ли ошибка связанной с аутентификацией
      if (this.isAuthenticationError(error)) {
        console.warn('Обнаружена ошибка аутентификации в пакетной отправке. Попытка обновления...');
        try {
          this.lastAuthError = error instanceof Error ? error : new Error(String(error));
          await this.refreshAuthIfNeeded();

          // Повторная попытка отправки после обновления аутентификации
          console.log('Повторная попытка отправки пакета логов после обновления аутентификации...');
          await this.logBatch(logMessages);
          return;
        } catch (authError) {
          console.error('Не удалось обновить аутентификацию для пакетной отправки:', authError);
          console.error(
            'РЕКОМЕНДАЦИЯ: Для решения проблем с истечением токенов используйте Service Account Key ' +
              'вместо IAM токена. Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY с JSON ключом.'
          );
        }
      }

      // В случае ошибки записываем в консоль локально
      logMessages.forEach(logMessage => {
        console.log(
          `[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`,
          logMessage.jsonPayload
        );
      });
    }
  }

  /**
   * Получить статус логгера и диагностическую информацию
   */
  getStatus(): {
    isInitialized: boolean;
    isCloudLoggingDisabled: boolean;
    authRetryCount: number;
    lastFailureTime: Date | null;
    authMethod: string;
    canAttemptCloudLogging: boolean;
  } {
    let authMethod = 'not configured';
    if (this.config.serviceAccountKey) {
      authMethod = 'Service Account Key (рекомендуется)';
    } else if (this.config.iamToken) {
      authMethod = 'IAM Token (может истекать)';
    } else if (this.config.oauthToken) {
      authMethod = 'OAuth Token';
    }

    return {
      isInitialized: this.isInitialized,
      isCloudLoggingDisabled: this.isCloudLoggingDisabled,
      authRetryCount: this.authRetryCount,
      lastFailureTime: this.lastFailureTime,
      authMethod,
      canAttemptCloudLogging: this.canAttemptCloudLogging(),
    };
  }

  /**
   * Принудительное включение облачного логирования (сброс cooldown)
   */
  forceEnableCloudLogging(): void {
    this.isCloudLoggingDisabled = false;
    this.lastFailureTime = null;
    this.authRetryCount = 0;
    this.lastAuthError = null;
    console.log('Облачное логирование принудительно включено. Cooldown сброшен.');
  }

  /**
   * Получить текущий environment
   */
  getEnvironment(): string {
    return this.config.environment;
  }

  /**
   * Изменить environment (полезно для тестирования или динамической смены)
   */
  setEnvironment(environment: string): void {
    this.config.environment = environment;
    console.log(`Yandex Cloud Logger environment изменен на: ${environment}`);
  }
}
