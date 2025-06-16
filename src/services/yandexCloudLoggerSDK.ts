import { Session, cloudApi, serviceClients } from '@yandex-cloud/nodejs-sdk';
import { ServiceAccountKey, ServiceAccountKeyConfig, ServiceAccountKeyLoader } from './types';

const {
  logging: {
    log_ingestion_service: { WriteRequest },
    log_entry: { LogLevel_Level },
  },
} = cloudApi;

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
  private session: Session;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logIngestionService: any; // Will be initialized as LogIngestionServiceClient from SDK
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
    this.session = new Session();
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

      // Сбрасываем состояние и пытаемся переинициализировать
      this.isInitialized = false;
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
    try {
      // Настройка аутентификации в зависимости от типа токена
      if (this.config.iamToken) {
        this.session = new Session({ iamToken: this.config.iamToken });
      } else if (this.config.serviceAccountKey) {
        // Используем serviceAccountKey - TypeScript определения неполные, но runtime поддерживает
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.session = new Session({ serviceAccountKey: this.config.serviceAccountKey } as any);
      } else if (this.config.oauthToken) {
        this.session = new Session({ oauthToken: this.config.oauthToken });
      } else {
        throw new Error('Необходимо указать iamToken, oauthToken или serviceAccountKey');
      }

      // Создаем клиент для Log Ingestion с помощью сессии
      this.logIngestionService = this.session.client(serviceClients.LogIngestionServiceClient);

      this.isInitialized = true;
      this.lastAuthError = null; // Сбрасываем предыдущие ошибки аутентификации
      this.authRetryCount = 0; // Сбрасываем счетчик попыток

      console.log('Yandex Cloud Logger SDK успешно инициализирован');

      // Если используется IAM токен, предупреждаем о возможном истечении
      if (this.config.iamToken) {
        console.warn(
          'ВНИМАНИЕ: Используется IAM токен, который может истечь через некоторое время. ' +
            'Для production-окружения рекомендуется использовать Service Account Key.'
        );
      }
    } catch (error) {
      console.error('Ошибка инициализации Yandex Cloud Logger SDK:', error);
      this.lastAuthError = error instanceof Error ? error : new Error(String(error));
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

    try {
      const timestamp = logMessage.timestamp || new Date();

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
        level: this.mapLogLevel(logMessage.level),
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

      console.log('Отправляем лог через Yandex Cloud SDK:', JSON.stringify(request, null, 2));

      const response = await this.logIngestionService.write(request);

      console.log(
        `Лог успешно отправлен в Yandex Cloud: ${logMessage.level} - ${logMessage.message} [${this.config.environment}]`
      );
      console.log('Response:', response);

      // Успешная отправка - сбрасываем счетчики ошибок
      this.authRetryCount = 0;
      this.lastAuthError = null;
    } catch (error) {
      console.error('Ошибка отправки лога в Yandex Cloud через SDK:', error);

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
  private mapLogLevel(level: string): (typeof LogLevel_Level)[keyof typeof LogLevel_Level] {
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
      await this.initialize();
    }

    try {
      const entries = logMessages.map(logMessage => {
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
          level: this.mapLogLevel(logMessage.level),
          message: logMessage.message,
          jsonPayload: enrichedPayload,
          streamName: logMessage.streamName || 'default',
        };
      });

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
