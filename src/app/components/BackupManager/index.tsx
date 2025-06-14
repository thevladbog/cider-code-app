import { Button, Card, Text } from '@gravity-ui/uikit';
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
        alert(`Бэкап смены ${shiftId} успешно экспортирован`);
      } else {
        alert(`Ошибка экспорта: ${result.error}`);
      }
    } catch (error) {
      alert(`Ошибка экспорта: ${error}`);
    }
  };

  const handleDeleteShift = async (date: string, shiftId: string) => {
    if (!confirm(`Вы уверены, что хотите удалить бэкап смены ${shiftId}?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteBackup(shiftId);
      if (result.success) {
        alert(`Бэкап смены ${shiftId} успешно удален`);
        loadBackupFiles(); // Обновляем список
      } else {
        alert(`Ошибка удаления: ${result.error}`);
      }
    } catch (error) {
      alert(`Ошибка удаления: ${error}`);
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
          🔄 Обновить
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
                <Text variant="subheader-1">📅 {formatDate(backupFile.date)}</Text>
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
                          <span className={shift.hasGeneralLog ? styles.hasFile : styles.noFile}>
                            📋 Общий лог
                          </span>
                          {shift.hasGeneralLog && (
                            <span className={styles.fileSize}>
                              ({formatFileSize(shift.generalLogSize)})
                            </span>
                          )}
                        </div>

                        <div className={styles.fileInfo}>
                          <span
                            className={shift.hasSuccessfulScans ? styles.hasFile : styles.noFile}
                          >
                            ✅ Успешные сканирования
                          </span>
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
                        👁️ Просмотр
                      </Button>
                      <Button
                        view="outlined"
                        size="s"
                        onClick={() => handleExportShift(backupFile.date, shift.shiftId)}
                      >
                        📤 Экспорт
                      </Button>
                      <Button
                        view="outlined"
                        size="s"
                        onClick={() => handleDeleteShift(backupFile.date, shift.shiftId)}
                      >
                        🗑️ Удалить
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
      {selectedShift && (
        <div className={styles.backupViewerModal}>
          <div className={styles.backupViewerOverlay} onClick={() => setSelectedShift(null)} />
          <div className={styles.backupViewerContent}>
            <BackupViewerNew
              shiftId={selectedShift.shiftId}
              onClose={() => setSelectedShift(null)}
            />
          </div>
        </div>
      )}
    </Card>
  );
};

export default BackupManager;
