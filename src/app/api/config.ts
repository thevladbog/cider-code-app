import { OpenAPI } from './generated';

// Базовый URL API (можно получить из переменной окружения)
let baseURL = 'https://api.bottlecode.app'; // Production URL by default

if (process.env.NODE_ENV === 'development') {
  baseURL = 'https://api.test.in.bottlecode.app:3035';
} else if (process.env.APP_ENV === 'beta') {
  // Assuming you'll set APP_ENV for beta
  baseURL = 'https://beta.api.bottlecode.app';
}

// Настройка OpenAPI клиента
export const configureOpenAPI = () => {
  OpenAPI.BASE = baseURL;
  OpenAPI.WITH_CREDENTIALS = true;

  console.log('OpenAPI configured with:', {
    BASE: OpenAPI.BASE,
    WITH_CREDENTIALS: OpenAPI.WITH_CREDENTIALS,
    baseURL: baseURL,
  });
};

// Автоматически настраиваем при импорте
configureOpenAPI();

export { baseURL };
