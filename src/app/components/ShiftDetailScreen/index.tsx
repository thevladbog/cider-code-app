// ShiftDetailScreen/index.tsx
import { DatePicker } from '@gravity-ui/date-components';
import { DateTime, dateTimeParse } from '@gravity-ui/date-utils';
import {
  ArrowLeft,
  ArrowsRotateRight,
  CircleXmark,
  Database,
  Pause,
  Play,
  Printer,
  TrashBin,
  Xmark,
} from '@gravity-ui/icons';
import {
  Button,
  Card,
  Icon,
  Label,
  Modal,
  SegmentedRadioGroup,
  Spin,
  Switch,
  Table,
  Text,
} from '@gravity-ui/uikit';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ShiftService } from '@/app/api/generated';
import { useShift, useUpdateShiftStatus, useUserProfile } from '@/app/api/queries';
import { useBackup } from '@/app/hooks/useBackup';
import { useScannerWithPacking } from '@/app/hooks/useScannerWithPacking';
import { useScannerWithoutPacking } from '@/app/hooks/useScannerWithoutPacking';
import { DataMatrixData, ShiftStatus } from '@/app/types';
import { formatGtin, formatNumber, formatSSCC } from '@/app/utils';
import { compareSSCCCodes } from '@/app/utils/datamatrix';

import { AppHeader } from '../AppHeader';
import BackupManager from '../BackupManager';
import styles from './ShiftDetailScreen.module.scss';

