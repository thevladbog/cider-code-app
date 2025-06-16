import { DataMatrixData, IShiftScheme } from '../types';
import { createDataMatrixKey, isMatchingGtin, parseDataMatrix } from '../utils/datamatrix';
import { rendererLogger } from '../utils/rendererLogger';

// Импортируем функции для работы с бэкапом
// Путь может отличаться в зависимости от структуры проекта
import { getAllScannedCodesFromBackup, isCodeAlreadyScannedInBackup } from '../../backupService';

// Хранение отсканированных кодов в рамках смены
interface ScanHistory {
  [shiftId: string]: {
    [codeKey: string]: {
      timestamp: number;
      data: DataMatrixData;
    };
  };
}

// Хранение в памяти
const scanHistoryCache: ScanHistory = {};

// Голосовые оповещения
const voiceMessages = {
  duplicateScan: 'Повторное сканирование',
  invalidProduct: 'Неверный продукт',
  success: 'Сканирование успешно',
  invalidFormat: 'Неверный формат кода',
};

/**
 * Проверяет отсканированный Datamatrix код
 *
 * @param code - Отсканированный код
 * @param shift - Текущая смена
 * @returns Объект с результатами проверки
 */
export function checkDataMatrixCode(
  code: string,
  shift: IShiftScheme
): {
  isValid: boolean;
  isDuplicate: boolean;
  isCorrectProduct: boolean;
  data: DataMatrixData | null;
  message?: string;
} {
  // Парсим Datamatrix код
  const parsedData = parseDataMatrix(code);

  // Если формат кода неверный
  if (!parsedData) {
    // Вызываем оповещение о неверном формате
    notifyInvalidFormat();

    return {
      isValid: false,
      isDuplicate: false,
      isCorrectProduct: false,
      data: null,
      message: 'Неверный формат Datamatrix кода',
    };
  }

  // Проверяем соответствие GTIN продукту смены
  const isCorrectProduct = isMatchingGtin(parsedData.gtin, shift.product.gtin);
  // Создаем уникальный ключ для кода
  const codeKey = createDataMatrixKey(parsedData);

  // Проверяем, сканировался ли уже этот код в рамках текущей смены
  const shiftScans = scanHistoryCache[shift.id] || {};
  const isDuplicateInCache = codeKey in shiftScans;

  // Также проверяем в бэкапе (используем raw код)
  const isDuplicateInBackup = isCodeAlreadyScannedInBackup(shift.id, code);

  // Код считается дубликатом, если он есть либо в кеше, либо в бэкапе
  const isDuplicate = isDuplicateInCache || isDuplicateInBackup;

  // Сохраняем информацию о сканировании ТОЛЬКО если это не дубликат
  if (!isDuplicate) {
    if (!scanHistoryCache[shift.id]) {
      scanHistoryCache[shift.id] = {};
    }

    scanHistoryCache[shift.id][codeKey] = {
      timestamp: Date.now(),
      data: parsedData,
    };
  }

  // Формируем сообщение и вызываем соответствующие оповещения
  let message;
  if (isDuplicate) {
    message = 'Этот код уже был отсканирован';
    // Вызываем визуальное и звуковое оповещение о дубликате
    notifyDuplicateScan();
  } else if (!isCorrectProduct) {
    message = 'Продукт не соответствует текущей смене';
    // Вызываем оповещение о неверном продукте
    notifyInvalidProduct();
  } else {
    message = 'Код успешно отсканирован';
    // Вызываем оповещение об успешном сканировании
    notifySuccessfulScan();
  }

  return {
    isValid: true,
    isDuplicate,
    isCorrectProduct,
    data: parsedData,
    message,
  };
}

/**
 * Очищает историю сканирования для определенной смены
 *
 * @param shiftId - ID смены
 */
export function clearScanHistory(shiftId: string): void {
  delete scanHistoryCache[shiftId];
}

