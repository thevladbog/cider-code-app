import { Button, Modal, Spin, Text } from '@gravity-ui/uikit';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { verifySSCCCode } from '@/app/services/packagingService';
import { IShiftScheme } from '@/app/types';
import { formatSSCC, isDev } from '@/app/utils';
import { rendererLogger } from '@/app/utils/rendererLogger';
import styles from './PackageVerificationModal.module.scss';

interface PackageVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
  sscc: string;
  productCount: number;
  shift: IShiftScheme;
  isLoading?: boolean;
}

export const PackageVerificationModal: React.FC<PackageVerificationModalProps> = ({
  visible,
  onClose,
  onVerified,
  sscc,
  productCount,
  shift,
  isLoading = false,
}) => {
  if (isDev()) {
    rendererLogger.debug('PackageVerificationModal: DEV mode active');
    rendererLogger.debug('PackageVerificationModal: visible state', { visible });
  }

  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Используем ref для отслеживания состояния верификации, чтобы избежать зависимости в useEffect
  const verifyingRef = useRef(false);

  // Extract complex expression to a variable for dependency array
  const operatorId = shift.operatorId ?? undefined; // Сбрасываем состояние при открытии/закрытии модального окна
  useEffect(() => {
    if (visible) {
      setScannedCode(null);
      setVerificationResult(null);
      setErrorMessage(null);
      setVerifyingCode(false);
      verifyingRef.current = false;
    }
  }, [visible]); // Обработчик сканирования с использованием useCallback
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      // Предотвращаем повторное сканирование во время обработки
      if (verifyingRef.current) return;
      console.log('🔍 SSCC barcode scanned:', barcode);
      setScannedCode(barcode);
      setVerifyingCode(true);
      verifyingRef.current = true;

      try {
        // Проверяем, соответствует ли отсканированный код ожидаемому
        console.log('🔍 Verifying SSCC code...');
        const isValid = await verifySSCCCode(shift.id, barcode, sscc, operatorId);
        console.log('🔍 Verification result:', isValid);
        setVerificationResult(isValid);
        if (isValid) {
          console.log('✅ SSCC verification successful');

          // Автоматически закрываем модальное окно через 1.5 секунды
          setTimeout(() => {
            onVerified();
          }, 1500);
        } else {
          setErrorMessage('Отсканированный код не соответствует SSCC коду упаковки');
        }
      } catch (error) {
        console.error('Error verifying SSCC:', error);
        setErrorMessage('Ошибка при проверке кода. Пожалуйста, попробуйте еще раз.');
        setVerificationResult(false);
      } finally {
        setVerifyingCode(false);
        verifyingRef.current = false;
      }
    },
    [shift.id, sscc, operatorId, onVerified]
  ); // Подписываемся на события сканирования
  useEffect(() => {
    if (!visible) return;

    const unsubscribe = window.electronAPI.onBarcodeScanned(handleBarcodeScan);

    return () => {
      unsubscribe();
    };
  }, [visible, handleBarcodeScan]);

  // Обработчик сброса сканирования
  const handleResetScan = useCallback(() => {
    setScannedCode(null);
    setVerificationResult(null);
    setErrorMessage(null);
    setVerifyingCode(false);
    verifyingRef.current = false;
  }, []);

  // Форматируем дату для отображения
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Modal open={visible} onClose={onClose} aria-labelledby="package-verification-modal-title">
      <div className={styles.packageVerificationModal}>
        <div className={styles.title}>
          <Text variant="display-2" id="package-verification-modal-title">
            Проверка упаковки
          </Text>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Spin size="l" />
            <Text variant="body-1" style={{ marginTop: '16px' }}>
              Печать этикетки...
            </Text>
          </div>
        ) : verifyingCode ? (
          <div className={styles.loadingContainer}>
            <Spin size="l" />
            <Text variant="body-1" style={{ marginTop: '16px' }}>
              Проверка кода...
            </Text>
          </div>
        ) : (
          <>
            <div className={styles.subheader}>
              <Text variant="body-1" color="secondary">
                Отсканируйте штрих-код с этикетки для подтверждения корректности упаковки
              </Text>
            </div>
            <div className={styles.packageInfo}>
              <div className={styles.packageInfoHeader}>
                <Text variant="subheader-1">Информация об упаковке</Text>
              </div>

              <div className={styles.packageCode}>{formatSSCC(sscc)}</div>

              <div className={styles.packageDetails}>
                <div className={styles.packageDetail}>
                  <Text variant="caption-1">Товар</Text>
                  <Text variant="body-1" className={styles.detailValue}>
                    {shift.product.fullName}
                  </Text>
                </div>

                <div className={styles.packageDetail}>
                  <Text variant="caption-1">Количество</Text>
                  <Text variant="body-1" className={styles.detailValue}>
                    {productCount} шт.
                  </Text>
                </div>

                <div className={styles.packageDetail}>
                  <Text variant="caption-1">Дата</Text>
                  <Text variant="body-1" className={styles.detailValue}>
                    {formatDate(new Date())}
                  </Text>
                </div>
              </div>
            </div>
            {!scannedCode ? (
              <div className={styles.scanInstructions}>
                <div className={styles.scanIcon}>📷</div>
                <div className={styles.scanText}>
                  <Text variant="subheader-1">Отсканируйте SSCC код с этикетки упаковки</Text>
                </div>
                <Text variant="body-1" style={{ textAlign: 'center' }}>
                  Для продолжения работы необходимо отсканировать штрих-код с этикетки, которую вы
                  распечатали на принтере
                </Text>
              </div>
            ) : (
              <div
                className={`${styles.scanResult} ${
                  verificationResult ? styles.scanResultSuccess : styles.scanResultError
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '24px' }}>{verificationResult ? '✅' : '❌'}</div>
                  <Text variant="subheader-1">
                    {verificationResult ? 'Верификация успешна!' : 'Ошибка верификации'}
                  </Text>
                </div>

                <Text variant="body-1" style={{ marginTop: '8px' }}>
                  {verificationResult
                    ? 'Отсканированный код соответствует SSCC коду упаковки. Можно продолжать работу.'
                    : 'Отсканированный код не соответствует SSCC коду упаковки. Пожалуйста, проверьте этикетку и повторите сканирование.'}
                </Text>

                {!verificationResult && (
                  <div style={{ marginTop: '8px' }}>
                    <Text variant="body-2">Ожидаемый код: {sscc}</Text>
                    <Text variant="body-2">Отсканировано: {scannedCode}</Text>
                  </div>
                )}
              </div>
            )}{' '}
            <div className={styles.actions}>
              <Button view="flat" onClick={onClose}>
                Отмена
              </Button>{' '}
              {!verificationResult && scannedCode && (
                <Button view="action" onClick={handleResetScan}>
                  Повторить сканирование
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
