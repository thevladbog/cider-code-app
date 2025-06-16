# Yandex Cloud Logging для Bottle Code App

Интеграция логирования событий в Yandex Cloud Logging для Electron приложения.

## 🚀 Быстрый старт

1. **Установка зависимостей** - уже выполнена:

   ```bash
   npm install @yandex-cloud/nodejs-sdk
   ```

2. **Настройка переменных окружения**:

   ```bash
   cp .env.example .env
   # Заполните .env файл своими данными
   ```

3. **Тестирование**:
   ```bash
   npm run test:logger
   ```

## 📁 Структура файлов

```
src/services/
├── yandexCloudLogger.ts      # Основной класс логгера
├── loggerService.ts          # Singleton сервис для управления логгером
├── loggerConfig.ts           # Конфигурация и валидация
├── loggerTest.ts             # Тестовый файл
└── index.ts                  # Экспорты

src/app/hooks/
└── useLogger.ts              # React хук для использования в компонентах

src/docs/
└── YANDEX_CLOUD_LOGGING.md  # Подробная документация
```

## 🎯 Примеры использования

### В React компонентах:

```tsx
import { useLogger } from '@/app/hooks/useLogger';

const MyComponent = () => {
  const { logUserAction, logError } = useLogger();

  const handleClick = async () => {
    await logUserAction('button_clicked', { buttonId: 'submit' });
  };
};
```

### В основном процессе:

```typescript
import { logger } from '@/services';

await logger.logAppEvent('application_started');
await logger.logError(error, { context: 'main_process' });
```

## 🏗️ Что уже интегрировано

- ✅ Инициализация логгера при запуске приложения
- ✅ Логирование событий жизненного цикла приложения
- ✅ Логирование системных событий (подключение портов, принтеров)
- ✅ Логирование действий пользователя (сканирование, навигация)
- ✅ Обработка ошибок с автоматическим fallback в консоль
- ✅ Разделение логов по потокам (streams)
- ✅ Пакетная отправка логов для оптимизации

## 🔧 Конфигурация

Основные переменные в `.env`:

```env
YANDEX_LOGGING_ENABLED=true
YANDEX_IAM_TOKEN=your-token
YANDEX_FOLDER_ID=your-folder-id
YANDEX_LOG_GROUP_ID=your-log-group-id
```

## 📊 Просмотр логов

Логи доступны в [консоли Yandex Cloud Logging](https://console.cloud.yandex.ru/).

## 📚 Документация

Подробная документация доступна в [YANDEX_CLOUD_LOGGING.md](./src/docs/YANDEX_CLOUD_LOGGING.md).

## 🔒 Безопасность

- Логи автоматически отправляются только при наличии валидной конфигурации
- При ошибках отправки используется локальное консольное логирование
- Токены авторизации хранятся в переменных окружения
- Не логируются чувствительные данные
