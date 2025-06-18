import { BackupItem } from '../types';
import { rendererLogger } from './simpleRendererLogger';

/**
 * Сохраняет код продукции в локальный бэкап
 *
 * @param code - Код продукции (Datamatrix)
 * @param shiftId - ID смены
 * @param additionalData - Дополнительная информация (опционально)
 * @returns Promise с результатом операции
 */
export async function backupProductCode(
  code: string,
  shiftId: string,
  /* eslint-disable */
  additionalData?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Вызываем метод из Electron API
    return await window.electronAPI.saveCodeToBackup(code, 'product', shiftId, additionalData);
  } catch (error) {
    rendererLogger.error('Error backing up product code', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сохранения',
    };
  }
}

/**
 * Сохраняет код упаковки (SSCC) в локальный бэкап
 *
 * @param sscc - SSCC код упаковки
 * @param shiftId - ID смены
 * @param additionalData - Дополнительная информация (например, список кодов продукции в упаковке)
 * @returns Promise с результатом операции
 */
export async function backupPackageCode(
  sscc: string,
  shiftId: string,
  /* eslint-disable */
  additionalData?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Вызываем метод из Electron API
    return await window.electronAPI.saveCodeToBackup(sscc, 'package', shiftId, additionalData);
  } catch (error) {
    rendererLogger.error('Error backing up package code', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сохранения',
    };
  }
}

/**
 * Получает все сохраненные коды для определенной смены
 *
 * @param shiftId - ID смены
 * @returns Promise с массивом сохраненных кодов
 */
export async function getBackupCodesForShift(shiftId: string): Promise<BackupItem[]> {
  try {
    return await window.electronAPI.getBackupCodesByShift(shiftId);
  } catch (error) {
    rendererLogger.error('Error getting backup codes', { error });
    return [];
  }
}

/**
 * Экспортирует бэкап смены в выбранное пользователем место
 *
 * @param shiftId - ID смены
 * @returns Promise с результатом операции
 */
export async function exportShiftBackup(
  shiftId: string
): Promise<{ success: boolean; error?: string; filePath?: string }> {
  try {
    return await window.electronAPI.exportBackup(shiftId);
  } catch (error) {
    rendererLogger.error('Error exporting backup', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка экспорта',
    };
  }
}

/**
 * Форматирует дату из временной метки для отображения
 *
 * @param timestamp - Временная метка в миллисекундах
 * @returns Отформатированная строка даты и времени
 */
export function formatBackupTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Группирует элементы бэкапа по типу
 *
 * @param backupItems - Массив элементов бэкапа
 * @returns Объект с группированными элементами
 */
export function groupBackupItemsByType(backupItems: BackupItem[]): {
  products: BackupItem[];
  packages: BackupItem[];
} {
  return backupItems.reduce(
    (acc, item) => {
      if (item.type === 'product') {
        acc.products.push(item);
      } else if (item.type === 'package') {
        acc.packages.push(item);
      }
      return acc;
    },
    { products: [] as BackupItem[], packages: [] as BackupItem[] }
  );
}

/**
 * Сортирует элементы бэкапа по времени
 *
 * @param backupItems - Массив элементов бэкапа
 * @param direction - Направление сортировки ('asc' или 'desc')
 * @returns Отсортированный массив
 */
export function sortBackupItemsByTime(
  backupItems: BackupItem[],
  direction: 'asc' | 'desc' = 'desc'
): BackupItem[] {
  return [...backupItems].sort((a, b) => {
    return direction === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
}

/**
 * Статистика по бэкапу
 *
 * @param backupItems - Массив элементов бэкапа
 * @returns Объект со статистикой
 */
export function getBackupStats(backupItems: BackupItem[]): {
  totalItems: number;
  productItems: number;
  packageItems: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
} {
  const grouped = groupBackupItemsByType(backupItems);

  const timestamps = backupItems.map(item => item.timestamp);
  const firstTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const lastTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    totalItems: backupItems.length,
    productItems: grouped.products.length,
    packageItems: grouped.packages.length,
    firstTimestamp,
    lastTimestamp,
  };
}

/**
 * Логирует действие с кодом (успешное или неуспешное)
 *
 * @param code - Код продукции или упаковки
 * @param type - Тип кода
 * @param shiftId - ID смены
 * @param status - Статус обработки
 * @param errorMessage - Сообщение об ошибке (если есть)
 * @param additionalData - Дополнительная информация
 * @returns Promise с результатом операции
 */
export async function logActionToBackup(
  code: string,
  type: 'product' | 'package',
  shiftId: string,
  status: 'success' | 'error',
  errorMessage?: string,
  /* eslint-disable */
  additionalData?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    return await window.electronAPI.logAction(
      code,
      type,
      shiftId,
      status,
      errorMessage,
      additionalData
    );
  } catch (error) {
    rendererLogger.error('Error logging action to backup', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка логирования',
    };
  }
}

