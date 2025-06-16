import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import { ServiceAccountKey, ServiceAccountKeyConfig, ServiceAccountKeyLoader } from './types';

export interface YandexCloudLoggerConfig {
  iamToken?: string;
  oauthToken?: string;
  serviceAccountKey?: ServiceAccountKey;
  // Enhanced security: load service account key from secure sources
  serviceAccountKeyConfig?: ServiceAccountKeyConfig;
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
    Omit<
      YandexCloudLoggerConfig,
      'iamToken' | 'oauthToken' | 'serviceAccountKey' | 'serviceAccountKeyConfig'
    >
  > &
    Pick<
      YandexCloudLoggerConfig,
      'iamToken' | 'oauthToken' | 'serviceAccountKey' | 'serviceAccountKeyConfig'
    >;
  private isInitialized = false;
  private iamToken?: string;
  private initializingPromise?: Promise<void>; // Guard against concurrent initialization
  private tokenExpiry?: number; // Track when IAM token expires (Unix timestamp)
  private refreshingToken = false; // Guard against concurrent token refresh

  /**
   * Конфигурация для retry логики
   */
  private readonly retryConfig = {
    maxRetries: 3, // Максимальное количество повторов на endpoint
    maxTotalRetries: 10, // Максимальное общее количество повторов
    baseDelay: 1000, // Базовая задержка в миллисекундах
    maxDelay: 10000, // Максимальная задержка
    jitterFactor: 0.1, // Коэффициент случайности (10%)
    retryableStatusCodes: [429, 500, 502, 503, 504], // HTTP статусы для retry
  };

  constructor(config: YandexCloudLoggerConfig) {
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
   * Использует безопасное извлечение приватного ключа для предотвращения его логирования
   */
  private generateJWT(serviceAccountKey: ServiceAccountKey): string {
    const now = Math.floor(Date.now() / 1000);

    // Извлекаем критически важные данные в локальные переменные
    // для предотвращения случайного логирования приватного ключа
    const privateKeyPem = serviceAccountKey.private_key;
    const serviceAccountId = serviceAccountKey.service_account_id;
    const keyId = serviceAccountKey.id;

    // Создаем closure для безопасной работы с приватным ключом
    const signToken = (() => {
      const payload = {
        iss: serviceAccountId,
        aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
        iat: now,
        exp: now + 3600, // токен действует 1 час
      };

      return jwt.sign(payload, privateKeyPem, {
        algorithm: 'RS256',
        keyid: keyId,
      });
    })();

    return signToken;
  }

  /**
   * Получение IAM токена из Service Account Key
   * Безопасно обрабатывает приватный ключ, избегая его передачи в логах
   */
  private async getIAMTokenFromServiceAccount(
    serviceAccountKey: ServiceAccountKey
  ): Promise<string> {
    try {
      const jwtToken = this.generateJWT(serviceAccountKey);

      const response = await axios.post('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
        jwt: jwtToken,
      });

      // Устанавливаем время истечения токена (IAM токены обычно действуют 12 часов)
      // Делаем refresh за 5 минут до истечения для безопасности
      this.tokenExpiry = Date.now() + 12 * 60 * 60 * 1000 - 5 * 60 * 1000;

      return response.data.iamToken;
    } catch (error) {
      // Логируем ошибку без раскрытия деталей service account key
      console.error(
        'Ошибка получения IAM токена. Service Account ID:',
        serviceAccountKey.service_account_id
      );
      console.error('Тип ошибки:', error instanceof Error ? error.message : 'Неизвестная ошибка');

      // Создаем безопасную ошибку без чувствительных данных
      const safeError = new Error('Не удалось получить IAM токен из Service Account Key');

      // Если нужна отладка, логируем только публичную информацию
      if (process.env.NODE_ENV === 'development') {
        console.error('Debug info - Key ID:', serviceAccountKey.id);
        console.error('Debug info - Algorithm:', serviceAccountKey.key_algorithm);
      }

      throw safeError;
    }
  }

  /**
   * Инициализация логгера с защитой от конкурентных вызовов
   */
  async initialize(): Promise<void> {
    // Если уже инициализирован, возвращаемся
    if (this.isInitialized) {
      return;
    }

    // Если инициализация уже идет, ждем ее завершения
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    // Создаем Promise для защиты от конкурентной инициализации
    this.initializingPromise = this.performInitialization();

    try {
      await this.initializingPromise;
    } finally {
      // Очищаем Promise после завершения (успешного или с ошибкой)
      this.initializingPromise = undefined;
    }
  }

