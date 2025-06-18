/**
 * Простой консольный логгер без облачного логирования
 */

export interface SimpleLoggerConfig {
  enabled: boolean;
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

export class SimpleLogger {
  private static instance: SimpleLogger;
  private isEnabled = true;
  private level: string = 'INFO';

  private constructor() {}

  static getInstance(): SimpleLogger {
    if (!SimpleLogger.instance) {
      SimpleLogger.instance = new SimpleLogger();
    }
    return SimpleLogger.instance;
  }

  /**
   * Инициализация логгера с конфигурацией
   */
  async initialize(config: SimpleLoggerConfig): Promise<void> {
    this.isEnabled = config.enabled;
    this.level = config.level || 'INFO';
    console.log(`SimpleLogger: инициализирован, уровень ${this.level}, включен: ${this.isEnabled}`);
  }

  /**
   * Логирование отладочной информации
   */
  async debug(message: string, data?: unknown): Promise<void> {
    if (!this.isEnabled) return;
    console.debug(`[DEBUG] ${message}`, data ? data : '');
  }

  /**
   * Логирование информационного сообщения
   */
  async info(message: string, data?: unknown): Promise<void> {
    if (!this.isEnabled) return;
    console.info(`[INFO] ${message}`, data ? data : '');
  }

  /**
   * Логирование предупреждения
   */
  async warn(message: string, data?: unknown): Promise<void> {
    if (!this.isEnabled) return;
    console.warn(`[WARN] ${message}`, data ? data : '');
  }

  /**
   * Логирование ошибки
   */
  async error(message: string, error?: Error | unknown): Promise<void> {
    if (!this.isEnabled) return;
    console.error(`[ERROR] ${message}`, error ? error : '');
  }

  /**
   * Проверка готовности логгера
   */
  isReady(): boolean {
    return true; // Простой логгер всегда готов
  }

  /**
   * Получение статуса логгера
   */
  getStatus(): string {
    return this.isEnabled ? 'enabled' : 'disabled';
  }
}

// Экспортируем singleton экземпляр
export const logger = SimpleLogger.getInstance();
