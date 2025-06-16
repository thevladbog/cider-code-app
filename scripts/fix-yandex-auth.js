#!/usr/bin/env node

/**
 * Скрипт для диагностики и исправления проблем с Yandex Cloud аутентификацией
 * Запуск: npm run fix-yandex-auth или node scripts/fix-yandex-auth.js
 */

// Подключаем переменные окружения
require('dotenv').config();

async function main() {
  try {
    console.log('🚀 Запуск диагностики Yandex Cloud аутентификации...\n');

    // Импортируем TypeScript модуль через ts-node
    const { diagnosAndFixYandexCloudAuth } =
      require('ts-node').register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
        },
      }) && require('../src/services/authFixer.ts');

    await diagnosAndFixYandexCloudAuth();
    console.log('\n✅ Диагностика завершена!');
  } catch (error) {
    console.error('❌ Ошибка во время диагностики:', error);

    // Альтернативная диагностика без TypeScript
    console.log('\n🔍 Базовая диагностика переменных окружения:');
    console.log(
      '- YANDEX_CLOUD_LOGGING_ENABLED:',
      process.env.YANDEX_CLOUD_LOGGING_ENABLED || 'не установлена'
    );
    console.log(
      '- YANDEX_IAM_TOKEN:',
      process.env.YANDEX_IAM_TOKEN ? '✅ установлена' : '❌ не установлена'
    );
    console.log(
      '- YANDEX_SERVICE_ACCOUNT_KEY:',
      process.env.YANDEX_SERVICE_ACCOUNT_KEY ? '✅ установлена' : '❌ не установлена'
    );
    console.log('- YANDEX_FOLDER_ID:', process.env.YANDEX_FOLDER_ID || 'не установлена');
    console.log('- YANDEX_LOG_GROUP_ID:', process.env.YANDEX_LOG_GROUP_ID || 'не установлена');

    console.log('\n💡 РЕШЕНИЕ:');
    if (process.env.YANDEX_IAM_TOKEN && !process.env.YANDEX_SERVICE_ACCOUNT_KEY) {
      console.log('⚠️  Найден IAM токен - он мог истечь!');
      console.log('🔧 Рекомендуется перейти на Service Account Key:');
      console.log('1. Создайте Service Account Key в консоли Yandex Cloud');
      console.log(
        '2. Установите YANDEX_SERVICE_ACCOUNT_KEY={"id":"...","service_account_id":"...","private_key":"..."}'
      );
      console.log('3. Уберите YANDEX_IAM_TOKEN');
    } else if (!process.env.YANDEX_IAM_TOKEN && !process.env.YANDEX_SERVICE_ACCOUNT_KEY) {
      console.log('❌ Не найдены токены аутентификации');
      console.log('🔧 Установите один из способов аутентификации');
    } else if (process.env.YANDEX_SERVICE_ACCOUNT_KEY) {
      console.log('✅ Service Account Key найден - должно работать корректно');
      console.log('🔧 Если проблема сохраняется, проверьте права сервисного аккаунта');
    }

    console.log('\n📖 Подробная документация: src/docs/YANDEX_TOKEN_EXPIRATION_FIX.md');
    process.exit(1);
  }
}

// Запускаем только если файл вызван напрямую
if (require.main === module) {
  main();
}

module.exports = { main };
