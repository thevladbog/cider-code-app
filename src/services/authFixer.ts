import { iamTokenManager } from './iamTokenManager';
import { ServiceAccountKeyLoader } from './types';

/**
 * Утилита для диагностики и исправления проблем с Yandex Cloud аутентификацией
 */
export class YandexCloudAuthFixer {
  /**
   * Диагностирует проблемы с аутентификацией и предлагает решения
   */
  static async diagnoseAuthenticationIssue(): Promise<void> {
    console.log('🔍 Диагностика проблем с Yandex Cloud аутентификацией...\n');

    // Проверяем переменные окружения
    const iamToken = process.env.YANDEX_IAM_TOKEN;
    const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
    const serviceAccountKey = process.env.YANDEX_SERVICE_ACCOUNT_KEY;
    const loggingEnabled = process.env.YANDEX_CLOUD_LOGGING_ENABLED;

    console.log('📋 Текущая конфигурация:');
    console.log(`- YANDEX_CLOUD_LOGGING_ENABLED: ${loggingEnabled || 'не установлена'}`);
    console.log(`- YANDEX_IAM_TOKEN: ${iamToken ? '✅ установлена' : '❌ не установлена'}`);
    console.log(`- YANDEX_OAUTH_TOKEN: ${oauthToken ? '✅ установлена' : '❌ не установлена'}`);
    console.log(
      `- YANDEX_SERVICE_ACCOUNT_KEY: ${serviceAccountKey ? '✅ установлена' : '❌ не установлена'}`
    );

    // Анализируем тип проблемы
    if (loggingEnabled === 'true') {
      if (iamToken && !serviceAccountKey) {
        console.log('\n⚠️  НАЙДЕНА ПРОБЛЕМА: Используется IAM токен, который может истекать');
        console.log('💡 РЕКОМЕНДУЕМОЕ РЕШЕНИЕ:');
        console.log('1. Получите Service Account Key в консоли Yandex Cloud');
        console.log('2. Установите переменную YANDEX_SERVICE_ACCOUNT_KEY с JSON содержимым ключа');
        console.log('3. Уберите переменную YANDEX_IAM_TOKEN');
        console.log(
          '\n📖 Инструкция: https://yandex.cloud/ru/docs/iam/operations/sa/create-access-key'
        );

        // Проверяем статус токена
        const tokenStatus = iamTokenManager.getTokenStatus();
        if (tokenStatus.isExpired) {
          console.log('\n🔴 IAM токен ИСТЕК!');
          console.log(
            '⏰ Время истечения:',
            tokenStatus.expirationTime?.toISOString() || 'неизвестно'
          );
        } else if (tokenStatus.shouldRefresh) {
          console.log('\n🟡 IAM токен скоро истечет и требует обновления');
          console.log(
            '⏰ Время истечения:',
            tokenStatus.expirationTime?.toISOString() || 'неизвестно'
          );
        }
      } else if (serviceAccountKey) {
        console.log('\n✅ Конфигурация выглядит корректно (используется Service Account Key)');

        // Проверяем валидность ключа
        try {
          const parsedKey = JSON.parse(serviceAccountKey);
          if (ServiceAccountKeyLoader.validate(parsedKey)) {
            console.log('✅ Service Account Key прошел валидацию');
          } else {
            console.log('❌ Service Account Key НЕ прошел валидацию');
            console.log('💡 Проверьте корректность JSON и наличие всех обязательных полей');
          }
        } catch (error) {
          console.log('❌ Ошибка парсинга Service Account Key:', error);
        }
      } else {
        console.log('\n❌ НЕ НАЙДЕНЫ токены аутентификации');
        console.log('💡 Необходимо настроить один из способов аутентификации:');
        console.log('- Service Account Key (рекомендуется)');
        console.log('- IAM токен');
        console.log('- OAuth токен');
      }
    } else {
      console.log('\n📝 Логирование в Yandex Cloud отключено');
      console.log('💡 Для включения установите YANDEX_CLOUD_LOGGING_ENABLED=true');
    }

    console.log('\n📋 Другие важные переменные:');
    console.log(`- YANDEX_FOLDER_ID: ${process.env.YANDEX_FOLDER_ID || 'не установлена'}`);
    console.log(`- YANDEX_LOG_GROUP_ID: ${process.env.YANDEX_LOG_GROUP_ID || 'не установлена'}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'не установлена'}`);
  }

  /**
   * Быстрое исправление проблемы с истекшим токеном
   */
  static async quickFix(): Promise<boolean> {
    console.log('🔧 Попытка автоматического исправления проблемы...\n');

    const iamToken = process.env.YANDEX_IAM_TOKEN;
    const serviceAccountKey = process.env.YANDEX_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      console.log('✅ Service Account Key найден - проблем с истечением токена быть не должно');
      console.log('💡 Если проблема сохраняется, проверьте права Service Account');
      return true;
    }

