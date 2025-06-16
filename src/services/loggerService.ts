import { YandexCloudLoggerSDK, YandexCloudLoggerSDKConfig } from './yandexCloudLoggerSDK';

/**
 * Singleton класс для управления глобальным экземпляром логгера
 * ОБНОВЛЕНО: теперь использует рабочий SDK вместо REST API
 */
export class LoggerService {
  private static instance: LoggerService;
  private logger: YandexCloudLoggerSDK | null = null;
  private isEnabled = false;

  private constructor() {}

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Инициализация логгера с конфигурацией
   */
  async initialize(config: YandexCloudLoggerSDKConfig & { enabled: boolean }): Promise<void> {
    try {
      if (!config.enabled) {
        console.log(
          'LoggerService: логирование в Yandex Cloud отключено, используется консольный вывод'
        );
        this.isEnabled = false;
        return;
      }

      this.logger = new YandexCloudLoggerSDK(config);
      await this.logger.initialize();
      this.isEnabled = true;
      console.log('LoggerService инициализирован (SDK версия)');
    } catch (error) {
      console.error('Ошибка инициализации LoggerService (SDK):', error);
      this.isEnabled = false;
    }
  }

  /**
   * Включение/выключение логирования
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Проверка, включен ли логгер
   */
  isLoggerEnabled(): boolean {
    return this.isEnabled && this.logger !== null;
  }

  /**
   * Методы логирования с проверкой состояния
   */
  async debug(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.debug(message, jsonPayload, streamName);
    } else {
      console.debug(`[DEBUG] ${message}`, jsonPayload);
    }
  }

  async info(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.info(message, jsonPayload, streamName);
    } else {
      console.info(`[INFO] ${message}`, jsonPayload);
    }
  }

  async warn(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.warn(message, jsonPayload, streamName);
    } else {
      console.warn(`[WARN] ${message}`, jsonPayload);
    }
  }

  async error(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.error(message, jsonPayload, streamName);
    } else {
      console.error(`[ERROR] ${message}`, jsonPayload);
    }
  }

  async fatal(
    message: string,
    jsonPayload?: Record<string, unknown>,
    streamName?: string
  ): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.fatal(message, jsonPayload, streamName);
    } else {
      console.error(`[FATAL] ${message}`, jsonPayload);
    }
  }

  /**
   * Логирование событий приложения
   */
  async logAppEvent(eventType: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.info(
      `App Event: ${eventType}`,
      {
        eventType,
        timestamp: new Date().toISOString(),
        ...details,
      },
      'app-events'
    );
  }

  /**
   * Логирование ошибок приложения
   */
  async logError(error: Error, context: Record<string, unknown> = {}): Promise<void> {
    await this.error(
      `Application Error: ${error.message}`,
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
        timestamp: new Date().toISOString(),
      },
      'app-errors'
    );
  }

  /**
   * Логирование пользовательских действий
   */
  async logUserAction(action: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.info(
      `User Action: ${action}`,
      {
        action,
        timestamp: new Date().toISOString(),
        ...details,
      },
      'user-actions'
    );
  }

  /**
   * Логирование системных событий
   */
  async logSystemEvent(event: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.info(
      `System Event: ${event}`,
      {
        event,
        timestamp: new Date().toISOString(),
        ...details,
      },
      'system-events'
    );
  }

  /**
   * Пакетная отправка логов
   */
  async logBatch(logMessages: import('./yandexCloudLogger').LogMessage[]): Promise<void> {
    if (this.isLoggerEnabled() && this.logger) {
      await this.logger.logBatch(logMessages);
    } else {
      // В случае отключенного логгера выводим в консоль
      logMessages.forEach(logMessage => {
        console.log(
          `[BATCH LOG] ${logMessage.level}: ${logMessage.message}`,
          logMessage.jsonPayload
        );
      });
    }
  }
}

// Экспортируем глобальный экземпляр для удобства использования
export const logger = LoggerService.getInstance();