/**
 * Получает список отсканированных кодов для смены (из кеша + бэкапа)
 *
 * @param shiftId - ID смены
 * @returns Массив отсканированных кодов
 */
export function getScannedCodes(shiftId: string): DataMatrixData[] {
  // Получаем коды из кеша
  const shiftScans = scanHistoryCache[shiftId] || {};
  const cacheData = Object.values(shiftScans).map(item => item.data);

  // Получаем коды из бэкапа
  const backupData = getAllScannedCodesFromBackup(shiftId);

  // Создаем Map для объединения данных без дубликатов
  const combinedData = new Map<string, DataMatrixData>();

  // Добавляем данные из бэкапа
  backupData.forEach(item => {
    try {
      // Парсим код из бэкапа для получения DataMatrixData
      const parsedData = parseDataMatrix(item.code);
      if (parsedData) {
        const key = createDataMatrixKey(parsedData);
        combinedData.set(key, parsedData);
      }
    } catch (error) {
      rendererLogger.warn('Failed to parse backup code', { code: item.code, error });
    }
  });

  // Добавляем данные из кеша (они имеют приоритет, если есть конфликты)
  cacheData.forEach(data => {
    const key = createDataMatrixKey(data);
    combinedData.set(key, data);
  });

  return Array.from(combinedData.values());
}

/**
 * Получает количество уникально отсканированных кодов для смены
 *
 * @param shiftId - ID смены
 * @returns Количество уникальных кодов
 */
export function getUniqueScannedCount(shiftId: string): number {
  const shiftScans = scanHistoryCache[shiftId] || {};
  return Object.keys(shiftScans).length;
}

/**
 * Проверяет, сканировался ли данный код в рамках смены
 *
 * @param shiftId - ID смены
 * @param code - Datamatrix код или объект данных
 * @returns true если код уже сканировался
 */
export function isCodeAlreadyScanned(shiftId: string, code: string | DataMatrixData): boolean {
  const shiftScans = scanHistoryCache[shiftId] || {};

  if (typeof code === 'string') {
    const parsedData = parseDataMatrix(code);
    if (!parsedData) return false;

    const codeKey = createDataMatrixKey(parsedData);
    return codeKey in shiftScans;
  } else {
    const codeKey = createDataMatrixKey(code);
    return codeKey in shiftScans;
  }
}

/**
 * Удаляет конкретные коды из истории сканирования для смены
 *
 * @param shiftId - ID смены
 * @param codesToRemove - Массив кодов для удаления
 */
export function removeCodesFromHistory(shiftId: string, codesToRemove: DataMatrixData[]): void {
  const shiftScans = scanHistoryCache[shiftId];
  if (!shiftScans) return;

  for (const codeData of codesToRemove) {
    const codeKey = createDataMatrixKey(codeData);
    delete shiftScans[codeKey];
  }

  rendererLogger.info(
    `Removed ${codesToRemove.length} codes from scan history for shift ${shiftId}`
  );
}

/**
 * Синхронизирует кеш сканирования с данными из бэкапа
 * Вызывается при инициализации смены для загрузки ранее отсканированных кодов
 *
 * @param shiftId - ID смены
 */
export function syncCacheWithBackup(shiftId: string): void {
  try {
    // Получаем все коды из бэкапа
    const backupData = getAllScannedCodesFromBackup(shiftId);

    // Инициализируем кеш для смены, если его нет
    if (!scanHistoryCache[shiftId]) {
      scanHistoryCache[shiftId] = {};
    }

    // Добавляем коды из бэкапа в кеш (если их еще нет)
    backupData.forEach(item => {
      try {
        const parsedData = parseDataMatrix(item.code);
        if (parsedData) {
          const key = createDataMatrixKey(parsedData);

          // Добавляем только если этого кода еще нет в кеше
          if (!(key in scanHistoryCache[shiftId])) {
            scanHistoryCache[shiftId][key] = {
              timestamp: item.timestamp,
              data: parsedData,
            };
          }
        }
      } catch (error) {
        rendererLogger.warn('Failed to sync backup code to cache', { code: item.code, error });
      }
    });

    rendererLogger.info(
      `Synced ${backupData.length} codes from backup to cache for shift ${shiftId}`
    );
  } catch (error) {
    rendererLogger.error('Error syncing cache with backup', { error });
  }
}

