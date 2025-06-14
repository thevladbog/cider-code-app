import React, { useEffect, useState } from 'react';

import { useBackup } from '../../hooks/useBackup';
import { BackupItem } from '../../types';
import {
  formatBackupTimestamp,
  getExtendedBackupStats,
  parseSuccessfulScansContent,
} from '../../utils/backupHelpers';

import styles from './BackupViewer.module.scss';

interface BackupViewerProps {
  shiftId: string;
  onClose?: () => void;
}

const BackupViewer: React.FC<BackupViewerProps> = ({ shiftId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'successful'>('general');
  const [generalLog, setGeneralLog] = useState<BackupItem[]>([]);
  const [successfulScans, setSuccessfulScans] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { restoreBackup, exportBackup } = useBackup({
    shiftId,
    onBackupSuccess: () => {},
    onBackupError: () => {},
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await restoreBackup();

        if (!data.canRestore) {
          setError('Нет данных для восстановления для данной смены');
          return;
        }

        setGeneralLog(data.generalLog);
        setSuccessfulScans(data.successfulScans);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [shiftId, restoreBackup]);

  const handleExport = async () => {
    try {
      const result = await exportBackup();
      if (result) {
        alert('Бэкап успешно экспортирован');
      } else {
        alert('Ошибка экспорта бэкапа');
      }
    } catch (err) {
      alert('Ошибка экспорта: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    }
  };

  const stats = getExtendedBackupStats(generalLog);
  const parsedScans = parseSuccessfulScansContent(successfulScans);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка данных бэкапа...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Ошибка</h3>
          <p>{error}</p>
          <button onClick={onClose} className={styles.button}>
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Бэкап смены: {shiftId}</h2>
        <div className={styles.actions}>
          <button onClick={handleExport} className={styles.exportButton}>
            Экспортировать
          </button>
          {onClose && (
            <button onClick={onClose} className={styles.closeButton}>
              Закрыть
            </button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className={styles.stats}>
        <h3>Статистика</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Всего операций:</span>
            <span className={styles.statValue}>{stats.totalItems}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Успешных:</span>
            <span className={styles.statValue}>{stats.successfulItems}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Ошибок:</span>
            <span className={styles.statValue}>{stats.errorItems}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Продукция:</span>
            <span className={styles.statValue}>{stats.productItems}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Упаковки:</span>
            <span className={styles.statValue}>{stats.packageItems}</span>
          </div>
        </div>
      </div>

      {/* Табы */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
          onClick={() => setActiveTab('general')}
        >
          Общий лог ({generalLog.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'successful' ? styles.active : ''}`}
          onClick={() => setActiveTab('successful')}
        >
          Успешные сканирования ({parsedScans.length})
        </button>
      </div>

      {/* Содержимое табов */}
      <div className={styles.tabContent}>
        {activeTab === 'general' && (
          <div className={styles.generalLog}>
            <h4>Общий лог операций</h4>
            {generalLog.length === 0 ? (
              <p>Нет записей в общем логе</p>
            ) : (
              <div className={styles.logList}>
                {generalLog.map((item, index) => (
                  <div
                    key={index}
                    className={`${styles.logItem} ${
                      item.status === 'error' ? styles.error : styles.success
                    }`}
                  >
                    <div className={styles.logHeader}>
                      <span className={styles.timestamp}>
                        {formatBackupTimestamp(item.timestamp)}
                      </span>
                      <span className={styles.type}>
                        {item.type === 'product' ? 'Продукция' : 'Упаковка'}
                      </span>
                      <span className={`${styles.status} ${styles[item.status]}`}>
                        {item.status === 'success' ? 'Успех' : 'Ошибка'}
                      </span>
                    </div>
                    <div className={styles.code}>
                      <strong>Код:</strong> {item.rawCode || item.code}
                    </div>
                    {item.errorMessage && (
                      <div className={styles.errorMessage}>
                        <strong>Ошибка:</strong> {item.errorMessage}
                      </div>
                    )}
                    {item.additionalData && (
                      <div className={styles.additionalData}>
                        <strong>Доп. данные:</strong> {JSON.stringify(item.additionalData, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'successful' && (
          <div className={styles.successfulScans}>
            <h4>Успешно отсканированные коды</h4>
            {parsedScans.length === 0 ? (
              <p>Нет успешно отсканированных кодов</p>
            ) : (
              <div className={styles.scansList}>
                {parsedScans.map((scan, index) => {
                  // Добавляем дополнительный отступ к заголовкам коробов для лучшей визуализации
                  const isNewBoxHeader = scan.type === 'box';

                  return (
                    <div
                      key={index}
                      className={`${styles.scanItem} ${
                        scan.type === 'box' ? styles.box : styles.product
                      } ${scan.isInBox ? styles.inBox : ''}`}
                      style={isNewBoxHeader ? { marginTop: '10px' } : {}}
                    >
                      <span className={styles.scanType}>
                        {scan.type === 'box' ? '📦 КОРОБ' : '📄 Продукция'}
                        {scan.isInBox ? ' (в коробе)' : ''}
                      </span>
                      <span className={styles.scanCode}>{scan.code}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Сырой текст для копирования */}
            {successfulScans && (
              <div className={styles.rawText}>
                <h5>Исходный текст (для копирования):</h5>
                <textarea
                  className={styles.rawTextarea}
                  value={successfulScans}
                  readOnly
                  rows={10}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupViewer;
