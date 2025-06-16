#!/usr/bin/env node

/**
 * Инструкция по настройке Service Account Key для Yandex Cloud Logging
 *
 * Этот скрипт поможет вам настроить аутентификацию для устранения ошибок типа:
 * "The token has expired" в Yandex Cloud Logging
 */

console.log('🔧 НАСТРОЙКА SERVICE ACCOUNT KEY ДЛЯ YANDEX CLOUD LOGGING');
console.log('===========================================================');
console.log('');

console.log('📋 Шаги для создания Service Account Key:');
console.log('');

console.log('1. Откройте Yandex Cloud Console: https://console.cloud.yandex.ru');
console.log('');

console.log('2. Перейдите в раздел "IAM" → "Сервисные аккаунты"');
console.log('');

console.log('3. Создайте новый сервисный аккаунт или выберите существующий');
console.log('   - Название: bottle-code-app-logging');
console.log('   - Описание: Service account for Bottle Code App logging');
console.log('');

console.log('4. Назначьте роли сервисному аккаунту:');
console.log('   - logging.writer (для записи логов)');
console.log('   - logging.reader (опционально, для чтения логов)');
console.log('');

console.log('5. Создайте ключ для сервисного аккаунта:');
console.log('   - Перейдите в карточку сервисного аккаунта');
console.log('   - Вкладка "Ключи" → "Создать ключ" → "Создать авторизованный ключ"');
console.log('   - Скачайте JSON файл с ключом');
console.log('');

console.log('6. Настройте переменную окружения:');
console.log('   Создайте файл .env в корне проекта со следующим содержимым:');
console.log('');
console.log('   YANDEX_CLOUD_LOGGING_ENABLED=true');
console.log(
  '   YANDEX_SERVICE_ACCOUNT_KEY={"id":"...","service_account_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}'
);
console.log('   YANDEX_FOLDER_ID=ваш-folder-id');
console.log('   YANDEX_LOG_GROUP_ID=ваш-log-group-id');
console.log('');

console.log('7. Удалите старые переменные (если используются):');
console.log('   - YANDEX_IAM_TOKEN');
console.log('   - YANDEX_OAUTH_TOKEN');
console.log('');

console.log('8. Перезапустите приложение');
console.log('');

console.log('✅ ПРЕИМУЩЕСТВА SERVICE ACCOUNT KEY:');
console.log('- Не истекает как IAM токены');
console.log('- Автоматически обновляется SDK');
console.log('- Более безопасен для production');
console.log('- Не требует ручного обновления токенов');
console.log('');

console.log('🔍 ДИАГНОСТИКА:');
console.log('Запустите тест для проверки настроек:');
console.log('npm run test:logging');
console.log('');

console.log('🆘 ТЕХНИЧЕСКАЯ ПОДДЕРЖКА:');
console.log('Если проблема остается, проверьте:');
console.log('- Корректность JSON в YANDEX_SERVICE_ACCOUNT_KEY');
console.log('- Права сервисного аккаунта (logging.writer)');
console.log('- Существование указанной лог-группы');
console.log('- Соответствие folder_id в Service Account Key');
console.log('');

// Проверяем текущие настройки
console.log('🔍 ТЕКУЩИЕ НАСТРОЙКИ:');

if (process.env.YANDEX_SERVICE_ACCOUNT_KEY) {
  console.log('✅ YANDEX_SERVICE_ACCOUNT_KEY: настроена');
  try {
    const key = JSON.parse(process.env.YANDEX_SERVICE_ACCOUNT_KEY);
    console.log('   - Service Account ID:', key.service_account_id || 'не указан');
    console.log('   - Key ID:', key.id || 'не указан');
    console.log('   - Private Key:', key.private_key ? 'присутствует' : 'отсутствует');
  } catch (e) {
    console.log('❌ Ошибка парсинга JSON ключа:', e.message);
  }
} else {
  console.log('❌ YANDEX_SERVICE_ACCOUNT_KEY: не настроена');
}

console.log('YANDEX_FOLDER_ID:', process.env.YANDEX_FOLDER_ID || 'не настроена');
console.log('YANDEX_LOG_GROUP_ID:', process.env.YANDEX_LOG_GROUP_ID || 'не настроена');
console.log(
  'YANDEX_CLOUD_LOGGING_ENABLED:',
  process.env.YANDEX_CLOUD_LOGGING_ENABLED || 'не настроена'
);

if (process.env.YANDEX_IAM_TOKEN) {
  console.log('⚠️  YANDEX_IAM_TOKEN: используется (рекомендуется заменить на Service Account Key)');
}

if (process.env.YANDEX_OAUTH_TOKEN) {
  console.log(
    '⚠️  YANDEX_OAUTH_TOKEN: используется (рекомендуется заменить на Service Account Key)'
  );
}
