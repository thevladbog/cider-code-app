import { useCallback, useState } from 'react';

import { BackupItem } from '../types';
import {
  addProductCodeToSuccessfulScans,
  backupPackageCode,
  backupProductCode,
  exportShiftBackup,
  getAllScannedCodesForShift,
  getBackupCodesForShift,
  getSuccessfulScansForShift,
  isCodeScannedInShift,
  logActionToBackup,
  restoreShiftBackup,
} from '../utils/backupHelpers';

interface UseBackupOptions {
  shiftId: string;
  onBackupSuccess?: (type: 'product' | 'package', code: string) => void;
  onBackupError?: (error: string, type: 'product' | 'package', code: string) => void;
}

interface UseBackupResult {
  backupProduct: (code: string, additionalData?: any) => Promise<boolean>;
  backupPackage: (sscc: string, additionalData?: any) => Promise<boolean>;
  logAction: (code: string, action: string, additionalData?: any) => Promise<boolean>;
  logError: (
    code: string,
    type: 'product' | 'package',
    errorMessage: string,
    additionalData?: any
  ) => Promise<boolean>;
  loadBackupCodes: () => Promise<BackupItem[]>;
  exportBackup: () => Promise<boolean>;
  getSuccessfulScans: () => Promise<string>;
  restoreBackup: () => Promise<{
    generalLog: BackupItem[];
    successfulScans: string;
    canRestore: boolean;
  }>;
  addSSCCToSuccessfulScans: (ssccCode: string, prepend?: boolean) => Promise<boolean>;
  addProductToProductOnlyFile: (productCode: string) => Promise<boolean>;
  removeBoxFromBackup: (ssccCode: string, productCodes: string[]) => Promise<boolean>;
  // Новый метод для сохранения полной упаковки в момент верификации
  savePackageToBackup: (
    ssccCode: string,
    productCodes: string[],
    shiftId: string,
    timestamp?: number
  ) => Promise<boolean>; // Новые методы для проверки уникальности кодов
  checkCodeUniqueness: (
    code: string
  ) => Promise<{ isDuplicate: boolean; foundIn: 'backup' | null }>;
  getAllScannedCodes: () => Promise<string[]>;
  // Метод для добавления кода продукции в successful_scans.txt
  addProductCodeToSuccessfulScans: (productCode: string) => Promise<boolean>;
  isBackingUp: boolean;
  backupError: string | null;
  backupCodes: BackupItem[];
}

/**
 * Хук для работы с бэкапом кодов продукции и упаковок
 */