    if (iamToken && serviceAccountKey) {
      console.log('🔄 Попытка обновления IAM токена...');
      const newToken = await iamTokenManager.forceRefresh();
      if (newToken) {
        console.log('✅ IAM токен успешно обновлен');
        return true;
      } else {
        console.log('❌ Не удалось обновить IAM токен');
      }
    }

    console.log('💡 Рекомендуется перейти на Service Account Key для решения проблем с токенами');
    return false;
  }

  /**
   * Создает пример конфигурации .env файла
   */
  static generateEnvExample(): string {
    return `# Конфигурация Yandex Cloud Logging (исправленная)
# Дата создания: ${new Date().toISOString()}

# Включение логирования
YANDEX_CLOUD_LOGGING_ENABLED=true

# РЕКОМЕНДУЕМЫЙ СПОСОБ: Service Account Key (не истекает)
# Получить: https://yandex.cloud/ru/docs/iam/operations/sa/create-access-key
YANDEX_SERVICE_ACCOUNT_KEY={"id":"your-key-id","service_account_id":"your-sa-id","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}

# АЛЬТЕРНАТИВНЫЙ СПОСОБ: IAM токен (истекает через 12 часов)
# Получить: https://yandex.cloud/ru/docs/iam/operations/iam-token/create
# YANDEX_IAM_TOKEN=your-iam-token-here

# Обязательные параметры
YANDEX_FOLDER_ID=your-folder-id
YANDEX_LOG_GROUP_ID=your-log-group-id

# Опциональные параметры
APP_INSTANCE_ID=bottle-code-app-prod-1
NODE_ENV=production
YANDEX_USE_SDK=true

# ВАЖНО: Не забудьте предоставить Service Account права:
# - logging.writer для записи логов
# - logging.viewer для чтения (если нужно)
`;
  }

  /**
   * Выводит инструкции по решению проблемы
   */
  static showFixInstructions(): void {
    console.log(`
🔧 ИНСТРУКЦИИ ПО УСТРАНЕНИЮ ОШИБКИ "The token has expired"

ПРИЧИНА ПРОБЛЕМЫ:
IAM токены Yandex Cloud действуют только 12 часов и требуют регулярного обновления.

РЕКОМЕНДУЕМОЕ РЕШЕНИЕ:
1. Перейдите на Service Account Key (не истекает):
   - Откройте консоль Yandex Cloud
   - Перейдите в IAM → Сервисные аккаунты
   - Создайте или выберите существующий сервисный аккаунт
   - Создайте ключ (Создать ключ → Создать авторизованный ключ)
   - Скопируйте JSON содержимое ключа

2. Обновите переменные окружения:
   - Установите YANDEX_SERVICE_ACCOUNT_KEY с JSON содержимым
   - Уберите YANDEX_IAM_TOKEN (если есть)

3. Убедитесь в правах сервисного аккаунта:
   - logging.writer - для записи логов
   - logging.viewer - для чтения (опционально)

АЛЬТЕРНАТИВНОЕ РЕШЕНИЕ (временное):
1. Получите новый IAM токен:
   - Выполните: yc iam create-token
   - Или используйте API: https://iam.api.cloud.yandex.net/iam/v1/tokens
   - Обновите переменную YANDEX_IAM_TOKEN

ПОЛЕЗНЫЕ ССЫЛКИ:
- Создание Service Account Key: https://yandex.cloud/ru/docs/iam/operations/sa/create-access-key
- Получение IAM токена: https://yandex.cloud/ru/docs/iam/operations/iam-token/create
- Управление доступом: https://yandex.cloud/ru/docs/logging/security/

💡 СОВЕТ: Service Account Key - самый надежный способ аутентификации для production-среды!
`);
  }
}

// Функция для быстрого запуска диагностики
export async function diagnosAndFixYandexCloudAuth(): Promise<void> {
  console.log('🔍 Yandex Cloud Authentication Diagnostic Tool\n');

  await YandexCloudAuthFixer.diagnoseAuthenticationIssue();

  console.log('\n' + '='.repeat(80));

  const fixAttempted = await YandexCloudAuthFixer.quickFix();

  if (!fixAttempted) {
    console.log('\n' + '='.repeat(80));
    YandexCloudAuthFixer.showFixInstructions();
  }

  console.log('\n' + '='.repeat(80));
  console.log('📝 Пример .env конфигурации:');
  console.log(YandexCloudAuthFixer.generateEnvExample());
}