export const ShiftDetailScreen: React.FC = () => {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [useCrates, setUseCrates] = useState(true);
  const [pendingSSCC, setPendingSSCC] = useState<string | null>(null);
  const [pendingItemCodes, setPendingItemCodes] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printLock, setPrintLock] = useState(false);
  const [productionDate, setProductionDate] = useState<DateTime | null>(null);
  // Ref для сканера в модальном окне
  const modalScannerRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Refs для стабильных ссылок на функции (избежание бесконечных циклов)
  const initializeShiftRef = useRef<(() => Promise<void>) | null>(null);
  const speakMessageRef = useRef<((message: string) => void) | null>(null);
  const { data: shift, isLoading, error } = useShift(shiftId || null);
  const { mutate: updateStatus } = useUpdateShiftStatus();
  const { data: userProfile } = useUserProfile();
  const queryClient = useQueryClient(); // Инициализация хука бэкапирования
  const { logAction, logError, savePackageToBackup } = useBackup({
    shiftId: shiftId || '',
  });

  // Функция для озвучивания сообщений
  const speakMessage = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  }, []); // Настройка хука для работы с упаковкой
  const packingHookResult = useScannerWithPacking({
    shift: shift?.result || null,
    enabled:
      shift?.result?.status === 'INPROGRESS' && // Сканирование только при активной смене
      shift?.result?.packing === true && // Только в режиме упаковки
      !activeModal &&
      !isPrinting, // Отключаем сканер при печати и в модальном окне
    onScanSuccess: (data: DataMatrixData) => {
      // Обрабатываем успешное сканирование в режиме упаковки
      handleCodeScannedWithPacking(data);
    },
    onScanError: async (message: string) => {
      // Показываем ошибку сканирования - негативный сценарий, озвучиваем
      setErrorIndex(scannedCodes.length);
      setTimeout(() => setErrorIndex(null), 2000);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка сканирования');
      }

      // Логируем ошибку в бэкап
      try {
        await logError('', 'product', message, {
          timestamp: new Date().toISOString(),
          errorType: 'scan_error',
        });
      } catch (error) {
        console.error('Failed to log scan error:', error);
      }
    },
    onDuplicateScan: async (data: DataMatrixData) => {
      // Обработка дубликата - негативный сценарий, озвучиваем
      if (speakMessageRef.current) {
        speakMessageRef.current('Дубликат');
      }

      // Логируем дубликат в бэкап
      try {
        await logError(data.rawData, 'product', 'Дубликат кода', {
          gtin: data.gtin,
          serialNumber: data.serialNumber,
          timestamp: new Date().toISOString(),
          errorType: 'duplicate_scan',
        });
      } catch (error) {
        console.error('Failed to log duplicate error:', error);
      }
    },
    onBoxReadyToPack: (currentSSCC: string, itemCodes: string[]) => {
      // Короб готов к упаковке - печатаем этикетку и показываем модал верификации
      handleBoxReadyToPack(currentSSCC, itemCodes);
    },
    onBoxPacked: (packedSSCC: string, nextSSCC: string) => {
      // Короб окончательно упакован - только обновляем статистику
      console.log(`Box packed: ${packedSSCC}, next: ${nextSSCC}`);
    },
    onSSCCInitialized: (sscc: string) => {
      console.log('SSCC initialized for first box:', sscc);
    },
  });

  // Настройка хука для работы без упаковки
  const nonPackingHookResult = useScannerWithoutPacking({
    shift: shift?.result || null,
    enabled:
      shift?.result?.status === 'INPROGRESS' && // Сканирование только при активной смене
      shift?.result?.packing === false && // Только в режиме без упаковки
      !activeModal &&
      !isPrinting, // Отключаем сканер при печати и в модальном окне
    onScanSuccess: (data: DataMatrixData) => {
      // Обрабатываем успешное сканирование в режиме без упаковки
      handleCodeScannedWithoutPacking(data);
    },
    onScanError: async (message: string) => {
      // Показываем ошибку сканирования - негативный сценарий, озвучиваем
      setErrorIndex(scannedCodes.length);
      setTimeout(() => setErrorIndex(null), 2000);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка сканирования');
      }

      // Логируем ошибку в бэкап
      try {
        await logError('', 'product', message, {
          timestamp: new Date().toISOString(),
          errorType: 'scan_error',
        });
      } catch (error) {
        console.error('Failed to log scan error:', error);
      }
    },
    onDuplicateScan: async (data: DataMatrixData) => {
      // Обработка дубликата - негативный сценарий, озвучиваем
      if (speakMessageRef.current) {
        speakMessageRef.current('Дубликат');
      }

      // Логируем дубликат в бэкап
      try {
        await logError(data.rawData, 'product', 'Дубликат кода', {
          gtin: data.gtin,
          serialNumber: data.serialNumber,
          timestamp: new Date().toISOString(),
          errorType: 'duplicate_scan',
        });
      } catch (error) {
        console.error('Failed to log duplicate error:', error);
      }
    },
    onBatchSent: async (codes: string[], count: number) => {
      // Коды успешно отправлены на сервер
      console.log(`Batch of ${count} codes sent to server:`, codes);
      if (speakMessageRef.current) {
        speakMessageRef.current(`Отправлено ${count} кодов`);
      }

      // Логируем отправку в бэкап
      try {
        await logAction('', 'codes_sent_to_server', {
          codes: codes,
          count: count,
          timestamp: new Date().toISOString(),
          shiftId: shift?.result?.id,
        });
      } catch (error) {
        console.error('Failed to log codes sent:', error);
      }
    },
    batchSize: 1, // Отправляем коды по одному
  });
  // Выбираем нужный результат в зависимости от режима упаковки
  const scannerHookResult = useCrates ? packingHookResult : nonPackingHookResult;

  // Извлекаем общие значения из результата хука
  const { scannedCodes, scanMessage, scanError, resetScan } = scannerHookResult;

  // Извлекаем специфичные для упаковки значения
  const currentBoxInfo =
    useCrates && 'currentBoxInfo' in scannerHookResult ? scannerHookResult.currentBoxInfo : null;
  const initializeShiftForPacking =
    useCrates && 'initializeShiftForPacking' in scannerHookResult
      ? scannerHookResult.initializeShiftForPacking
      : null;
  const confirmBoxPacking =
    useCrates && 'confirmBoxPacking' in scannerHookResult
      ? scannerHookResult.confirmBoxPacking
      : null;
  // Обновляем refs при изменении функций
  useEffect(() => {
    initializeShiftRef.current = initializeShiftForPacking;
    speakMessageRef.current = speakMessage;
  }, [initializeShiftForPacking, speakMessage]);
  const [scanStats, setScanStats] = useState({
    totalScanned: 0,
    currentBoxScanned: 0,
    totalBoxes: 0,
    boxCapacity: 0,
    totalShiftScanned: 0, // Общее количество отсканированных в смене
    initialFactCount: 0, // Начальное значение factCount при открытии смены
  }); // Получаем сохраненные коды по текущей смене при загрузке
  useEffect(() => {
    const shiftResult = shift?.result;
    if (!shiftResult) return; // Инициализация данных из смены
    const boxCapacity = shiftResult.countInBox || 0;
    const shouldUseCrates = shiftResult.packing;
    setUseCrates(shouldUseCrates);
    // Инициализация даты производства
    console.log('Original plannedDate from API:', shiftResult.plannedDate);

    let parsedDate: DateTime | null = null;
    if (shiftResult.plannedDate) {
      try {
        // Пробуем разные способы парсинга даты
        const result = dateTimeParse(shiftResult.plannedDate);
        parsedDate = result || null;
        console.log('Parsed date:', parsedDate?.format('DD.MM.YYYY'));
      } catch (error) {
        console.error('Error parsing date:', error);
        // Если не удалось распарсить, создаём новую дату из ISO строки
        try {
          const jsDate = new Date(shiftResult.plannedDate);
          const fallbackResult = dateTimeParse(jsDate.toISOString());
          parsedDate = fallbackResult || null;
        } catch (fallbackError) {
          console.error('Fallback parsing failed:', fallbackError);
        }
      }
    }
    setProductionDate(parsedDate); // Если используется упаковка, инициализируем SSCC для смены
    if (shouldUseCrates && shiftResult.status === 'INPROGRESS' && initializeShiftForPacking) {
      initializeShiftForPacking().catch((error: unknown) => {
        console.error('Failed to initialize SSCC for shift:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка инициализации упаковки');
        }
      });
    } // Установка начальных значений
    const initialFactCount = shiftResult.factCount || 0;
    setScanStats({
      totalScanned: 0,
      currentBoxScanned: 0,
      totalBoxes: 0,
      boxCapacity,
      totalShiftScanned: 0,
      initialFactCount,
    });
  }, [shift?.result, initializeShiftForPacking]);
  // Обработчик успешной верификации SSCC
  const handleSSCCVerificationSuccess = useCallback(async () => {
    try {
      if (!pendingSSCC || !pendingItemCodes.length) {
        console.error('No pending SSCC or item codes for verification');
        return;
      }

      console.log('SSCC verification successful, confirming box packing...');

      // Сохраняем упаковку в локальный бэкап
      console.log('Saving package to backup:', {
        sscc: pendingSSCC,
        productCodes: pendingItemCodes,
        shiftId: shiftId || '',
      });

      const backupSuccess = await savePackageToBackup(
        pendingSSCC,
        pendingItemCodes,
        shiftId || '',
        Date.now()
      );

      if (backupSuccess) {
        console.log('Package successfully saved to backup');
      } else {
        console.error('Failed to save package to backup');
      } // Подтверждаем упаковку через API
      if (confirmBoxPacking) {
        const nextSSCC = await confirmBoxPacking(pendingSSCC, pendingItemCodes);
        console.log('Box packing confirmed, next SSCC:', nextSSCC);
      } else {
        throw new Error('confirmBoxPacking is not available');
      }

      // Очищаем ожидающие данные
      setPendingSSCC(null);
      setPendingItemCodes([]);
      setActiveModal(null);
      setIsPrinting(false);

      // Увеличиваем счетчик коробов и очищаем текущий короб
      setScanStats(prev => ({
        ...prev,
        totalBoxes: prev.totalBoxes + 1,
        currentBoxScanned: 0,
      }));
      resetScan(); // Очищаем данные текущего скана через хук

      if (speakMessageRef.current) {
        speakMessageRef.current('Короб успешно упакован');
      }
    } catch (error) {
      console.error('Error confirming box packing:', error);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка упаковки короба');
      }

      // При ошибке очищаем данные и закрываем модал
      setPendingSSCC(null);
      setPendingItemCodes([]);
      setActiveModal(null);
      setIsPrinting(false);
    }
  }, [pendingSSCC, pendingItemCodes, confirmBoxPacking, resetScan, savePackageToBackup, shiftId]);

  // Настройка сканера для модального окна
  useEffect(() => {
    if (activeModal === 'verification' && pendingSSCC && window.electronAPI?.onBarcodeScanned) {
      console.log('Setting up modal scanner for SSCC:', pendingSSCC);

      // Создаем новое подключение к сканеру для модального окна
      modalScannerRef.current = {
        unsubscribe: window.electronAPI.onBarcodeScanned(barcode => {
          console.log('Modal scanner received barcode:', barcode);
          if (compareSSCCCodes(barcode, pendingSSCC)) {
            // Успешная верификация - теперь отправляем запрос на бэкенд
            handleSSCCVerificationSuccess();
          } else {
            // Неверный SSCC
            if (speakMessageRef.current) {
              speakMessageRef.current('Неверный код верификации');
            }
          }
        }),
      };
      return () => {
        // Отписываемся при закрытии модального окна
        if (modalScannerRef.current) {
          console.log('Unsubscribing modal scanner');
          modalScannerRef.current.unsubscribe();
          modalScannerRef.current = null;
        }

        // ВАЖНО: НЕ сбрасываем isPrinting автоматически в cleanup!
        // isPrinting должен сбрасываться только в handleSSCCVerificationSuccess
        // или при явном закрытии модального окна пользователем
      };
    }
  }, [activeModal, pendingSSCC, resetScan, handleSSCCVerificationSuccess]);

  // Обработчик готовности коробки к упаковке (печать этикетки и показ модала)
  const handleBoxReadyToPack = useCallback(
    async (currentSSCC: string, itemCodes: string[]) => {
      console.log('Box ready to pack with SSCC:', currentSSCC);
      try {
        // Проверяем, что у нас есть данные смены
        if (!shift?.result) {
          console.error('No shift data available for SSCC label');
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка: нет данных смены');
          }
          return;
        }

        // Сохраняем данные для последующей упаковки
        setPendingSSCC(currentSSCC);
        setPendingItemCodes(itemCodes);

        // Вычисляем дату истечения срока годности
        const plannedDate = new Date(shift.result.plannedDate);
        const expirationDate = new Date(plannedDate);
        expirationDate.setDate(plannedDate.getDate() + shift.result.product.expirationInDays); // Печатаем SSCC этикетку с полными данными
        const printResult = await window.electronAPI.printSSCCLabelWithData({
          ssccCode: currentSSCC,
          shiftId: shift.result.id,
          fullName: shift.result.product.fullName,
          plannedDate: shift.result.plannedDate,
          expiration: expirationDate.toISOString().split('T')[0], // Форматируем как YYYY-MM-DD
          barcode: shift.result.product.gtin,
          alcoholCode: shift.result.product.alcoholCode || '',
          currentCountInBox: itemCodes.length, // Фактическое количество кодов в коробе
          volume: shift.result.product.volume,
          pictureUrl: shift.result.product.pictureUrl || '', // URL изображения продукции
        });
        if (printResult.success) {
          console.log('Print successful, showing verification dialog');
          setActiveModal('verification');

          // Логируем упаковку короба в бэкап
          try {
            await logAction(currentSSCC, 'box_packed', {
              itemCodes: itemCodes,
              itemCount: itemCodes.length,
              shiftId: shift.result.id,
              productName: shift.result.product.fullName,
            });
          } catch (error) {
            console.error('Failed to log box packing:', error);
          }
        } else {
          console.error('Print failed:', printResult.error);
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка печати этикетки');
          }

          // Логируем ошибку печати в бэкап
          try {
            await logError(currentSSCC, 'package', `Ошибка печати этикетки: ${printResult.error}`, {
              itemCodes: itemCodes,
              itemCount: itemCodes.length,
              errorType: 'print_error',
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error('Failed to log print error:', error);
          }

          // Сбрасываем ожидающие данные при ошибке
          setPendingSSCC(null);
          setPendingItemCodes([]);
        }
      } catch (error) {
        console.error('Error preparing box for packing:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка печати этикетки');
        }

        // Логируем общую ошибку упаковки в бэкап
        try {
          await logError(currentSSCC, 'package', `Ошибка подготовки упаковки: ${error}`, {
            itemCodes: itemCodes,
            itemCount: itemCodes.length,
            errorType: 'packaging_error',
            timestamp: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error('Failed to log packaging error:', logErr);
        }

        // Сбрасываем ожидающие данные при ошибке
        setPendingSSCC(null);
        setPendingItemCodes([]);
      }
    },
    [shift, logAction, logError]
  ); // Обработчик успешного сканирования в режиме упаковки (используется хуком useScannerWithPacking)
  const handleCodeScannedWithPacking = useCallback(
    async (data: DataMatrixData) => {
      // Обновляем счетчики на основе данных от хука
      setScanStats(prev => ({
        ...prev,
        currentBoxScanned: currentBoxInfo?.boxItemCount || 0,
        totalScanned: prev.totalScanned + 1,
        totalShiftScanned: prev.totalShiftScanned + 1, // Увеличиваем общий счетчик смены
      }));

      // Логируем успешное сканирование в бэкап
      try {
        await logAction(data.rawData, 'scan_success', {
          gtin: data.gtin,
          serialNumber: data.serialNumber,
          currentBoxCount: currentBoxInfo?.boxItemCount || 0,
          boxSSCC: currentBoxInfo?.currentSSCC || null,
          mode: 'packing',
        });
      } catch (error) {
        console.error('Failed to log scan success:', error);
      }
    },
    [currentBoxInfo?.boxItemCount, currentBoxInfo?.currentSSCC, logAction]
  );

  // Обработчик успешного сканирования в режиме без упаковки (используется хуком useScannerWithoutPacking)
  const handleCodeScannedWithoutPacking = useCallback(
    async (data: DataMatrixData) => {
      // Обновляем счетчики для режима без упаковки
      setScanStats(prev => ({
        ...prev,
        totalScanned: prev.totalScanned + 1,
        totalShiftScanned: prev.totalShiftScanned + 1, // Увеличиваем общий счетчик смены
        currentBoxScanned: 0, // В режиме без упаковки нет текущего короба
      }));

      // Логируем успешное сканирование в бэкап
      try {
        await logAction(data.rawData, 'scan_success', {
          gtin: data.gtin,
          serialNumber: data.serialNumber,
          mode: 'no_packing',
          totalScannedInShift: scanStats.totalShiftScanned + 1,
        });
      } catch (error) {
        console.error('Failed to log scan success:', error);
      }
    },
    [logAction, scanStats.totalShiftScanned]
  );
  // Обработчик удаления текущего короба (только для режима упаковки)
  const handleDeleteCurrentBox = () => {
    if (useCrates && (currentBoxInfo?.boxItemCount || 0) > 0) {
      // Показать подтверждение
      setActiveModal('confirmDeleteBox');
    }
  }; // Фактическое удаление текущего короба (только для режима упаковки)
  const confirmDeleteCurrentBox = () => {
    if (useCrates) {
      const deletedCount = currentBoxInfo?.boxItemCount || 0;

      // Сначала сбрасываем скан через хук (это обновит currentBoxInfo)
      resetScan();

      // Затем обновляем статистику на основе удаленного количества
      setScanStats(prev => ({
        ...prev,
        totalScanned: prev.totalScanned - deletedCount,
        totalShiftScanned: prev.totalShiftScanned - deletedCount, // Уменьшаем общий счетчик смены
        currentBoxScanned: 0, // Обнуляем счетчик текущего короба
      }));

      console.log(`📦 Deleted current box with ${deletedCount} items. Stats updated.`);
    }
    setActiveModal(null);
  };
  // Обработчик ручного закрытия короба
  const handleCloseBox = async () => {
    console.log('handleCloseBox called manually');

    if (isPrinting || printLock || (currentBoxInfo?.boxItemCount || 0) <= 0) {
      console.log('Cannot close box: already printing or box is empty');
      return;
    }

    setIsPrinting(true);

    try {
      // Если используется режим упаковки и есть SSCC, можно попробовать упаковать
      if (currentBoxInfo?.currentSSCC) {
        // Получаем последние отсканированные коды для текущего короба
        const currentBoxCodes = scannedCodes
          .slice(-currentBoxInfo.boxItemCount)
          .map(item => item.rawData);

        await handleBoxReadyToPack(currentBoxInfo.currentSSCC, currentBoxCodes);

        // НЕ сбрасываем setIsPrinting здесь, так как это должно произойти после верификации
        // setIsPrinting будет сброшен в handleSSCCVerificationSuccess или при ошибке
      } else {
        // Если нет SSCC, сбрасываем isPrinting
        setIsPrinting(false);
      }
    } catch (error) {
      console.error('Error in manual box closing:', error);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка закрытия короба');
      }
      setIsPrinting(false);
      setPrintLock(false);
    }
  }; // Обработчик завершения смены
  const handleFinishShift = () => {
    // Проверка, закрыт ли текущий короб в режиме упаковки
    if (useCrates && (currentBoxInfo?.boxItemCount || 0) > 0) {
      setActiveModal('confirmFinishWithOpenBox');
      return;
    }

    // Проверка, есть ли неотправленные коды в режиме без упаковки
    if (
      !useCrates &&
      'pendingCodes' in scannerHookResult &&
      scannerHookResult.pendingCodes &&
      scannerHookResult.pendingCodes.length > 0
    ) {
      setActiveModal('confirmFinishWithPendingCodes');
      return;
    }

    // Вызов API для завершения смены
    if (shiftId) {
      updateStatus(
        { shiftId: shiftId, status: 'DONE' },
        {
          onSuccess: () => {
            navigate('/shifts');
          },
          onError: error => {
            console.error('Failed to finish shift:', error);
            if (speakMessageRef.current) {
              speakMessageRef.current('Ошибка завершения смены');
            }
          },
        }
      );
    } else {
      console.error('shiftId is undefined, cannot finish shift');
    }
  }; // Обработчик для возврата на экран со сменами с переводом статуса в паузу
  const handleBackToShifts = () => {
    // Изменяем статус смены на "Пауза" если она была активна
    if (shift?.result.status === 'INPROGRESS') {
      updateStatus(
        { shiftId: shiftId!, status: 'PAUSED' },
        {
          onSuccess: () => {
            navigate('/shifts');
          },
          onError: error => {
            console.error('Failed to pause shift:', error);
            // В случае ошибки все равно возвращаемся к списку
            navigate('/shifts');
          },
        }
      );
    } else {
      // Если смена не была активна, просто возвращаемся к списку
      navigate('/shifts');
    }
  };
  // Обработчик изменения настройки формирования коробов
  const handleUseCratesChange = useCallback(
    async (value: boolean) => {
      if (!shiftId || !shift) return;

      setUseCrates(value);

      try {
        // Отправляем запрос на обновление настройки упаковки
        await ShiftService.shiftControllerUpdate({
          id: shiftId,
          requestBody: {
            packing: value,
          },
        });

        console.log('Packing setting updated successfully:', value);

        // Инвалидируем кэш для обновления данных смены
        await queryClient.invalidateQueries({
          queryKey: ['shift', shiftId],
        });

        // Логируем изменение настройки в бэкап
        try {
          await logAction('', `packing_mode_${value ? 'enabled' : 'disabled'}`, {
            packingEnabled: value,
            timestamp: new Date().toISOString(),
            shiftId: shiftId,
          });
        } catch (logError) {
          console.error('Failed to log packing mode change:', logError);
        }

        if (speakMessageRef.current) {
          speakMessageRef.current(value ? 'Упаковка включена' : 'Упаковка отключена');
        }
      } catch (error) {
        console.error('Failed to update packing setting:', error);

        // Возвращаем предыдущее значение при ошибке
        setUseCrates(shift.result.packing);

        // Логируем ошибку изменения настройки
        try {
          await logError('', 'product', `Ошибка изменения настройки упаковки: ${error}`, {
            packingEnabled: value,
            errorType: 'packing_setting_error',
            timestamp: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error('Failed to log packing setting error:', logErr);
        }

        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка изменения настройки упаковки');
        }
      }
    },
    [shiftId, shift, queryClient, logAction, logError]
  );

  // Обработчик изменения статуса смены (пауза/возобновление)
  const handleToggleShiftStatus = () => {
    if (!shiftId || !shift) return;

    const currentStatus = shift.result.status;
    let newStatus: 'PLANNED' | 'INPROGRESS' | 'PAUSED' | 'DONE' | 'CANCELED';

    if (currentStatus === 'PLANNED') {
      newStatus = 'INPROGRESS';
    } else if (currentStatus === 'INPROGRESS') {
      newStatus = 'PAUSED';
    } else if (currentStatus === 'PAUSED') {
      newStatus = 'INPROGRESS';
    } else {
      // Для завершенных или отмененных смен не меняем статус
      return;
    }

    updateStatus(
      { shiftId, status: newStatus },
      {
        onSuccess: () => {
          console.log(`Shift status changed to: ${newStatus}`);
        },
        onError: error => {
          console.error('Failed to change shift status:', error);
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка изменения статуса смены');
          }
        },
      }
    );
  };

  // Обработчик изменения даты производства
  const handleProductionDateChange = useCallback(
    async (newDate: DateTime | null) => {
      if (!shiftId || !shift) return;

      setProductionDate(newDate);

      try {
        // Отправляем запрос на обновление plannedDate
        await ShiftService.shiftControllerUpdate({
          id: shiftId,
          requestBody: {
            plannedDate: newDate ? newDate.toISOString() : null,
          },
        });

        console.log('Production date updated successfully');

        // Инвалидируем кэш для обновления данных смены
        await queryClient.invalidateQueries({
          queryKey: ['shift', shiftId],
        });
      } catch (error) {
        console.error('Failed to update production date:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка обновления даты производства');
        } // Возвращаем предыдущее значение при ошибке
        let originalDate: DateTime | null = null;
        if (shift.result.plannedDate) {
          try {
            const result = dateTimeParse(shift.result.plannedDate);
            originalDate = result || null;
          } catch (parseError) {
            console.error('Error parsing original date:', parseError);
          }
        }
        setProductionDate(originalDate);
      }
    },
    [shiftId, shift, queryClient]
  );

  // Функция для установки operatorId при открытии смены
  const assignOperatorToShift = useCallback(async () => {
    if (!shiftId || !userProfile?.result || !shift) return;

    // Проверяем, не установлен ли уже operatorId
    if (shift.result.operatorId === userProfile.result.id) {
      console.log('OperatorId already assigned to this shift');
      return;
    }

    try {
      await ShiftService.shiftControllerUpdate({
        id: shiftId,
        requestBody: {
          operatorId: userProfile.result.id,
        },
      });

      console.log('OperatorId assigned to shift successfully:', userProfile.result.id);

      // Инвалидируем кэш для обновления данных смены
      await queryClient.invalidateQueries({
        queryKey: ['shift', shiftId],
      });
    } catch (error) {
      console.error('Failed to assign operatorId to shift:', error);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка привязки оператора к смене');
      }
    }
  }, [shiftId, userProfile, shift, queryClient]);

  // useEffect для установки operatorId при загрузке данных
  useEffect(() => {
    if (userProfile?.result && shift?.result) {
      assignOperatorToShift();
    }
  }, [userProfile?.result, shift?.result, assignOperatorToShift]);

  // Функция для изменения количества в коробе
  const handleBoxCapacityChange = useCallback(
    async (newCapacity: string) => {
      if (!shiftId || !shift) return;

      const capacity = parseInt(newCapacity, 10);

      try {
        await ShiftService.shiftControllerUpdate({
          id: shiftId,
          requestBody: {
            countInBox: capacity,
          },
        });
        console.log('Box capacity updated successfully:', capacity);

        // Инвалидируем кэш для обновления данных смены
        await queryClient.invalidateQueries({
          queryKey: ['shift', shiftId],
        });

        if (speakMessageRef.current) {
          speakMessageRef.current('Количество в коробе изменено');
        }
      } catch (error) {
        console.error('Failed to update box capacity:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка изменения количества в коробе');
        }
      }
    },
    [shiftId, shift, queryClient]
  );

  // Колонки для таблицы кодов
  const columns = useMemo(
    () => [
      {
        id: 'index',
        name: '№',
        width: 50,
        accessor: 'index',
      },
      {
        id: 'gtin',
        name: 'GTIN',
        render: (item: DataMatrixData) => formatGtin(item.gtin),
        width: 150,
      },
      {
        id: 'serialNumber',
        name: 'Серийный номер',
        render: (item: DataMatrixData) => item.serialNumber,
      },
      {
        id: 'crypto',
        name: 'Криптохвост',
        render: (item: DataMatrixData) => item.verificationCode,
      },
    ],
    []
  );

  // Мемоизируем данные таблицы для предотвращения лишних рендеров
  const tableData = useMemo(
    () =>
      scannedCodes.map((code, index) => ({
        ...code,
        index: index + 1,
      })),
    [scannedCodes]
  );

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <Spin size="l" />
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className={styles.errorContainer}>
        <Card className={styles.errorCard}>
          <Text variant="display-1">Ошибка загрузки смены</Text>
          <Button
            view="action"
            size="xl"
            onClick={() => navigate('/shifts')}
            className={styles.actionButton}
          >
            Вернуться к списку смен
          </Button>
        </Card>
      </div>
    );
  }

  const product = shift.result.product;
  const boxCapacity = shift.result.countInBox || 0;
  const isPacking = shift.result.packing;

  // Расчеты для прогресс бара смены
  const plannedCount = shift.result.plannedCount || 0;
  const currentFactCount = scanStats.initialFactCount + scanStats.totalShiftScanned;
  const progressPercentage =
    plannedCount > 0 ? Math.min((currentFactCount / plannedCount) * 100, 100) : 0;

  // Определение цвета прогресс бара в зависимости от заполнения
  const getProgressColor = (percentage: number) => {
    if (percentage < 25) return '#ef4444'; // красный
    if (percentage < 50) return '#f97316'; // оранжевый
    if (percentage < 75) return '#eab308'; // желтый
    if (percentage < 90) return '#84cc16'; // желто-зеленый
    return '#10b981'; // зеленый
  };
  return (
    <div className={styles.shiftDetailContainer}>
      <AppHeader />
      <div className={styles.content}>
        {/* Верхняя панель с информацией о смене */}
        <div className={styles.header}>
          <div className={styles.productInfo}>
            {' '}
            <div className={styles.titleRow}>
              <div className={styles.titleLeft}>
                <Button
                  view="flat"
                  size="l"
                  onClick={handleBackToShifts}
                  className={styles.backButton}
                >
                  <ArrowLeft />
                </Button>
                <Text variant="display-2">{product.shortName}</Text>
              </div>
            </div>
            <Label
              size="m"
              theme={shift.result.status === ShiftStatus.PLANNED ? 'success' : 'normal'}
            >
              {shift.result.status === ShiftStatus.PLANNED
                ? 'Активна'
                : getStatusText(shift.result.status as ShiftStatus)}
            </Label>
          </div>{' '}
          <div className={styles.shiftStats}>
            <div className={styles.statItem}>
              <Text variant="caption-1">GTIN</Text>
              <Text variant="body-1">{product.gtin}</Text>
            </div>{' '}
            <div className={styles.statItem}>
              <Text variant="caption-1">Плановое количество</Text>
              <Text variant="body-1">{formatNumber(shift.result.plannedCount)}</Text>
            </div>
            {isPacking && (
              <div className={styles.statItem}>
                <Text variant="caption-1">Единиц в коробе</Text>
                <Text variant="body-1">{boxCapacity}</Text>
              </div>
            )}
            {/* Настройка для формирования коробов */}
            <div className={styles.settingsItem}>
              <Text variant="caption-1">Формировать короба</Text>
              <Switch checked={useCrates} onUpdate={handleUseCratesChange} />
            </div>
          </div>
        </div>
        {/* Основной контейнер с информацией о сканировании */}
        <div className={styles.scanningContainer}>
          {' '}
          {/* Левая панель с большими счетчиками */}
          <div className={styles.countersPanel}>
            <div className={styles.mainCounterContainer}>
              {' '}
              <div className={styles.mainCounter}>
                {' '}
                <Text variant="display-1" className={styles.bigCounter}>
                  {useCrates ? (
                    <>
                      {currentBoxInfo?.boxItemCount || 0}
                      <span className={styles.divider}>/</span>
                      <span className={styles.capacity}>{boxCapacity}</span>
                    </>
                  ) : (
                    scanStats.totalShiftScanned
                  )}
                </Text>
              </div>
              <Text variant="subheader-1" className={styles.counterCaption}>
                {useCrates ? 'Отсканировано в текущем коробе' : 'Отсканировано в смене'}
              </Text>
            </div>{' '}
            <div className={styles.secondaryCounters}>
              <div className={styles.counterItem}>
                <div className={styles.counterIcon}>🍾</div>
                <Text variant="display-2">{scanStats.totalScanned}</Text>
                <Text variant="body-1">Всего отсканировано</Text>
              </div>

              {useCrates && (
                <div className={styles.counterItem}>
                  <div className={styles.counterIcon}>📦</div>
                  <Text variant="display-2">{scanStats.totalBoxes}</Text>
                  <Text variant="body-1">Закрыто коробов</Text>
                </div>
              )}

              {!useCrates && 'pendingCodes' in scannerHookResult && (
                <div className={styles.counterItem}>
                  <div className={styles.counterIcon}>📤</div>
                  <Text variant="display-2">{scannerHookResult.pendingCodes?.length || 0}</Text>
                  <Text variant="body-1">В очереди на отправку</Text>
                </div>
              )}
            </div>
            {/* Таблица с кодами текущего короба */}
            <div className={styles.currentBoxTable}>
              <Text variant="subheader-2">Коды в текущем коробе:</Text>{' '}
              <div className={styles.tableContainer}>
                <Table
                  data={tableData}
                  columns={columns}
                  className={styles.codesTable}
                  emptyMessage="Нет отсканированных кодов"
                />
              </div>
            </div>
          </div>
          {/* Правая панель с визуализацией короба и кнопками действий */}
          <div className={styles.controlsPanel}>
            {useCrates && (
              <>
                {/* Визуализация заполнения короба */}
                <div className={styles.boxVisualization}>
                  <Text variant="subheader-1">Текущий короб</Text>
                  <div className={styles.boxGrid}>
                    {' '}
                    {Array.from({ length: boxCapacity || 1 }, (_, i) => (
                      <div
                        key={i}
                        className={`${styles.boxItem} 
                        ${i < (currentBoxInfo?.boxItemCount || 0) ? styles.boxItemScanned : ''} 
                        ${i === errorIndex ? styles.boxItemError : ''}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Большая полоса прогресса */}
                <div className={styles.progressBar}>
                  {' '}
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${boxCapacity > 0 ? ((currentBoxInfo?.boxItemCount || 0) / boxCapacity) * 100 : 0}%`,
                    }}
                  />{' '}
                </div>
              </>
            )}
            {/* Прогресс бар для всей смены */}
            <div className={styles.shiftProgressContainer}>
              <Text variant="subheader-2">Прогресс смены</Text>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: getProgressColor(progressPercentage),
                  }}
                />
                <div className={styles.progressText}>
                  {formatNumber(currentFactCount)} / {formatNumber(plannedCount)}
                </div>
              </div>
            </div>
            {/* Настройки производства */}{' '}
            <div className={styles.productionSettings}>
              <div className={styles.settingGroup}>
                <Text variant="subheader-2">Дата производства</Text>{' '}
                <DatePicker
                  value={productionDate}
                  onUpdate={handleProductionDateChange}
                  format="DD.MM.YYYY"
                  placeholder="Выберите дату"
                  size="l"
                  className={styles.datePicker}
                />
              </div>{' '}
              <div className={styles.settingGroup}>
                <Text variant="subheader-2">Оператор</Text>
                <Text variant="body-1" className={styles.operatorInfo}>
                  {userProfile?.result?.name || 'Не определен'}
                </Text>
              </div>
              {useCrates && (
                <div className={styles.settingGroup}>
                  <Text variant="subheader-2">Количество в коробе</Text>
                  <SegmentedRadioGroup
                    value={String(boxCapacity)}
                    onUpdate={handleBoxCapacityChange}
                    options={[
                      { value: '1', content: '1' },
                      { value: '6', content: '6' },
                      { value: '20', content: '20' },
                    ]}
                    size="l"
                    className={styles.capacitySelector}
                  />
                </div>
              )}
            </div>{' '}
            {/* Кнопки управления */}
            <div className={styles.actionButtons}>
              {useCrates && (
                <>
                  {' '}
                  <Button
                    view="normal"
                    size="xl"
                    onClick={handleDeleteCurrentBox}
                    disabled={(currentBoxInfo?.boxItemCount || 0) === 0 || isPrinting}
                    className={styles.actionButton}
                  >
                    <span className={styles.buttonContent}>
                      <TrashBin />
                      <span>Удалить текущий короб</span>
                    </span>
                  </Button>
                  <Button
                    view="normal"
                    size="xl"
                    onClick={() => setActiveModal('scanToDelete')}
                    disabled={printLock}
                    className={styles.actionButton}
                  >
                    <span className={styles.buttonContent}>
                      <TrashBin />
                      <span>Удалить короб по коду</span>
                    </span>
                  </Button>{' '}
                  <Button
                    view="action"
                    size="xl"
                    onClick={handleCloseBox}
                    disabled={(currentBoxInfo?.boxItemCount || 0) === 0 || printLock}
                    loading={printLock}
                    className={styles.actionButton}
                  >
                    <span className={styles.buttonContent}>
                      <Printer />
                      <span>Закрыть короб</span>
                    </span>
                  </Button>{' '}
                </>
              )}
              {/* Кнопка для отправки кодов в режиме без упаковки */}
              {!useCrates && 'sendPendingCodes' in scannerHookResult && (
                <Button
                  view="action"
                  size="xl"
                  onClick={scannerHookResult.sendPendingCodes}
                  disabled={
                    scannerHookResult.pendingCodes?.length === 0 ||
                    scannerHookResult.isProcessing ||
                    printLock
                  }
                  loading={scannerHookResult.isProcessing}
                  className={styles.actionButton}
                >
                  <span className={styles.buttonContent}>
                    <ArrowsRotateRight />
                    <span>
                      {scannerHookResult.autoSendCountdown &&
                      scannerHookResult.autoSendCountdown > 0
                        ? `Отправка через ${scannerHookResult.autoSendCountdown}с`
                        : `Отправить коды${
                            scannerHookResult.pendingCodes &&
                            scannerHookResult.pendingCodes.length > 0
                              ? ` (${scannerHookResult.pendingCodes.length})`
                              : ''
                          }`}
                    </span>
                  </span>
                </Button>
              )}{' '}
              <Button
                view="outlined-info"
                size="xl"
                onClick={() => setActiveModal('backupManager')}
                disabled={printLock}
                className={styles.actionButton}
              >
                <span className={styles.buttonContent}>
                  <Database />
                  <span>Просмотр бэкапов</span>
                </span>
              </Button>{' '}
              <Button
                view={shift.result.status === 'PAUSED' ? 'outlined-warning' : 'normal'}
                size="xl"
                onClick={handleToggleShiftStatus}
                disabled={
                  printLock || shift.result.status === 'DONE' || shift.result.status === 'CANCELED'
                }
                className={styles.actionButton}
              >
                <span className={styles.buttonContent}>
                  {shift.result.status === 'PAUSED' ? <Play /> : <Pause />}
                  <span>
                    {shift.result.status === 'PAUSED'
                      ? 'Возобновить'
                      : shift.result.status === 'PLANNED'
                        ? 'Начать смену'
                        : 'Пауза'}
                  </span>
                </span>
              </Button>{' '}
              <Button
                view="outlined-danger"
                size="xl"
                onClick={handleFinishShift}
                disabled={printLock}
                className={styles.actionButton}
              >
                <span className={styles.buttonContent}>
                  <CircleXmark />
                  <span>Завершить смену</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
        {/* Строка сканирования внизу */}
        <div className={styles.scanBar}>
          {' '}
          <Text variant="display-1">
            {printLock
              ? 'Печать этикетки...'
              : shift?.result.status !== 'INPROGRESS'
                ? shift?.result.status === 'PAUSED'
                  ? 'Сканирование на паузе'
                  : shift?.result.status === 'PLANNED'
                    ? 'Нажмите "Начать смену" для начала сканирования'
                    : 'Смена завершена'
                : 'Отсканируйте код маркировки'}
          </Text>
          {scanError && (
            <Text variant="body-1" className={styles.errorText}>
              {scanMessage}
            </Text>
          )}
        </div>
        {/* Модальные окна */}{' '}
        {activeModal === 'verification' && pendingSSCC && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalTitle}>
                <Text variant="display-2">Проверка этикетки</Text>
              </div>
              <div className={styles.modalSubheader}>
                <Text variant="body-1" color="secondary">
                  Отсканируйте SSCC код с напечатанной этикетки для подтверждения
                </Text>
              </div>
              <div className={styles.modalCode}>
                <Text variant="display-3">{formatSSCC(pendingSSCC)}</Text>
              </div>{' '}
              <Button
                view="flat"
                size="xl"
                onClick={() => {
                  // При отмене сбрасываем все состояния
                  setActiveModal(null);
                  setPendingSSCC(null);
                  setPendingItemCodes([]);
                  setIsPrinting(false);
                  setPrintLock(false);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}{' '}
        {/* Модальное окно подтверждения удаления короба */}
        <Modal open={activeModal === 'confirmDeleteBox'} onClose={() => setActiveModal(null)}>
          <div className={styles.modalContent}>
            {' '}
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon
                  data={TrashBin}
                  size={20}
                  className={`${styles.modalIcon} ${styles.danger}`}
                />
                <Text variant="header-2">Подтверждение удаления</Text>
              </div>
            </div>
            <div className={styles.modalBody}>
              <Text variant="body-1">
                Вы уверены, что хотите удалить все отсканированные коды из текущего короба?
              </Text>
              <div style={{ marginTop: '12px' }}>
                <Text variant="body-2" style={{ color: 'var(--g-color-text-danger)' }}>
                  Это действие нельзя отменить.
                </Text>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <Button view="flat" size="l" onClick={() => setActiveModal(null)}>
                Отмена
              </Button>
              <Button view="outlined-danger" size="l" onClick={confirmDeleteCurrentBox}>
                Удалить
              </Button>
            </div>
          </div>
        </Modal>{' '}
        {activeModal === 'scanToDelete' && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalTitle}>
                <Text variant="display-2">Удаление короба по коду</Text>
              </div>
              <div className={styles.modalSubheader}>
                <Text variant="body-1" color="secondary">
                  Отсканируйте SSCC код короба, который нужно удалить
                </Text>
              </div>
              <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
                Отмена
              </Button>
            </div>
          </div>
        )}{' '}
        {activeModal === 'confirmFinishWithOpenBox' && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalTitle}>
                <Text variant="display-2">Незавершенный короб</Text>
              </div>
              <div className={styles.modalSubheader}>
                <Text variant="body-1" color="secondary">
                  У вас есть незавершенный короб. Завершить его перед закрытием смены?
                </Text>
              </div>
              <div className={styles.modalButtons}>
                <Button view="action" size="xl" onClick={handleCloseBox}>
                  Завершить короб
                </Button>
                <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
                  Отмена
                </Button>
              </div>{' '}
            </div>
          </div>
        )}
        {activeModal === 'confirmFinishWithPendingCodes' && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalTitle}>
                <Text variant="display-2">Неотправленные коды</Text>
              </div>
              <div className={styles.modalSubheader}>
                <Text variant="body-1" color="secondary">
                  У вас есть{' '}
                  {('pendingCodes' in scannerHookResult &&
                    scannerHookResult.pendingCodes?.length) ||
                    0}{' '}
                  неотправленных кодов. Отправить их перед закрытием смены?
                </Text>
              </div>
              <div className={styles.modalButtons}>
                <Button
                  view="action"
                  size="xl"
                  onClick={async () => {
                    if ('sendPendingCodes' in scannerHookResult) {
                      try {
                        await scannerHookResult.sendPendingCodes();
                        setActiveModal(null);
                        // После отправки завершаем смену
                        handleFinishShift();
                      } catch (error) {
                        console.error('Failed to send pending codes:', error);
                      }
                    }
                  }}
                  loading={'isProcessing' in scannerHookResult && scannerHookResult.isProcessing}
                >
                  Отправить коды
                </Button>
                <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
                  Отмена
                </Button>
              </div>{' '}
            </div>
          </div>
        )}{' '}
        {/* Модальное окно управления бэкапами */}
        <Modal open={activeModal === 'backupManager'} onClose={() => setActiveModal(null)}>
          <div
            style={{
              minWidth: '90vw',
              maxWidth: '1200px',
              minHeight: '80vh',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {' '}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '24px 24px 16px',
                borderBottom: '1px solid var(--g-color-line-generic)',
              }}
            >
              <Icon data={Database} size={20} className={`${styles.modalIcon} ${styles.info}`} />
              <Text variant="header-2">Управление бэкапами</Text>
              <Button
                view="flat"
                size="s"
                onClick={() => setActiveModal(null)}
                style={{ marginLeft: 'auto' }}
              >
                <Icon data={Xmark} size={16} />
              </Button>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px 24px 24px',
              }}
            >
              <BackupManager />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

// Вспомогательная функция для получения текста статуса
function getStatusText(status: ShiftStatus): string {
  switch (status) {
    case ShiftStatus.PLANNED:
      return 'Активна';
    case ShiftStatus.INPROGRESS:
      return 'В работе';
    case ShiftStatus.PAUSED:
      return 'На паузе';
    case ShiftStatus.DONE:
      return 'Завершена';
    case ShiftStatus.CANCELED:
      return 'Отменена';
    default:
      return 'Неизвестно';
  }
}
