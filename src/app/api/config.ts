import { isBeta, isDev } from '../utils/envHelper';
import { rendererLogger } from '../utils/rendererLogger';
import { OpenAPI } from './generated';

// Базовый URL API (можно получить из переменной окружения)
let baseURL = 'https://api.bottlecode.app'; // Production URL by default

// Определяем окружение через унифицированные helper функции
if (isDev()) {
  baseURL = 'https://api.test.in.bottlecode.app:3035';
} else if (isBeta()) {
  baseURL = 'https://beta.api.bottlecode.app';
}

// Настройка OpenAPI клиента
export const configureOpenAPI = () => {
  OpenAPI.BASE = baseURL;
  OpenAPI.WITH_CREDENTIALS = true;
  rendererLogger.info('OpenAPI configured', {
    BASE: OpenAPI.BASE,
    WITH_CREDENTIALS: OpenAPI.WITH_CREDENTIALS,
    baseURL: baseURL,
  });
};

// Автоматически настраиваем при импорте
configureOpenAPI();

export { baseURL };

