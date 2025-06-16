// Условные импорты - только в main процессе
/* eslint-disable @typescript-eslint/no-explicit-any */
let fs: any = null;
let path: any = null;
/* eslint-enable @typescript-eslint/no-explicit-any */
let app: { getPath: (name: string) => string } | null = null;

// Импорт централизованного логгера
import { logger } from './services/loggerService';

// Проверяем, работаем ли мы в main процессе (Node.js среда)
const isMainProcess = typeof window === 'undefined' && typeof process !== 'undefined';

if (isMainProcess) {
  try {
    fs = require('fs');
    path = require('path');
    const electron = require('electron');
    app = electron.app;
  } catch (error) {
    logger.error('Failed to load Node.js modules', {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
  }
}

// Типы данных для бэкапа
interface BackupItem {
  code: string; // Код продукции или упаковки
  type: 'product' | 'package'; // Тип кода (продукция или упаковка)
  timestamp: number; // Время сканирования/создания
  shiftId: string; // ID смены
  /* eslint-disable */
  additionalData?: any; // Дополнительные данные (если нужно)
  rawCode?: string; // Исходный raw код со всеми символами
  status: 'success' | 'error'; // Статус обработки кода
  errorMessage?: string; // Сообщение об ошибке (если есть)
}

// Интерфейс для элемента успешно отсканированного кода
interface SuccessfulScanItem {
  code: string; // Raw код со всеми символами
  type: 'product' | 'package';
  timestamp: number;
  boxCode?: string; // Код короба (если продукт в коробе)
}

// Путь к директории для бэкапов (теперь с датой и ID смены)
const getBackupDir = (shiftId: string): string => {
  // В renderer процессе возвращаем безопасное значение
  if (!isMainProcess || !app || !path || !fs) {
    return '';
  }

  const userDataPath = app.getPath('userData');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupPath = path.join(userDataPath, 'backups', today, shiftId);

  // Создаем директорию, если она не существует
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  return backupPath;
};

/**
 * Получает путь к файлу общего лога
 */
const getGeneralLogPath = (shiftId: string): string => {
  if (!isMainProcess || !path) {
    return '';
  }
  const backupDir = getBackupDir(shiftId);
  return backupDir ? path.join(backupDir, 'general_log.json') : '';
};

/**
 * Получает путь к файлу успешно отсканированных кодов
 */
const getSuccessfulScansPath = (shiftId: string): string => {
  if (!isMainProcess || !path) {
    return '';
  }
  const backupDir = getBackupDir(shiftId);
  return backupDir ? path.join(backupDir, 'successful_scans.txt') : '';
};

/**
 * Сохраняет данные в файл общего лога
 *
 * @param data - Массив данных для сохранения
 * @param filePath - Путь к файлу
 */
const saveToGeneralLog = (data: BackupItem[], filePath: string): void => {
  if (!isMainProcess || !fs || !filePath) {
    return;
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving backup data:', error);
    throw error;
  }
};

/**
 * Добавляет успешно отсканированный код в текстовый файл
 *
 * @param item - Элемент для добавления
 * @param filePath - Путь к файлу
 * @param boxCode - Код короба (если есть)
 */
/**
 * Добавляет успешный код в файл успешных сканирований
 * Для правильного порядка: SSCC, затем коды продукции
 */
const appendToSuccessfulScans = (item: SuccessfulScanItem, filePath: string): void => {
  try {
    let logEntry = '';

    if (item.type === 'product' && item.boxCode) {
      // Если это продукт в коробе, добавляем без отступа
      logEntry = `${item.code}\n`;
    } else if (item.type === 'product' && !item.boxCode) {
      // Если это продукт без короба (обычное сканирование)
      logEntry = `${item.code}\n`;
    } // Для type === 'package' не добавляем ничего, SSCC добавляется через addSSCCToSuccessfulScans

    if (logEntry) {
      // Добавляем новую запись в файл
      fs.appendFileSync(filePath, logEntry, 'utf-8');

      // Не вызываем reorderSuccessfulScans здесь, так как это может вызывать конфликты
      // Переупорядочивание должно происходить только при добавлении SSCC кодов
    }
  } catch (error) {
    console.error('Error appending to successful scans:', error);
    throw error;
  }
};

/**
 * Читает данные из файла общего лога
 *
 * @param filePath - Путь к файлу
 * @returns Массив данных или пустой массив, если файл не существует
 */
const readFromGeneralLog = (filePath: string): BackupItem[] => {
  if (!isMainProcess || !fs || !filePath) {
    return [];
  }

  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as BackupItem[];
  } catch (error) {
    console.error('Error reading backup data:', error);
    return [];
  }
};

/**
 * Логирует действие в общий лог (все действия - успешные и неуспешные)
 *
 * @param code - Код продукции или упаковки
 * @param type - Тип кода (продукция или упаковка)
 * @param shiftId - ID смены
 * @param status - Статус обработки
 * @param errorMessage - Сообщение об ошибке (если есть)
 * @param additionalData - Дополнительные данные (опционально)
 * @returns Результат операции
 */
export const logAction = (
  code: string,
  type: 'product' | 'package',
  shiftId: string,
  status: 'success' | 'error',
  errorMessage?: string,
  /* eslint-disable */
  additionalData?: any
): { success: boolean; error?: string } => {
  // В renderer процессе не можем работать с файловой системой
  if (!isMainProcess) {
    return { success: true }; // Возвращаем успех, чтобы не ломать логику
  }

  try {
    const logPath = getGeneralLogPath(shiftId);
    if (!logPath) {
      return { success: false, error: 'Cannot get log path' };
    }

    // Читаем существующие данные
    const existingData = readFromGeneralLog(logPath);

    // Создаем новую запись
    const newItem: BackupItem = {
      code,
      type,
      timestamp: Date.now(),
      shiftId,
      rawCode: code, // Сохраняем raw код
      status,
      errorMessage,
      additionalData,
    }; // Добавляем новую запись и сохраняем
    existingData.push(newItem);
    saveToGeneralLog(existingData, logPath);

    // Если операция успешная, добавляем в файл успешных сканирований
    if (status === 'success') {
      // ВАЖНО: Данные в файл успешных сканирований добавляются только через
      // savePackageToBackup() в момент верификации упаковки.
      // Здесь мы НЕ добавляем данные, чтобы избежать дублирования и неправильного порядка.

      console.log(
        `Success logged for ${type} code: ${code}, but not added to successful_scans.txt yet`
      );

      // Коды будут добавлены в файлы только при вызове savePackageToBackup()
    }

    return { success: true };
  } catch (error) {
    console.error('Error logging action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Сохраняет информацию о сканированном коде в локальный бэкап
 * (оставлено для обратной совместимости)
 *
 * @param code - Код продукции или упаковки
 * @param type - Тип кода (продукция или упаковка)
 * @param shiftId - ID смены
 * @param additionalData - Дополнительные данные (опционально)
 * @returns Результат операции
 */
export const saveCodeToBackup = (
  code: string,
  type: 'product' | 'package',
  shiftId: string,
  /* eslint-disable */
  additionalData?: any
): { success: boolean; error?: string } => {
  // Используем новую функцию логирования с успешным статусом
  return logAction(code, type, shiftId, 'success', undefined, additionalData);
};

/**
 * Получает все сохраненные коды для определенной смены
 *
 * @param shiftId - ID смены
 * @returns Массив сохраненных кодов
 */
export const getBackupCodesByShift = (shiftId: string): BackupItem[] => {
  if (!isMainProcess) {
    return []; // В renderer процессе возвращаем пустой массив
  }

  try {
    const logPath = getGeneralLogPath(shiftId);
    if (!logPath) {
      return [];
    }
    return readFromGeneralLog(logPath);
  } catch (error) {
    console.error('Error getting backup codes:', error);
    return [];
  }
};

/**
 * Получает все файлы бэкапов по дням
 *
 * @returns Массив объектов с информацией о папках по дням
 */
export const getAllBackupFiles = (): {
  date: string;
  shifts: {
    shiftId: string;
    hasGeneralLog: boolean;
    hasSuccessfulScans: boolean;
    generalLogSize?: number;
    successfulScansSize?: number;
    modifiedDate?: Date;
  }[];
}[] => {
  try {
    if (!isMainProcess || !app || !fs || !path) {
      // В renderer процессе возвращаем пустой массив
      return [];
    }

    const userDataPath = app.getPath('userData');
    const backupsDir = path.join(userDataPath, 'backups');

    if (!fs.existsSync(backupsDir)) {
      return [];
    }

    const dateDirs = fs.readdirSync(backupsDir).filter((item: string) => {
      const fullPath = path.join(backupsDir, item);
      return fs.statSync(fullPath).isDirectory();
    });

    return dateDirs.map((date: string) => {
      const datePath = path.join(backupsDir, date);
      const shiftDirs = fs.readdirSync(datePath).filter((item: string) => {
        const fullPath = path.join(datePath, item);
        return fs.statSync(fullPath).isDirectory();
      });

      const shifts = shiftDirs.map((shiftId: string) => {
        const shiftPath = path.join(datePath, shiftId);
        const generalLogPath = path.join(shiftPath, 'general_log.json');
        const successfulScansPath = path.join(shiftPath, 'successful_scans.txt');

        const hasGeneralLog = fs.existsSync(generalLogPath);
        const hasSuccessfulScans = fs.existsSync(successfulScansPath);

        let generalLogSize: number | undefined;
        let successfulScansSize: number | undefined;
        let modifiedDate: Date | undefined;

        if (hasGeneralLog) {
          const stats = fs.statSync(generalLogPath);
          generalLogSize = stats.size;
          modifiedDate = new Date(stats.mtime);
        }

        if (hasSuccessfulScans) {
          const stats = fs.statSync(successfulScansPath);
          successfulScansSize = stats.size;
          if (!modifiedDate) {
            modifiedDate = new Date(stats.mtime);
          }
        }

        return {
          shiftId,
          hasGeneralLog,
          hasSuccessfulScans,
          generalLogSize,
          successfulScansSize,
          modifiedDate,
        };
      });

      return {
        date,
        shifts,
      };
    });
  } catch (error) {
    console.error('Error getting backup files:', error);
    return [];
  }
};

/**
 * Экспортирует бэкап в указанное место
 *
 * @param shiftId - ID смены
 * @param exportPath - Путь для экспорта
 * @returns Результат операции
 */
export const exportBackup = (
  shiftId: string,
  exportPath: string
): { success: boolean; error?: string } => {
  try {
    const backupDir = getBackupDir(shiftId);

    if (!fs.existsSync(backupDir)) {
      return { success: false, error: 'Backup directory does not exist' };
    }

    // Создаем папку для экспорта
    const exportDir = path.join(exportPath, `backup_${shiftId}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Копируем все файлы из папки бэкапа
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      const sourcePath = path.join(backupDir, file);
      const destPath = path.join(exportDir, file);
      fs.copyFileSync(sourcePath, destPath);
    }

    return { success: true };
  } catch (error) {
    console.error('Error exporting backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Удаляет бэкап смены
 *
 * @param shiftId - ID смены
 * @returns Результат операции
 */
export const deleteBackup = (shiftId: string): { success: boolean; error?: string } => {
  try {
    const backupDir = getBackupDir(shiftId);

    if (!fs.existsSync(backupDir)) {
      return { success: false, error: 'Backup directory does not exist' };
    }

    // Удаляем всю папку с файлами
    fs.rmSync(backupDir, { recursive: true, force: true });

    return { success: true };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Получает содержимое файла успешных сканирований для смены
 *
 * @param shiftId - ID смены
 * @returns Содержимое файла или пустая строка
 */
export const getSuccessfulScansContent = (shiftId: string): string => {
  if (!isMainProcess || !fs) {
    return ''; // В renderer процессе возвращаем пустую строку
  }

  try {
    const successPath = getSuccessfulScansPath(shiftId);
    if (!successPath) {
      return '';
    }

    if (!fs.existsSync(successPath)) {
      return '';
    }

    return fs.readFileSync(successPath, 'utf-8');
  } catch (error) {
    console.error('Error reading successful scans:', error);
    return '';
  }
};

/**
 * Восстанавливает данные из файлов бэкапа
 *
 * @param shiftId - ID смены
 * @returns Объект с данными для восстановления
 */
export const restoreBackupData = (
  shiftId: string
): {
  generalLog: BackupItem[];
  successfulScans: string;
  canRestore: boolean;
} => {
  try {
    const generalLog = getBackupCodesByShift(shiftId);
    const successfulScans = getSuccessfulScansContent(shiftId);

    return {
      generalLog,
      successfulScans,
      canRestore: generalLog.length > 0 || successfulScans.length > 0,
    };
  } catch (error) {
    console.error('Error restoring backup data:', error);
    return {
      generalLog: [],
      successfulScans: '',
      canRestore: false,
    };
  }
};

/**
 * Добавляет SSCC код короба в файл успешных сканирований с контролем порядка добавления
 *
 * @param ssccCode - SSCC код короба
 * @param shiftId - ID смены
 * @param prepend - Добавить в начало файла (для нового сканирования) или в конец (для нового короба)
 * @returns Результат операции
 */
export const addSSCCToSuccessfulScans = (
  ssccCode: string,
  shiftId: string,
  prepend: boolean = false
): { success: boolean; error?: string } => {
  if (!isMainProcess || !fs) {
    return { success: true }; // В renderer процессе возвращаем успех
  }

  try {
    const successPath = getSuccessfulScansPath(shiftId);
    if (!successPath) {
      return { success: false, error: 'Cannot get success path' };
    }

    const logEntry = `${ssccCode}\n`;

    // Всегда добавляем в конец файла, а затем переупорядочиваем
    fs.appendFileSync(successPath, logEntry, 'utf-8');

    console.log(`Added SSCC ${ssccCode} to file, now reordering...`);

    // После добавления SSCC, переупорядочиваем файл для обеспечения
    // правильного порядка: SSCC, затем коды продукции
    reorderSuccessfulScans(shiftId);

    return { success: true };
  } catch (error) {
    console.error('Error adding SSCC to successful scans:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Получает путь к файлу только с кодами продукции
 */
const getProductOnlyPath = (shiftId: string): string => {
  if (!isMainProcess || !path) {
    return '';
  }
  const backupDir = getBackupDir(shiftId);
  return backupDir ? path.join(backupDir, 'products_only.txt') : '';
};

/**
 * Добавляет код продукции в файл только с продукцией
 */
export const addProductToProductOnlyFile = (productCode: string, shiftId: string): void => {
  if (!isMainProcess || !fs) {
    return; // В renderer процессе ничего не делаем
  }

  try {
    const productOnlyPath = getProductOnlyPath(shiftId);
    if (!productOnlyPath) {
      return;
    }
    const logEntry = `${productCode}\n`;
    fs.appendFileSync(productOnlyPath, logEntry, 'utf-8');
  } catch (error) {
    console.error('Error appending to product-only file:', error);
    throw error;
  }
};

/**
 * Удаляет короб и все его содержимое из файлов бэкапа
 */
export const removeBoxFromBackup = (
  ssccCode: string,
  productCodes: string[],
  shiftId: string
): { success: boolean; error?: string } => {
  if (!isMainProcess || !fs) {
    return { success: true }; // В renderer процессе возвращаем успех
  }

  try {
    const successPath = getSuccessfulScansPath(shiftId);
    const productOnlyPath = getProductOnlyPath(shiftId);

    if (!successPath || !productOnlyPath) {
      return { success: false, error: 'Cannot get backup paths' };
    }

    // Читаем содержимое файлов
    let successContent = '';
    let productOnlyContent = '';

    if (fs.existsSync(successPath)) {
      successContent = fs.readFileSync(successPath, 'utf-8');
    }

    if (fs.existsSync(productOnlyPath)) {
      productOnlyContent = fs.readFileSync(productOnlyPath, 'utf-8');
    } // Удаляем SSCC код и его продукты из файла с коробами
    const lines = successContent.split('\n');
    const updatedLines: string[] = [];
    let skipProducts = false;

    for (const line of lines) {
      if (line.trim() === ssccCode) {
        skipProducts = true; // Начинаем пропускать продукты этого короба
        continue;
      }

      // Если мы пропускаем продукты и встретили код из списка продуктов этого короба
      if (skipProducts && productCodes.includes(line.trim())) {
        continue;
      }

      // Если встретили новый SSCC код (начинается с определенных цифр), прекращаем пропускать
      if (skipProducts && line.trim() !== '' && line.trim().length >= 18) {
        // Проверяем, может ли это быть SSCC код (обычно длиннее 18 символов)
        const possibleSSCC = line.trim();
        if (possibleSSCC.match(/^\d{18,}/)) {
          skipProducts = false;
        }
      }

      if (!skipProducts && line.trim() !== '') {
        updatedLines.push(line);
      }
    }

    // Удаляем коды продукции из файла только с продукцией
    let updatedProductContent = productOnlyContent;
    for (const productCode of productCodes) {
      const regex = new RegExp(`^${productCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm');
      updatedProductContent = updatedProductContent.replace(regex, '');
    }

    // Убираем лишние пустые строки
    updatedProductContent = updatedProductContent.replace(/\n\s*\n/g, '\n').trim();
    if (updatedProductContent) {
      updatedProductContent += '\n';
    }

    // Записываем обновленные файлы
    fs.writeFileSync(
      successPath,
      updatedLines.join('\n') + (updatedLines.length > 0 ? '\n' : ''),
      'utf-8'
    );
    fs.writeFileSync(productOnlyPath, updatedProductContent, 'utf-8');

    return { success: true };
  } catch (error) {
    console.error('Error removing box from backup:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Переупорядочивает файл успешных сканирований, обеспечивая правильный порядок:
 * SSCC код, затем коды продукции для этого короба
 *
 * @param shiftId - ID смены
 * @returns Результат операции
 */
export const reorderSuccessfulScans = (shiftId: string): { success: boolean; error?: string } => {
  if (!isMainProcess || !fs) {
    return { success: true }; // В renderer процессе возвращаем успех
  }

  try {
    const successPath = getSuccessfulScansPath(shiftId);
    if (!successPath) {
      return { success: false, error: 'Cannot get success path' };
    }

    if (!fs.existsSync(successPath)) {
      return { success: true }; // Файл не существует, ничего делать не надо
    }
    const content = fs.readFileSync(successPath, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim() !== '');

    console.log('Original file content before reordering:', lines);

    if (lines.length === 0) {
      console.log('File is empty, nothing to reorder');
      return { success: true }; // Файл пустой, ничего делать не надо
    }

    // Анализируем строки и определяем SSCC коды и продукцию
    const ssccCodes: string[] = [];
    const productsBySSCC: { [ssccCode: string]: string[] } = {};
    const productsWithoutSSCC: string[] = [];
    let currentSSCC: string | null = null; // Первый проход - классифицируем строки
    for (const line of lines) {
      // SSCC код обычно имеет 18 цифр и начинается с цифр (без букв)
      const isPossibleSSCC = line.length === 18 && /^\d{18}$/.test(line);

      if (isPossibleSSCC) {
        ssccCodes.push(line);
        console.log('Found SSCC code:', line);
      } else {
        productsWithoutSSCC.push(line);
        console.log('Found product code:', line);
      }
    }

    // Если нет ни одного SSCC, возвращаем как есть
    if (ssccCodes.length === 0) {
      return { success: true };
    }

    // Если нет кодов продукции, возвращаем как есть
    if (productsWithoutSSCC.length === 0) {
      return { success: true };
    }
    console.log(
      `Reordering: Found ${ssccCodes.length} SSCC codes and ${productsWithoutSSCC.length} products`
    );

    // Правильный порядок: SSCC код должен идти ПЕРЕД кодами продукции
    const result: string[] = [];

    // Если есть SSCC коды, берем последний (текущий короб)
    if (ssccCodes.length > 0) {
      const currentSSCC = ssccCodes[ssccCodes.length - 1];
      result.push(currentSSCC);
    }

    // Затем добавляем все коды продукции (они относятся к текущему SSCC)
    result.push(...productsWithoutSSCC);
    console.log('Reordered content (SSCC first, then products):', result);

    // Записываем отсортированное содержимое обратно в файл
    fs.writeFileSync(successPath, result.join('\n') + '\n', 'utf-8');

    console.log('File reordering completed successfully');

    return { success: true };
  } catch (error) {
    console.error('Error reordering successful scans:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Тестовая функция для проверки правильности переупорядочивания
 * (только для отладки)
 */
export const testReorderLogic = (shiftId: string): void => {
  console.log('=== TESTING REORDER LOGIC ===');

  // Создаем тестовое содержимое файла (неправильный порядок)
  const testContent = [
    '0104680089900239215ZQtc4P93wSkH',
    '0104680089900239215OWS>dq93Vynx',
    '0104680089900239215qHh1pR93N/2h',
    '046800899000003292',
  ];

  const successPath = getSuccessfulScansPath(shiftId);

  // Записываем тестовое содержимое
  fs.writeFileSync(successPath, testContent.join('\n') + '\n', 'utf-8');
  console.log('Created test file with content:', testContent);

  // Применяем переупорядочивание
  const result = reorderSuccessfulScans(shiftId);
  console.log('Reorder result:', result);

  // Читаем результат
  const finalContent = fs.readFileSync(successPath, 'utf-8');
  console.log(
    'Final file content:',
    finalContent.split('\n').filter((line: string) => line.trim() !== '')
  );
  console.log('=== END TEST ===');
};

/**
 * Записывает данные упаковки в файлы бэкапа в момент верификации
 * Это основная функция для формирования правильного порядка в файлах
 *
 * @param ssccCode - SSCC код короба
 * @param productCodes - Массив кодов продукции в коробе
 * @param shiftId - ID смены
 * @param timestamp - Время упаковки (опционально)
 * @returns Результат операции
 */
export const savePackageToBackup = (
  ssccCode: string,
  productCodes: string[],
  shiftId: string,
  timestamp?: number
): { success: boolean; error?: string } => {
  if (!isMainProcess || !fs) {
    return { success: true }; // В renderer процессе возвращаем успех
  }

  try {
    const currentTime = timestamp || Date.now();
    const successPath = getSuccessfulScansPath(shiftId);
    const productOnlyPath = getProductOnlyPath(shiftId);
    const generalLogPath = getGeneralLogPath(shiftId);

    if (!successPath || !productOnlyPath || !generalLogPath) {
      return { success: false, error: 'Cannot get backup paths' };
    }

    // 1. Формируем правильный порядок для файла successful_scans.txt
    const successfulContent: string[] = [];

    // Сначала SSCC код
    successfulContent.push(ssccCode);

    // Затем все коды продукции
    successfulContent.push(...productCodes); // Записываем в файл успешных сканирований (добавляем к существующему содержимому)
    const newContent = successfulContent.join('\n') + '\n';
    fs.appendFileSync(successPath, newContent, 'utf-8');

    // 2. Добавляем только коды продукции в файл products_only.txt
    const productOnlyContent = productCodes.join('\n') + '\n';
    fs.appendFileSync(productOnlyPath, productOnlyContent, 'utf-8');

    // 3. Записываем в общий лог JSON
    const existingLog = readFromGeneralLog(generalLogPath);

    // Добавляем запись о SSCC коде
    const ssccLogItem: BackupItem = {
      code: ssccCode,
      type: 'package',
      timestamp: currentTime,
      shiftId,
      rawCode: ssccCode,
      status: 'success',
      additionalData: {
        productCodes,
        productCount: productCodes.length,
        packTime: new Date(currentTime).toISOString(),
      },
    };

    existingLog.push(ssccLogItem);

    // Добавляем записи о кодах продукции
    productCodes.forEach(productCode => {
      const productLogItem: BackupItem = {
        code: productCode,
        type: 'product',
        timestamp: currentTime,
        shiftId,
        rawCode: productCode,
        status: 'success',
        additionalData: {
          boxCode: ssccCode,
          packTime: new Date(currentTime).toISOString(),
        },
      };
      existingLog.push(productLogItem);
    }); // Сохраняем обновленный общий лог
    saveToGeneralLog(existingLog, generalLogPath);

    return { success: true };
  } catch (error) {
    console.error('Error saving package to backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Очищает файлы бэкапа для указанной смены (только для тестирования)
 */
export const clearBackupFiles = (shiftId: string): { success: boolean; error?: string } => {
  if (!isMainProcess || !fs || !path) {
    return { success: true }; // В renderer процессе возвращаем успех
  }

  try {
    const backupDir = getBackupDir(shiftId);
    if (!backupDir) {
      return { success: false, error: 'Cannot get backup directory' };
    }

    const filesToClear = [
      path.join(backupDir, 'successful_scans.txt'),
      path.join(backupDir, 'products_only.txt'),
      path.join(backupDir, 'general_log.json'),
    ];

    filesToClear.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf-8');
        console.log(`Cleared file: ${filePath}`);
      }
    });

    console.log(`Backup files cleared for shift: ${shiftId}`);
    return { success: true };
  } catch (error) {
    console.error('Error clearing backup files:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Проверяет, был ли код уже отсканирован в рамках смены (по данным из бэкапа)
 */
export function isCodeAlreadyScannedInBackup(shiftId: string, code: string): boolean {
  // В renderer процессе всегда возвращаем false (полагаемся на кеш)
  if (!isMainProcess || !fs || !path) {
    return false;
  }

  try {
    const successfulScansPath = getSuccessfulScansPath(shiftId);

    // Добавляем проверку на пустой путь
    if (!successfulScansPath || !fs.existsSync(successfulScansPath)) {
      return false;
    }

    const data = fs.readFileSync(successfulScansPath, 'utf8');

    // Читаем файл как plain text и разбиваем по строкам
    const scannedCodes = data
      .trim()
      .split('\n')
      .filter((line: string) => line.trim() !== '');

    // Проверяем, есть ли код в списке уже отсканированных
    return scannedCodes.includes(code);
  } catch (error) {
    console.error('Error checking code in backup:', error);
    // В случае ошибки считаем, что код не сканировался
    return false;
  }
}

/**
 * Получает все отсканированные коды из бэкапа для смены
 */
export function getAllScannedCodesFromBackup(shiftId: string): SuccessfulScanItem[] {
  // В renderer процессе всегда возвращаем пустой массив (полагаемся на кеш)
  if (!isMainProcess || !fs || !path) {
    return [];
  }

  try {
    const successfulScansPath = getSuccessfulScansPath(shiftId);

    // Добавляем проверку на пустой путь
    if (!successfulScansPath || !fs.existsSync(successfulScansPath)) {
      return [];
    }

    const data = fs.readFileSync(successfulScansPath, 'utf8');

    // Читаем файл как plain text и разбиваем по строкам
    const scannedCodes = data
      .trim()
      .split('\n')
      .filter((line: string) => line.trim() !== '');

    // Преобразуем в SuccessfulScanItem[], создавая объекты с минимальной информацией
    return scannedCodes.map((code: string) => ({
      code: code.trim(),
      type: 'product' as const, // Устанавливаем по умолчанию, так как из файла эту информацию получить нельзя
      timestamp: 0, // Устанавливаем 0, так как из файла эту информацию получить нельзя
    }));
  } catch (error) {
    console.error('Error reading scanned codes from backup:', error);
    return [];
  }
}