export function useBackup({
  shiftId,
  onBackupSuccess,
  onBackupError,
}: UseBackupOptions): UseBackupResult {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<BackupItem[]>([]);

  /**
   * Сохраняет код продукции в бэкап
   */
  const backupProduct = useCallback(
    async (
      code: string,
      /* eslint-disable */
      additionalData?: any
    ): Promise<boolean> => {
      setIsBackingUp(true);
      setBackupError(null);

      try {
        const result = await backupProductCode(code, shiftId, additionalData);

        if (result.success) {
          onBackupSuccess?.('product', code);
          return true;
        } else {
          const errorMessage = result.error || 'Unknown error during product backup';
          setBackupError(errorMessage);
          onBackupError?.(errorMessage, 'product', code);
          return false;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setBackupError(errorMessage);
        onBackupError?.(errorMessage, 'product', code);
        return false;
      } finally {
        setIsBackingUp(false);
      }
    },
    [shiftId, onBackupSuccess, onBackupError]
  );

  /**
   * Сохраняет SSCC код упаковки в бэкап
   */
  const backupPackage = useCallback(
    async (
      sscc: string,
      /* eslint-disable */
      additionalData?: any
    ): Promise<boolean> => {
      setIsBackingUp(true);
      setBackupError(null);

      try {
        const result = await backupPackageCode(sscc, shiftId, additionalData);

        if (result.success) {
          onBackupSuccess?.('package', sscc);
          return true;
        } else {
          const errorMessage = result.error || 'Unknown error during package backup';
          setBackupError(errorMessage);
          onBackupError?.(errorMessage, 'package', sscc);
          return false;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setBackupError(errorMessage);
        onBackupError?.(errorMessage, 'package', sscc);
        return false;
      } finally {
        setIsBackingUp(false);
      }
    },
    [shiftId, onBackupSuccess, onBackupError]
  );

  /**
   * Загружает все сохраненные коды для текущей смены
   */
  const loadBackupCodes = useCallback(async (): Promise<BackupItem[]> => {
    try {
      const codes = await getBackupCodesForShift(shiftId);
      setBackupCodes(codes);
      return codes;
    } catch (error) {
      console.error('Error loading backup codes:', error);
      return [];
    }
  }, [shiftId]);

  /**
   * Экспортирует бэкап смены
   */
  const exportBackup = useCallback(async (): Promise<boolean> => {
    try {
      const result = await exportShiftBackup(shiftId);
      return result.success;
    } catch (error) {
      console.error('Error exporting backup:', error);
      return false;
    }
  }, [shiftId]);

  /**
   * Логирует ошибку сканирования в бэкап
   */
  const logError = useCallback(
    async (
      code: string,
      type: 'product' | 'package',
      errorMessage: string,
      /* eslint-disable */
      additionalData?: any
    ): Promise<boolean> => {
      setIsBackingUp(true);
      setBackupError(null);

      try {
        const result = await logActionToBackup(
          code,
          type,
          shiftId,
          'error',
          errorMessage,
          additionalData
        );

        if (result.success) {
          onBackupError?.(errorMessage, type, code);
          return true;
        } else {
          const error = result.error || 'Unknown error during error logging';
          setBackupError(error);
          return false;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setBackupError(errorMsg);
        return false;
      } finally {
        setIsBackingUp(false);
      }
    },
    [shiftId, onBackupError]
  );

  /**
   * Логирует произвольное действие в бэкап
   */
  const logAction = useCallback(
    async (code: string, action: string, additionalData?: any): Promise<boolean> => {
      setIsBackingUp(true);
      setBackupError(null);

      try {
        const result = await logActionToBackup(
          code,
          'product', // Тип по умолчанию
          shiftId,
          'success',
          action,
          additionalData
        );

        if (result.success) {
          return true;
        } else {
          const error = result.error || 'Unknown error during action logging';
          setBackupError(error);
          return false;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setBackupError(errorMsg);
        return false;
      } finally {
        setIsBackingUp(false);
      }
    },
    [shiftId]
  );

  /**
   * Получает содержимое файла успешных сканирований
   */
  const getSuccessfulScans = useCallback(async (): Promise<string> => {
    try {
      return await getSuccessfulScansForShift(shiftId);
    } catch (error) {
      console.error('Error getting successful scans:', error);
      return '';
    }
  }, [shiftId]);
  /**
   * Восстанавливает данные из бэкапа
   */
  const restoreBackup = useCallback(async (): Promise<{
    generalLog: BackupItem[];
    successfulScans: string;
    canRestore: boolean;
  }> => {
    try {
      return await restoreShiftBackup(shiftId);
    } catch (error) {
      console.error('Error restoring backup:', error);
      return {
        generalLog: [],
        successfulScans: '',
        canRestore: false,
      };
    }
  }, [shiftId]); /**
   * Добавляет SSCC код в файл успешных сканирований
   * @param ssccCode - SSCC код
   * @param prepend - Добавить в начало файла (для нового сканирования) или в конец (для нового короба)
   */
  const addSSCCToSuccessfulScans = useCallback(
    async (ssccCode: string, prepend: boolean = false): Promise<boolean> => {
      try {
        // В backupService.ts уже интегрирована функция переупорядочивания,
        // поэтому здесь не нужно отдельно вызывать reorderSuccessfulScans
        // Третий параметр prepend пока не поддерживается в API, игнорируем его
        const result = await window.electronAPI.addSSCCToSuccessfulScans(ssccCode, shiftId);
        return result.success;
      } catch (error) {
        console.error('Error adding SSCC to successful scans:', error);
        return false;
      }
    },
    [shiftId]
  );

  /**
   * Добавляет код продукции в файл только с продукцией
   */
  const addProductToProductOnlyFile = useCallback(
    async (productCode: string): Promise<boolean> => {
      try {
        const result = await window.electronAPI.addProductToProductOnlyFile(productCode, shiftId);
        return result.success;
      } catch (error) {
        console.error('Error adding product to product-only file:', error);
        return false;
      }
    },
    [shiftId]
  );

  /**
   * Удаляет короб и все его содержимое из файлов бэкапа
   */
  const removeBoxFromBackup = useCallback(
    async (ssccCode: string, productCodes: string[]): Promise<boolean> => {
      try {
        const result = await window.electronAPI.removeBoxFromBackup(
          ssccCode,
          productCodes,
          shiftId
        );
        return result.success;
      } catch (error) {
        console.error('Error removing box from backup:', error);
        return false;
      }
    },
    [shiftId]
  );
  /**
   * Сохраняет полную упаковку (SSCC + коды продукции) в момент верификации
   */ const savePackageToBackup = useCallback(
    async (
      ssccCode: string,
      productCodes: string[],
      shiftId: string,
      timestamp?: number
    ): Promise<boolean> => {
      setIsBackingUp(true);
      setBackupError(null);

      try {
        const result = await window.electronAPI.savePackageToBackup(
          ssccCode,
          productCodes,
          shiftId,
          timestamp
        );

        if (result.success) {
          onBackupSuccess?.('package', ssccCode);
          return true;
        } else {
          const errorMessage = result.error || 'Unknown error during package backup';
          setBackupError(errorMessage);
          onBackupError?.(errorMessage, 'package', ssccCode);
          return false;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setBackupError(errorMessage);
        onBackupError?.(errorMessage, 'package', ssccCode);
        return false;
      } finally {
        setIsBackingUp(false);
      }
    },
    [shiftId, onBackupSuccess, onBackupError]
  );

  /**
   * Проверяет уникальность кода в рамках текущей смены
   */
  const checkCodeUniqueness = useCallback(
    async (code: string) => {
      return await isCodeScannedInShift(code, shiftId);
    },
    [shiftId]
  );

  /**
   * Получает все отсканированные коды для текущей смены
   */ const getAllScannedCodes = useCallback(async () => {
    return await getAllScannedCodesForShift(shiftId);
  }, [shiftId]);

  /**
   * Добавляет код продукции в файл successful_scans.txt
   */
  const addProductCodeToSuccessfulScansMethod = useCallback(
    async (productCode: string) => {
      try {
        const result = await addProductCodeToSuccessfulScans(productCode, shiftId);
        return result.success;
      } catch (error) {
        console.error('Error adding product code to successful scans:', error);
        return false;
      }
    },
    [shiftId]
  );

  // reorderSuccessfulScans интегрирована в backupService

  return {
    backupProduct,
    backupPackage,
    logAction,
    logError,
    loadBackupCodes,
    exportBackup,
    getSuccessfulScans,
    restoreBackup,
    addSSCCToSuccessfulScans,
    addProductToProductOnlyFile,
    removeBoxFromBackup,
    savePackageToBackup,
    checkCodeUniqueness,
    getAllScannedCodes,
    addProductCodeToSuccessfulScans: addProductCodeToSuccessfulScansMethod,
    isBackingUp,
    backupError,
    backupCodes,
  };
}
