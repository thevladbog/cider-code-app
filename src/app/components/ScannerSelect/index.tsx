import { Button, Select, Text } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';

import { useDeviceStore } from '@/app/store/deviceStore';
import { useSettingsStore } from '@/app/store/settingsStore';
import { SerialPortInfo } from '@/app/types';
import styles from './ScannerSelect.module.scss';

interface ScannerSelectProps {
  onConnected?: () => void;
}

export const ScannerSelect: React.FC<ScannerSelectProps> = ({ onConnected }) => {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scannerPort = useSettingsStore(state => state.scannerPort);
  const setScannerPort = useSettingsStore(state => state.setScannerPort);

  const devices = useDeviceStore(state => state.devices);
  const updateDeviceStatus = useDeviceStore(state => state.updateDeviceStatus);
  const updateDeviceConnection = useDeviceStore(state => state.updateDeviceConnection);

  const scannerDevice = devices.find(device => device.id === 'barcode-scanner');
  const isConnected = scannerDevice?.status === 'connected' || scannerDevice?.status === 'verified'; // Получение списка доступных COM-портов
  const loadPorts = async () => {
    setLoading(true);
    setError(null);
    try {
      const availablePorts = await window.electronAPI.listSerialPorts();
      setPorts(availablePorts);

      // Если есть подключенный порт, выбираем его
      if (scannerPort && availablePorts.some(port => port.path === scannerPort)) {
        setSelectedPort(scannerPort);
      } else if (availablePorts.length > 0) {
        setSelectedPort(availablePorts[0].path);
      }
    } catch (err) {
      console.error('Failed to load ports:', err);
      setError('Не удалось загрузить список портов');
    } finally {
      setLoading(false);
    }
  };

  // Подключение к сканеру
  const connectScanner = async () => {
    if (!selectedPort) return;

    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.connectToPort(selectedPort);
      if (result.success) {
        setScannerPort(selectedPort);
        updateDeviceStatus('barcode-scanner', 'connected');
        updateDeviceConnection('barcode-scanner', selectedPort);
        onConnected?.();
      } else {
        setError(`Ошибка подключения: ${result.error}`);
        updateDeviceStatus('barcode-scanner', 'disconnected');
        updateDeviceConnection('barcode-scanner', null);
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError('Произошла ошибка при подключении к сканеру');
      updateDeviceStatus('barcode-scanner', 'disconnected');
      updateDeviceConnection('barcode-scanner', null);
    } finally {
      setLoading(false);
    }
  };

  // Отключение от сканера
  const disconnectScanner = () => {
    setScannerPort(null);
    updateDeviceStatus('barcode-scanner', 'disconnected');
    updateDeviceConnection('barcode-scanner', null);
  };
  // Загружаем список портов при монтировании компонента
  useEffect(() => {
    loadPorts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Подготавливаем опции для Select
  const portOptions = ports.map(port => ({
    value: port.path,
    content: `${port.path} - ${port.manufacturer}`,
  }));

  return (
    <div className={styles.scannerSelect}>
      <div className={styles.scannerSelectContainer}>
        <Text variant="subheader-1">Сканер штрих-кодов</Text>

        <div className={styles.portSelection}>
          <Select
            value={[selectedPort || '']}
            options={portOptions}
            onUpdate={value => setSelectedPort(value.length > 0 ? value[0] : null)}
            placeholder="Выберите COM-порт"
            disabled={loading || isConnected}
            width="max"
          />

          <Button
            view="action"
            onClick={connectScanner}
            disabled={!selectedPort || loading || isConnected}
            loading={loading}
          >
            Подключить
          </Button>

          {isConnected && (
            <Button view="flat" onClick={disconnectScanner} disabled={loading}>
              Отключить
            </Button>
          )}

          <Button view="flat" onClick={loadPorts} disabled={loading}>
            Обновить список
          </Button>
        </div>

        {isConnected && scannerPort && (
          <Text variant="body-1" className={styles.statusMessageSuccess}>
            Сканер подключен к порту {scannerPort}
          </Text>
        )}

        {error && (
          <Text variant="body-1" className={styles.statusMessageError}>
            {error}
          </Text>
        )}
      </div>
    </div>
  );
};
