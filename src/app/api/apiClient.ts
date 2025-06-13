import axios from 'axios';

// Базовый URL API (можно получить из переменной окружения)
const baseURL = 'https://api.test.in.bottlecode.app:3035';

// Создаем инстанс axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд тайм-аут
});

// Глобальное состояние аутентификации
let authToken: string | null = null;

// Функция для установки токена авторизации
export const setAuthToken = (token: string | null): void => {
  authToken = token;

  if (token) {
    // Устанавливаем токен для всех последующих запросов
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    // Удаляем заголовок авторизации при выходе
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Перехватчик для добавления заголовков авторизации
apiClient.interceptors.request.use(
  config => {
    // Если токен есть, но не добавлен в заголовки - добавляем
    if (authToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Перехватчик для обработки ответов
apiClient.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const originalRequest = error.config;

    // Если сервер вернул 401 (неавторизован)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Можно добавить логику обновления токена здесь
      // Если токен обновлен успешно, повторяем запрос

      // Пример:
      // originalRequest._retry = true;
      // const newToken = await refreshToken();
      // setAuthToken(newToken);
      // return apiClient(originalRequest);

      // Если обновление токена не предусмотрено, просто сообщаем о необходимости авторизации
      console.error('Unauthorized access. Please login again.');

      // Можно вызвать функцию для перенаправления на страницу входа
      // redirectToLogin();
    }

    // Обработка других кодов ошибок
    if (error.response) {
      // Ошибка от сервера (есть ответ)
      console.error('Server error:', error.response.status, error.response.data);

      // Можно добавить специфичную логику для разных кодов ошибок
      switch (error.response.status) {
        case 400:
          console.error('Bad Request:', error.response.data);
          break;
        case 403:
          console.error('Forbidden:', error.response.data);
          break;
        case 404:
          console.error('Not Found:', error.response.data);
          break;
        case 500:
          console.error('Internal Server Error:', error.response.data);
          break;
      }
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      console.error('No response from server:', error.request);
    } else {
      // Что-то пошло не так при настройке запроса
      console.error('Request setup error:', error.message);
    }

    // Пробрасываем ошибку дальше
    return Promise.reject(error);
  }
);

// Вспомогательные функции для работы с хранилищем токенов
export const loadAuthToken = (): void => {
  const storedToken = localStorage.getItem('auth_token');
  if (storedToken) {
    try {
      setAuthToken(storedToken);
    } catch (e) {
      console.error('Failed to load auth token:', e);
      localStorage.removeItem('auth_token');
    }
  }
};

export const saveAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
  setAuthToken(token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem('auth_token');
  setAuthToken(null);
};

// Загружаем токен при инициализации клиента
loadAuthToken();

export default apiClient;
