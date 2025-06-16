import { Session, cloudApi, serviceClients } from '@yandex-cloud/nodejs-sdk';
import { ServiceAccountKey } from './yandexCloudLogger';

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
    Omit<YandexCloudLoggerSDKConfig, 'iamToken' | 'oauthToken' | 'serviceAccountKey'>
  > &
    Pick<YandexCloudLoggerSDKConfig, 'iamToken' | 'oauthToken' | 'serviceAccountKey'>;
  private isInitialized = false;

  constructor(config: YandexCloudLoggerSDKConfig) {
    this.config = {
      iamToken: config.iamToken,
      oauthToken: config.oauthToken,
      serviceAccountKey: config.serviceAccountKey,
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
      console.log('Yandex Cloud Logger SDK успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации Yandex Cloud Logger SDK:', error);
      throw error;
    }
  }

  /**
   * Отправка лога в Yandex Cloud Logging
   */
  async log(logMessage: LogMessage): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Logger не инициализирован. Инициализируем...');
      await this.initialize();
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
    } catch (error) {
      console.error('Ошибка отправки лога в Yandex Cloud через SDK:', error);
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
