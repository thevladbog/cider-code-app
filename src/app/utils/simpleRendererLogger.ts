/**
 * Простой консольный логгер для renderer-процесса
 * Облачное логирование отключено в production-сборке
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

// Простой консольный логгер
class SimpleRendererLogger implements IRendererLogger {
  private static instance: SimpleRendererLogger;
  private readonly timestamp = true;

  private constructor() {
    // Простая инициализация
  }

  static getInstance(): SimpleRendererLogger {
    if (!SimpleRendererLogger.instance) {
      SimpleRendererLogger.instance = new SimpleRendererLogger();
    }
    return SimpleRendererLogger.instance;
  }

  /**
   * Получить timestamp для логов
   */
  private getTimestamp(): string {
    return this.timestamp ? `[${new Date().toISOString()}] ` : '';
  }

  /**
   * Базовые методы логирования
   */
  debug(message: string, payload?: RendererLogPayload): void {
    console.debug(`${this.getTimestamp()}[DEBUG] ${message}`, payload || '');
  }

  info(message: string, payload?: RendererLogPayload): void {
    console.info(`${this.getTimestamp()}[INFO] ${message}`, payload || '');
  }

  warn(message: string, payload?: RendererLogPayload): void {
    console.warn(`${this.getTimestamp()}[WARN] ${message}`, payload || '');
  }

  error(message: string, payload?: RendererLogPayload): void {
    console.error(`${this.getTimestamp()}[ERROR] ${message}`, payload || '');
  }

  /**
   * Специализированные методы логирования
   */
  logUserAction(action: string, details?: RendererLogPayload): void {
    this.info(`User Action: ${action}`, details);
  }

  logAppEvent(eventType: string, details?: RendererLogPayload): void {
    this.info(`App Event: ${eventType}`, details);
  }

  logError(error: Error, context?: RendererLogPayload): void {
    this.error(`Error: ${error.message}`, {
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }
}

// Экспортируем готовый экземпляр
export const rendererLogger = SimpleRendererLogger.getInstance();
