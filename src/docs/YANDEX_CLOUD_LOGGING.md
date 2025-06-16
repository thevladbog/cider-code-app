# Руководство по настройке Yandex Cloud Logging

Этот документ описывает, как настроить и использовать логирование событий в Yandex Cloud Logging для приложения Bottle Code App.

## Установка и настройка

### 1. Установка зависимостей

Зависимость `@yandex-cloud/nodejs-sdk` уже установлена в проекте. Если нужно установить отдельно:

```bash
npm install @yandex-cloud/nodejs-sdk
```

### 2. Настройка Yandex Cloud

#### Создание лог-группы

1. Перейдите в [консоль Yandex Cloud](https://console.cloud.yandex.ru/)
2. Выберите нужную папку (folder)
3. Перейдите в сервис "Cloud Logging"
4. Нажмите "Создать лог-группу"
5. Укажите имя (например, "bottle-code-app-logs")
6. Сохраните ID созданной лог-группы

#### Получение токена авторизации

**Вариант 1: IAM токен (рекомендуется)**

1. Установите [Yandex Cloud CLI](https://cloud.yandex.ru/docs/cli/quickstart)
2. Авторизуйтесь: `yc init`
3. Получите IAM токен: `yc iam create-token`
4. Токен действует 12 часов, для production рекомендуется использовать сервисный аккаунт

**Вариант 2: OAuth токен**

1. Перейдите по ссылке: https://oauth.yandex.ru/authorize?response_type=token&client_id=1a6990aa636648e9b2ef855fa7bec2fb
2. Авторизуйтесь в Yandex
3. Скопируйте токен из URL

**Вариант 3: Сервисный аккаунт (для production)**

1. Создайте сервисный аккаунт в консоли Yandex Cloud
2. Назначьте роль `logging.writer`
3. Создайте JSON ключ для сервисного аккаунта
4. Используйте содержимое файла как значение `YANDEX_SERVICE_ACCOUNT_KEY`

### 3. Конфигурация приложения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните необходимые переменные:

```env
YANDEX_LOGGING_ENABLED=true
YANDEX_IAM_TOKEN=your-iam-token-here
YANDEX_FOLDER_ID=your-folder-id-here
YANDEX_LOG_GROUP_ID=your-log-group-id-here
APP_INSTANCE_ID=bottle-code-app-prod-1
```

## Использование в коде

### В React компонентах

```tsx
import { useLogger } from '@/app/hooks/useLogger';

const MyComponent: React.FC = () => {
  const { logUserAction, logError, logInfo } = useLogger();

  const handleButtonClick = async () => {
    await logUserAction('button_clicked', {
      buttonId: 'submit',
      timestamp: new Date().toISOString(),
    });
  };

  const handleError = async (error: Error) => {
    await logError('Component error occurred', error, {
      componentName: 'MyComponent',
    });
  };

  return <button onClick={handleButtonClick}>Submit</button>;
};
```

### В основном процессе Electron

```typescript
import { logger } from './services/loggerService';

// Логирование событий приложения
await logger.logAppEvent('application_started', {
  version: app.getVersion(),
  platform: process.platform,
});

// Логирование ошибок
await logger.logError(new Error('Something went wrong'), {
  context: 'main_process',
});

// Логирование пользовательских действий
await logger.logUserAction('file_opened', {
  fileName: 'document.pdf',
});
```

### Прямое использование логгера

```typescript
import { logger } from '@/services';

// Различные уровни логирования
await logger.debug('Debug message', { data: 'value' });
await logger.info('Info message', { data: 'value' });
await logger.warn('Warning message', { data: 'value' });
await logger.error('Error message', { data: 'value' });
await logger.fatal('Fatal error', { data: 'value' });

// Пакетная отправка логов
await logger.logBatch([
  { level: 'INFO', message: 'First log' },
  { level: 'WARN', message: 'Second log' },
  { level: 'ERROR', message: 'Third log' },
]);
```

## Типы логов

### Потоки логов (streams)

Логи автоматически разделяются по потокам:

- `default` - обычные логи
- `app-events` - события приложения (запуск, остановка, навигация)
- `app-errors` - ошибки приложения
- `user-actions` - действия пользователя (клики, сканирование, печать)
- `system-events` - системные события (подключение устройств, работа с портами)

### Уровни логирования

- `DEBUG` - детальная отладочная информация
- `INFO` - общая информация о работе приложения
- `WARN` - предупреждения о потенциальных проблемах
- `ERROR` - ошибки, которые не останавливают работу приложения
- `FATAL` - критические ошибки, приводящие к остановке приложения

## Просмотр логов

1. Перейдите в консоль Yandex Cloud
2. Откройте сервис "Cloud Logging"
3. Выберите вашу лог-группу
4. Используйте фильтры для поиска нужных логов:
   - По времени
   - По уровню логирования
   - По потоку (stream)
   - По содержимому сообщения

## Отключение логирования

Для отключения логирования в Yandex Cloud:

1. Установите `YANDEX_LOGGING_ENABLED=false` в `.env`
2. Или удалите токены авторизации

При отключенном облачном логировании все логи будут выводиться только в консоль.

## Производительность

- Логи отправляются асинхронно и не блокируют UI
- При ошибках отправки логи сохраняются в локальной консоли
- Поддерживается пакетная отправка для оптимизации сетевых запросов
- Автоматическое переподключение при сбоях сети

## Безопасность

- Не логируйте чувствительные данные (пароли, токены, персональную информацию)
- Используйте IAM токены вместо OAuth для production
- Регулярно обновляйте токены авторизации
- Ограничьте права сервисного аккаунта только необходимыми (logging.writer)

## Мониторинг и алерты

В консоли Yandex Cloud Logging можно настроить:

- Алерты при превышении количества ошибок
- Уведомления о критических событиях
- Дашборды для мониторинга активности приложения
- Экспорт логов для дальнейшего анализа
