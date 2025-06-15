import { OpenAPI } from './generated';

// Базовый URL API (можно получить из переменной окружения)
let baseURL = 'https://api.bottlecode.app'; // Production URL by default

// В Vite используем import.meta.env вместо process.env
if (import.meta.env.DEV) {
  baseURL = 'https://api.test.in.bottlecode.app:3035';
} else if (import.meta.env.VITE_APP_ENV === 'beta') {
  // Assuming you'll set VITE_APP_ENV for beta
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
