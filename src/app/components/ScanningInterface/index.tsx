import { Text, Card, Button } from '@gravity-ui/uikit';
import React, { useState, useEffect } from 'react';

import styles from './ScanningInterface.module.scss';
import { IShiftScheme, ShiftStatus } from '@/app/types';
import { useBackup, useScannerInShift } from '@/app/hooks';
import { formatGtin } from '@/app/utils';


interface ScanningInterfaceProps {
  shift: IShiftScheme;
  onScanCountUpdated?: (count: number) => void;
}

export const ScanningInterface: React.FC<ScanningInterfaceProps> = ({
  shift,
  onScanCountUpdated,
}) => {
  const [scanEnabled, setScanEnabled] = useState(true);
  const [showBackupError, setShowBackupError] = useState(false);

  // Используем хук для бэкапа
  const { backupProduct, backupError } = useBackup({
    shiftId: shift.id,
    onBackupSuccess: (type, code) => {
      console.log(`Successfully backed up ${type} code: ${code}`);
    },
    onBackupError: (error, type, code) => {
      console.error(`Error backing up ${type} code ${code}: ${error}`);
      setShowBackupError(true);
      // Автоматически скрываем сообщение об ошибке через 3 секунды
      setTimeout(() => setShowBackupError(false), 3000);
    },
  });

  // Используем наш хук для сканирования
  const { lastScannedCode, scannedCodes, scanMessage, scanError, resetScan, clearHistory } =
    useScannerInShift({
      shift,
      enabled: scanEnabled && shift.status === ShiftStatus.PLANNED,
      onScanSuccess: async data => {
        console.log('Successfully scanned:', data);

        // Создаем уникальный ключ для кода
        const codeKey = `${data.gtin}_${data.countryCode}${data.serialNumber}`;

        // Сохраняем код в бэкап
        await backupProduct(codeKey, {
          gtin: data.gtin,
          countryCode: data.countryCode,
          serialNumber: data.serialNumber,
          verificationCode: data.verificationCode,
          scanTime: new Date().toISOString(),
        });

        // Здесь можно добавить логику для упаковки и т.д.
      },
    });

  // Оповещаем родительский компонент об изменении количества отсканированных кодов
  useEffect(() => {
    onScanCountUpdated?.(scannedCodes.length);
  }, [scannedCodes.length, onScanCountUpdated]);

  // Автоматический сброс сообщения о сканировании через 3 секунды
  useEffect(() => {
    if (scanMessage) {
      const timer = setTimeout(() => {
        resetScan();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [scanMessage, resetScan]);

  return (
    <div className={styles.scanningInterface}>
      <Card className={styles.scanningCard}>
        <div className={styles.scanningHeader}>
          <Text variant="display-3">Сканирование продукции</Text>

          <div className={styles.scanControls}>
            <Button
              view={scanEnabled ? 'action' : 'normal'}
              onClick={() => setScanEnabled(!scanEnabled)}
              disabled={shift.status !== ShiftStatus.PLANNED}
            >
              {scanEnabled ? 'Сканирование включено' : 'Сканирование отключено'}
            </Button>

            <Button view="flat" onClick={clearHistory} disabled={scannedCodes.length === 0}>
              Очистить историю
            </Button>
          </div>
        </div>

        <div className={styles.scanningContent}>
          <div className={styles.lastScanContainer}>
            <Text variant="subheader-1">Последнее сканирование:</Text>

            {lastScannedCode ? (
              <div
                className={`${styles.lastScanResult} ${scanError ? styles.lastScanError : styles.lastScanSuccess}`}
              >
                <div className={styles.codeValue}>
                  <Text variant="display-3">{formatGtin(lastScannedCode.gtin)}</Text>
                </div>

                <div className={styles.codeDetails}>
                  <div className={styles.codeDetail}>
                    <Text variant="body-2">Код страны:</Text>
                    <Text variant="body-1">{lastScannedCode.countryCode}</Text>
                  </div>

                  <div className={styles.codeDetail}>
                    <Text variant="body-2">Серийный номер:</Text>
                    <Text variant="body-1">{lastScannedCode.serialNumber}</Text>
                  </div>

                  <div className={styles.codeDetail}>
                    <Text variant="body-2">Код проверки:</Text>
                    <Text variant="body-1">{lastScannedCode.verificationCode}</Text>
                  </div>
                </div>

                {scanMessage && (
                  <div className={styles.scanMessage}>
                    <Text
                      variant="body-1"
                      className={scanError ? styles.errorText : styles.successText}
                    >
                      {scanMessage}
                    </Text>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.noScanYet}>
                <div className={styles.scanIcon}>📷</div>
                <Text variant="body-1">Отсканируйте Datamatrix код продукции</Text>
              </div>
            )}
          </div>

          <div className={styles.scanningStats}>
            <div className={styles.statsCard}>
              <div className={styles.statsValue}>
                <Text variant="display-3">{scannedCodes.length}</Text>
              </div>
              <Text variant="body-1">Всего отсканировано</Text>
            </div>

            {/* Здесь можно добавить другую статистику */}
          </div>
        </div>
      </Card>

      {showBackupError && backupError && (
        <div className={styles.backupError}>
          <Text variant="body-1" className={styles.errorText}>
            Ошибка при сохранении резервной копии: {backupError}
          </Text>
        </div>
      )}

      {scannedCodes.length > 0 && (
        <Card className={styles.scanHistoryCard}>
          <Text variant="subheader-1" className={styles.scanHistoryTitle}>
            История сканирования
          </Text>

          <div className={styles.scanHistoryTable}>
            <div className={styles.scanHistoryHeader}>
              <div className={styles.scanHistoryCell}>
                <Text variant="body-2">GTIN</Text>
              </div>
              <div className={styles.scanHistoryCell}>
                <Text variant="body-2">Страна</Text>
              </div>
              <div className={styles.scanHistoryCell}>
                <Text variant="body-2">Серийный номер</Text>
              </div>
              <div className={styles.scanHistoryCell}>
                <Text variant="body-2">Код проверки</Text>
              </div>
            </div>

            <div className={styles.scanHistoryBody}>
              {scannedCodes.map((code, index) => (
                <div
                  key={`${code.gtin}_${code.serialNumber}_${index}`}
                  className={styles.scanHistoryRow}
                >
                  <div className={styles.scanHistoryCell}>
                    <Text variant="body-1">{code.gtin}</Text>
                  </div>
                  <div className={styles.scanHistoryCell}>
                    <Text variant="body-1">{code.countryCode}</Text>
                  </div>
                  <div className={styles.scanHistoryCell}>
                    <Text variant="body-1">{code.serialNumber}</Text>
                  </div>
                  <div className={styles.scanHistoryCell}>
                    <Text variant="body-1">{code.verificationCode}</Text>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
