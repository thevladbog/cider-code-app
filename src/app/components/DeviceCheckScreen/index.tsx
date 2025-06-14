import { Button, Switch, Text } from '@gravity-ui/uikit';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDeviceStore } from '@/app/store/deviceStore';
import { AppHeader } from '../AppHeader';
import { BarcodeTestModal } from '../BarcodeTestModal';
import { DeviceCheckItem } from '../DeviceCheckItem';
import { PrinterSelect } from '../PrinterSelect';
import { ScannerSelect } from '../ScannerSelect';
import styles from './DeviceCheckScreen.module.scss';

export const DeviceCheckScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeConfig, setActiveConfig] = useState<string | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testDeviceType, setTestDeviceType] = useState<'scanner' | 'printer'>('scanner');
  const [printTestBarcode, setPrintTestBarcode] = useState(false);
  const [printTestLabelEnabled, setPrintTestLabelEnabled] = useState(true);

  const devices = useDeviceStore(state => state.devices);
  const updateDeviceStatus = useDeviceStore(state => state.updateDeviceStatus);

  // Проверяем готовы ли все устройства
  // Если печать тестовой этикетки отключена, принтер считается проверенным автоматически
  const allDevicesVerified = devices.every(device => {
    if (device.id === 'label-printer' && !printTestLabelEnabled) {
      return true; // Принтер считается проверенным, если печать отключена
    }
    return device.status === 'verified';
  });

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

  // Обработчик изменения тоглера печати
  const handlePrintTestToggle = (enabled: boolean) => {
    setPrintTestLabelEnabled(enabled);
    // Если печать отключена, автоматически помечаем принтер как проверенный
    if (!enabled) {
      updateDeviceStatus('label-printer', 'verified');
    } else {
      // Если печать включена, сбрасываем статус принтера
      const printer = devices.find(d => d.id === 'label-printer');
      if (printer && printer.status === 'verified') {
        updateDeviceStatus('label-printer', printer.connection ? 'connected' : 'disconnected');
      }
    }
  };
  return (
    <div className={styles.deviceCheckScreen}>
      <AppHeader />
      <div className={styles.content}>
        <div className={styles.deviceCheckScreenHeader}>
          <div className={styles.headerContent}>
            <div className={styles.titleRow}>
              <Text variant="display-3">Проверка оборудования</Text>
            </div>

            <div className={styles.printerSettings}>
              <div className={styles.switchContainer}>
                <Switch checked={printTestLabelEnabled} onUpdate={handlePrintTestToggle} size="m" />
                <Text variant="body-1">Печатать проверочную этикетку</Text>
              </div>
              <Text variant="body-2" color="secondary">
                При отключении этикетка не печатается и проверка принтера пропускается
              </Text>
            </div>
          </div>

          {allDevicesVerified && (
            <Button view="action" size="l" onClick={() => navigate('/shifts')}>
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
                  handleTestDevice(
                    device.id,
                    device.id === 'barcode-scanner' ? 'scanner' : 'printer'
                  )
                }
                onConfigure={() => handleConfigureDevice(device.id)}
                skipTest={device.id === 'label-printer' && !printTestLabelEnabled}
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
        )}{' '}
        <BarcodeTestModal
          visible={testModalVisible}
          onClose={() => setTestModalVisible(false)}
          onSuccess={handleTestSuccess}
          type={testDeviceType}
          printBarcode={printTestBarcode}
        />
      </div>
    </div>
  );
};
