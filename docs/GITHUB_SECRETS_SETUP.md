# Настройка GitHub Secrets для CI/CD

Для корректной работы CI/CD pipeline необходимо настроить следующие секреты в GitHub репозитории.

## Как добавить секреты

1. Перейдите в Settings вашего репозитория
2. Выберите "Secrets and variables" → "Actions"
3. Нажмите "New repository secret"
4. Введите имя секрета и его значение

## Необходимые секреты

### Production окружение (для ветки `release-stable`)

| Секрет                                  | Описание                                            | Пример значения                                                                            |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `YANDEX_SERVICE_ACCOUNT_KEY_PRODUCTION` | Service Account Key для Yandex Cloud (JSON)         | `{"id":"...","service_account_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}` |
| `YANDEX_FOLDER_ID_PRODUCTION`           | ID папки в Yandex Cloud для production              | `b1g1234567890abcdef`                                                                      |
| `YANDEX_LOG_GROUP_ID_PRODUCTION`        | ID лог-группы в Yandex Cloud Logging для production | `e23abc123def456789`                                                                       |

### Beta окружение (для ветки `release-beta`)

| Секрет                            | Описание                                      | Пример значения                                                                            |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `YANDEX_SERVICE_ACCOUNT_KEY_BETA` | Service Account Key для Yandex Cloud (JSON)   | `{"id":"...","service_account_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}` |
| `YANDEX_FOLDER_ID_BETA`           | ID папки в Yandex Cloud для beta              | `b1g0987654321fedcba`                                                                      |
| `YANDEX_LOG_GROUP_ID_BETA`        | ID лог-группы в Yandex Cloud Logging для beta | `e23fed456789abc123`                                                                       |

## Как получить значения для Yandex Cloud

### 1. Service Account Key

1. Перейдите в [Yandex Cloud Console](https://console.yandex.cloud/)
2. Выберите нужную папку (folder)
3. Перейдите в "IAM" → "Service accounts"
4. Создайте новый Service Account или выберите существующий
5. Добавьте роли:
   - `logging.writer` - для записи логов
   - `monitoring.editor` - для метрик (если используется)
6. Создайте новый ключ: "Create new key" → "Create JSON key"
7. Скачайте JSON файл и используйте его содержимое как значение секрета

### 2. Folder ID

1. В [Yandex Cloud Console](https://console.yandex.cloud/)
2. Выберите нужную папку
3. Скопируйте ID папки из URL или из информации о папке

### 3. Log Group ID

1. Перейдите в "Cloud Logging"
2. Создайте новую лог-группу или выберите существующую
3. Скопируйте ID лог-группы

## Проверка настроек

После добавления всех секретов, workflow будет:

### Для ветки `release-beta`:

- Устанавливать `VITE_APP_ENV=beta`
- Использовать beta секреты Yandex Cloud
- Устанавливать `APP_INSTANCE_ID=bottle-code-app-beta-{version}-{os}`
  - Пример: `bottle-code-app-beta-1.0.0-beta.5-win`

### Для ветки `release-stable`:

- Устанавливать `VITE_APP_ENV=production`
- Использовать production секреты Yandex Cloud
- Устанавливать `APP_INSTANCE_ID=bottle-code-app-prod-{version}-{os}`
  - Пример: `bottle-code-app-prod-1.0.1-linux`

## Формат APP_INSTANCE_ID

APP_INSTANCE_ID автоматически формируется по шаблону:

```
bottle-code-app-{тип_релиза}-{версия}-{ос}
```

Где:

- **тип_релиза**: `beta` или `prod`
- **версия**: версия из semantic-release (например, `1.0.0-beta.5`, `1.0.1`)
- **ос**: `win`, `linux`, `macos`

**Примеры:**

- `bottle-code-app-beta-1.0.0-beta.5-win`
- `bottle-code-app-prod-1.0.1-linux`
- `bottle-code-app-beta-2.0.0-beta.1-macos`

## Безопасность

⚠️ **Важно:**

- Никогда не коммитьте секреты в код
- Используйте разные Service Account для production и beta
- Регулярно ротируйте ключи
- Настройте минимальные необходимые права для Service Account

## Отладка

Если логирование не работает в CI, проверьте:

1. ✅ Все секреты добавлены в GitHub
2. ✅ Service Account имеет правильные роли
3. ✅ Log Group существует и доступен
4. ✅ Folder ID корректный
5. ✅ JSON ключ валидный

В логах CI вы увидите отладочную информацию:

```
=== Environment Configuration ===
VITE_APP_ENV will be: beta
APP_INSTANCE_ID pattern: bottle-code-app-{type}-{version}-{os}
Release type: beta
Version: 1.0.0-beta.5
OS suffix: win
Final APP_INSTANCE_ID will be: bottle-code-app-beta-1.0.0-beta.5-win
```
