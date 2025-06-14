import {
  ArrowRotateRight,
  ArrowUpFromSquare,
  Calendar,
  Check,
  Eye,
  FileText,
  TrashBin,
  TriangleExclamation,
  Xmark,
} from '@gravity-ui/icons';
import { Button, Card, Icon, Modal, Text } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';

import BackupViewerNew from '../BackupViewer/BackupViewerNew';

import styles from './BackupManager.module.scss';

interface BackupFile {
  date: string;
  shifts: {
    shiftId: string;
    hasGeneralLog: boolean;
    hasSuccessfulScans: boolean;
    generalLogSize?: number;
    successfulScansSize?: number;
    modifiedDate?: Date;
  }[];
}

const BackupManager: React.FC = () => {
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<{ date: string; shiftId: string } | null>(
    null
  );

  // Состояния для модальных окон
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDangerous: false,
  });

  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: '',
  });

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: '',
  });

  useEffect(() => {
    loadBackupFiles();
  }, []);

  const loadBackupFiles = async () => {
    setIsLoading(true);
    try {
      const files = await window.electronAPI.getAllBackupFiles();
      setBackupFiles(files);
    } catch (error) {
      console.error('Error loading backup files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportShift = async (date: string, shiftId: string) => {
    try {
      const result = await window.electronAPI.exportBackup(shiftId);
      if (result.success) {
        setSuccessModal({
          isOpen: true,
          message: `Бэкап смены ${shiftId} успешно экспортирован`,
        });
      } else {
        setErrorModal({
          isOpen: true,
          message: `Ошибка экспорта: ${result.error}`,
        });
      }
    } catch (error) {
      setErrorModal({
        isOpen: true,
        message: `Ошибка экспорта: ${error}`,
      });
    }
  };

  const handleDeleteShift = async (date: string, shiftId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Подтверждение удаления',
      message: `Вы уверены, что хотите удалить бэкап смены ${shiftId}? Это действие нельзя отменить.`,
      isDangerous: true,
      onConfirm: () => performDeleteShift(shiftId),
    });
  };

  const performDeleteShift = async (shiftId: string) => {
    try {
      const result = await window.electronAPI.deleteBackup(shiftId);
      if (result.success) {
        setSuccessModal({
          isOpen: true,
          message: `Бэкап смены ${shiftId} успешно удален`,
        });
        loadBackupFiles(); // Обновляем список
      } else {
        setErrorModal({
          isOpen: true,
          message: `Ошибка удаления: ${result.error}`,
        });
      }
    } catch (error) {
      setErrorModal({
        isOpen: true,
        message: `Ошибка удаления: ${error}`,
      });
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Нет данных';
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.loading}>
          <Text variant="body-1">Загрузка бэкапов...</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <Text variant="display-2">Управление бэкапами</Text>
        <Button view="action" onClick={loadBackupFiles}>
          <Icon data={ArrowRotateRight} size={16} />
          Обновить
        </Button>
      </div>

      {backupFiles.length === 0 ? (
        <div className={styles.emptyState}>
          <Text variant="body-1">Нет сохраненных бэкапов</Text>
        </div>
      ) : (
        <div className={styles.backupList}>
          {backupFiles.map(backupFile => (
            <div key={backupFile.date} className={styles.dateGroup}>
              <div className={styles.dateHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon data={Calendar} size={16} />
                  <Text variant="subheader-1">{formatDate(backupFile.date)}</Text>
                </div>
                <Text variant="body-2">
                  {backupFile.shifts.length} смен
                  {backupFile.shifts.length === 1 ? 'а' : backupFile.shifts.length < 5 ? 'ы' : ''}
                </Text>
              </div>

              <div className={styles.shiftsList}>
                {backupFile.shifts.map(shift => (
                  <div key={shift.shiftId} className={styles.shiftItem}>
                    <div className={styles.shiftInfo}>
                      <div className={styles.shiftHeader}>
                        <Text variant="body-1">
                          <strong>Смена: {shift.shiftId}</strong>
                        </Text>
                        {shift.modifiedDate && (
                          <Text variant="body-2" className={styles.modifiedDate}>
                            Изменено: {shift.modifiedDate.toLocaleString('ru-RU')}
                          </Text>
                        )}
                      </div>

                      <div className={styles.shiftDetails}>
                        <div className={styles.fileInfo}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icon data={FileText} size={14} />
                            <span className={shift.hasGeneralLog ? styles.hasFile : styles.noFile}>
                              Общий лог
                            </span>
                          </div>
                          {shift.hasGeneralLog && (
                            <span className={styles.fileSize}>
                              ({formatFileSize(shift.generalLogSize)})
                            </span>
                          )}
                        </div>

                        <div className={styles.fileInfo}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icon data={Check} size={14} />
                            <span
                              className={shift.hasSuccessfulScans ? styles.hasFile : styles.noFile}
                            >
                              Успешные сканирования
                            </span>
                          </div>
                          {shift.hasSuccessfulScans && (
                            <span className={styles.fileSize}>
                              ({formatFileSize(shift.successfulScansSize)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.shiftActions}>
                      <Button
                        view="outlined"
                        size="s"
                        onClick={() =>
                          setSelectedShift({ date: backupFile.date, shiftId: shift.shiftId })
                        }
                      >
                        <Icon data={Eye} size={16} />
                        Просмотр
                      </Button>
                      <Button
                        view="outlined"
                        size="s"
                        onClick={() => handleExportShift(backupFile.date, shift.shiftId)}
                      >
                        <Icon data={ArrowUpFromSquare} size={16} />
                        Экспорт
                      </Button>
                      <Button
                        view="outlined"
                        size="s"
                        onClick={() => handleDeleteShift(backupFile.date, shift.shiftId)}
                      >
                        <Icon data={TrashBin} size={16} />
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно для просмотра бэкапа */}
      <Modal open={selectedShift !== null} onClose={() => setSelectedShift(null)}>
        <div
          style={{
            minWidth: '90vw',
            maxWidth: '1200px',
            minHeight: '80vh',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Icon data={Eye} size={24} />
            <Text variant="header-1">Просмотр бэкапа смены {selectedShift?.shiftId}</Text>
            <Button
              view="flat"
              size="s"
              onClick={() => setSelectedShift(null)}
              style={{ marginLeft: 'auto' }}
            >
              <Icon data={Xmark} size={16} />
            </Button>
          </div>
          {selectedShift && (
            <BackupViewerNew
              shiftId={selectedShift.shiftId}
              onClose={() => setSelectedShift(null)}
            />
          )}
        </div>
      </Modal>

      {/* Модальное окно подтверждения */}
      <Modal
        open={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {confirmModal.isDangerous && (
                <div style={{ color: 'var(--g-color-text-danger)' }}>
                  <Icon data={TriangleExclamation} size={24} />
                </div>
              )}
              <Text variant="header-2">{confirmModal.title}</Text>
            </div>
          </div>
          <div className={styles.modalBody}>
            <Text variant="body-1">{confirmModal.message}</Text>
          </div>
          <div className={styles.modalFooter}>
            <Button
              view="flat"
              size="l"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Отмена
            </Button>
            <Button
              view={confirmModal.isDangerous ? 'outlined-danger' : 'action'}
              size="l"
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal({ ...confirmModal, isOpen: false });
              }}
            >
              {confirmModal.isDangerous ? (
                <>
                  <Icon data={TrashBin} size={16} />
                  Удалить
                </>
              ) : (
                'Подтвердить'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно успеха */}
      <Modal
        open={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: 'var(--g-color-text-positive)' }}>
                <Icon data={Check} size={24} />
              </div>
              <Text variant="header-2">Операция выполнена</Text>
            </div>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.successMessage}>
              <Text variant="body-1">{successModal.message}</Text>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button
              view="action"
              size="l"
              onClick={() => setSuccessModal({ ...successModal, isOpen: false })}
            >
              Отлично!
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно ошибки */}
      <Modal
        open={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: 'var(--g-color-text-danger)' }}>
                <Icon data={Xmark} size={24} />
              </div>
              <Text variant="header-2">Ошибка</Text>
            </div>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.errorMessage}>
              <Text variant="body-1">{errorModal.message}</Text>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button
              view="outlined-danger"
              size="l"
              onClick={() => setErrorModal({ ...errorModal, isOpen: false })}
            >
              Понятно
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default BackupManager;
