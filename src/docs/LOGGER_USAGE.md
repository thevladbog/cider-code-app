# Использование логгера в приложении

## Введение

В приложении реализована система логирования на базе YandexCloudLogger, которая заменяет стандартные вызовы `console`. Логгер поддерживает отправку логов как в Yandex Cloud, так и вывод в консоль в зависимости от конфигурации.

## Как использовать логгер в main-процессе

### Импорт логгера

```typescript
import { logger } from './services';
```

### Методы логирования

Вместо стандартных методов консоли используйте следующие методы логгера:

- `logger.debug(message, jsonPayload?, streamName?)` - для отладочных сообщений
- `logger.info(message, jsonPayload?, streamName?)` - для информационных сообщений
- `logger.warn(message, jsonPayload?, streamName?)` - для предупреждений
- `logger.error(message, jsonPayload?, streamName?)` - для ошибок
- `logger.fatal(message, jsonPayload?, streamName?)` - для критических ошибок

### Примеры использования

```typescript
// Простой лог
logger.info('Приложение запущено');

// Лог с дополнительными данными
logger.info('Пользователь авторизован', {
  userId: 123,
  email: 'user@example.com',
});
```

## Как использовать логгер в renderer-процессе

Поскольку renderer-процесс не имеет прямого доступа к main-процессу из-за изоляции контекста, для него создана отдельная утилита логирования.

### Импорт логгера для renderer-процесса

```typescript
import { rendererLogger } from './app/utils/rendererLogger';
```

### Методы логирования

В renderer-процессе доступны те же методы, что и в main-процессе:

- `rendererLogger.debug(message, payload?)` - для отладочных сообщений
- `rendererLogger.info(message, payload?)` - для информационных сообщений
- `rendererLogger.warn(message, payload?)` - для предупреждений
- `rendererLogger.error(message, payload?)` - для ошибок

Также доступны специализированные методы:

- `rendererLogger.logUserAction(action, details?)`
- `rendererLogger.logAppEvent(eventType, details?)`
- `rendererLogger.logError(error, context?)`

### Примеры использования

```typescript
// Простой лог
rendererLogger.info('Компонент инициализирован');

// Логирование действия пользователя
rendererLogger.logUserAction('button_click', { buttonId: 'save-product' });

// Логирование ошибки
try {
  // some code
} catch (error) {
  rendererLogger.logError(error as Error, {
    component: 'ProductScanner',
    action: 'scanCode',
  });
}
```

## Конфигурация логгера

Логгер инициализируется при старте приложения с конфигурацией из `loggerConfig.ts`. Если логирование в Yandex Cloud отключено, все логи будут выводиться в консоль.

### Включение/отключение логирования в Yandex Cloud

```env
YANDEX_CLOUD_LOGGING_ENABLED=true
```

## Замечания по производительности

- При использовании `jsonPayload` с большим количеством данных учитывайте, что это может повлиять на производительность.
- Для отладки в режиме разработки рекомендуется использовать `logger.debug()`.
