import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ServiceAccountKey } from './types';

/**
 * Утилита для создания IAM токенов из Service Account Key
 * Используется когда SDK не может правильно обработать Service Account Key
 */
export class ServiceAccountTokenProvider {
  /**
   * Создает JWT токен из Service Account Key
   */
  static createJwtToken(serviceAccountKey: ServiceAccountKey): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountKey.service_account_id,
      aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
      iat: now,
      exp: now + 3600, // Токен действует 1 час
    }; // Обрабатываем private key - убираем escape символы и обеспечиваем правильный формат
    let privateKey = serviceAccountKey.private_key;

    // Убираем escape символы и комментарии
    privateKey = privateKey
      .replace(/\\n/g, '\n')
      .replace(/PLEASE DO NOT REMOVE THIS LINE![^\n]*\n/, ''); // Убираем служебную строку Yandex

    return jwt.sign(payload, privateKey, {
      algorithm: 'PS256',
      keyid: serviceAccountKey.id,
    });
  }

  /**
   * Получает IAM токен через API, используя Service Account Key
   */
  static async getIamToken(serviceAccountKey: ServiceAccountKey): Promise<string> {
    try {
      const jwtToken = this.createJwtToken(serviceAccountKey);

      const response = await axios.post(
        'https://iam.api.cloud.yandex.net/iam/v1/tokens',
        {
          jwt: jwtToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 секунд таймаут
        }
      );

      if (response.data && response.data.iamToken) {
        return response.data.iamToken;
      } else {
        throw new Error('IAM token not found in response');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to get IAM token: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Проверяет, валиден ли Service Account Key для создания токенов
   */
  static validateServiceAccountKey(serviceAccountKey: ServiceAccountKey): boolean {
    const requiredFields = ['id', 'service_account_id', 'private_key'];

    for (const field of requiredFields) {
      if (!serviceAccountKey[field as keyof ServiceAccountKey]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    // Проверяем формат private key
    if (!serviceAccountKey.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('Invalid private key format');
      return false;
    }

    return true;
  }
}
