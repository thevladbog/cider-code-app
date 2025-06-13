import fs from 'fs';
import path from 'path';

import { app } from 'electron';

// Типы данных для бэкапа
interface BackupItem {
  code: string;           // Код продукции или упаковки
  type: 'product' | 'package'; // Тип кода (продукция или упаковка)
  timestamp: number;      // Время сканирования/создания
  shiftId: string; 
  /* eslint-disable */       // ID смены
  additionalData?: any;   // Дополнительные данные (если нужно)
}

// Путь к директории для бэкапов
const getBackupDir = (): string => {
  // Используем папку userData приложения для хранения бэкапов
  const userDataPath = app.getPath('userData');
  const backupPath = path.join(userDataPath, 'backups');
  
  // Создаем директорию, если она не существует
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  
  return backupPath;
};

/**
 * Создает имя файла для бэкапа на основе даты и смены
 * 
 * @param shiftId - ID смены
 * @returns Имя файла
 */
const getBackupFileName = (shiftId: string): string => {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `backup_${date}_shift_${shiftId}.json`;
};

/**
 * Сохраняет данные в файл бэкапа
 * 
 * @param data - Массив данных для сохранения
 * @param filePath - Путь к файлу
 */
const saveToFile = (data: BackupItem[], filePath: string): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving backup data:', error);
    throw error;
  }
};

/**
 * Читает данные из файла бэкапа
 * 
 * @param filePath - Путь к файлу
 * @returns Массив данных или пустой массив, если файл не существует
 */
const readFromFile = (filePath: string): BackupItem[] => {
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
 * Сохраняет информацию о сканированном коде в локальный бэкап
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
  try {
    const backupDir = getBackupDir();
    const fileName = getBackupFileName(shiftId);
    const filePath = path.join(backupDir, fileName);
    
    // Читаем существующие данные
    const existingData = readFromFile(filePath);
    
    // Создаем новую запись
    const newItem: BackupItem = {
      code,
      type,
      timestamp: Date.now(),
      shiftId,
      additionalData
    };
    
    // Добавляем новую запись и сохраняем
    existingData.push(newItem);
    saveToFile(existingData, filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error saving code to backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Получает все сохраненные коды для определенной смены
 * 
 * @param shiftId - ID смены
 * @returns Массив сохраненных кодов
 */
export const getBackupCodesByShift = (shiftId: string): BackupItem[] => {
  try {
    const backupDir = getBackupDir();
    const fileName = getBackupFileName(shiftId);
    const filePath = path.join(backupDir, fileName);
    
    return readFromFile(filePath);
  } catch (error) {
    console.error('Error getting backup codes:', error);
    return [];
  }
};

/**
 * Получает все файлы бэкапов
 * 
 * @returns Массив объектов с информацией о файлах
 */
export const getAllBackupFiles = (): { fileName: string; filePath: string; size: number; modifiedDate: Date }[] => {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json'));
    
    return files.map(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        fileName: file,
        filePath,
        size: stats.size,
        modifiedDate: new Date(stats.mtime)
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
    const backupDir = getBackupDir();
    const fileName = getBackupFileName(shiftId);
    const sourcePath = path.join(backupDir, fileName);
    
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Backup file does not exist' };
    }
    
    // Копируем файл в указанное место
    fs.copyFileSync(sourcePath, exportPath);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Удаляет бэкап смены
 * 
 * @param shiftId - ID смены
 * @returns Результат операции
 */
export const deleteBackup = (
  shiftId: string
): { success: boolean; error?: string } => {
  try {
    const backupDir = getBackupDir();
    const fileName = getBackupFileName(shiftId);
    const filePath = path.join(backupDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Backup file does not exist' };
    }
    
    // Удаляем файл
    fs.unlinkSync(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