  /**
   * Внутренний метод для выполнения инициализации
   */
  private async performInitialization(): Promise<void> {
    try {
      // Получаем токен авторизации
      if (this.config.iamToken) {
        this.iamToken = this.config.iamToken;
        // Для статического IAM токена не устанавливаем expiry, так как не знаем его срок действия
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
   * Проверяет, нужно ли обновить IAM токен
   */
  private needsTokenRefresh(): boolean {
    return !!(this.tokenExpiry && Date.now() >= this.tokenExpiry);
  }

  /**
   * Обновляет IAM токен если это возможно и необходимо
   */
  private async refreshTokenIfNeeded(): Promise<void> {
    // Проверяем, нужно ли обновление и возможно ли оно
    if (!this.needsTokenRefresh() || !this.config.serviceAccountKey || this.refreshingToken) {
      return;
    }

    // Защита от конкурентного обновления токена
    this.refreshingToken = true;

    try {
      console.log('Обновляем истекший IAM токен...');
      const newToken = await this.getIAMTokenFromServiceAccount(this.config.serviceAccountKey);

      this.iamToken = newToken;
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      console.log('IAM токен успешно обновлен');
    } catch (error) {
      console.error('Ошибка обновления IAM токена:', error);
      // Не выбрасываем ошибку, так как это фоновая операция
      // Токен может еще работать или будет обновлен при следующей попытке
    } finally {
      this.refreshingToken = false;
    }
  }

  /**
   * Обрабатывает ошибки аутентификации и пытается обновить токен
   */
  private async handleAuthError(): Promise<boolean> {
    // Если есть service account key, пытаемся обновить токен
    if (this.config.serviceAccountKey && !this.refreshingToken) {
      try {
        console.log('Обнаружена ошибка аутентификации, пытаемся обновить токен...');
        await this.refreshTokenIfNeeded();
        return true; // Указываем, что можно повторить запрос
      } catch (error) {
        console.error('Не удалось обновить токен после ошибки аутентификации:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Отправка лога в Yandex Cloud Logging
   */
  async log(logMessage: LogMessage): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Logger не инициализирован. Инициализируем...');
      await this.initialize();
    }

    // Проверяем и обновляем токен при необходимости
    await this.refreshTokenIfNeeded();

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
      // Проверяем, является ли это ошибкой аутентификации
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.warn('Обнаружена ошибка аутентификации (401), пытаемся обновить токен...');

        const tokenRefreshed = await this.handleAuthError();

        if (tokenRefreshed) {
          // Повторяем попытку отправки с обновленным токеном
          try {
            const timestamp = logMessage.timestamp || new Date();
            const retryLogEntry: LogEntry = {
              timestamp: timestamp.toISOString(),
              level: this.mapLogLevel(logMessage.level),
              message: logMessage.message,
              jsonPayload: logMessage.jsonPayload,
              streamName: logMessage.streamName || 'default',
            };

            await this.sendLogViaAPI([retryLogEntry]);
            console.log('Лог успешно отправлен после обновления токена');
            return;
          } catch (retryError) {
            console.error('Ошибка отправки лога даже после обновления токена:', retryError);
            // Продолжаем к стандартной обработке ошибки
          }
        }
      }

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

    // Only log Authorization header in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'Authorization header:',
        this.httpClient.defaults.headers.common['Authorization']
      );
    }

    // Попробуем разные возможные endpoints для gRPC-Web с retry логикой
    const endpoints = [
      '/logging/v1/write',
      '/v1/write',
      '/logging/v1/LogIngestion/Write',
      '/v1/LogIngestion/Write',
    ];

    let totalAttempts = 0;

    for (const endpoint of endpoints) {
      try {
        // Ограничиваем общее количество попыток
        const remainingTotalRetries = Math.max(0, this.retryConfig.maxTotalRetries - totalAttempts);
        const endpointMaxRetries = Math.min(this.retryConfig.maxRetries, remainingTotalRetries);

        if (endpointMaxRetries === 0) {
          console.warn(
            `Достигнут лимит общих попыток (${this.retryConfig.maxTotalRetries}), пропускаем endpoint ${endpoint}`
          );
          continue;
        }

        console.log(
          `Пытаемся отправить на endpoint ${endpoint} с максимум ${endpointMaxRetries + 1} попытками`
        );

        const actualAttempts = await this.retryableRequest(endpoint, payload, endpointMaxRetries);
        totalAttempts += actualAttempts; // Add the actual number of attempts made

        console.log(
          `Успешно отправлено через ${endpoint} после ${actualAttempts} попыток (общих попыток: ${totalAttempts})`
        );
        return; // Успешная отправка, выходим
      } catch (error: unknown) {
        // Extract actual attempts from the error if available
        const errorWithAttempts = error as Error & { actualAttempts?: number };
        const actualAttempts = errorWithAttempts?.actualAttempts || this.retryConfig.maxRetries + 1;
        totalAttempts += actualAttempts; // Add the actual number of attempts made

        console.log(
          `Все попытки на endpoint ${endpoint} завершились ошибкой (${actualAttempts} попыток):`,
          axios.isAxiosError(error) ? error.response?.status : 'Unknown error'
        );

        // Если это последний endpoint в списке, выбрасываем ошибку
        if (endpoint === endpoints[endpoints.length - 1]) {
          console.error(
            `Все endpoints и попытки (${totalAttempts} общих) завершились ошибкой. Последняя ошибка:`,
            error
          );

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
    // Инициализируем, если еще не инициализирован
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Проверяем и обновляем токен если необходимо
    await this.refreshTokenIfNeeded();

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
      // Проверяем, является ли это ошибкой аутентификации
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.warn(
          'Обнаружена ошибка аутентификации (401) в пакетной отправке, пытаемся обновить токен...'
        );

        const tokenRefreshed = await this.handleAuthError();

        if (tokenRefreshed) {
          // Повторяем попытку отправки с обновленным токеном
          try {
            const retryEntries: LogEntry[] = logMessages.map(logMessage => {
              const timestamp = logMessage.timestamp || new Date();
              return {
                timestamp: timestamp.toISOString(),
                level: this.mapLogLevel(logMessage.level),
                message: logMessage.message,
                jsonPayload: logMessage.jsonPayload,
                streamName: logMessage.streamName || 'default',
              };
            });

            await this.sendLogViaAPI(retryEntries);
            console.log(
              `Пакет из ${logMessages.length} логов успешно отправлен после обновления токена`
            );
            return;
          } catch (retryError) {
            console.error('Ошибка отправки пакета логов даже после обновления токена:', retryError);
            // Продолжаем к стандартной обработке ошибки
          }
        }
      }

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

  /**
   * Проверяет, является ли ошибка временной (retryable)
   */
  private isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Ошибки сети (нет ответа от сервера)
    if (!error.response) {
      return true;
    }

    // Специфические HTTP статусы, которые можно повторить
    return this.retryConfig.retryableStatusCodes.includes(error.response.status);
  }

  /**
   * Вычисляет задержку для retry с экспоненциальным back-off и jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt);
    const jitter = exponentialDelay * this.retryConfig.jitterFactor * Math.random();
    const delayWithJitter = exponentialDelay + jitter;

    return Math.min(delayWithJitter, this.retryConfig.maxDelay);
  }

  /**
   * Выполняет задержку
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Проверяет валидность HTTP ответа
   */
  private validateResponse(response: { status: number; data?: unknown }, endpoint: string): void {
    if (response.status !== 200) {
      const warningMessage = `Предупреждение: endpoint ${endpoint} вернул статус ${response.status} вместо 200`;
      console.warn(warningMessage);

      // Для статуса 202 (Accepted) логируем предупреждение, но не считаем это ошибкой
      if (response.status === 202) {
        console.warn('Сервер принял запрос для асинхронной обработки (202 Accepted)');
        return;
      }

      // Для других не-200 статусов в диапазоне 2xx также логируем предупреждение
      if (response.status >= 200 && response.status < 300) {
        console.warn(`Неожиданный 2xx статус: ${response.status}, но запрос считается успешным`);
        return;
      }

      // Для всех остальных статусов выбрасываем ошибку
      throw new Error(`Неожиданный статус ответа: ${response.status}`);
    }
  }

  /**
   * Выполняет HTTP запрос с retry логикой для конкретного endpoint
   */
  private async retryableRequest(
    endpoint: string,
    payload: Record<string, unknown>,
    maxRetries: number = this.retryConfig.maxRetries
  ): Promise<number> {
    let lastError: unknown;
    let actualAttempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      actualAttempts = attempt + 1; // Track the actual number of attempts made

      try {
        console.log(
          `Попытка ${attempt + 1}/${maxRetries + 1} отправки на endpoint: ${this.httpClient.defaults.baseURL}${endpoint}`
        );

        const response = await this.httpClient.post(endpoint, payload);

        // Проверяем валидность ответа
        this.validateResponse(response, endpoint);

        console.log(
          `Логи успешно отправлены в Yandex Cloud Logging через ${endpoint} (статус: ${response.status})`
        );
        return actualAttempts; // Return the actual number of attempts made
      } catch (error: unknown) {
        lastError = error;

        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === maxRetries;

        console.log(
          `Ошибка на endpoint ${endpoint} (попытка ${attempt + 1}):`,
          axios.isAxiosError(error) ? error.response?.status : 'Unknown error'
        );

        // Если это последняя попытка или ошибка не подлежит retry
        if (isLastAttempt || !isRetryable) {
          if (!isRetryable) {
            console.log(
              `Ошибка не подлежит retry: ${axios.isAxiosError(error) ? error.response?.status : 'Unknown'}`
            );
          }
          break;
        }

        // Вычисляем и выполняем задержку перед следующей попыткой
        const delayMs = this.calculateRetryDelay(attempt);
        console.log(`Ожидание ${delayMs}ms перед следующей попыткой...`);
        await this.delay(delayMs);
      }
    }

    // Если дошли до сюда, значит все попытки не удались
    // Return the actual attempts made before throwing
    const error = new Error(
      `All ${actualAttempts} attempts failed for endpoint ${endpoint}`
    ) as Error & {
      actualAttempts: number;
      originalError: unknown;
    };
    error.actualAttempts = actualAttempts;
    error.originalError = lastError;
    throw error;
  }
}
