import { Text, Spin, Card } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './ScanScreen.module.scss';
import { useWorkplaceData } from '@/app/api/queries';
import { ScannerSelect } from '../ScannerSelect';

import logoImage from '@/assets/logo.svg';
import scanImage from '@/assets/scan-image.svg';


export const ScanScreen: React.FC = () => {
  const navigate = useNavigate();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Запрашиваем данные о рабочем месте по штрих-коду
  const {
    data: workplaceData,
    isLoading,
    error,
    isSuccess,
  } = useWorkplaceData(scannedCode, !!scannedCode);

  // Подписываемся на события сканирования
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBarcodeScanned(barcode => {
      console.log('Scanned access card:', barcode);
      setScannedCode(barcode);
      setScanError(null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // После успешного получения данных переходим на экран проверки устройств
  useEffect(() => {
    if (isSuccess && workplaceData) {
      // Сохраняем данные рабочего места в localStorage или state management
      localStorage.setItem('workplaceData', JSON.stringify(workplaceData));

      // Переходим на экран проверки устройств
      navigate('/devices');
    }
  }, [isSuccess, workplaceData, navigate]);

  // Обработка ошибок запроса
  useEffect(() => {
    if (error) {
      console.error('Error fetching workplace data:', error);
      setScanError('Рабочее место не найдено. Проверьте карту доступа.');
      setScannedCode(null);
    }
  }, [error]);

  return (
    <div className={styles.scanScreen}>
      <Card className={styles.scanCard}>
        <div className={styles.logoContainer}>
          <img src={logoImage} alt="Company Logo" className={styles.logo} />
        </div>

        <Text variant="display-2" className={styles.title}>
          Система контроля производства
        </Text>

        <ScannerSelect />

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Spin size="l" />
            <Text variant="body-1" className={styles.loadingText}>
              Проверка рабочего места...
            </Text>
          </div>
        ) : (
          <div className={styles.scanContainer}>
            <div className={styles.scanImageContainer}>
              <img src={scanImage} alt="Scan barcode" className={styles.scanImage} />
            </div>

            <Text variant="display-3" className={styles.scanTitle}>
              Отсканируйте карту доступа
            </Text>

            <Text variant="body-1" className={styles.scanDescription}>
              Для входа в систему необходимо отсканировать штрих-код с карты доступа
            </Text>

            {scanError && (
              <Text variant="body-1" className={styles.errorText}>
                {scanError}
              </Text>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <Text variant="caption-1" className={styles.footerText}>
            © 2023 Ваша Компания. Все права защищены.
          </Text>
        </div>
      </Card>
    </div>
  );
};
