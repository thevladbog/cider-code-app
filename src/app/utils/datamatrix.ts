import { DataMatrixData } from '../types';
import { rendererLogger } from './rendererLogger';

/**
 * Парсинг Datamatrix кода в соответствии с указанным форматом:
 * 01 + 14 цифр (код товара) + 21 + 1 цифра (код страны) + 6 символов (серийный номер) + FN1 + 93 + 4 символа (код проверки)
 *
 * @param dataMatrixCode - Отсканированный Datamatrix код
 * @returns Структурированные данные Datamatrix или null если формат неверный
 */
export function parseDataMatrix(dataMatrixCode: string): DataMatrixData | null {
  try {
    // Некоторые сканеры могут заменять FN1 на разные последовательности
    // Например, ]d2 или просто опускать его. Мы нормализуем входные данные.
    const cleanCode = dataMatrixCode.trim();

    rendererLogger.debug('Parsing DataMatrix code', { original: dataMatrixCode, clean: cleanCode });

    // Пробуем разные варианты парсинга
    let match: RegExpMatchArray | null = null;

    // Основной формат: 01 + 14 цифр + 21 + 1 цифра + 6 символов + 93 + 4 символа
    const mainRegex = /^01(\d{14})21(\d{1})(.{6})93(.{4})$/;
    match = cleanCode.match(mainRegex);

    if (match) {
      rendererLogger.debug('Matched with main regex', { match });
    } else {
      // Альтернативный формат с возможным FN1 между серийным номером и кодом проверки
      // eslint-disable-next-line no-control-regex
      const fnRegex = /^01(\d{14})21(\d{1})(.{6})[\x1D\u001D]?93(.{4})$/;
      match = cleanCode.match(fnRegex);

      if (match) {
        rendererLogger.debug('Matched with FN1 regex', { match });
      } else {
        // Более гибкий поиск с нежадным квантификатором
        const flexibleRegex = /^01(\d{14})21(\d{1})(.{6}).*?93(.{4})$/;
        match = cleanCode.match(flexibleRegex);

        if (match) {
          rendererLogger.debug('Matched with flexible regex', { match });
        }
      }
    }

    if (!match) {
      rendererLogger.error('Invalid DataMatrix format', {
        expected: '01XXXXXXXXXXXXXXXX21YZZZZZZZ93WWWW',
        received: cleanCode,
      });

      // Попробуем найти части по отдельности для диагностики
      const gtinMatch = cleanCode.match(/^01(\d{14})/);
      const serialMatch = cleanCode.match(/21(\d{1})(.{6})/);
      const verificationMatch = cleanCode.match(/93(.{4})/);
      rendererLogger.debug('Diagnostic matches', {
        gtin: gtinMatch?.[1],
        serial: serialMatch ? { countryCode: serialMatch[1], serialNumber: serialMatch[2] } : null,
        verification: verificationMatch?.[1],
      });

      return null;
    }

    const result = {
      gtin: match[1], // 14 цифр после "01"
      countryCode: match[2], // 1 цифра после "21"
      serialNumber: match[3], // 6 символов после кода страны
      verificationCode: match[4], // 4 символа после "93"
      rawData: dataMatrixCode, // Сохраняем исходный код
    };

    rendererLogger.info('Successfully parsed DataMatrix', { result });
    return result;
  } catch (error) {
    rendererLogger.error('Error parsing DataMatrix code', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return null;
  }
}

/**
 * Создает уникальный ключ для Datamatrix кода
 *
 * @param data - Данные Datamatrix
 * @returns Уникальный ключ
 */
export function createDataMatrixKey(data: DataMatrixData): string {
  return `${data.gtin}_${data.countryCode}${data.serialNumber}`;
}

/**
 * Проверяет, соответствует ли GTIN продукта указанному в смене
 *
 * @param dataMatrixGtin - GTIN из Datamatrix кода
 * @param productGtin - GTIN продукта в смене
 * @returns true если коды совпадают
 */
export function isMatchingGtin(dataMatrixGtin: string, productGtin: string): boolean {
  // Очищаем от возможных пробелов и других разделителей
  const cleanDataMatrixGtin = dataMatrixGtin.replace(/\D/g, '');
  const cleanProductGtin = productGtin.replace(/\D/g, '');

  return cleanDataMatrixGtin === cleanProductGtin;
}

/**
 * Форматирует GTIN для улучшения читабельности
 *
 * @param gtin - 14-значный GTIN
 * @returns Отформатированная строка
 */
export function formatGtin(gtin: string): string {
  if (gtin.length !== 14) return gtin;

  // Форматируем как: X XX XXXXX XXXXX X
  return `${gtin.slice(0, 1)} ${gtin.slice(1, 3)} ${gtin.slice(3, 8)} ${gtin.slice(8, 13)} ${gtin.slice(13)}`;
}

/**
 * Форматирует SSCC код для улучшения читабельности
 *
 * @param sscc - 18-значный SSCC код
 * @returns Отформатированная строка
 */
export function formatSSCC(sscc: string): string {
  if (sscc.length !== 18) return sscc;

  // Форматируем как: (00) XXXX XXXX XXXX XXXX XX
  return `(00) ${sscc.slice(0, 4)} ${sscc.slice(4, 8)} ${sscc.slice(8, 12)} ${sscc.slice(12, 16)} ${sscc.slice(16)}`;
}

/**
 * Проверяет, является ли строка валидным GTIN
 *
 * @param gtin - GTIN для проверки
 * @returns true если GTIN валиден
 */
export function isValidGtin(gtin: string): boolean {
  // Очищаем от возможных пробелов и других разделителей
  const cleanGtin = gtin.replace(/\D/g, '');

  // GTIN должен быть 14 цифр
  if (cleanGtin.length !== 14) {
    return false;
  }

  // Проверка контрольной цифры
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(cleanGtin[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleanGtin[13]);
}

/**
 * Проверяет, является ли строка валидным SSCC
 *
 * @param sscc - SSCC для проверки
 * @returns true если SSCC валиден
 */
export function isValidSSCC(sscc: string): boolean {
  // Очищаем от возможных пробелов и других разделителей
  const cleanSSCC = sscc.replace(/\D/g, '');

  // SSCC должен быть 18 цифр
  if (cleanSSCC.length !== 18) {
    return false;
  }

  // Проверка контрольной цифры
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = parseInt(cleanSSCC[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleanSSCC[17]);
}

/**
 * Нормализует SSCC код, удаляя префиксы сканеров и служебные символы
 *
 * @param ssccCode - Отсканированный SSCC код
 * @returns Нормализованный SSCC код
 */
export function normalizeSSCCCode(ssccCode: string): string {
  try {
    let cleanCode = ssccCode.trim();

    rendererLogger.debug('Normalizing SSCC code', { original: ssccCode, clean: cleanCode });

    // Удаляем префикс ]C1 который добавляют некоторые сканеры для SSCC (Application Identifier 00)
    if (cleanCode.startsWith(']C1')) {
      cleanCode = cleanCode.substring(3);
      rendererLogger.debug('Removed ]C1 prefix', { cleanCode });
    }

    // Удаляем другие возможные префиксы сканеров
    if (cleanCode.startsWith(']d2')) {
      cleanCode = cleanCode.substring(3);
      rendererLogger.debug('Removed ]d2 prefix', { cleanCode });
    } // Поддерживаем формат вида ]C100046800899000001977 - длинный SSCC с префиксом
    // Сначала проверяем, есть ли корректный 18-значный SSCC в конце строки
    const endSSCCMatch = cleanCode.match(/(\d{18})$/);
    if (endSSCCMatch) {
      cleanCode = endSSCCMatch[1];
      rendererLogger.debug('Extracted 18-digit SSCC from end of code', { cleanCode });
    } else {
      // Если SSCC начинается с 00, то это правильный формат (Application Identifier 00)
      if (cleanCode.startsWith('00') && cleanCode.length === 20) {
        // Убираем AI и оставляем только 18-значный SSCC
        cleanCode = cleanCode.substring(2);
        rendererLogger.debug('Removed AI 00 prefix', { cleanCode });
      } else {
        // Удаляем все нецифровые символы
        cleanCode = cleanCode.replace(/\D/g, '');

        // Если получилось больше 18 цифр, берем последние 18
        if (cleanCode.length > 18) {
          cleanCode = cleanCode.slice(-18);
          rendererLogger.debug('Took last 18 digits', { cleanCode });
        }
      }
    }

    // SSCC должен быть 18 цифр
    if (cleanCode.length === 18) {
      rendererLogger.info('Successfully normalized SSCC', { cleanCode });
      return cleanCode;
    }
    rendererLogger.warn('Invalid SSCC length after normalization', {
      length: cleanCode.length,
      code: cleanCode,
    });

    return cleanCode; // Возвращаем как есть для дальнейшей обработки
  } catch (error) {
    rendererLogger.error('Error normalizing SSCC code', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return ssccCode; // Возвращаем исходный код в случае ошибки
  }
}

/**
 * Проверяет соответствие двух SSCC кодов с учетом нормализации
 *
 * @param scannedSSCC - Отсканированный SSCC код
 * @param expectedSSCC - Ожидаемый SSCC код
 * @returns true если коды совпадают
 */
export function compareSSCCCodes(scannedSSCC: string, expectedSSCC: string): boolean {
  const normalizedScanned = normalizeSSCCCode(scannedSSCC);
  const normalizedExpected = normalizeSSCCCode(expectedSSCC);

  rendererLogger.debug('Comparing SSCC codes', {
    scanned: { original: scannedSSCC, normalized: normalizedScanned },
    expected: { original: expectedSSCC, normalized: normalizedExpected },
    match: normalizedScanned === normalizedExpected,
  });

  return normalizedScanned === normalizedExpected;
}

/**
 * Форматирует число с разделителями тысяч для улучшения читабельности
 *
 * @param num - Число для форматирования
 * @returns Отформатированная строка с разделителями тысяч
 */
export function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return 'Не указано';

  return new Intl.NumberFormat('ru-RU').format(num);
}
