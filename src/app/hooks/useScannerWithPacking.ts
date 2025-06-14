import { useCallback, useEffect, useRef, useState } from 'react';

import { checkDataMatrixCode, clearScanHistory, getScannedCodes } from '../services/scanService';
import {
  addItemToCurrentBox,
  getCurrentBoxInfo,
  initializeSSCCForShift,
  isShiftInitializedForSSCC,
  packCurrentBoxAndGetNextSSCC,
} from '../services/ssccService';
import { DataMatrixData, IShiftScheme } from '../types';

interface UseScannerWithPackingOptions {
  shift: IShiftScheme | null;
  onScanSuccess?: (data: DataMatrixData) => void;
  onScanError?: (message: string) => void;
  onDuplicateScan?: (data: DataMatrixData) => void;
  onInvalidProduct?: (data: DataMatrixData) => void;
  onBoxReadyToPack?: (currentSSCC: string, itemCodes: string[]) => void; // Короб готов к упаковке (нужна верификация)
  onBoxPacked?: (packedSSCC: string, nextSSCC: string, itemCodes: string[]) => void; // Короб окончательно упакован
  onSSCCInitialized?: (sscc: string) => void;
  enabled?: boolean;
}

interface UseScannerWithPackingResult {
  lastScannedCode: DataMatrixData | null;
  scannedCodes: DataMatrixData[];
  scanMessage: string | null;
  scanError: boolean;
  currentBoxInfo: {
    currentSSCC: string | null;
    boxItemCount: number;
    maxBoxCount: number;
  } | null;
  isPackingMode: boolean;
  resetScan: () => void;
  clearHistory: () => void;
  initializeShiftForPacking: () => Promise<void>;
  confirmBoxPacking: (ssccCode: string, itemCodes: string[]) => Promise<string>; // Подтверждает упаковку после верификации
}

/**
 * Хук для обработки сканирования с поддержкой упаковки в коробы
 */
