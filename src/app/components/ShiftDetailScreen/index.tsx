// ShiftDetailScreen/index.tsx
import { ArrowLeft, CircleXmark, Pause, Play, Printer, TrashBin } from '@gravity-ui/icons';
import { Button, Card, Label, Spin, Switch, Table, Text } from '@gravity-ui/uikit';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useShift, useUpdateShiftStatus } from '@/app/api/queries';
import { useScannerWithPacking } from '@/app/hooks/useScannerWithPacking';
import { DataMatrixData, ShiftStatus } from '@/app/types';
import { formatGtin, formatSSCC } from '@/app/utils';
import { compareSSCCCodes } from '@/app/utils/datamatrix';

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
  const [printLock, setPrintLock] = useState(false); // Ref для сканера в модальном окне
  const modalScannerRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Refs для стабильных ссылок на функции (избежание бесконечных циклов)
  const initializeShiftRef = useRef<(() => Promise<void>) | null>(null);
  const speakMessageRef = useRef<((message: string) => void) | null>(null);

  const { data: shift, isLoading, error } = useShift(shiftId || null);
  const { mutate: updateStatus } = useUpdateShiftStatus();

  // Функция для озвучивания сообщений
  const speakMessage = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  }, []);
  // Настройка нового хука для работы с упаковкой
  const {
    scannedCodes,
    scanMessage,
    scanError,
    currentBoxInfo,
    resetScan,
    initializeShiftForPacking,
    confirmBoxPacking,
  } = useScannerWithPacking({
    shift: shift?.result || null,
    enabled:
      shift?.result?.status === 'INPROGRESS' && // Сканирование только при активной смене
      !activeModal &&
      !isPrinting, // Отключаем сканер при печати и в модальном окне
    onScanSuccess: (data: DataMatrixData) => {
      // Обрабатываем успешное сканирование
      handleCodeScanned(data);
    },
    onScanError: (_message: string) => {
      // Показываем ошибку сканирования - негативный сценарий, озвучиваем
      setErrorIndex(scannedCodes.length);
      setTimeout(() => setErrorIndex(null), 2000);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка сканирования');
      }
    },
    onDuplicateScan: (_data: DataMatrixData) => {
      // Обработка дубликата - негативный сценарий, озвучиваем
      if (speakMessageRef.current) {
        speakMessageRef.current('Дубликат');
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

  // Обновляем refs при изменении функций
  useEffect(() => {
    initializeShiftRef.current = initializeShiftForPacking;
    speakMessageRef.current = speakMessage;
  });

  const [scanStats, setScanStats] = useState({
    totalScanned: 0,
    currentBoxScanned: 0,
    totalBoxes: 0,
    boxCapacity: 0,
  }); // Получаем сохраненные коды по текущей смене при загрузке
  useEffect(() => {
    const shiftResult = shift?.result;
    if (!shiftResult) return;

    // Инициализация данных из смены
    const boxCapacity = shiftResult.countInBox || 0;
    const shouldUseCrates = shiftResult.packing;
    setUseCrates(shouldUseCrates);

    // Если используется упаковка, инициализируем SSCC для смены
    if (shouldUseCrates && shiftResult.status === 'INPROGRESS' && initializeShiftRef.current) {
      initializeShiftRef.current().catch((error: unknown) => {
        console.error('Failed to initialize SSCC for shift:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка инициализации упаковки');
        }
      });
    }

    // Установка начальных значений
    setScanStats({
      totalScanned: 0, // Заменить на реальные данные
      currentBoxScanned: 0, // Заменить на реальные данные
      totalBoxes: 0, // Заменить на реальные данные
      boxCapacity,
    });
  }, [shift?.result]);

  // Обработчик успешной верификации SSCC
  const handleSSCCVerificationSuccess = useCallback(async () => {
    try {
      if (!pendingSSCC || !pendingItemCodes.length) {
        console.error('No pending SSCC or item codes for verification');
        return;
      }

      console.log('SSCC verification successful, confirming box packing...');

      // Подтверждаем упаковку через API
      const nextSSCC = await confirmBoxPacking(pendingSSCC, pendingItemCodes);

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

      console.log('Box packing confirmed, next SSCC:', nextSSCC);
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
  }, [pendingSSCC, pendingItemCodes, confirmBoxPacking, resetScan]);

  // Настройка сканера для модального окна
  useEffect(() => {
    if (activeModal === 'verification' && pendingSSCC) {
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
        } // Если модальное окно закрывается без верификации, снимаем блокировку
        if (pendingSSCC && activeModal === 'verification') {
          setIsPrinting(false);
          setPendingSSCC(null);
          setPendingItemCodes([]);
        }
      };
    }
  }, [activeModal, pendingSSCC, resetScan, handleSSCCVerificationSuccess]);
  // Обработчик упаковки короба от хука
  const handleBoxPacked = useCallback(
    async (packedSSCC: string, nextSSCC: string) => {
      console.log('Box packed with SSCC:', packedSSCC, 'Next SSCC:', nextSSCC);
      try {
        // Проверяем, что у нас есть данные смены
        if (!shift?.result) {
          console.error('No shift data available for SSCC label');
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка: нет данных смены');
          }
          return;
        }

        // Вычисляем дату истечения срока годности
        const plannedDate = new Date(shift.result.plannedDate);
        const expirationDate = new Date(plannedDate);
        expirationDate.setDate(plannedDate.getDate() + shift.result.product.expirationInDays); // Печатаем SSCC этикетку с полными данными
        const printResult = await window.electronAPI.printSSCCLabelWithData({
          ssccCode: packedSSCC,
          shiftId: shift.result.id,
          fullName: shift.result.product.fullName,
          plannedDate: shift.result.plannedDate,
          expiration: expirationDate.toISOString().split('T')[0], // Форматируем как YYYY-MM-DD
          barcode: shift.result.product.gtin,
          alcoholCode: shift.result.product.alcoholCode || '',
          currentCountInBox: shift.result.countInBox || 0,
          volume: shift.result.product.volume,
          pictureUrl: shift.result.product.pictureUrl || '', // URL изображения продукции
        });

        if (printResult.success) {
          console.log('Print successful, showing verification dialog');
          setPendingSSCC(packedSSCC);
          setActiveModal('verification');
        } else {
          console.error('Print failed:', printResult.error);
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка печати этикетки');
          }
          setIsPrinting(false);
          setPrintLock(false);
        }
      } catch (error) {
        console.error('Error printing SSCC:', error);
        if (speakMessageRef.current) {
          speakMessageRef.current('Ошибка печати этикетки');
        }
        setIsPrinting(false);
        setPrintLock(false);
      }
    },
    [shift]
  );

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
        expirationDate.setDate(plannedDate.getDate() + shift.result.product.expirationInDays);

        // Печатаем SSCC этикетку с полными данными
        const printResult = await window.electronAPI.printSSCCLabelWithData({
          ssccCode: currentSSCC,
          shiftId: shift.result.id,
          fullName: shift.result.product.fullName,
          plannedDate: shift.result.plannedDate,
          expiration: expirationDate.toISOString().split('T')[0], // Форматируем как YYYY-MM-DD
          barcode: shift.result.product.gtin,
          alcoholCode: shift.result.product.alcoholCode || '',
          currentCountInBox: shift.result.countInBox || 0,
          volume: shift.result.product.volume,
          pictureUrl: shift.result.product.pictureUrl || '', // URL изображения продукции
        });

        if (printResult.success) {
          console.log('Print successful, showing verification dialog');
          setActiveModal('verification');
        } else {
          console.error('Print failed:', printResult.error);
          if (speakMessageRef.current) {
            speakMessageRef.current('Ошибка печати этикетки');
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
        // Сбрасываем ожидающие данные при ошибке
        setPendingSSCC(null);
        setPendingItemCodes([]);
      }
    },
    [shift]
  );

  // Обработчик успешного сканирования (используется новым хуком)
  const handleCodeScanned = useCallback(
    (_data: DataMatrixData) => {
      // Обновляем счетчики на основе данных от хука
      setScanStats(prev => ({
        ...prev,
        currentBoxScanned: currentBoxInfo?.boxItemCount || 0,
        totalScanned: prev.totalScanned + 1,
      }));
    },
    [currentBoxInfo?.boxItemCount]
  );

  // Обработчик удаления текущего короба
  const handleDeleteCurrentBox = () => {
    if ((currentBoxInfo?.boxItemCount || 0) > 0) {
      // Показать подтверждение
      setActiveModal('confirmDeleteBox');
    }
  };

  // Фактическое удаление текущего короба
  const confirmDeleteCurrentBox = () => {
    resetScan(); // Сбрасываем текущий скан через хук
    setScanStats(prev => ({
      ...prev,
      totalScanned: prev.totalScanned - (currentBoxInfo?.boxItemCount || 0),
      currentBoxScanned: 0,
    }));
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

    // В новой системе упаковка должна происходить автоматически через хук
    // Здесь мы можем только принудительно закрыть короб, если нужно
    try {
      // Если используется режим упаковки и есть SSCC, можно попробовать упаковать
      if (currentBoxInfo?.currentSSCC) {
        await handleBoxPacked(currentBoxInfo.currentSSCC, currentBoxInfo.currentSSCC);
      }
    } catch (error) {
      console.error('Error in manual box closing:', error);
      if (speakMessageRef.current) {
        speakMessageRef.current('Ошибка закрытия короба');
      }
      setIsPrinting(false);
      setPrintLock(false);
    }
  };
  // Обработчик завершения смены
  const handleFinishShift = () => {
    // Проверка, закрыт ли текущий короб
    if (useCrates && (currentBoxInfo?.boxItemCount || 0) > 0) {
      setActiveModal('confirmFinishWithOpenBox');
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
  const handleUseCratesChange = (value: boolean) => {
    setUseCrates(value);
    // Здесь можно также сохранить настройку в API
  };

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
  // Колонки для таблицы кодов
  const columns = useMemo(
    () => [
      {
        id: 'index',
        name: '№',
        width: 50,
        render: (_: unknown, index: number) => index + 1,
      },
      {
        id: 'gtin',
        name: 'GTIN',
        render: (item: DataMatrixData) => formatGtin(item.gtin),
      },
      {
        id: 'serialNumber',
        name: 'Серийный номер',
        render: (item: DataMatrixData) => item.serialNumber,
      },
    ],
    []
  );

  // Мемоизируем данные таблицы для предотвращения лишних рендеров
  const tableData = useMemo(() => scannedCodes, [scannedCodes]);

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

  return (
    <div className={styles.shiftDetailContainer}>
      {/* Верхняя панель с информацией о смене */}
      <div className={styles.header}>
        <div className={styles.productInfo}>
          <div className={styles.titleRow}>
            <Button view="flat" size="l" onClick={handleBackToShifts} className={styles.backButton}>
              <ArrowLeft />
            </Button>
            <Text variant="display-2">{product.shortName}</Text>
          </div>
          <Label
            size="m"
            theme={shift.result.status === ShiftStatus.PLANNED ? 'success' : 'normal'}
          >
            {shift.result.status === ShiftStatus.PLANNED
              ? 'Активна'
              : getStatusText(shift.result.status as ShiftStatus)}
          </Label>
        </div>

        <div className={styles.shiftStats}>
          <div className={styles.statItem}>
            <Text variant="caption-1">GTIN</Text>
            <Text variant="body-1">{product.gtin}</Text>
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
        {/* Левая панель с большими счетчиками */}
        <div className={styles.countersPanel}>
          <div className={styles.mainCounterContainer}>
            {' '}
            <div className={styles.mainCounter}>
              <Text variant="display-1" className={styles.bigCounter}>
                {currentBoxInfo?.boxItemCount || 0}
                <span className={styles.divider}>/</span>
                <span className={styles.capacity}>{useCrates ? boxCapacity : '-'}</span>
              </Text>
            </div>
            <Text variant="subheader-1" className={styles.counterCaption}>
              {useCrates ? 'Отсканировано в текущем коробе' : 'Отсканировано единиц'}
            </Text>
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

          <div className={styles.secondaryCounters}>
            <div className={styles.counterItem}>
              <div className={styles.counterIcon}>📦</div>
              <Text variant="display-2">{scanStats.totalScanned}</Text>
              <Text variant="body-1">Всего отсканировано</Text>
            </div>

            {useCrates && (
              <div className={styles.counterItem}>
                <div className={styles.counterIcon}>🧳</div>
                <Text variant="display-2">{scanStats.totalBoxes}</Text>
                <Text variant="body-1">Закрыто коробов</Text>
              </div>
            )}
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
                />
              </div>
            </>
          )}

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
                  <TrashBin /> Удалить текущий короб
                </Button>
                <Button
                  view="normal"
                  size="xl"
                  onClick={() => setActiveModal('scanToDelete')}
                  disabled={printLock}
                  className={styles.actionButton}
                >
                  <TrashBin /> Удалить короб по коду
                </Button>{' '}
                <Button
                  view="action"
                  size="xl"
                  onClick={handleCloseBox}
                  disabled={(currentBoxInfo?.boxItemCount || 0) === 0 || printLock}
                  loading={printLock}
                  className={styles.actionButton}
                >
                  <Printer /> Закрыть короб
                </Button>
              </>
            )}{' '}
            <Button
              view={shift.result.status === 'PAUSED' ? 'outlined-warning' : 'normal'}
              size="xl"
              onClick={handleToggleShiftStatus}
              disabled={
                printLock || shift.result.status === 'DONE' || shift.result.status === 'CANCELED'
              }
              className={styles.actionButton}
            >
              {shift.result.status === 'PAUSED' ? <Play /> : <Pause />}
              {shift.result.status === 'PAUSED'
                ? 'Возобновить'
                : shift.result.status === 'PLANNED'
                  ? 'Начать смену'
                  : 'Пауза'}
            </Button>
            <Button
              view="outlined-danger"
              size="xl"
              onClick={handleFinishShift}
              disabled={printLock}
              className={styles.actionButton}
            >
              <CircleXmark /> Завершить смену
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

      {/* Модальные окна */}
      {activeModal === 'verification' && pendingSSCC && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <Text variant="display-2">Проверка этикетки</Text>
            <Text variant="body-1">Отсканируйте SSCC код с напечатанной этикетки</Text>
            <Text variant="display-3">{formatSSCC(pendingSSCC)}</Text>
            <Button
              view="flat"
              size="xl"
              onClick={() => {
                // При отмене сбрасываем все состояния
                setActiveModal(null);
                setPendingSSCC(null);
                setPrintLock(false);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {activeModal === 'confirmDeleteBox' && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <Text variant="display-2">Подтверждение удаления</Text>
            <Text variant="body-1">
              Вы уверены, что хотите удалить все отсканированные коды из текущего короба?
            </Text>
            <div className={styles.modalButtons}>
              <Button view="outlined-danger" size="xl" onClick={confirmDeleteCurrentBox}>
                Удалить
              </Button>
              <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'scanToDelete' && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <Text variant="display-2">Удаление короба по коду</Text>
            <Text variant="body-1">Отсканируйте SSCC код короба, который нужно удалить</Text>
            <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {activeModal === 'confirmFinishWithOpenBox' && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <Text variant="display-2">Незавершенный короб</Text>
            <Text variant="body-1">
              У вас есть незавершенный короб. Завершить его перед закрытием смены?
            </Text>
            <div className={styles.modalButtons}>
              <Button view="action" size="xl" onClick={handleCloseBox}>
                Завершить короб
              </Button>
              <Button view="flat" size="xl" onClick={() => setActiveModal(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
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
