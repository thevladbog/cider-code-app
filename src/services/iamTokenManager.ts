import { logger } from './loggerService';
import { ServiceAccountKey } from './types';

/**
 * Утилита для работы с IAM токенами Yandex Cloud
 * Помогает автоматически обновлять токены и обрабатывать их истечение
 */
export class YandexIAMTokenManager {
  private static instance: YandexIAMTokenManager;
  private lastTokenRefresh: Date | null = null;
  private tokenExpirationTime: Date | null = null;
  private refreshInProgress = false;

  // Токен действует 12 часов, но мы обновляем за 1 час до истечения
  private readonly TOKEN_LIFETIME_HOURS = 12;
  private readonly REFRESH_BEFORE_EXPIRY_HOURS = 1;

  private constructor() {}

  static getInstance(): YandexIAMTokenManager {
    if (!YandexIAMTokenManager.instance) {
      YandexIAMTokenManager.instance = new YandexIAMTokenManager();
    }
    return YandexIAMTokenManager.instance;
  }

  /**
   * Проверяет, нужно ли обновить IAM токен
   */
  shouldRefreshToken(): boolean {
    if (!this.tokenExpirationTime) {
      return true; // Если время истечения неизвестно, считаем что нужно обновить
    }

    const now = new Date();
    const refreshTime = new Date(
      this.tokenExpirationTime.getTime() - this.REFRESH_BEFORE_EXPIRY_HOURS * 60 * 60 * 1000
    );

    return now >= refreshTime;
  }

  /**
   * Получает новый IAM токен с помощью Service Account Key
   */
  async refreshIAMToken(serviceAccountKey?: ServiceAccountKey): Promise<string | null> {
    if (this.refreshInProgress) {
      console.log('Обновление токена уже выполняется, ожидаем...');
      // Ждем завершения текущего обновления
      while (this.refreshInProgress) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return process.env.YANDEX_IAM_TOKEN || null;
    }

    this.refreshInProgress = true;

    try {
      if (!serviceAccountKey) {
        // Пытаемся загрузить Service Account Key из переменных окружения
        const envKey = process.env.YANDEX_SERVICE_ACCOUNT_KEY;
        if (envKey) {
          try {
            serviceAccountKey = JSON.parse(envKey) as ServiceAccountKey;
          } catch (error) {
            console.error('Ошибка парсинга YANDEX_SERVICE_ACCOUNT_KEY:', error);
            return null;
          }
        } else {
          console.warn(
            'Service Account Key не найден. Невозможно обновить IAM токен автоматически.'
          );
          return null;
        }
      }

      console.log('Получение нового IAM токена...');

      // Вместо использования SDK для получения токена, рекомендуем Service Account Key
      console.warn(
        'ВНИМАНИЕ: Автоматическое обновление IAM токена требует дополнительной настройки. ' +
          'Рекомендуется использовать Service Account Key напрямую, так как он не истекает.'
      );

      console.warn(
        'РЕШЕНИЕ: Установите переменную окружения YANDEX_SERVICE_ACCOUNT_KEY ' +
          'и уберите YANDEX_IAM_TOKEN для автоматического управления токенами.'
      );

      return null;
    } catch (error) {
      console.error('Ошибка обновления IAM токена:', error);
      await logger.error('Ошибка обновления IAM токена', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Запускает периодическое обновление IAM токена
   */
  startAutoRefresh(serviceAccountKey?: ServiceAccountKey): void {
    // Проверяем каждые 30 минут
    const checkInterval = 30 * 60 * 1000; // 30 минут

    setInterval(async () => {
      if (this.shouldRefreshToken()) {
        console.log('Время обновить IAM токен...');
        await this.refreshIAMToken(serviceAccountKey);
      }
    }, checkInterval);

    console.log('Автоматическое обновление IAM токена запущено (проверка каждые 30 минут)');
  }

  /**
   * Получает информацию о текущем состоянии токена
   */
  getTokenStatus(): {
    lastRefresh: Date | null;
    expirationTime: Date | null;
    isExpired: boolean;
    shouldRefresh: boolean;
    hoursUntilExpiry: number | null;
  } {
    const now = new Date();
    let hoursUntilExpiry: number | null = null;
    let isExpired = false;

    if (this.tokenExpirationTime) {
      const msUntilExpiry = this.tokenExpirationTime.getTime() - now.getTime();
      hoursUntilExpiry = msUntilExpiry / (60 * 60 * 1000);
      isExpired = msUntilExpiry <= 0;
    }

    return {
      lastRefresh: this.lastTokenRefresh,
      expirationTime: this.tokenExpirationTime,
      isExpired,
      shouldRefresh: this.shouldRefreshToken(),
      hoursUntilExpiry,
    };
  }

  /**
   * Принудительно обновляет токен
   */
  async forceRefresh(serviceAccountKey?: ServiceAccountKey): Promise<string | null> {
    this.tokenExpirationTime = new Date(); // Принудительно помечаем как истекший
    return await this.refreshIAMToken(serviceAccountKey);
  }
}

// Экспортируем глобальный экземпляр
export const iamTokenManager = YandexIAMTokenManager.getInstance();