/**
 * Получает содержимое файла успешных сканирований
 *
 * @param shiftId - ID смены
 * @returns Promise с содержимым файла
 */
export async function getSuccessfulScansForShift(shiftId: string): Promise<string> {
  try {
    return await window.electronAPI.getSuccessfulScansContent(shiftId);
  } catch (error) {
    rendererLogger.error('Error getting successful scans', { error });
    return '';
  }
}

/**
 * Восстанавливает данные из бэкапа
 *
 * @param shiftId - ID смены
 * @returns Promise с данными для восстановления
 */
export async function restoreShiftBackup(shiftId: string): Promise<{
  generalLog: BackupItem[];
  successfulScans: string;
  canRestore: boolean;
}> {
  try {
    return await window.electronAPI.restoreBackupData(shiftId);
  } catch (error) {
    rendererLogger.error('Error restoring backup', { error });
    return {
      generalLog: [],
      successfulScans: '',
      canRestore: false,
    };
  }
}

/**
 * Получает статистику по бэкапу с разделением на успешные и неуспешные операции
 *
 * @param backupItems - Массив элементов бэкапа
 * @returns Объект с расширенной статистикой
 */
export function getExtendedBackupStats(backupItems: BackupItem[]): {
  totalItems: number;
  successfulItems: number;
  errorItems: number;
  productItems: number;
  packageItems: number;
  successfulProducts: number;
  successfulPackages: number;
  errorProducts: number;
  errorPackages: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
} {
  const successful = backupItems.filter(item => item.status === 'success');
  const errors = backupItems.filter(item => item.status === 'error');

  const successfulProducts = successful.filter(item => item.type === 'product');
  const successfulPackages = successful.filter(item => item.type === 'package');
  const errorProducts = errors.filter(item => item.type === 'product');
  const errorPackages = errors.filter(item => item.type === 'package');

  const timestamps = backupItems.map(item => item.timestamp);
  const firstTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const lastTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    totalItems: backupItems.length,
    successfulItems: successful.length,
    errorItems: errors.length,
    productItems: backupItems.filter(item => item.type === 'product').length,
    packageItems: backupItems.filter(item => item.type === 'package').length,
    successfulProducts: successfulProducts.length,
    successfulPackages: successfulPackages.length,
    errorProducts: errorProducts.length,
    errorPackages: errorPackages.length,
    firstTimestamp,
    lastTimestamp,
  };
}

/**
 * Парсит содержимое файла успешных сканирований для отображения
 * В новом формате коды продукции добавляются без отступов,
 * а SSCC коды определяются по их формату (обычно 18+ цифр)
 *
 * @param content - Содержимое файла
 * @returns Массив объектов с информацией о сканированных кодах
 */
export function parseSuccessfulScansContent(content: string): {
  type: 'box' | 'product';
  code: string;
  isInBox?: boolean;
}[] {
  if (!content.trim()) return [];

  const lines = content.split('\n').filter(line => line.trim());
  const result: { type: 'box' | 'product'; code: string; isInBox?: boolean }[] = [];

  let currentBoxIndex = -1; // Индекс текущего короба в результирующем массиве

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Проверяем, является ли строка SSCC кодом (обычно длиннее 18 символов и состоит из цифр)
    const isPossibleSSCC = line.length >= 18 && /^\d{18,}/.test(line);

    if (isPossibleSSCC) {
      // Это SSCC код короба
      currentBoxIndex = result.length; // Запоминаем индекс этого короба

      result.push({
        type: 'box',
        code: line,
        isInBox: false,
      });
    } else {
      // Это код продукции
      if (currentBoxIndex >= 0) {
        // Если уже был встречен короб, то этот код - продукция в коробе
        result.push({
          type: 'product',
          code: line,
          isInBox: true,
        });
      } else {
        // Если короб еще не был встречен, то это отдельная продукция
        result.push({
          type: 'product',
          code: line,
          isInBox: false,
        });
      }
    }
  }

  return result;
}

