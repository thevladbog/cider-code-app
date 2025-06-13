import { packCodes, verifyPackage } from '../api/queries';
import { DataMatrixData, IShiftScheme, PackageWithSSCC } from '../types';

// Хранение упаковочных кодов в памяти
interface PackagingCache {
  [shiftId: string]: {
    currentBatch: DataMatrixData[]; // Текущая партия товаров для упаковки
    packages: PackageWithSSCC[]; // Завершенные упаковки
  };
}

// Храним данные в памяти
const packagingCache: PackagingCache = {};

/**
 * Инициализирует кэш для смены, если он еще не существует
 *
 * @param shiftId - ID смены
 */
function initCacheForShift(shiftId: string): void {
  if (!packagingCache[shiftId]) {
    packagingCache[shiftId] = {
      currentBatch: [],
      packages: [],
    };
  }
}

/**
 * Добавляет отсканированный код в текущую партию
 *
 * @param shiftId - ID смены
 * @param data - Данные DataMatrix
 * @returns Текущее количество кодов в партии
 */
export function addToCurrentBatch(shiftId: string, data: DataMatrixData): number {
  initCacheForShift(shiftId);

  // Создаем уникальный ключ для кода и проверяем, что он не дублируется в текущей партии
  const codeKey = `${data.gtin}_${data.countryCode}${data.serialNumber}`;
  const isDuplicate = packagingCache[shiftId].currentBatch.some(
    item => `${item.gtin}_${item.countryCode}${item.serialNumber}` === codeKey
  );

  if (!isDuplicate) {
    packagingCache[shiftId].currentBatch.push(data);
  }

  return packagingCache[shiftId].currentBatch.length;
}

/**
 * Запрашивает упаковку кодов с бэкенда и создает новую упаковку из текущей партии
 *
 * @param shiftId - ID смены
 * @param productId - ID продукта для упаковки
 * @returns Промис с данными созданной упаковки или null, если партия пуста
 */
export async function createPackageWithSSCC(
  shiftId: string,
  productId: string
): Promise<PackageWithSSCC | null> {
  initCacheForShift(shiftId);

  const currentBatch = packagingCache[shiftId].currentBatch;

  if (currentBatch.length === 0) {
    return null;
  }

  // Собираем коды продуктов в упаковке
  const itemCodes = currentBatch.map(
    item => `${item.gtin}_${item.countryCode}${item.serialNumber}`
  );
  // Запрашиваем упаковку кодов с бэкенда
  try {
    // Генерируем временный SSCC код (в реальном приложении это должно быть на бэкенде)
    const tempSSCC = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const response = await packCodes({
      id: Date.now(), // Временный ID
      ssccCode: tempSSCC,
      codes: itemCodes,
      shiftId,
      productId, // Используем переданный productId
    });

    // Создаем объект упаковки
    const newPackage: PackageWithSSCC = {
      sscc: response.ssccCode,
      items: itemCodes,
      timestamp: Date.now(),
    };

    // Добавляем упаковку в список и очищаем текущую партию
    packagingCache[shiftId].packages.push(newPackage);
    packagingCache[shiftId].currentBatch = [];

    return newPackage;
  } catch (error) {
    console.error('Error creating package with SSCC:', error);
    throw error;
  }
}

/**
 * Проверяет, соответствует ли отсканированный код ожидаемому SSCC коду упаковки
 *
 * @param shiftId - ID смены
 * @param scannedCode - Отсканированный код
 * @param expectedSSCC - Ожидаемый SSCC код
 * @param operatorId - ID оператора (для записи верификации)
 * @returns Промис с результатом верификации
 */
