import { useState, useCallback } from 'react';

import { BackupItem } from '../types';
import { 
  backupProductCode, 
  backupPackageCode, 
  getBackupCodesForShift, 
  exportShiftBackup,
} from '../utils/backupHelpers';

interface UseBackupOptions {
  shiftId: string;
  onBackupSuccess?: (type: 'product' | 'package', code: string) => void;
  onBackupError?: (error: string, type: 'product' | 'package', code: string) => void;
}

interface UseBackupResult {
  /* eslint-disable */
  backupProduct: (code: string, additionalData?: any) => Promise<boolean>;
  /* eslint-disable */
  backupPackage: (sscc: string, additionalData?: any) => Promise<boolean>;
  loadBackupCodes: () => Promise<BackupItem[]>;
  exportBackup: () => Promise<boolean>;
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
  onBackupError 
}: UseBackupOptions): UseBackupResult {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<BackupItem[]>([]);
  
  /**
   * Сохраняет код продукции в бэкап
   */
  const backupProduct = useCallback(async (
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
  }, [shiftId, onBackupSuccess, onBackupError]);
  
  /**
   * Сохраняет SSCC код упаковки в бэкап
   */
  const backupPackage = useCallback(async (
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
  }, [shiftId, onBackupSuccess, onBackupError]);
  
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
  
  return {
    backupProduct,
    backupPackage,
    loadBackupCodes,
    exportBackup,
    isBackingUp,
    backupError,
    backupCodes
  };
}
