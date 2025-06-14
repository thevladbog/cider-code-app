import { Button, Card, Table, Text } from '@gravity-ui/uikit';
import React, { useCallback, useState } from 'react';

import { useScannerWithoutPacking } from '../../hooks';
import { DataMatrixData, IShiftScheme } from '../../types';
import { formatGtin } from '../../utils';

interface ScanWithoutPackagingProps {
  shift: IShiftScheme | null;
  enabled?: boolean;
}

export const ScanWithoutPackaging: React.FC<ScanWithoutPackagingProps> = ({
  shift,
  enabled = true,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>('');

  const { scannedCodes, scanMessage, scanError, pendingCodes, isProcessing, sendPendingCodes } =
    useScannerWithoutPacking({
      shift,
      enabled,
      batchSize: 5, // Отправляем коды батчами по 5
      onScanSuccess: (data: DataMatrixData) => {
        console.log('Scan success:', data);
        setStatusMessage(`Отсканирован код: ${data.gtin}-${data.serialNumber}`);
      },
      onScanError: (message: string) => {
        console.error('Scan error:', message);
        setStatusMessage(`Ошибка сканирования: ${message}`);
      },
      onBatchSent: (codes: string[], count: number) => {
        console.log('Batch sent:', codes, count);
        setStatusMessage(`Отправлено ${count} кодов на сервер`);
      },
    });

  const handleSendPending = useCallback(async () => {
    try {
      await sendPendingCodes();
      setStatusMessage('Все накопленные коды отправлены');
    } catch (error: any) {
      setStatusMessage(`Ошибка отправки: ${error?.message || error}`);
    }
  }, [sendPendingCodes]);

  const columns = [
    {
      id: 'index',
      name: '№',
      width: 50,
      accessor: 'index',
    },
    {
      id: 'gtin',
      name: 'GTIN',
      render: (item: DataMatrixData) => formatGtin(item.gtin),
    },
    {
      id: 'serialNumber',
      name: 'Серийный номер',
      render: (item: DataMatrixData) => item.serialNumber,
    },
  ];

  const tableData = scannedCodes.map((code, index) => ({
    ...code,
    index: index + 1,
  }));

  return (
    <Card>
      <div style={{ padding: '16px' }}>
        <Text variant="header-1">Сканирование без упаковки</Text>

        <div style={{ margin: '16px 0' }}>
          <Text variant="body-1">
            Отсканировано: {scannedCodes.length} | В очереди: {pendingCodes.length} | Статус:{' '}
            {scanError ? 'Ошибка' : 'Готов'}
          </Text>
        </div>

        {scanMessage && (
          <div style={{ margin: '16px 0' }}>
            <Text variant="body-2" color={scanError ? 'danger' : 'info'}>
              {scanMessage}
            </Text>
          </div>
        )}

        {statusMessage && (
          <div style={{ margin: '16px 0' }}>
            <Text variant="body-2" color="positive">
              {statusMessage}
            </Text>
          </div>
        )}

        <div style={{ margin: '16px 0' }}>
          <Button
            view="action"
            size="l"
            onClick={handleSendPending}
            disabled={pendingCodes.length === 0 || isProcessing}
            loading={isProcessing}
          >
            Отправить накопленные коды ({pendingCodes.length})
          </Button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <Text variant="subheader-2">Отсканированные коды:</Text>
          <Table data={tableData} columns={columns} emptyMessage="Нет отсканированных кодов" />
        </div>
      </div>
    </Card>
  );
};
