import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';

export interface ServiceAccountKey {
  id: string;
  service_account_id: string;
  created_at: string;
  key_algorithm: string;
  public_key: string;
  private_key: string;
}

export interface YandexCloudLoggerConfig {
  iamToken?: string;
  oauthToken?: string;
  serviceAccountKey?: ServiceAccountKey;
  folderId: string;
  logGroupId: string;
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
  LEVEL_UNSPECIFIED = 'LEVEL_UNSPECIFIED',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogEntry {
  timestamp: string; // RFC3339 format
  level: LogLevel;
  message: string;
  jsonPayload?: Record<string, unknown>;
  streamName?: string;
}

export class YandexCloudLogger {
  private httpClient: AxiosInstance;
  private config: Required<
    Omit<YandexCloudLoggerConfig, 'iamToken' | 'oauthToken' | 'serviceAccountKey'>
  > &
    Pick<YandexCloudLoggerConfig, 'iamToken' | 'oauthToken' | 'serviceAccountKey'>;
  private isInitialized = false;
  private iamToken?: string;

  constructor(config: YandexCloudLoggerConfig) {
    this.config = {
      iamToken: config.iamToken,
      oauthToken: config.oauthToken,
      serviceAccountKey: config.serviceAccountKey,
      folderId: config.folderId,
      logGroupId: config.logGroupId,
      resource: config.resource || {
        type: 'bottle-code-app',
        id: 'electron-app',
      },
    };

    // Используем правильный endpoint для Yandex Cloud Logging gRPC-Web gateway
    this.httpClient = axios.create({
      baseURL: 'https://logging.api.cloud.yandex.net',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * Генерация JWT токена из Service Account Key
   */
  private generateJWT(serviceAccountKey: ServiceAccountKey): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountKey.service_account_id,
      aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
      iat: now,
      exp: now + 3600, // токен действует 1 час
    };

    return jwt.sign(payload, serviceAccountKey.private_key, {
      algorithm: 'RS256',
      keyid: serviceAccountKey.id,
    });
  }

  /**
   * Получение IAM токена из Service Account Key
   */
  private async getIAMTokenFromServiceAccount(
    serviceAccountKey: ServiceAccountKey
  ): Promise<string> {
    const jwtToken = this.generateJWT(serviceAccountKey);

    try {
      const response = await axios.post('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
        jwt: jwtToken,
      });

      return response.data.iamToken;
    } catch (error) {
      console.error('Ошибка получения IAM токена:', error);
      throw new Error('Не удалось получить IAM токен из Service Account Key');
    }
  }

  /**
   * Инициализация логгера
   */
  async initialize(): Promise<void> {
    try {
      // Получаем токен авторизации
      if (this.config.iamToken) {
        this.iamToken = this.config.iamToken;
      } else if (this.config.serviceAccountKey) {
        this.iamToken = await this.getIAMTokenFromServiceAccount(this.config.serviceAccountKey);
      } else if (this.config.oauthToken) {
        // OAuth токен используется напрямую
        this.httpClient.defaults.headers.common['Authorization'] =
          `OAuth ${this.config.oauthToken}`;
      } else {
        throw new Error('Необходимо указать iamToken, oauthToken или serviceAccountKey');
      }

      // Устанавливаем заголовок авторизации для IAM токена
      if (this.iamToken) {
        this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.iamToken}`;
      }

      this.isInitialized = true;
      console.log('Yandex Cloud Logger успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации Yandex Cloud Logger:', error);
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
      const logEntry: LogEntry = {
        timestamp: timestamp.toISOString(),
        level: this.mapLogLevel(logMessage.level),
        message: logMessage.message,
        jsonPayload: logMessage.jsonPayload,
        streamName: logMessage.streamName || 'default',
      };

      await this.sendLogViaAPI([logEntry]);

      console.log(`Лог отправлен в Yandex Cloud: ${logMessage.level} - ${logMessage.message}`);
    } catch (error) {
      console.error('Ошибка отправки лога в Yandex Cloud:', error);
      // В случае ошибки записываем в консоль локально
      console.log(`[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`, logMessage.jsonPayload);
    }
  }

  /**
   * Отправка логов через REST API
   */
  private async sendLogViaAPI(entries: LogEntry[]): Promise<void> {
    // Формируем payload согласно документации gRPC API
    const payload = {
      destination: {
        logGroupId: this.config.logGroupId,
      },
      resource: this.config.resource,
      entries: entries.map(entry => {
        // Убираем undefined поля для корректной отправки
        const cleanEntry: Partial<LogEntry> = {
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
        };

        if (entry.jsonPayload && Object.keys(entry.jsonPayload).length > 0) {
          cleanEntry.jsonPayload = entry.jsonPayload;
        }

        if (entry.streamName) {
          cleanEntry.streamName = entry.streamName;
        }

        return cleanEntry;
      }),
    };

    console.log('Отправляем payload в Yandex Cloud Logging:', JSON.stringify(payload, null, 2));
    console.log('Authorization header:', this.httpClient.defaults.headers.common['Authorization']);

    // Попробуем разные возможные endpoints для gRPC-Web
    const endpoints = [
      '/logging/v1/write',
      '/v1/write',
      '/logging/v1/LogIngestion/Write',
      '/v1/LogIngestion/Write',
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Попытка отправки на endpoint: ${this.httpClient.defaults.baseURL}${endpoint}`);

        const response = await this.httpClient.post(endpoint, payload);
        console.log('Логи успешно отправлены в Yandex Cloud Logging через', endpoint);
        return response.data;
      } catch (error: unknown) {
        console.log(
          `Ошибка на endpoint ${endpoint}:`,
          axios.isAxiosError(error) ? error.response?.status : 'Unknown error'
        );

        // Если это последний endpoint в списке, выбрасываем ошибку
        if (endpoint === endpoints[endpoints.length - 1]) {
          console.error('Все endpoints завершились ошибкой. Последняя ошибка:', error);

          if (axios.isAxiosError(error) && error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            console.error('Response headers:', error.response.headers);

            // Дополнительная информация для отладки
            if (error.response.status === 404) {
              console.error('Возможные причины ошибки 404:');
              console.error('1. Неверный logGroupId:', this.config.logGroupId);
              console.error('2. Yandex Cloud Logging API не поддерживает REST/HTTP запросы');
              console.error('3. Нет доступа к указанной log group');
              console.error('4. Необходимо использовать gRPC клиент вместо HTTP');
            }
          }
          throw error;
        }
      }
    }
  }

  /**
   * Преобразование уровня логирования в формат Yandex Cloud
   */
  private mapLogLevel(level: string): LogLevel {
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'FATAL':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
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
      const entries: LogEntry[] = logMessages.map(logMessage => {
        const timestamp = logMessage.timestamp || new Date();
        return {
          timestamp: timestamp.toISOString(),
          level: this.mapLogLevel(logMessage.level),
          message: logMessage.message,
          jsonPayload: logMessage.jsonPayload,
          streamName: logMessage.streamName || 'default',
        };
      });

      await this.sendLogViaAPI(entries);

      console.log(`Пакет из ${logMessages.length} логов отправлен в Yandex Cloud`);
    } catch (error) {
      console.error('Ошибка отправки пакета логов в Yandex Cloud:', error);
      // В случае ошибки записываем в консоль локально
      logMessages.forEach(logMessage => {
        console.log(
          `[LOCAL LOG] ${logMessage.level}: ${logMessage.message}`,
          logMessage.jsonPayload
        );
      });
    }
  }
}