/**
 * Проверяет, был ли код уже отсканирован в рамках текущей смены
 * Проверяет как локальные бэкапы, так и данные с бэкенда
 *
 * @param code - Код для проверки
 * @param shiftId - ID смены
 * @returns Promise с результатом проверки
 */
export async function isCodeScannedInShift(
  code: string,
  shiftId: string
): Promise<{ isDuplicate: boolean; foundIn: 'backup' | null }> {
  try {
    // Сначала проверяем локальные бэкапы
    const backupCodes = await getBackupCodesForShift(shiftId);
    const foundInBackup = backupCodes.some(item => item.code === code);

    if (foundInBackup) {
      return { isDuplicate: true, foundIn: 'backup' };
    }

    // Проверяем успешные сканы из файла
    const successfulScans = await getSuccessfulScansForShift(shiftId);
    const scannedCodes = successfulScans.split('\n').filter(line => line.trim() !== '');
    const foundInScans = scannedCodes.includes(code);

    if (foundInScans) {
      return { isDuplicate: true, foundIn: 'backup' }; // Считаем это тоже бэкапом
    }

    return { isDuplicate: false, foundIn: null };
  } catch (error) {
    rendererLogger.error('Error checking code uniqueness', { error });
    // В случае ошибки возвращаем false, чтобы не блокировать работу
    return { isDuplicate: false, foundIn: null };
  }
}

/**
 * Получает все уникальные коды, отсканированные в рамках смены
 * Объединяет данные из бэкапов и файла успешных сканов
 *
 * @param shiftId - ID смены
 * @returns Promise с массивом уникальных кодов
 */
export async function getAllScannedCodesForShift(shiftId: string): Promise<string[]> {
  try {
    const allCodes = new Set<string>();

    // Добавляем коды из бэкапов
    const backupCodes = await getBackupCodesForShift(shiftId);
    backupCodes.forEach(item => {
      if (item.type === 'product') {
        allCodes.add(item.code);
      }
    });

    // Добавляем коды из файла успешных сканов
    const successfulScans = await getSuccessfulScansForShift(shiftId);
    const scannedCodes = successfulScans.split('\n').filter(line => line.trim() !== '');
    scannedCodes.forEach(code => allCodes.add(code));

    return Array.from(allCodes);
  } catch (error) {
    rendererLogger.error('Error getting all scanned codes', { error });
    return [];
  }
}

/**
 * Добавляет код продукции в файл successful_scans.txt
 *
 * @param productCode - Код продукции для добавления
 * @param shiftId - ID смены
 * @returns Promise с результатом операции
 */
export async function addProductCodeToSuccessfulScans(
  productCode: string,
  shiftId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    rendererLogger.info('Adding product code to successful_scans.txt', {
      productCode,
      shiftId,
    });

    // Проверяем, что код не пустой
    if (!productCode || productCode.trim() === '') {
      rendererLogger.error('Cannot add empty product code to successful_scans.txt');
      return { success: false, error: 'Product code is empty' };
    }

    // Используем существующий API для добавления в successful_scans.txt
    const result = await window.electronAPI.addSSCCToSuccessfulScans(productCode, shiftId);
    rendererLogger.info('Product code added to successful_scans.txt', { productCode });
    return { success: true };
  } catch (error) {
    rendererLogger.error('Error adding product code to successful_scans.txt', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Удаляет последние N кодов продукции из бэкапа смены
 * TODO: Implement this function when backend API is ready
 *
 * @param shiftId - ID смены
 * @param count - Количество кодов для удаления (начиная с последних)
 * @returns Promise с результатом операции
 */
export async function removeLastCodesFromBackup(
  shiftId: string,
  count: number
): Promise<{ success: boolean; error?: string }> {
  try {
    rendererLogger.info('Removing last codes from backup', { count, shiftId });

    if (count <= 0) {
      return { success: true };
    }

    // TODO: Implement API call when backend is ready
    // const result = await window.electronAPI.removeLastCodesFromBackup(shiftId, count);

    rendererLogger.warn(
      'removeLastCodesFromBackup not implemented yet - codes may remain in backup'
    );
    return {
      success: false,
      error: 'Function not implemented yet - codes remain in backup',
    };
  } catch (error) {
    rendererLogger.error('Error removing codes from backup', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
