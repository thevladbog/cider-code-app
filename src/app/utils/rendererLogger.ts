/**
 * Утилита логирования для рендерер-процесса с поддержкой облачного логирования
 *
 * Этот логгер отправляет логи в Yandex Cloud Logging через main процесс и дублирует их в консоль.
 */

export interface RendererLogPayload {
  [key: string]: unknown;
}

export interface IRendererLogger {
  debug(message: string, payload?: RendererLogPayload): void;
  info(message: string, payload?: RendererLogPayload): void;
  warn(message: string, payload?: RendererLogPayload): void;
  error(message: string, payload?: RendererLogPayload): void;

  // Специализированные методы для наиболее частых событий
  logUserAction(action: string, details?: RendererLogPayload): void;
  logAppEvent(eventType: string, details?: RendererLogPayload): void;
  logError(error: Error, context?: RendererLogPayload): void;
}

// Создаем синглтон для рендерер-логгера с облачным логированием
class RendererLogger implements IRendererLogger {
  private static instance: RendererLogger;
  private readonly timestamp = true;
  private isIPCAvailable = false;

  private constructor() {
    this.checkIPCAvailability();
  }

  static getInstance(): RendererLogger {
    if (!RendererLogger.instance) {
      RendererLogger.instance = new RendererLogger();
    }
    return RendererLogger.instance;
  }

  /**
   * Проверка доступности IPC для коммуникации с main процессом
   */
  private checkIPCAvailability(): void {
    try {
      // Проверяем, доступен ли electronAPI
      if (typeof window !== 'undefined' && window.electronAPI) {
        this.isIPCAvailable = true;
        console.log('electronAPI доступен для отправки логов в main процесс');
      } else {
        console.warn('electronAPI недоступен, логи будут только локальными');
      }
    } catch (error) {
      console.error('Ошибка проверки electronAPI:', error);
    }
  }

  /**
   * Получить отметку времени для логов
   */
  private getTimestamp(): string {
    if (!this.timestamp) return '';
    return `[${new Date().toISOString()}] `;
  }

  /**
   * Отправить лог в облако через IPC (без ожидания)
   */
  private sendToCloud(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    payload?: RendererLogPayload
  ): void {
    if (this.isIPCAvailable) {
      // Отправляем лог через IPC в main процесс для облачного логирования
      try {
        // Проверяем наличие electronAPI перед отправкой
        if (typeof window !== 'undefined' && window.electronAPI) {
          // Безопасно приводим к типу с sendLog методом
          const electronAPIWithSendLog = window.electronAPI as typeof window.electronAPI & {
            sendLog: (logData: {
              level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
              message: string;
              payload?: Record<string, unknown>;
              timestamp: string;
              source: string;
            }) => Promise<{ success: boolean; error?: string }>;
          };

          electronAPIWithSendLog
            .sendLog({
              level,
              message,
              payload,
              timestamp: new Date().toISOString(),
              source: 'renderer',
            })
            .catch((error: unknown) => {
              console.error('Ошибка отправки лога в облако:', error);
            });
        }
      } catch (error) {
        console.error('Ошибка отправки лога через electronAPI:', error);
      }
    }
  }

  /**
   * Базовые методы логирования
   */
  debug(message: string, payload?: RendererLogPayload): void {
    console.debug(`${this.getTimestamp()}[DEBUG] ${message}`, payload || '');
    this.sendToCloud('DEBUG', message, payload);
  }

  info(message: string, payload?: RendererLogPayload): void {
    console.info(`${this.getTimestamp()}[INFO] ${message}`, payload || '');
    this.sendToCloud('INFO', message, payload);
  }

  warn(message: string, payload?: RendererLogPayload): void {
    console.warn(`${this.getTimestamp()}[WARN] ${message}`, payload || '');
    this.sendToCloud('WARN', message, payload);
  }

  error(message: string, payload?: RendererLogPayload): void {
    console.error(`${this.getTimestamp()}[ERROR] ${message}`, payload || '');
    this.sendToCloud('ERROR', message, payload);
  }

  /**
   * Специализированные методы логирования
   */
  logUserAction(action: string, details?: RendererLogPayload): void {
    this.info(`User Action: ${action}`, {
      action,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  logAppEvent(eventType: string, details?: RendererLogPayload): void {
    this.info(`App Event: ${eventType}`, {
      eventType,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  logError(error: Error, context?: RendererLogPayload): void {
    this.error(`Application Error: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

// Экспортируем глобальный экземпляр для удобства использования
export const rendererLogger = RendererLogger.getInstance();
