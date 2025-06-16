import { diagnosAndFixYandexCloudAuth } from './authFixer';

/**
 * Тест для проверки исправления проблем с аутентификацией Yandex Cloud
 */
async function testAuthFix() {
  console.log('🧪 Тестирование диагностики и исправления аутентификации...\n');

  try {
    await diagnosAndFixYandexCloudAuth();
    console.log('\n✅ Тест завершен успешно');
  } catch (error) {
    console.error('\n❌ Ошибка в тесте:', error);
  }
}

// Запускаем тест
if (require.main === module) {
  testAuthFix();
}
