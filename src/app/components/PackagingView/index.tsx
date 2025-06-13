import { Button, Card, Progress, Text } from '@gravity-ui/uikit';
import React, { useCallback, useEffect, useState } from 'react';

import { useBackup } from '@/app/hooks';
import {
  createPackageWithSSCC,
  getPackages,
  getPackagingProgress,
  preparePackageLabelZpl,
} from '@/app/services/packagingService';
import { IShiftScheme, ShiftStatus } from '@/app/types';
import { formatSSCC } from '@/app/utils';
import { PackageVerificationModal } from '../PackageVerificationModal';
import styles from './PackagingView.module.scss';

interface PackagingViewProps {
  shift: IShiftScheme;
}

export const PackagingView: React.FC<PackagingViewProps> = ({ shift }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSSCC, setPendingSSCC] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [packagingProgress, setPackagingProgress] = useState(0);
  const [currentBatchCount, setCurrentBatchCount] = useState(0);
  /* eslint-disable */
  const [createdPackages, setCreatedPackages] = useState<any[]>([]);

  // Используем хук для бэкапа
  const { backupPackage } = useBackup({
    shiftId: shift.id,
  });

  // Обновляем прогресс упаковки
  const updateProgress = useCallback(() => {
    const progress = getPackagingProgress(shift.id, shift.countInBox ?? 0);
    setPackagingProgress(progress.progress);
    setCurrentBatchCount(progress.currentCount);

    // Получаем созданные упаковки
    const packages = getPackages(shift.id);
    setCreatedPackages(packages);
  }, [shift.id, shift.countInBox]);

  // Обновляем информацию при монтировании и изменении смены
  useEffect(() => {
    updateProgress();

    // Периодически обновляем информацию
    const intervalId = setInterval(updateProgress, 5000);

    return () => clearInterval(intervalId);
  }, [updateProgress]);

  // Функция для создания упаковки и печати этикетки
  const handleCreatePackage = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Создаем упаковку с SSCC кодом от бэкенда
      const newPackage = await createPackageWithSSCC(shift.id, shift.product.id);

      if (newPackage) {
        // Сохраняем SSCC код для верификации
        setPendingSSCC(newPackage.sscc);

        // Сохраняем в бэкап
        await backupPackage(newPackage.sscc, {
          items: newPackage.items,
          timestamp: newPackage.timestamp,
        });

        // Генерируем и печатаем этикетку
        const zplCode = preparePackageLabelZpl(shift, newPackage.sscc, currentBatchCount);

        try {
          const printResult = await window.electronAPI.printZpl(zplCode);
          if (!printResult.success) {
            throw new Error(printResult.error || 'Ошибка печати');
          }

          // Показываем модальное окно для верификации
          setIsModalOpen(true);
        } catch (printError) {
          console.error('Error printing label:', printError);
          setError(
            'Ошибка печати этикетки: ' +
              (printError instanceof Error ? printError.message : 'Неизвестная ошибка')
          );
        }

        // Обновляем прогресс после создания упаковки
        updateProgress();
      }
    } catch (err) {
      console.error('Error creating package:', err);
      setError(
        'Ошибка при создании упаковки: ' +
          (err instanceof Error ? err.message : 'Неизвестная ошибка')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик успешной верификации
  const handleVerificationSuccess = () => {
    setIsModalOpen(false);
    setPendingSSCC(null);
    updateProgress();
  };

  const canCreatePackage =
    currentBatchCount >= (shift.countInBox ?? 0) && shift.status === ShiftStatus.PLANNED;

  return (
    <div className={styles.packagingView}>
      <Card className={styles.packagingCard}>
        <div className={styles.packagingHeader}>
          <Text variant="display-3">Упаковка продукции</Text>
        </div>

        <div className={styles.progressContainer}>
          <Text variant="subheader-1">Прогресс формирования упаковки:</Text>

          <div className={styles.progressInfo}>
            <Progress
              value={packagingProgress}
              theme={packagingProgress >= 100 ? 'success' : 'info'}
              size="m"
            />

            <Text variant="body-1" className={styles.progressText}>
              {currentBatchCount} из {shift.countInBox ?? 0} единиц продукции
            </Text>
          </div>

          <Button
            view="action"
            onClick={handleCreatePackage}
            disabled={!canCreatePackage || isLoading}
            loading={isLoading}
          >
            Создать упаковку и распечатать этикетку
          </Button>

          {error && (
            <Text variant="body-1" className={styles.errorText}>
              {error}
            </Text>
          )}
        </div>
      </Card>

      {createdPackages.length > 0 && (
        <Card className={styles.packagesCard}>
          <Text variant="subheader-1" className={styles.packagesTitle}>
            Созданные упаковки
          </Text>

          <div className={styles.packagesList}>
            {createdPackages.map((pkg, index) => (
              <div key={pkg.sscc} className={styles.packageItem}>
                <div className={styles.packageNumber}>
                  <Text variant="body-2">#{index + 1}</Text>
                </div>

                <div className={styles.packageSSCC}>
                  <Text variant="body-1" className={styles.packageSSCCValue}>
                    {formatSSCC(pkg.sscc)}
                  </Text>
                  <Text variant="caption-1" className={styles.packageTimestamp}>
                    {new Date(pkg.timestamp).toLocaleString('ru-RU')}
                  </Text>
                </div>

                <div className={styles.packageItems}>
                  <Text variant="body-2">{pkg.items.length} единиц продукции</Text>
                </div>

                <div className={styles.packageStatus}>
                  {pkg.verifiedAt ? (
                    <div className={styles.verifiedStatus}>
                      <Text variant="caption-1">Проверено</Text>
                    </div>
                  ) : (
                    <div className={styles.unverifiedStatus}>
                      <Text variant="caption-1">Не проверено</Text>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pendingSSCC && (
        <PackageVerificationModal
          visible={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onVerified={handleVerificationSuccess}
          sscc={pendingSSCC}
          productCount={currentBatchCount}
          shift={shift}
        />
      )}
    </div>
  );
};
