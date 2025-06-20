import { isBeta, isDev } from '../utils/envHelper';
import { rendererLogger } from '../utils/simpleRendererLogger';
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
  OpenAPI.WITH_CREDENTIALS = false; // Отключаем credentials для обхода CORS
  
  // В Electron среде можно использовать дополнительные настройки
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    console.log('Running in Electron renderer process - CORS restrictions bypassed');
  }
  
  rendererLogger.info('OpenAPI configured', {
    BASE: OpenAPI.BASE,
    WITH_CREDENTIALS: OpenAPI.WITH_CREDENTIALS,
    baseURL: baseURL,
  });
};

// Автоматически настраиваем при импорте
configureOpenAPI();

export { baseURL };

