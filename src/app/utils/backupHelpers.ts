import { BackupItem } from '../types';

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
    console.error('Error backing up product code:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка сохранения'
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
    console.error('Error backing up package code:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка сохранения'
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
    console.error('Error getting backup codes:', error);
    return [];
  }
}

/**
 * Экспортирует бэкап смены в выбранное пользователем место
 * 
 * @param shiftId - ID смены
 * @returns Promise с результатом операции
 */
export async function exportShiftBackup(shiftId: string): Promise<{ success: boolean; error?: string; filePath?: string }> {
  try {
    return await window.electronAPI.exportBackup(shiftId);
  } catch (error) {
    console.error('Error exporting backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка экспорта'
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
    second: '2-digit'
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
    return direction === 'asc' 
      ? a.timestamp - b.timestamp 
      : b.timestamp - a.timestamp;
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
    lastTimestamp
  };
}
