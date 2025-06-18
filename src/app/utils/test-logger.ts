/**
 * Тестовый файл для проверки работы rendererLogger
 */

import { rendererLogger } from './simpleRendererLogger';

// Тестируем все уровни логирования
export function testRendererLogger(): void {
  console.log('=== Тестирование rendererLogger ===');

  // Тестируем базовые методы
  rendererLogger.debug('Тестовое DEBUG сообщение', { testData: 'debug test' });
  rendererLogger.info('Тестовое INFO сообщение', { testData: 'info test' });
  rendererLogger.warn('Тестовое WARN сообщение', { testData: 'warn test' });
  rendererLogger.error('Тестовое ERROR сообщение', { testData: 'error test' });

  // Тестируем специализированные методы
  rendererLogger.logUserAction('test-action', { userId: 'test-user' });
  rendererLogger.logAppEvent('test-event', { eventData: 'test-event-data' });

  // Тестируем логирование ошибок
  const testError = new Error('Тестовая ошибка');
  rendererLogger.logError(testError, { context: 'test-context' });

  console.log('=== Тестирование завершено ===');
}

// Автоматически запускаем тест при импорте (только в development)
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    testRendererLogger();
  }, 2000); // Даем время на инициализацию
}
