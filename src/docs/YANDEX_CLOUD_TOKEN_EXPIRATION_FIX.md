# Решение проблемы истечения токенов Yandex Cloud

## Проблема

При использовании Yandex Cloud Logging вы можете столкнуться с ошибкой:

```
ClientError: /yandex.cloud.logging.v1.LogIngestionService/Write UNAUTHENTICATED:
request-id = xxx rpc error: code = Unauthenticated desc = The token has expired
```

Эта ошибка возникает, когда IAM токен истекает (обычно через 12 часов).

## Решение

### Рекомендуемый способ: Service Account Key

Service Account Key является предпочтительным способом аутентификации для долгосрочного использования, поскольку:

- Не истекает со временем
- Автоматически обновляется SDK
- Более безопасен для production-окружения

#### Шаги по настройке:

1. **Создайте Service Account в Yandex Cloud Console:**

   - Перейдите в раздел "Identity and Access Management"
   - Создайте новый Service Account
   - Назначьте роль `logging.writer` для нужной папки

2. **Создайте ключ доступа:**

   - В настройках Service Account нажмите "Создать ключ доступа"
   - Выберите тип "JSON"
   - Сохраните полученный JSON файл

3. **Настройте переменную окружения:**

   ```bash
   # В .env файле или системных переменных
   YANDEX_SERVICE_ACCOUNT_KEY={"id":"...","service_account_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}
   ```

4. **Удалите старые токены (опционально):**
   ```bash
   # Можете удалить эти переменные
   # YANDEX_IAM_TOKEN=
   # YANDEX_OAUTH_TOKEN=
   ```

### Альтернативный способ: Обновление IAM токена

Если вы хотите продолжить использовать IAM токен:

1. **Получите новый IAM токен:**

   ```bash
   yc iam create-token
   ```

2. **Обновите переменную окружения:**

   ```bash
   YANDEX_IAM_TOKEN=новый_токен_здесь
   ```

3. **Настройте автоматическое обновление** (по желанию):
   Создайте скрипт для периодического обновления токена.

## Автоматическое восстановление

Наша реализация `YandexCloudLoggerSDK` теперь включает:

- **Автоматическое определение ошибок аутентификации**
- **Попытки переинициализации** при истечении токена
- **Fallback к локальному логированию** при неудаче
- **Детальные сообщения об ошибках** с рекомендациями

## Проверка настройки

Запустите тест для проверки настройки:

```bash
npm run test:environment
```

или выполните файл напрямую:

```bash
npx tsx src/services/testEnvironmentUnified.ts
```

## Переменные окружения

Убедитесь, что у вас настроены следующие переменные:

```bash
# Обязательные
YANDEX_CLOUD_LOGGING_ENABLED=true
YANDEX_FOLDER_ID=ваш_folder_id
YANDEX_LOG_GROUP_ID=ваш_log_group_id

# Аутентификация (выберите один способ)
YANDEX_SERVICE_ACCOUNT_KEY={"id":"...","service_account_id":"...","private_key":"..."}
# ИЛИ
YANDEX_IAM_TOKEN=ваш_iam_токен
# ИЛИ
YANDEX_OAUTH_TOKEN=ваш_oauth_токен

# Опциональные
YANDEX_USE_SDK=true
APP_INSTANCE_ID=уникальный_id_приложения
```

## Дополнительная информация

- [Документация Yandex Cloud IAM](https://yandex.cloud/ru/docs/iam/)
- [Создание Service Account](https://yandex.cloud/ru/docs/iam/operations/sa/create)
- [Yandex Cloud Logging](https://yandex.cloud/ru/docs/logging/)

## Контакты

Если проблема сохраняется, проверьте:

1. Права доступа Service Account
2. Корректность ID папки и лог-группы
3. Сетевое соединение с Yandex Cloud