export function useScannerWithPacking({
  shift,
  onScanSuccess,
  onScanError,
  onDuplicateScan,
  onInvalidProduct,
  onBoxReadyToPack,
  onBoxPacked,
  onSSCCInitialized,
  enabled = true,
}: UseScannerWithPackingOptions): UseScannerWithPackingResult {
  const [lastScannedCode, setLastScannedCode] = useState<DataMatrixData | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<boolean>(false);
  const [currentBoxInfo, setCurrentBoxInfo] = useState<{
    currentSSCC: string | null;
    boxItemCount: number;
    maxBoxCount: number;
  } | null>(null);

  // Определяем, работаем ли мы в режиме упаковки
  const isPackingMode = shift?.packing === true;

  // Получаем список отсканированных кодов
  const getScanned = useCallback(() => {
    if (!shift?.id) return [];
    return getScannedCodes(shift.id);
  }, [shift?.id]);

  const [scannedCodes, setScannedCodes] = useState<DataMatrixData[]>(getScanned());
  const initializationRef = useRef<{ shiftId: string | null; isInitializing: boolean }>({
    shiftId: null,
    isInitializing: false,
  });

  // Инициализация смены для упаковки
  const initializeShiftForPacking = useCallback(async () => {
    if (!shift || !isPackingMode || !shift.countInBox) {
      return;
    }

    // Проверяем, не инициализируется ли уже эта смена или не была ли уже инициализирована
    if (
      initializationRef.current.isInitializing ||
      (initializationRef.current.shiftId === shift.id && isShiftInitializedForSSCC(shift.id))
    ) {
      return;
    }

    initializationRef.current.isInitializing = true;
    initializationRef.current.shiftId = shift.id;

    try {
      // Проверяем, не инициализирована ли уже смена
      if (isShiftInitializedForSSCC(shift.id)) {
        // Обновляем информацию о текущем коробе
        const boxInfo = getCurrentBoxInfo(shift.id);
        setCurrentBoxInfo(boxInfo);
        return;
      }

      // GLN теперь необязательный параметр
      // const gln = '1234567890123'; // Можно получать из настроек если нужно

      const firstSSCC = await initializeSSCCForShift(
        shift.id,
        shift.product.id,
        shift.countInBox
        // GLN не передаем, так как он необязательный
      );

      // Обновляем информацию о коробе
      const boxInfo = getCurrentBoxInfo(shift.id);
      setCurrentBoxInfo(boxInfo);

      onSSCCInitialized?.(firstSSCC);
      console.log('Shift initialized for packing. First box will use SSCC:', firstSSCC);
    } catch (error) {
      console.error('Error initializing shift for packing:', error);
      setScanMessage(`Ошибка инициализации упаковки: ${error}`);
      setScanError(true);
      // Сбрасываем флаги при ошибке
      initializationRef.current.isInitializing = false;
      initializationRef.current.shiftId = null;
    } finally {
      initializationRef.current.isInitializing = false;
    }
  }, [shift, isPackingMode, onSSCCInitialized]);

  // Обработчик сканирования
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
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

        if (checkResult.isDuplicate) {
          onDuplicateScan?.(checkResult.data);
        } else if (!checkResult.isCorrectProduct) {
          onInvalidProduct?.(checkResult.data);
        } else if (checkResult.isValid) {
          // Обновляем список отсканированных кодов
          setScannedCodes(getScanned());
          onScanSuccess?.(checkResult.data);

          // Если это режим упаковки, обрабатываем логику коробов
          if (isPackingMode && shift.countInBox) {
            try {
              // Используем исходный отсканированный код (rawData)
              const originalCode = checkResult.data.rawData;

              // Добавляем товар в текущий короб
              const boxResult = addItemToCurrentBox(shift.id, originalCode);

              // Обновляем информацию о коробе
              setCurrentBoxInfo({
                currentSSCC: boxResult.currentSSCC,
                boxItemCount: boxResult.currentBoxItemCount,
                maxBoxCount: boxResult.maxBoxCount,
              });

              // Если короб заполнен, готовим его к упаковке (но не отправляем на бэкенд)
              if (boxResult.shouldPackBox) {
                const currentScannedCodes = getScanned();
                // Используем исходные rawData кодов для упаковки
                const lastBoxCodes = currentScannedCodes
                  .slice(-shift.countInBox)
                  .map(item => item.rawData);

                // Вместо немедленной упаковки, уведомляем о готовности к упаковке
                if (boxResult.currentSSCC) {
                  onBoxReadyToPack?.(boxResult.currentSSCC, lastBoxCodes);
                }

                setScanMessage(
                  `Короб готов к упаковке: ${boxResult.currentSSCC}. Отсканируйте SSCC для подтверждения.`
                );
              } else {
                setScanMessage(
                  `Товар добавлен в короб: ${boxResult.currentBoxItemCount}/${boxResult.maxBoxCount}`
                );
              }
            } catch (error) {
              console.error('Error handling box packing:', error);
              setScanMessage(`Ошибка упаковки: ${error}`);
              setScanError(true);
            }
          }
        }
      } else if (!checkResult.isValid) {
        onScanError?.(checkResult.message || 'Ошибка сканирования');
      }
    },
    [
      shift,
      enabled,
      getScanned,
      onScanSuccess,
      onScanError,
      onDuplicateScan,
      onInvalidProduct,
      onBoxReadyToPack,
      isPackingMode,
    ]
  );

  // Подписываемся на события сканирования
  useEffect(() => {
    if (!enabled || !window.electronAPI?.onBarcodeScanned) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(handleBarcodeScan);
    return unsubscribe;
  }, [enabled, handleBarcodeScan]);

  // Сбрасываем состояние инициализации при смене shift
  useEffect(() => {
    initializationRef.current.shiftId = null;
    initializationRef.current.isInitializing = false;
  }, [shift?.id]);

  // Автоматическая инициализация при открытии смены в режиме упаковки
  useEffect(() => {
    if (
      isPackingMode &&
      shift &&
      enabled &&
      initializationRef.current.shiftId !== shift.id &&
      !initializationRef.current.isInitializing
    ) {
      initializeShiftForPacking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackingMode, shift, enabled]);

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

  // Подтверждение упаковки после верификации SSCC
  const confirmBoxPacking = useCallback(
    async (ssccCode: string, itemCodes: string[]): Promise<string> => {
      if (!shift) {
        throw new Error('Нет данных смены');
      }

      try {
        const packResult = await packCurrentBoxAndGetNextSSCC(shift.id, itemCodes);

        // Обновляем информацию о коробе с новым SSCC
        const updatedBoxInfo = getCurrentBoxInfo(shift.id);
        setCurrentBoxInfo(updatedBoxInfo);

        onBoxPacked?.(packResult.packedSSCC, packResult.nextSSCC, itemCodes);

        setScanMessage(
          `Короб упакован: ${packResult.packedSSCC}. Новый короб: ${packResult.nextSSCC}`
        );

        return packResult.nextSSCC;
      } catch (error) {
        console.error('Error confirming box packing:', error);
        setScanMessage(`Ошибка упаковки: ${error}`);
        setScanError(true);
        throw error;
      }
    },
    [shift, onBoxPacked]
  );

  return {
    lastScannedCode,
    scannedCodes,
    scanMessage,
    scanError,
    currentBoxInfo,
    isPackingMode,
    resetScan,
    clearHistory,
    initializeShiftForPacking,
    confirmBoxPacking,
  };
}
