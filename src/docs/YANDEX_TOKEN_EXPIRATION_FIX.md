# Исправление ошибки "The token has expired" в Yandex Cloud Logging

## Описание проблемы

Ошибка возникает когда IAM токен Yandex Cloud истекает. IAM токены действуют только 12 часов и требуют регулярного обновления.

**Пример ошибки:**

```
ClientError: /yandex.cloud.logging.v1.LogIngestionService/Write UNAUTHENTICATED:
request-id = a61f17c1-c60d-46b6-8874-c0316b839057 rpc error: code = Unauthenticated
desc = The token has expired 2025-06-16T05:55:04.752284226Z.
Now 2025-06-16T22:22:04.243904459Z, which is more than PT10M later
```

## Быстрое решение

### 1. Запуск диагностики

```bash
npm run fix:yandex-auth
```

Или:

```bash
npm run diagnose:yandex-auth
```

### 2. Автоматический анализ

Скрипт автоматически:

- Проверит текущую конфигурацию
- Определит тип проблемы
- Предложит решения
- Покажет статус токенов

## Рекомендуемое решение (Service Account Key)

### Зачем использовать Service Account Key?

- ✅ Не истекает (в отличие от IAM токенов)
- ✅ Автоматическое обновление токенов через SDK
- ✅ Более безопасный для production
- ✅ Не требует ручного вмешательства

### Инструкция по настройке

1. **Создайте Service Account Key в консоли Yandex Cloud:**

   - Откройте [консоль Yandex Cloud](https://console.cloud.yandex.ru/)
   - Перейдите в IAM → Сервисные аккаунты
   - Создайте или выберите существующий сервисный аккаунт
   - Нажмите "Создать ключ" → "Создать авторизованный ключ"
   - Скопируйте JSON содержимое ключа

2. **Обновите переменные окружения:**

   ```bash
   # Уберите IAM токен (если есть)
   # YANDEX_IAM_TOKEN=your-old-token

   # Добавьте Service Account Key
   YANDEX_SERVICE_ACCOUNT_KEY={"id":"your-key-id","service_account_id":"your-sa-id","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}

   # Убедитесь что логирование включено
   YANDEX_CLOUD_LOGGING_ENABLED=true
   YANDEX_USE_SDK=true
   ```

3. **Проверьте права сервисного аккаунта:**
   - `logging.writer` - для записи логов
   - `logging.viewer` - для чтения (опционально)

## Альтернативное решение (обновление IAM токена)

Если вы хотите продолжить использовать IAM токен:

1. **Получите новый IAM токен:**

   ```bash
   # Через Yandex CLI
   yc iam create-token

   # Через API
   curl -d '{"yandexPassportOauthToken":"your-oauth-token"}' \
        "https://iam.api.cloud.yandex.net/iam/v1/tokens"
   ```

2. **Обновите переменную окружения:**
   ```bash
   YANDEX_IAM_TOKEN=new-token-here
   ```

⚠️ **Внимание:** IAM токены истекают через 12 часов и требуют регулярного обновления!

## Проверка исправления

1. **Запустите диагностику:**

   ```bash
   npm run fix:yandex-auth
   ```

2. **Протестируйте логирование:**

   ```bash
   npm run test:logger:comprehensive
   ```

3. **Проверьте статус в приложении:**
   В коде можно проверить статус логгера:

   ```typescript
   import { logger } from './src/services/loggerService';

   // Проверка статуса
   console.log('Logger enabled:', logger.isLoggerEnabled());

   // Тестовый лог
   await logger.info('Test message after fix');
   ```

## Мониторинг и предотвращение

### Автоматическое обновление токенов

Если используете Service Account Key, токены обновляются автоматически.

### Мониторинг истечения (для IAM токенов)

```typescript
import { iamTokenManager } from './src/services/iamTokenManager';

// Проверка статуса токена
const status = iamTokenManager.getTokenStatus();
console.log('Token expires in hours:', status.hoursUntilExpiry);
console.log('Should refresh:', status.shouldRefresh);
```

### Настройка алертов

Добавьте в код проверку истечения токена:

```typescript
// В основном цикле приложения
setInterval(
  () => {
    const status = iamTokenManager.getTokenStatus();
    if (status.shouldRefresh) {
      console.warn('IAM token needs refresh!');
      // Отправить уведомление администратору
    }
  },
  30 * 60 * 1000
); // Проверка каждые 30 минут
```

## FAQ

**Q: Как часто истекают IAM токены?**
A: IAM токены действуют 12 часов с момента создания.

**Q: Безопасно ли хранить Service Account Key в переменных окружения?**
A: Да, это стандартная практика. Убедитесь, что .env файл не попадает в git (добавьте в .gitignore).

**Q: Что делать если Service Account Key тоже не работает?**
A: Проверьте права сервисного аккаунта в консоли Yandex Cloud. Должны быть роли logging.writer.

**Q: Можно ли автоматически обновлять IAM токены?**
A: Да, но это сложнее чем использование Service Account Key. Рекомендуем перейти на Service Account Key.

## Полезные ссылки

- [Создание Service Account Key](https://yandex.cloud/ru/docs/iam/operations/sa/create-access-key)
- [Получение IAM токена](https://yandex.cloud/ru/docs/iam/operations/iam-token/create)
- [Управление доступом в Cloud Logging](https://yandex.cloud/ru/docs/logging/security/)
- [Yandex Cloud SDK для Node.js](https://github.com/yandex-cloud/nodejs-sdk)

## Скрипты и утилиты

Проект содержит следующие полезные скрипты:

- `npm run fix:yandex-auth` - диагностика и исправление проблем
- `npm run test:logger:comprehensive` - тестирование логирования
- `npm run diagnose:logging` - полная диагностика системы логирования

Все скрипты автоматически определят проблему и предложат решение.
