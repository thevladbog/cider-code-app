import { useCallback, useEffect, useRef, useState } from 'react';

import { CodesService } from '../api/generated';
import { checkDataMatrixCode, clearScanHistory, getScannedCodes } from '../services/scanService';
import { DataMatrixData, IShiftScheme } from '../types';

interface UseScannerWithoutPackingOptions {
  shift: IShiftScheme | null;
  onScanSuccess?: (data: DataMatrixData) => void;
  onScanError?: (message: string) => void;
  onDuplicateScan?: (data: DataMatrixData) => void;
  onInvalidProduct?: (data: DataMatrixData) => void;
  onBatchSent?: (codes: string[], count: number) => void;
  enabled?: boolean;
  batchSize?: number; // Размер батча для отправки кодов (по умолчанию 1)
  autoSendDelay?: number; // Задержка автоматической отправки в секундах (по умолчанию 10)
}

interface UseScannerWithoutPackingResult {
  lastScannedCode: DataMatrixData | null;
  scannedCodes: DataMatrixData[];
  scanMessage: string | null;
  scanError: boolean;
  pendingCodes: string[]; // Коды, которые еще не отправлены на сервер
  isProcessing: boolean; // Флаг обработки запроса
  autoSendCountdown: number; // Обратный отсчет до автоматической отправки (в секундах)
  resetScan: () => void;
  clearHistory: () => void;
  sendPendingCodes: () => Promise<void>; // Принудительная отправка накопленных кодов
}

/**
 * Хук для обработки сканирования без упаковки в коробы
 * Отправляет коды через API /code/update-status
 */
export function useScannerWithoutPacking({
  shift,
  onScanSuccess,
  onScanError,
  onDuplicateScan,
  onInvalidProduct,
  onBatchSent,
  enabled = true,
  batchSize = 1, // По умолчанию отправляем каждый код сразу
  autoSendDelay = 10, // По умолчанию 10 секунд
}: UseScannerWithoutPackingOptions): UseScannerWithoutPackingResult {
  const [lastScannedCode, setLastScannedCode] = useState<DataMatrixData | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<boolean>(false);
  const [pendingCodes, setPendingCodes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [autoSendCountdown, setAutoSendCountdown] = useState<number>(0);

  // Рефы для таймера
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Получаем список отсканированных кодов
  const getScanned = useCallback(() => {
    if (!shift?.id) return [];
    return getScannedCodes(shift.id);
  }, [shift?.id]);

  const [scannedCodes, setScannedCodes] = useState<DataMatrixData[]>(getScanned());

  // Реф для предотвращения множественных одновременных запросов
  const processingRef = useRef(false);

  // Функция отправки кодов на сервер
  const sendCodesToServer = useCallback(
    async (codes: string[]) => {
      if (!shift?.id || codes.length === 0 || processingRef.current) {
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      try {
        console.log(`Sending ${codes.length} codes to server:`, codes);

        await CodesService.codeControllerUpdateCodesStatus({
          requestBody: {
            codes: codes,
            shiftId: shift.id,
            productId: shift.product?.id,
          },
        });

        console.log(`Successfully sent ${codes.length} codes to server`);

        // Убираем отправленные коды из pending
        setPendingCodes(prev => prev.filter(code => !codes.includes(code)));

        onBatchSent?.(codes, codes.length);

        setScanMessage(`Отправлено ${codes.length} кодов на сервер`);
        setScanError(false);
      } catch (error) {
        console.error('Error sending codes to server:', error);
        setScanMessage(`Ошибка отправки кодов: ${error}`);
        setScanError(true);
        throw error;
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [shift, onBatchSent]
  );

  // Функция для запуска автоматической отправки с таймером
  const startAutoSendTimer = useCallback(() => {
    // Очищаем предыдущие таймеры
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Устанавливаем начальное значение обратного отсчета
    setAutoSendCountdown(autoSendDelay);

    // Запускаем обратный отсчет (обновляем каждую секунду)
    countdownTimerRef.current = setInterval(() => {
      setAutoSendCountdown(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Запускаем таймер автоматической отправки
    autoSendTimerRef.current = setTimeout(() => {
      if (pendingCodes.length > 0) {
        sendCodesToServer([...pendingCodes]).catch(console.error);
      }
      setAutoSendCountdown(0);
    }, autoSendDelay * 1000);
  }, [autoSendDelay, pendingCodes, sendCodesToServer]);

  // Функция для остановки автоматической отправки
  const stopAutoSendTimer = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setAutoSendCountdown(0);
  }, []);

  // Принудительная отправка всех накопленных кодов
  const sendPendingCodes = useCallback(async () => {
    if (pendingCodes.length > 0) {
      stopAutoSendTimer(); // Останавливаем автоматический таймер
      await sendCodesToServer([...pendingCodes]);
    }
  }, [pendingCodes, sendCodesToServer, stopAutoSendTimer]);

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

          // Добавляем код в pending список
          const rawCode = checkResult.data.rawData;
          setPendingCodes(prev => [...prev, rawCode]);

          // Проверяем, нужно ли отправить батч
          const newPendingCount = pendingCodes.length + 1;
          if (newPendingCount >= batchSize) {
            // Отправляем батч немедленно
            const codesToSend = [...pendingCodes, rawCode];
            try {
              stopAutoSendTimer(); // Останавливаем таймер перед отправкой
              await sendCodesToServer(codesToSend);
            } catch (error) {
              console.error('Failed to send batch:', error);
              // При ошибке коды остаются в pending и можно попробовать отправить позже
            }
          } else {
            // Если батч не заполнен, запускаем таймер автоматической отправки
            startAutoSendTimer();
            setScanMessage(`Код добавлен. Автоотправка через ${autoSendDelay} сек.`);
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
      pendingCodes,
      batchSize,
      sendCodesToServer,
      startAutoSendTimer,
      stopAutoSendTimer,
      autoSendDelay,
    ]
  );

  // Подписываемся на события сканирования
  useEffect(() => {
    if (!enabled || !window.electronAPI?.onBarcodeScanned) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(handleBarcodeScan);
    return unsubscribe;
  }, [enabled, handleBarcodeScan]);

  // Автоматическая отправка pending кодов при изменении смены или отключении
  useEffect(() => {
    if (!enabled && pendingCodes.length > 0) {
      sendPendingCodes().catch(console.error);
    }
  }, [enabled, pendingCodes.length, sendPendingCodes]);

  // Cleanup таймеров при размонтировании компонента
  useEffect(() => {
    return () => {
      stopAutoSendTimer();
    };
  }, [stopAutoSendTimer]);

  // Сбрасываем состояние сканирования
  const resetScan = useCallback(() => {
    setLastScannedCode(null);
    setScanMessage(null);
    setScanError(false);
    stopAutoSendTimer(); // Останавливаем таймер при сбросе
  }, [stopAutoSendTimer]);

  // Очищаем историю сканирования для текущей смены
  const clearHistory = useCallback(() => {
    if (shift) {
      clearScanHistory(shift.id);
      setScannedCodes([]);
      setPendingCodes([]);
      stopAutoSendTimer(); // Останавливаем таймер при очистке
    }
  }, [shift, stopAutoSendTimer]);

  return {
    lastScannedCode,
    scannedCodes,
    scanMessage,
    scanError,
    pendingCodes,
    isProcessing,
    autoSendCountdown,
    resetScan,
    clearHistory,
    sendPendingCodes,
  };
}