// Функции для визуальных и звуковых оповещений

/**
 * Оповещение о повторном сканировании
 */
function notifyDuplicateScan(): void {
  flashScreen('red');
  speakMessage(voiceMessages.duplicateScan);
}

/**
 * Оповещение о неверном продукте
 */
function notifyInvalidProduct(): void {
  flashScreen('orange');
  speakMessage(voiceMessages.invalidProduct);
}

/**
 * Оповещение о неверном формате
 */
function notifyInvalidFormat(): void {
  flashScreen('red');
  speakMessage(voiceMessages.invalidFormat);
}

/**
 * Оповещение об успешном сканировании
 */
function notifySuccessfulScan(): void {
  flashScreen('green');
  // При успешном сканировании можно не озвучивать, чтобы не замедлять работу
}

/**
 * Создает моргающий эффект на экране указанного цвета
 *
 * @param color - Цвет вспышки ('red', 'green', 'orange')
 * @param times - Количество вспышек
 */
function flashScreen(color: 'red' | 'green' | 'orange', times = 2): void {
  // Создаем оверлей для вспышки, если его еще нет
  let flashOverlay = document.getElementById('flash-overlay');
  if (!flashOverlay) {
    flashOverlay = document.createElement('div');
    flashOverlay.id = 'flash-overlay';
    flashOverlay.style.position = 'fixed';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.pointerEvents = 'none';
    flashOverlay.style.zIndex = '9999';
    flashOverlay.style.opacity = '0';
    flashOverlay.style.transition = 'opacity 0.15s ease-in-out';
    document.body.appendChild(flashOverlay);
  }

  // Устанавливаем цвет вспышки
  let bgColor;
  switch (color) {
    case 'red':
      bgColor = 'rgba(220, 38, 38, 0.3)';
      break;
    case 'green':
      bgColor = 'rgba(22, 163, 74, 0.3)';
      break;
    case 'orange':
      bgColor = 'rgba(234, 88, 12, 0.3)';
      break;
  }
  flashOverlay.style.backgroundColor = bgColor;

  // Запускаем анимацию мигания
  let currentFlash = 0;

  function doFlash() {
    if (currentFlash >= times * 2) return;

    if (flashOverlay) {
      if (currentFlash % 2 === 0) {
        // Показываем вспышку
        flashOverlay.style.opacity = '1';
      } else {
        // Скрываем вспышку
        flashOverlay.style.opacity = '0';
      }
    }

    currentFlash++;
    setTimeout(doFlash, 150);
  }

  doFlash();
}

/**
 * Произносит указанное сообщение
 *
 * @param message - Текст для озвучивания
 */
function speakMessage(message: string): void {
  // Проверяем поддержку SpeechSynthesis
  if ('speechSynthesis' in window) {
    // Отменяем предыдущее произношение, если оно еще не закончилось
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Устанавливаем голос, предпочтительно женский
    window.speechSynthesis.onvoiceschanged = () => {
      const voices = window.speechSynthesis.getVoices();
      const russianVoice =
        voices.find(voice => voice.lang.includes('ru') && voice.name.includes('Female')) ||
        voices.find(voice => voice.lang.includes('ru'));

      if (russianVoice) {
        utterance.voice = russianVoice;
      }
    };

    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('SpeechSynthesis не поддерживается в этом браузере');
    // Пробуем использовать внешний метод воспроизведения звука через Electron
    const electronWindow = window as { electronAPI?: { playSound: (sound: string) => void } };
    if ('electronAPI' in electronWindow && electronWindow.electronAPI) {
      electronWindow.electronAPI.playSound('voice_' + message.toLowerCase().replace(/\s+/g, '_'));
    }
  }
}
