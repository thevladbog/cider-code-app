import { Button, Text } from '@gravity-ui/uikit';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BarcodeTestModal } from '../BarcodeTestModal';
import { DeviceCheckItem } from '../DeviceCheckItem';
import { PrinterSelect } from '../PrinterSelect';
import { ScannerSelect } from '../ScannerSelect';
import styles from './DeviceCheckScreen.module.scss';
import { useDeviceStore } from '@/app/store/deviceStore';

export const DeviceCheckScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeConfig, setActiveConfig] = useState<string | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testDeviceType, setTestDeviceType] = useState<'scanner' | 'printer'>('scanner');
  const [printTestBarcode, setPrintTestBarcode] = useState(false);

  const devices = useDeviceStore(state => state.devices);
  const updateDeviceStatus = useDeviceStore(state => state.updateDeviceStatus);

  // Проверяем готовы ли все устройства
  const allDevicesVerified = devices.every(device => device.status === 'verified');

  // Обработчик для запуска теста
  const handleTestDevice = (id: string, type: 'scanner' | 'printer') => {
    setTestDeviceType(type);
    // Для принтера сначала распечатаем штрих-код
    setPrintTestBarcode(type === 'printer');
    setTestModalVisible(true);
  };

  console.log({ activeConfig, devices });

  // Обработчик успешного завершения теста
  const handleTestSuccess = () => {
    updateDeviceStatus(
      testDeviceType === 'scanner' ? 'barcode-scanner' : 'label-printer',
      'verified'
    );
  };

  // Обработчик для настройки устройства
  const handleConfigureDevice = (id: string) => {
    setActiveConfig(id);
  };

  return (
    <div className={styles.deviceCheckScreen}>
      <div className={styles.deviceCheckScreenHeader}>
        <Text variant="display-3">Проверка оборудования</Text>

        {allDevicesVerified && (
          <Button 
            view="action" 
            size="l" 
            onClick={() => navigate('/shifts')}
          >
            Продолжить работу
          </Button>
        )}
      </div>

      {activeConfig && (
        <div className={styles.deviceConfig}>
          {activeConfig === 'barcode-scanner' && (
            <ScannerSelect onConnected={() => setActiveConfig(null)} />
          )}

          {activeConfig === 'label-printer' && (
            <PrinterSelect onConnected={() => setActiveConfig(null)} />
          )}

          <Button view="flat" onClick={() => setActiveConfig(null)} style={{ marginTop: '16px' }}>
            Вернуться к списку
          </Button>
        </div>
      )}

      {!activeConfig && (
        <div className={styles.deviceList}>
          {devices.map(device => (
            <DeviceCheckItem
              key={device.id}
              id={device.id}
              name={device.name}
              type={device.id === 'barcode-scanner' ? 'scanner' : 'printer'}
              status={device.status}
              connection={device.connection}
              onCheck={() =>
                handleTestDevice(device.id, device.id === 'barcode-scanner' ? 'scanner' : 'printer')
              }
              onConfigure={() => handleConfigureDevice(device.id)}
            />
          ))}
        </div>
      )}

      {allDevicesVerified && !activeConfig && (
        <div className={styles.statusSummary + ' ' + styles.statusSummarySuccess}>
          <Text variant="body-1">
            Все устройства успешно проверены. Вы можете продолжить работу с системой.
          </Text>
        </div>
      )}

      {!allDevicesVerified && !activeConfig && (
        <div className={styles.statusSummary + ' ' + styles.statusSummaryPending}>
          <Text variant="body-1">
            Пожалуйста, подключите и проверьте все необходимые устройства перед началом работы.
          </Text>
        </div>
      )}

      <BarcodeTestModal
        visible={testModalVisible}
        onClose={() => setTestModalVisible(false)}
        onSuccess={handleTestSuccess}
        type={testDeviceType}
        printBarcode={printTestBarcode}
      />
    </div>
  );
};
