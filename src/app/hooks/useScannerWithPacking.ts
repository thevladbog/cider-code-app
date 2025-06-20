import { useCallback, useEffect, useRef, useState } from 'react';
import { rendererLogger } from '../utils/simpleRendererLogger';

import {
  addCodeToScanHistory,
  checkDataMatrixCode,
  clearScanHistory,
  flashScreen,
  getScannedCodes,
  isCodeDuplicateInShift,
  removeCodesFromHistory,
  syncCacheWithBackup,
} from '../services/scanService';
import {
  addItemToCurrentBox,
  getCurrentBoxInfo,
  initializeSSCCForShift,
  isShiftInitializedForSSCC,
  packCurrentBoxAndGetNextSSCC,
  resetCurrentBox,
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
  // Получаем список отсканированных кодов - стабильная функция
  const getScanned = useCallback(() => {
    if (!shift?.id) return [];
    return getScannedCodes(shift.id);
  }, [shift?.id]);

  // Инициализируем состояние пустым массивом, чтобы избежать вызова getScanned при каждом рендере
  const [scannedCodes, setScannedCodes] = useState<DataMatrixData[]>([]);

  // Обновляем scannedCodes при изменении смены
  useEffect(() => {
    if (shift?.id) {
      // Синхронизируем кеш с бэкапом перед получением кодов
      syncCacheWithBackup(shift.id);
      setScannedCodes(getScanned());
    } else {
      setScannedCodes([]);
    }
  }, [shift?.id, getScanned]);
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
      rendererLogger.info('Shift initialized for packing. First box will use SSCC', { firstSSCC });
    } catch (error) {
      rendererLogger.error('Error initializing shift for packing', { error });
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

      rendererLogger.info('Scanned barcode', { barcode }); // Проверяем отсканированный код (без визуальных эффектов)
      const checkResult = checkDataMatrixCode(barcode, shift, true);

      // Асинхронная проверка дубликатов в бэкапе
      const isDuplicateAsync = await isCodeDuplicateInShift(shift.id, barcode);
      if (isDuplicateAsync && checkResult.data && !checkResult.isDuplicate) {
        checkResult.isDuplicate = true;
        checkResult.message = 'Этот код уже был отсканирован (async check)';
      }

      // Определяем визуальную реакцию после всех проверок
      if (checkResult.isDuplicate) {
        // Красное мигание для всех дубликатов (включая async check)
        flashScreen('red');
      } else if (!checkResult.isCorrectProduct) {
        // Оранжевое мигание для неправильного продукта
        flashScreen('orange');
      } else if (checkResult.isValid) {
        // Зеленое мигание только для успешных сканирований
        flashScreen('green');
      }

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
          // Добавляем код в кэш только если он прошел все проверки
          addCodeToScanHistory(shift.id, checkResult.data);

          // Обновляем список отсканированных кодов
          const updatedCodes = getScanned();
          setScannedCodes(updatedCodes);
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
              }); // Если короб заполнен, готовим его к упаковке (но не отправляем на бэкенд)
              if (boxResult.shouldPackBox) {
                // Получаем актуальные отсканированные коды
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shift,
      enabled,
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
  // Используем ref для предотвращения множественных инициализаций
  const autoInitRef = useRef<{ shiftId: string | null; initiated: boolean }>({
    shiftId: null,
    initiated: false,
  });

  useEffect(() => {
    if (
      isPackingMode &&
      shift &&
      enabled &&
      shift.id !== autoInitRef.current.shiftId &&
      !autoInitRef.current.initiated
    ) {
      autoInitRef.current.shiftId = shift.id;
      autoInitRef.current.initiated = true;

      initializeShiftForPacking().finally(() => {
        autoInitRef.current.initiated = false;
      });
    }

    // Сбрасываем при смене shift
    if (shift?.id !== autoInitRef.current.shiftId) {
      autoInitRef.current.initiated = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackingMode, shift?.id, enabled]);
  // Сбрасываем состояние сканирования
  const resetScan = useCallback(() => {
    setLastScannedCode(null);
    setScanMessage(null);
    setScanError(false);

    // Сбрасываем данные о текущем коробе
    if (shift?.id) {
      const currentBoxItemCount = currentBoxInfo?.boxItemCount || 0;

      // Получаем коды текущего короба (последние N кодов) из актуального состояния
      if (currentBoxItemCount > 0) {
        const currentScannedCodes = getScanned(); // Получаем актуальные данные
        const currentBoxCodes = currentScannedCodes.slice(-currentBoxItemCount);

        // Удаляем коды текущего короба из истории сканирования
        if (currentBoxCodes.length > 0) {
          removeCodesFromHistory(shift.id, currentBoxCodes);
        }

        // Обновляем состояние с актуальными данными
        setScannedCodes(getScanned());
      }

      resetCurrentBox(shift.id);
      // Обновляем информацию о коробе в UI
      const updatedBoxInfo = getCurrentBoxInfo(shift.id);
      setCurrentBoxInfo(updatedBoxInfo);

      console.log(
        `🔄 Reset current box: removed ${currentBoxItemCount} items from scan history and UI`
      );
    }
  }, [shift?.id, currentBoxInfo?.boxItemCount, getScanned]);

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
