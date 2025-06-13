import { Modal, Text, Button, Spin } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';

import styles from './CreateShiftModal.module.scss';
import { useCreateShift } from '@/app/api/queries';


interface CreateShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (shiftId: string) => void;
}

export const CreateShiftModal: React.FC<CreateShiftModalProps> = ({
  visible,
  onClose,
  onCreated,
}) => {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutate: createShift, isPending, error, data } = useCreateShift();

  // Сбрасываем состояние при открытии/закрытии модального окна
  useEffect(() => {
    if (visible) {
      setScannedBarcode(null);
      setErrorMessage(null);
    }
  }, [visible]);

  // Подписываемся на события сканирования штрих-кодов
  useEffect(() => {
    if (!visible) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(barcode => {
      console.log('Scanned product barcode:', barcode);
      setScannedBarcode(barcode);
      setErrorMessage(null);
    });

    return () => {
      unsubscribe();
    };
  }, [visible]);

  // Обработка при успешном создании смены
  useEffect(() => {
    if (data && data.id) {
      onCreated(data.id);
    }
  }, [data, onCreated]);

  // Обработка ошибок от API
  useEffect(() => {
    if (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Произошла ошибка при создании смены';
      setErrorMessage(errorMsg);
    }
  }, [error]);

  // Обработчик для создания смены
  const handleCreateShift = () => {
    if (!scannedBarcode) {
      setErrorMessage('Необходимо отсканировать штрих-код продукции');
      return;
    }

    createShift(scannedBarcode);
  };

  return (
    <Modal open={visible} onClose={onClose} aria-labelledby="create-shift-modal-title">
      <div className={styles.createShiftModal}>
        <div className={styles.title}>
          <Text variant="display-2" id="create-shift-modal-title">
            Создание новой смены
          </Text>
        </div>

        {isPending ? (
          <div className={styles.loadingContainer}>
            <Spin size="l" />
            <Text variant="body-1" style={{ marginTop: '16px' }}>
              Создание смены...
            </Text>
          </div>
        ) : scannedBarcode ? (
          <div className={styles.barcodeResult}>
            <div className={styles.barcodeValue}>
              <Text variant="display-3">{scannedBarcode}</Text>
            </div>
            <div className={styles.barcodeDescription}>
              <Text variant="body-1">
                `Штрих-код продукции успешно отсканирован. Нажмите &#34Создать смену&#34 для продолжения.`
              </Text>
            </div>
          </div>
        ) : (
          <div className={styles.scanInstructions}>
            <div className={styles.scanIcon}>📷</div>
            <div className={styles.scanText}>
              <Text variant="subheader-1">Отсканируйте штрих-код продукции</Text>
            </div>
            <Text variant="body-1" style={{ textAlign: 'center' }}>
              Для создания новой смены необходимо отсканировать штрих-код продукции с помощью
              подключенного сканера
            </Text>
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorMessage}>
            <Text variant="body-1">{errorMessage}</Text>
          </div>
        )}

        <div className={styles.actions}>
          <Button view="flat" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>

          {scannedBarcode && (
            <Button
              view="action"
              onClick={handleCreateShift}
              disabled={isPending}
              loading={isPending}
            >
              Создать смену
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
