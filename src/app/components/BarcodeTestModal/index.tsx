import { Button, Modal, Spin, Text } from '@gravity-ui/uikit';
import JsBarcode from 'jsbarcode';
import React, { useEffect, useRef, useState } from 'react';

import styles from './BarcodeTestModal.module.scss';

interface BarcodeTestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'scanner' | 'printer';
  printBarcode?: boolean;
}

// Функция для генерации случайного штрих-кода
const generateRandomBarcode = () => {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const BarcodeTestModal: React.FC<BarcodeTestModalProps> = ({
  visible,
  onClose,
  onSuccess,
  type,
  printBarcode = false,
}) => {
  const [barcode, setBarcode] = useState<string>('');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (visible) {
      // Генерируем новый штрих-код при открытии модального окна
      const newBarcode = generateRandomBarcode();
      setBarcode(newBarcode);
      setScannedBarcode(null);
      setErrorMessage(null);
      setSuccess(false);
    }
  }, [visible]);

  useEffect(() => {
    if (barcode && svgRef.current) {
      try {
        // Генерируем изображение штрих-кода
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 16,
          margin: 10,
        });

        // Если это для принтера, печатаем штрих-код
        if (type === 'printer' && printBarcode) {
          handlePrintBarcode();
        }
      } catch (err) {
        console.error('Error generating barcode:', err);
        setErrorMessage('Ошибка при генерации штрих-кода');
      }
    }
  }, [barcode, printBarcode, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подписываемся на события сканирования штрих-кодов
  useEffect(() => {
    if (!visible) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(scannedCode => {
      console.log('Scanned barcode:', scannedCode);
      setScannedBarcode(scannedCode);

      // Проверяем, соответствует ли отсканированный код сгенерированному
      if (scannedCode === barcode) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500); // Закрываем через 1.5 секунды после успешного сканирования
      } else {
        setErrorMessage('Отсканированный код не соответствует ожидаемому');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, barcode, onSuccess, onClose]);

  // Обработчик для печати штрих-кода
  const handlePrintBarcode = async () => {
    if (!barcode) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.printBarcode(barcode);
      if (!result.success) {
        setErrorMessage(`Ошибка при печати: ${result.error}`);
      }
    } catch (err) {
      console.error('Error printing barcode:', err);
      setErrorMessage('Ошибка при печати штрих-кода');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open={visible} onOpenChange={onClose} aria-labelledby="barcode-test-modal-title">
      <div className={styles.barcodeModal}>
        <div className={styles.title}>
          <Text variant="display-2" id="barcode-test-modal-title">
            {type === 'scanner' ? 'Проверка сканера штрих-кодов' : 'Проверка принтера этикеток'}
          </Text>
        </div>

        <div className={styles.subheader}>
          <Text variant="body-1" color="secondary">
            {type === 'printer'
              ? 'Штрих-код будет напечатан на принтере. Отсканируйте его, чтобы подтвердить работу оборудования.'
              : 'Отсканируйте этот штрих-код с помощью подключенного сканера.'}
          </Text>
        </div>

        <div className={styles.barcodeImage}>
          <svg ref={svgRef}></svg>
        </div>

        <div className={styles.barcodeValue}>
          <Text variant="body-1">{barcode}</Text>
        </div>

        {type === 'printer' && (
          <Button view="action" onClick={handlePrintBarcode} loading={loading} disabled={loading}>
            Распечатать штрих-код
          </Button>
        )}

        {loading && (
          <div style={{ marginTop: '16px' }}>
            <Spin size="l" />
            <Text variant="body-2">Печать...</Text>
          </div>
        )}

        {scannedBarcode && (
          <div
            className={`${styles.scanResult} ${success ? styles.scanResultSuccess : styles.scanResultError}`}
          >
            <Text variant="body-1">
              {success ? 'Штрих-код успешно отсканирован!' : `Отсканировано: ${scannedBarcode}`}
            </Text>

            {errorMessage && !success && (
              <Text variant="body-2" style={{ color: '#ef4444', marginTop: '8px' }}>
                {errorMessage}
              </Text>
            )}
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button view="flat" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
};
