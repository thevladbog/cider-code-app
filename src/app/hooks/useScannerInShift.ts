import { useState, useEffect, useCallback } from 'react';

import { checkDataMatrixCode, getScannedCodes, clearScanHistory } from '../services/scanService';
import { DataMatrixData, IShiftScheme } from '../types';

interface UseScannerInShiftOptions {
  shift: IShiftScheme | null;
  onScanSuccess?: (data: DataMatrixData) => void;
  onScanError?: (message: string) => void;
  onDuplicateScan?: (data: DataMatrixData) => void;
  onInvalidProduct?: (data: DataMatrixData) => void;
  enabled?: boolean;
}

interface UseScannerInShiftResult {
  lastScannedCode: DataMatrixData | null;
  scannedCodes: DataMatrixData[];
  scanMessage: string | null;
  scanError: boolean;
  resetScan: () => void;
  clearHistory: () => void;
}

/**
 * Хук для обработки сканирования Datamatrix кодов в рамках смены
 */
export function useScannerInShift({
  shift,
  onScanSuccess,
  onScanError,
  onDuplicateScan,
  onInvalidProduct,
  enabled = true,
}: UseScannerInShiftOptions): UseScannerInShiftResult {
  const [lastScannedCode, setLastScannedCode] = useState<DataMatrixData | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<boolean>(false);

  // Получаем список отсканированных кодов
  const getScanned = useCallback(() => {
    if (!shift) return [];
    return getScannedCodes(shift.id);
  }, [shift]);

  const [scannedCodes, setScannedCodes] = useState<DataMatrixData[]>(getScanned());

  // Обработчик сканирования
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      if (!shift || !enabled) return;

      console.log('Scanned barcode:', barcode);

      // Проверяем отсканированный код
      const checkResult = checkDataMatrixCode(barcode, shift);

      // Устанавливаем сообщение
      setScanMessage(checkResult.message || null);

      // Обновляем состояние ошибки
      setScanError(
        !checkResult.isValid || !checkResult.isCorrectProduct || checkResult.isDuplicate
      );

      if (checkResult.data) {
        setLastScannedCode(checkResult.data);

        // Обновляем список отсканированных кодов

        if (checkResult.isDuplicate) {
          // Вызываем колбэк для дубликата
          onDuplicateScan?.(checkResult.data);
        } else if (!checkResult.isCorrectProduct) {
          // Вызываем колбэк для неверного продукта
          onInvalidProduct?.(checkResult.data);
        } else if (checkResult.isValid) {
          // Вызываем колбэк для успешного сканирования
          setScannedCodes(getScanned());
          onScanSuccess?.(checkResult.data);
        }
      } else if (!checkResult.isValid) {
        // Вызываем колбэк ошибки
        onScanError?.(checkResult.message || 'Ошибка сканирования');
      }
    },
    [shift, enabled, getScanned, onScanSuccess, onScanError, onDuplicateScan, onInvalidProduct]
  );

  // Подписываемся на события сканирования
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(handleBarcodeScan);
    return unsubscribe;
  }, [enabled, handleBarcodeScan]);

  // Сбрасываем состояние сканирования
  const resetScan = useCallback(() => {
    setLastScannedCode(null);
    setScanMessage(null);
    setScanError(false);
  }, []);

  // Очищаем историю сканирования для текущей смены
  const clearHistory = useCallback(() => {
    if (shift) {
      clearScanHistory(shift.id);
      setScannedCodes([]);
    }
  }, [shift]);

  return {
    lastScannedCode,
    scannedCodes,
    scanMessage,
    scanError,
    resetScan,
    clearHistory,
  };
}
