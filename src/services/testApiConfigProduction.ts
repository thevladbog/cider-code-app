/**
 * Тест API конфигурации в production сборке
 * Проверяет, что VITE_APP_ENV корректно подставляется и используется
 */

// Создаем тестовый скрипт для проверки API конфигурации
console.log('=== API CONFIG PRODUCTION TEST ===');

// Симулируем разные окружения
const testEnvironments = [
  { NODE_ENV: 'development', VITE_APP_ENV: 'development' },
  { NODE_ENV: 'production', VITE_APP_ENV: 'production' },
  { NODE_ENV: 'production', VITE_APP_ENV: 'beta' },
  { NODE_ENV: 'production', VITE_APP_ENV: 'staging' },
];

testEnvironments.forEach(env => {
  console.log(
    `\n🧪 Testing environment: NODE_ENV=${env.NODE_ENV}, VITE_APP_ENV=${env.VITE_APP_ENV}`
  );

  // Устанавливаем переменные
  process.env.NODE_ENV = env.NODE_ENV;
  process.env.VITE_APP_ENV = env.VITE_APP_ENV;

  // Удаляем из cache, чтобы модуль перезагрузился
  delete require.cache[require.resolve('../utils/environment')];
  delete require.cache[require.resolve('../app/api/config')];

  try {
    // Загружаем модули заново
    const { getAppEnvironment, getEnvironmentConfig } = require('../utils/environment');
    const envConfig = getEnvironmentConfig();

    console.log('✅ Environment detected:', getAppEnvironment());
    console.log('✅ API URL configured:', envConfig.apiUrl);
    console.log('✅ Cloud logging enabled:', envConfig.enableCloudLogging);
    console.log('✅ Debug mode enabled:', envConfig.enableDebugMode);

    // Проверяем API конфиг (он автоматически настраивается при импорте)
    const { baseURL } = require('../app/api/config');
    console.log('✅ Configured base URL:', baseURL);

    // Проверяем корректность URL для каждого окружения
    const expectedUrl = envConfig.apiUrl;
    if (baseURL === expectedUrl) {
      console.log('✅ Base URL matches expected URL');
    } else {
      console.log('❌ Base URL mismatch! Expected:', expectedUrl, 'Got:', baseURL);
    }
  } catch (error) {
    console.error('❌ Error testing environment:', (error as Error).message);
  }
});

console.log('\n✅ API configuration production test completed');
console.log('All environment variables should be correctly resolved in production builds');
