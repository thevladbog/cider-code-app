import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UseIdleTimeoutOptions {
  timeoutMs?: number; // Время бездействия в миллисекундах (по умолчанию 30 минут)
  enabled?: boolean; // Включен ли таймер (по умолчанию true)
  onTimeout?: () => void; // Коллбэк при срабатывании таймаута
}

/**
 * Хук для автоматической блокировки системы при бездействии пользователя
 *
 * Отслеживает следующие типы активности:
 * - Движения и клики мыши (mousedown, mousemove, mouseup, click, wheel)
 * - Нажатия клавиш (keydown, keypress, keyup)
 * - Ввод в поля (input, change)
 * - Прокрутка (scroll)
 * - Касания экрана (touchstart, touchmove, touchend, touchcancel)
 * - События фокуса (focus, blur)
 *
 * При отсутствии активности в течение заданного времени пользователь
 * автоматически перенаправляется на страницу входа, а данные сессии очищаются.
 */
export const useIdleTimeout = ({
  timeoutMs = 30 * 60 * 1000, // 30 минут
  enabled = true,
  onTimeout,
}: UseIdleTimeoutOptions = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoginPage = location.pathname === '/';

  // Функция для сброса таймера
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Не запускаем таймер на странице входа
    if (!enabled || isLoginPage) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      console.log('User idle timeout reached, redirecting to login');

      // Очищаем данные сессии
      localStorage.removeItem('workplaceData');

      // Вызываем коллбэк если есть
      if (onTimeout) {
        onTimeout();
      }

      // Перенаправляем на страницу входа
      navigate('/', { replace: true });
    }, timeoutMs);
  }, [enabled, isLoginPage, timeoutMs, navigate, onTimeout]);

  // Обработчики событий активности пользователя
  const handleUserActivity = useCallback(
    (event: Event) => {
      // Логируем активность для отладки (можно отключить в продакшене)
      if (process.env.NODE_ENV === 'development') {
        console.log('User activity detected:', event.type);
      }
      resetTimer();
    },
    [resetTimer]
  );

  useEffect(() => {
    if (!enabled || isLoginPage) {
      // Очищаем таймер если он не нужен
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // События, которые считаются активностью пользователя
    const events = [
      // Мышь
      'mousedown',
      'mousemove',
      'mouseup',
      'click',
      'wheel', // прокрутка колесом мыши
      // Клавиатура
      'keydown',
      'keypress',
      'keyup',
      // Ввод данных
      'input',
      'change',
      // Прокрутка
      'scroll',
      // Касания (touch screen)
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel', // отмена касания
      // Фокус
      'focus',
      'blur',
    ];

    // Запускаем таймер при первой загрузке
    resetTimer();

    // Добавляем слушатели событий
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Очистка при размонтировании или изменении зависимостей
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [enabled, isLoginPage, handleUserActivity, resetTimer]);

  // Очищаем таймер при смене маршрута на страницу входа
  useEffect(() => {
    if (isLoginPage && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isLoginPage]);

  return {
    resetTimer,
  };
};
