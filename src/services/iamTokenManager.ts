import { logger } from './simpleLogger';
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

      // Используем Service Account Key для получения IAM токена
      const jwt = await this.createJWT(serviceAccountKey);
      if (!jwt) {
        console.error('Не удалось создать JWT токен');
        return null;
      }

      // Отправляем запрос к Yandex Cloud IAM API
      const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jwt: jwt,
        }),
      });

      if (!response.ok) {
        console.error('Ошибка получения IAM токена:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Детали ошибки:', errorText);
        return null;
      }

      const tokenData = await response.json();
      const newToken = tokenData.iamToken;

      if (!newToken) {
        console.error('IAM токен не получен из ответа API');
        return null;
      }

      // Обновляем метаданные токена
      this.lastTokenRefresh = new Date();
      this.tokenExpirationTime = new Date(
        tokenData.expiresAt || Date.now() + this.TOKEN_LIFETIME_HOURS * 60 * 60 * 1000
      );

      // Обновляем переменную окружения с новым токеном
      process.env.YANDEX_IAM_TOKEN = newToken;

      console.log('✅ IAM токен успешно обновлен');
      await logger.info('IAM токен обновлен', {
        expiresAt: this.tokenExpirationTime.toISOString(),
      });

      return newToken;
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

  /**
   * Создает JWT токен для аутентификации Service Account
   */
  private async createJWT(serviceAccountKey: ServiceAccountKey): Promise<string | null> {
    try {
      // Импортируем crypto модуль для создания подписи
      const crypto = await import('crypto');

      const now = Math.floor(Date.now() / 1000);
      const iat = now; // issued at
      const exp = now + 3600; // expires in 1 hour

      // Создаем заголовок JWT
      const header = {
        alg: 'PS256',
        typ: 'JWT',
        kid: serviceAccountKey.id,
      };

      // Создаем payload JWT
      const payload = {
        iss: serviceAccountKey.service_account_id, // service account ID
        aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
        iat: iat,
        exp: exp,
      };

      // Кодируем заголовок и payload в base64url
      const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
      const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

      // Создаем строку для подписи
      const signingString = `${encodedHeader}.${encodedPayload}`;

      // Создаем подпись с использованием приватного ключа
      const signature = crypto.sign('RSA-SHA256', Buffer.from(signingString), {
        key: serviceAccountKey.private_key,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      });

      // Кодируем подпись в base64url
      const encodedSignature = this.base64UrlEncode(signature);

      // Собираем JWT токен
      const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

      return jwt;
    } catch (error) {
      console.error('Ошибка создания JWT токена:', error);
      await logger.error('Ошибка создания JWT токена', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Кодирует данные в формат base64url
   */
  private base64UrlEncode(data: string | Buffer): string {
    const base64 = Buffer.from(data).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

// Экспортируем глобальный экземпляр
export const iamTokenManager = YandexIAMTokenManager.getInstance();
