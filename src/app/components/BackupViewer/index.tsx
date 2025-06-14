import { Button, Text, Spin, Card } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';

import styles from './BackupViewer.module.scss';
import { formatBackupTimestamp, groupBackupItemsByType } from '@/app/utils';
import { useBackup } from '@/app/hooks';

interface BackupViewerProps {
  shiftId: string;
}

export const BackupViewer: React.FC<BackupViewerProps> = ({ shiftId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'packages'>('products');

  const { loadBackupCodes, exportBackup, backupCodes } = useBackup({ shiftId });

  // Группируем коды по типу
  const { products, packages } = groupBackupItemsByType(backupCodes);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await loadBackupCodes();
      setIsLoading(false);
    };

    loadData();
  }, [loadBackupCodes]);

  const handleExport = async () => {
    const success = await exportBackup();
    if (success) {
      alert('Резервная копия успешно экспортирована');
    } else {
      alert('Не удалось экспортировать резервную копию');
    }
  };

  return (
    <div className={styles.backupViewer}>
      <div className={styles.backupHeader}>
        <Text variant="subheader-1">Резервное копирование данных</Text>

        <Button
          view="outlined"
          onClick={handleExport}
          disabled={isLoading || backupCodes.length === 0}
        >
          Экспорт данных
        </Button>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <Spin size="l" />
          <Text variant="body-1" style={{ marginTop: '16px' }}>
            Загрузка данных...
          </Text>
        </div>
      ) : backupCodes.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📂</div>
          <Text variant="subheader-1">Нет сохраненных данных</Text>
          <Text variant="body-1">Для этой смены еще не было создано резервных копий данных.</Text>
        </div>
      ) : (
        <>
          <div className={styles.tabsContainer}>
            <div
              className={`${styles.tab} ${activeTab === 'products' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <Text variant="body-1">Продукция ({products.length})</Text>
            </div>
            <div
              className={`${styles.tab} ${activeTab === 'packages' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('packages')}
            >
              <Text variant="body-1">Упаковки ({packages.length})</Text>
            </div>
          </div>

          {activeTab === 'products' && (
            <Card className={styles.backupTable}>
              <div className={styles.backupTableHeader}>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Код</Text>
                </div>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Время</Text>
                </div>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Дополнительно</Text>
                </div>
              </div>

              <div className={styles.backupTableBody}>
                {products.length === 0 ? (
                  <div className={styles.noData}>
                    <Text variant="body-1">Нет данных о продукции</Text>
                  </div>
                ) : (
                  products.map((item, index) => (
                    <div key={index} className={styles.backupTableRow}>
                      <div className={styles.backupTableCell}>
                        <Text variant="body-1">{item.code}</Text>
                      </div>
                      <div className={styles.backupTableCell}>
                        <Text variant="body-1">{formatBackupTimestamp(item.timestamp)}</Text>
                      </div>
                      <div className={styles.backupTableCell}>
                        <Button
                          view="flat"
                          size="s"
                          onClick={() => alert(JSON.stringify(item.additionalData, null, 2))}
                        >
                          Подробнее
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeTab === 'packages' && (
            <Card className={styles.backupTable}>
              <div className={styles.backupTableHeader}>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">SSCC</Text>
                </div>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Время</Text>
                </div>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Кол-во единиц</Text>
                </div>
                <div className={styles.backupTableCell}>
                  <Text variant="body-2">Действия</Text>
                </div>
              </div>

              <div className={styles.backupTableBody}>
                {packages.length === 0 ? (
                  <div className={styles.noData}>
                    <Text variant="body-1">Нет данных об упаковках</Text>
                  </div>
                ) : (
                  packages.map((item, index) => (
                    <div key={index} className={styles.backupTableRow}>
                      <div className={styles.backupTableCell}>
                        <Text variant="body-1">{item.code}</Text>
                      </div>
                      <div className={styles.backupTableCell}>
                        <Text variant="body-1">{formatBackupTimestamp(item.timestamp)}</Text>
                      </div>
                      <div className={styles.backupTableCell}>
                        <Text variant="body-1">{item.additionalData?.items?.length || 0}</Text>
                      </div>
                      <div className={styles.backupTableCell}>
                        <Button
                          view="flat"
                          size="s"
                          onClick={() => alert(JSON.stringify(item.additionalData, null, 2))}
                        >
                          Подробнее
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