export async function verifySSCCCode(
  shiftId: string,
  scannedCode: string,
  expectedSSCC: string,
  operatorId?: string
): Promise<boolean> {
  // Нормализуем коды перед сравнением (удаляем пробелы и т.д.)
  const normalizedScanned = scannedCode.trim().toUpperCase();
  const normalizedExpected = expectedSSCC.trim().toUpperCase();

  const isMatch = normalizedScanned === normalizedExpected;

  if (isMatch) {
    try {
      // Отправляем подтверждение верификации на бэкенд
      const result = await verifyPackage({
        shiftId,
        sscc: expectedSSCC,
        verifiedBy: operatorId,
      });

      if (!result.success) {
        console.error('Failed to verify package:', result.message);
        return false;
      }

      // Обновляем локальные данные
      const packageIndex = packagingCache[shiftId]?.packages.findIndex(
        p => p.sscc.toUpperCase() === normalizedExpected
      );

      if (packageIndex !== -1) {
        packagingCache[shiftId].packages[packageIndex].verifiedBy = operatorId;
        packagingCache[shiftId].packages[packageIndex].verifiedAt = Date.now();
      }

      return true;
    } catch (error) {
      console.error('Error verifying SSCC code:', error);
      return false;
    }
  }

  return false;
}

/**
 * Получает количество товаров в текущей партии
 *
 * @param shiftId - ID смены
 * @returns Количество товаров
 */
export function getCurrentBatchCount(shiftId: string): number {
  return packagingCache[shiftId]?.currentBatch.length || 0;
}

/**
 * Получает список упаковок для смены
 *
 * @param shiftId - ID смены
 * @returns Список упаковок
 */
export function getPackages(shiftId: string): PackageWithSSCC[] {
  return packagingCache[shiftId]?.packages || [];
}

/**
 * Очищает информацию о текущей партии
 *
 * @param shiftId - ID смены
 */
export function clearCurrentBatch(shiftId: string): void {
  if (packagingCache[shiftId]) {
    packagingCache[shiftId].currentBatch = [];
  }
}

/**
 * Заменяет переменные в ZPL шаблоне на реальные значения
 *
 * @param template - ZPL шаблон
 * @param variables - Объект с переменными для замены
 * @returns Сформированный ZPL код
 */
export function processZplTemplate(template: string, variables: Record<string, string>): string {
  let processedTemplate = template;

  // Заменяем переменные вида ${variable} на их значения
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    processedTemplate = processedTemplate.replace(regex, value);
  }

  return processedTemplate;
}

/**
 * Подготавливает данные для печати этикетки с SSCC
 *
 * @param shift - Смена
 * @param sscc - SSCC код упаковки
 * @param productCount - Количество продуктов в упаковке
 * @returns ZPL код для печати
 */
export function preparePackageLabelZpl(
  shift: IShiftScheme,
  sscc: string,
  productCount: number
): string {
  // Получаем шаблон ZPL
  const zplTemplate = ''; //shift.packaging.template.zplCode;

  // Текущая дата в формате DD.MM.YYYY
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Переменные для подстановки в шаблон
  const variables: Record<string, string> = {
    SSCC: sscc,
    PRODUCT_NAME: shift.product.fullName,
    PRODUCT_CODE: shift.product.gtin,
    DATE: currentDate,
    QUANTITY: productCount.toString(),
    BATCH: 'N/A',
    OPERATOR: shift.operatorId || 'Неизвестно',
  };

  // Обрабатываем шаблон
  return processZplTemplate(zplTemplate, variables);
}

/**
 * Получает информацию о прогрессе формирования упаковки
 *
 * @param shiftId - ID смены
 * @param packSize - Размер упаковки
 * @returns Объект с информацией о прогрессе
 */
export function getPackagingProgress(
  shiftId: string,
  packSize: number
): {
  currentCount: number;
  packSize: number;
  progress: number;
  isComplete: boolean;
} {
  const currentCount = getCurrentBatchCount(shiftId);
  const progress = (currentCount / packSize) * 100;
  const isComplete = currentCount >= packSize;

  return {
    currentCount,
    packSize,
    progress,
    isComplete,
  };
}

/**
 * Проверяет, была ли упаковка уже верифицирована
 *
 * @param shiftId - ID смены
 * @param sscc - SSCC код упаковки
 * @returns true, если упаковка верифицирована
 */
export function isPackageVerified(shiftId: string, sscc: string): boolean {
  const packages = getPackages(shiftId);
  const pkg = packages.find(p => p.sscc === sscc);

  return pkg?.verifiedBy !== undefined && pkg?.verifiedAt !== undefined;
}
