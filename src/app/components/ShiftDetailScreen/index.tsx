// ShiftDetailScreen/index.tsx
import { ArrowLeft, CircleXmark, Pause, Play, Printer, TrashBin } from '@gravity-ui/icons';
import { Button, Card, Label, Spin, Switch, Table, Text } from '@gravity-ui/uikit';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useShift, useUpdateShiftStatus } from '@/app/api/queries';
import { useScannerInShift } from '@/app/hooks/useScannerInShift';
import { DataMatrixData, ShiftStatus } from '@/app/types';
import { formatGtin, formatSSCC } from '@/app/utils';

import styles from './ShiftDetailScreen.module.scss';

export const ShiftDetailScreen: React.FC = () => {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [useCrates, setUseCrates] = useState(true);
  const [currentBoxCodes, setCurrentBoxCodes] = useState<DataMatrixData[]>([]);
  const [pendingSSCC, setPendingSSCC] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printLock, setPrintLock] = useState(false);

  // Ref для сканера в модальном окне
  const modalScannerRef = useRef<{ unsubscribe: () => void } | null>(null);
  const ssccCounterRef = useRef<number>(0);
  const { data: shift, isLoading, error } = useShift(shiftId || null);
  const { mutate: updateStatus } = useUpdateShiftStatus();

  const [scanStats, setScanStats] = useState({
    totalScanned: 0,
    currentBoxScanned: 0,
    totalBoxes: 0,
    boxCapacity: 0,
  });

  // Получаем сохраненные коды по текущей смене при загрузке
  useEffect(() => {
    if (shift?.result) {
      // Инициализация данных из смены
      const boxCapacity = shift.result.countInBox || 0;
      const shouldUseCrates = shift.result.packing;
      setUseCrates(shouldUseCrates);

      // Здесь бы загрузить существующие сканы и упаковки
      // Установка начальных значений
      setScanStats({
        totalScanned: 0, // Заменить на реальные данные
        currentBoxScanned: 0, // Заменить на реальные данные
        totalBoxes: 0, // Заменить на реальные данные
        boxCapacity,
      });
    }
  }, [shift]);

  // Функция для голосовых оповещений (только негативные сценарии)
  const speakMessage = (message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ru-RU';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Обработчик успешного сканирования
  const handleCodeScanned = (data: DataMatrixData) => {
    setCurrentBoxCodes(prev => [...prev, data]);

    // Считаем, сколько будет после добавления
    const newCurrentBoxScanned = scanStats.currentBoxScanned + 1;
    const boxFull =
      useCrates &&
      newCurrentBoxScanned >= scanStats.boxCapacity &&
      scanStats.boxCapacity > 0 &&
      !isPrinting &&
      !printLock;

    // Если короб заполнен — СТАВИМ printLock СРАЗУ!
    if (boxFull) {
      setPrintLock(true);
      setTimeout(() => {
        handleCloseBox();
      }, 500);
    }

    setScanStats(prev => ({
      ...prev,
      currentBoxScanned: prev.currentBoxScanned + 1,
      totalScanned: prev.totalScanned + 1,
    }));
  };

  // Настройка сканера для модального окна
  useEffect(() => {
    if (activeModal === 'verification' && pendingSSCC) {
      console.log('Setting up modal scanner for SSCC:', pendingSSCC);

      // Создаем новое подключение к сканеру для модального окна
      modalScannerRef.current = {
        unsubscribe: window.electronAPI.onBarcodeScanned(barcode => {
          console.log('Modal scanner received barcode:', barcode);
          if (barcode === pendingSSCC) {
            // Успешная верификация
            setPendingSSCC(null);
            setActiveModal(null);
            setIsPrinting(false); // Важно: снимаем блокировку

            // Увеличиваем счетчик коробов и очищаем текущий короб
            setScanStats(prev => ({
              ...prev,
              totalBoxes: prev.totalBoxes + 1,
              currentBoxScanned: 0,
            }));
            setCurrentBoxCodes([]);
          } else {
            // Неверный SSCC
            speakMessage('Неверный код верификации');
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

        // Если модальное окно закрывается без верификации, снимаем блокировку
        if (pendingSSCC && activeModal === 'verification') {
          setIsPrinting(false);
        }
      };
    }
  }, [activeModal, pendingSSCC]); // Интеграция с хуком сканирования для основного интерфейса
  const { scanMessage, scanError } = useScannerInShift({
    shift: shift?.result || null,
    enabled:
      shift?.result.status === 'INPROGRESS' && // Сканирование только при активной смене
      !activeModal &&
      !isPrinting, // Отключаем сканер при печати и в модальном окне
    onScanSuccess: data => {
      // Обрабатываем успешное сканирование
      handleCodeScanned(data);
    },
    onScanError: _message => {
      // Показываем ошибку сканирования - негативный сценарий, озвучиваем
      setErrorIndex(scanStats.currentBoxScanned);
      setTimeout(() => setErrorIndex(null), 2000);
      speakMessage('Ошибка сканирования');
    },
    onDuplicateScan: _data => {
      // Обработка дубликата - негативный сценарий, озвучиваем
      speakMessage('Дубликат');
    },
  });

  // Вспомогательная функция для создания SSCC
  const createSSCC = async (shiftId: string): Promise<string> => {
    // Инкрементируем счетчик для каждого нового SSCC
    ssccCounterRef.current += 1;

    const timestamp = Date.now();
    const counter = ssccCounterRef.current;
    const sscc = `SSCC${timestamp}_${counter}`;

    console.log(`GENERATED NEW SSCC: ${sscc} for shift ${shiftId} (counter: ${counter})`);
    return sscc;
  };

  // Обработчик удаления текущего короба
  const handleDeleteCurrentBox = () => {
    if (scanStats.currentBoxScanned > 0) {
      // Показать подтверждение
      setActiveModal('confirmDeleteBox');
    }
  };

  // Фактическое удаление текущего короба
  const confirmDeleteCurrentBox = () => {
    setScanStats(prev => ({
      ...prev,
      totalScanned: prev.totalScanned - prev.currentBoxScanned,
      currentBoxScanned: 0,
    }));
    setCurrentBoxCodes([]);
    setActiveModal(null);
  }; // Обработчик закрытия короба
  const handleCloseBox = () => {
    console.log('handleCloseBox called, isPrinting:', isPrinting);

    if (isPrinting || printLock || scanStats.currentBoxScanned <= 0) {
      console.log('Cannot close box: already printing or box is empty');
      return;
    }

    setIsPrinting(true);

    (async () => {
      try {
        const sscc = await createSSCC(shift?.result?.id || '');
        console.log('Created SSCC:', sscc);

        const printResult = await window.electronAPI.printBarcode(sscc);

        if (printResult.success) {
          console.log('Print successful, showing verification dialog');
          setPendingSSCC(sscc);
          setActiveModal('verification');
        } else {
          console.error('Print failed:', printResult.error);
          speakMessage('Ошибка печати этикетки');
          setIsPrinting(false);
          setPrintLock(false); // Снимаем блокировку при ошибке
        }
      } catch (error) {
        console.error('Error in handleCloseBox:', error);
        speakMessage('Ошибка печати этикетки');
        setIsPrinting(false);
        setPrintLock(false); // Снимаем блокировку при ошибке
      }
    })();

    setPrintLock(false);
  };
  // Обработчик завершения смены
  const handleFinishShift = () => {
    // Проверка, закрыт ли текущий короб
    if (useCrates && scanStats.currentBoxScanned > 0) {
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
            speakMessage('Ошибка завершения смены');
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
          speakMessage('Ошибка изменения статуса смены');
        },
      }
    );
  };

  // Колонки для таблицы кодов
  const columns = [
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
  ];

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
            <div className={styles.mainCounter}>
              <Text variant="display-1" className={styles.bigCounter}>
                {scanStats.currentBoxScanned}
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
            <Text variant="subheader-2">Коды в текущем коробе:</Text>
            <div className={styles.tableContainer}>
              <Table
                data={currentBoxCodes}
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
                  {Array.from({ length: boxCapacity || 1 }, (_, i) => (
                    <div
                      key={i}
                      className={`${styles.boxItem} 
                        ${i < scanStats.currentBoxScanned ? styles.boxItemScanned : ''} 
                        ${i === errorIndex ? styles.boxItemError : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* Большая полоса прогресса */}
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${boxCapacity > 0 ? (scanStats.currentBoxScanned / boxCapacity) * 100 : 0}%`,
                  }}
                />
              </div>
            </>
          )}

          {/* Кнопки управления */}
          <div className={styles.actionButtons}>
            {useCrates && (
              <>
                <Button
                  view="normal"
                  size="xl"
                  onClick={handleDeleteCurrentBox}
                  disabled={scanStats.currentBoxScanned === 0 || isPrinting}
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
                </Button>

                <Button
                  view="action"
                  size="xl"
                  onClick={handleCloseBox}
                  disabled={scanStats.currentBoxScanned === 0 || printLock}
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
