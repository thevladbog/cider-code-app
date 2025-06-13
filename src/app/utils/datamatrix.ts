import { DataMatrixData } from '../types';

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

    // Регулярное выражение для нашего формата
    // Идентификатор "01" + 14 цифр + идентификатор "21" + 1 цифра + 6 символов + (опционально: FN1) + "93" + 4 символа
    /* eslint-disable */
    const dataMatrixRegex =
      /^01(\d{14})21(\d{1})(.{6})(?:[\x1D\u001D\{GS\}\|\^\s_,.;:-]|(?=93))93(.{4})$/i;

    let match = cleanCode.match(dataMatrixRegex);

    // Альтернативный regex для более гибкого поиска
    const flexibleRegex = /^01(\d{14})21(\d{1})(.{6}).*?93(.{4})/i;

    console.log({ dataMatrixCode, cleanCode, match });

    if (!match) {
      match = cleanCode.match(flexibleRegex);

      if (!match) {
        console.error('Invalid DataMatrix format', cleanCode);
        return null;
      }
    }

    return {
      gtin: match[1], // 14 цифр после "01"
      countryCode: match[2], // 1 цифра после "21"
      serialNumber: match[3], // 6 символов после кода страны
      verificationCode: match[4], // 4 символа после "93"
      rawData: dataMatrixCode,
    };
  } catch (error) {
    console.error('Error parsing DataMatrix code:', error);
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
