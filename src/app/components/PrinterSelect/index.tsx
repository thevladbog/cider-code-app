import { Button, RadioGroup, Select, Text, TextInput } from '@gravity-ui/uikit';
import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useDeviceStore } from '@/app/store/deviceStore';
import { useSettingsStore } from '@/app/store/settingsStore';
import { PrinterInfo } from '@/app/types';
import styles from './PrinterSelect.module.scss';

interface PrinterSelectProps {
  onConnected?: () => void;
}

export const PrinterSelect: React.FC<PrinterSelectProps> = ({ onConnected }) => {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [serialPorts, setSerialPorts] = useState<Array<{ path: string; manufacturer?: string }>>(
    []
  );
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<'system' | 'usb' | 'network' | 'serial'>(
    'system'
  );
  const [networkAddress, setNetworkAddress] = useState('');
  const [networkPort, setNetworkPort] = useState(9100);
  const [selectedSerialPort, setSelectedSerialPort] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState(9600);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [printerSettings, setPrinter] = useSettingsStore(
    useShallow(state => [state.printer, state.setPrinter])
  );

  const [devices, updateDeviceStatus, updateDeviceConnection, setDevices] = useDeviceStore(
    useShallow(state => [
      state.devices,
      state.updateDeviceStatus,
      state.updateDeviceConnection,
      state.setDevices,
    ])
  );

  const printerDevice = devices.find(device => device.id === 'label-printer');
  const isConnected = printerDevice?.status === 'connected' || printerDevice?.status === 'verified'; // Получение списка доступных принтеров
  const loadPrinters = async () => {
    setLoading(true);
    setError(null);
    try {
      const availablePrinters = await window.electronAPI.listPrinters();
      setPrinters(availablePrinters);

      // Загружаем список последовательных портов
      const ports = await window.electronAPI.listPrinterSerialPorts();
      setSerialPorts(ports);

      // Если есть подключенный принтер, выбираем его
      if (printerSettings) {
        if (printerSettings.connectionType === 'network' && printerSettings.address) {
          setConnectionType('network');
          setNetworkAddress(printerSettings.address);
          setNetworkPort(printerSettings.port || 9100);
        } else if (printerSettings.connectionType === 'serial' && printerSettings.serialPath) {
          setConnectionType('serial');
          setSelectedSerialPort(printerSettings.serialPath);
          setBaudRate(printerSettings.baudRate || 9600);
        } else if (
          printerSettings.name &&
          availablePrinters.some(p => p.name === printerSettings.name)
        ) {
          setConnectionType('system');
          setSelectedPrinter(printerSettings.name);
        } else if (printerSettings.name && printerSettings.name.startsWith('USB:')) {
          setConnectionType('usb');
          setSelectedPrinter(printerSettings.name);
        } else if (availablePrinters.length > 0) {
          setSelectedPrinter(availablePrinters[0].name);
        }
      } else if (availablePrinters.length > 0) {
        setSelectedPrinter(availablePrinters[0].name);
      }
    } catch (err) {
      console.error('Failed to load printers:', err);
      setError('Не удалось загрузить список принтеров');
    } finally {
      setLoading(false);
    }
  };

  // Подключение к принтеру
  const connectPrinter = async () => {
    let validationError = false;

    // Валидация в зависимости от типа подключения
    if (connectionType === 'system' && !selectedPrinter) {
      setError('Выберите принтер');
      validationError = true;
    } else if (connectionType === 'usb' && !selectedPrinter) {
      setError('Выберите USB-принтер');
      validationError = true;
    } else if (connectionType === 'network') {
      if (!networkAddress) {
        setError('Введите IP-адрес принтера');
        validationError = true;
      }
      if (!networkPort) {
        setError('Введите порт принтера');
        validationError = true;
      }
    } else if (connectionType === 'serial') {
      if (!selectedSerialPort) {
        setError('Выберите COM-порт');
        validationError = true;
      }
      if (!baudRate) {
        setError('Укажите скорость COM-порта');
        validationError = true;
      }
    }

    if (validationError) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Формируем конфигурацию принтера в зависимости от типа подключения
      type PrinterConfig = {
        name: string;
        connectionType: 'system' | 'usb' | 'network' | 'serial';
        vendorId?: number;
        productId?: number;
        address?: string;
        port?: number;
        serialPath?: string;
        baudRate?: number;
      };

      let printerConfig: PrinterConfig | undefined;

      if (connectionType === 'system' || connectionType === 'usb') {
        if (!selectedPrinter) {
          setError('Принтер не выбран');
          return;
        }

        printerConfig = {
          name: selectedPrinter,
          connectionType: connectionType,
        };

        // Добавляем USB-специфичные параметры, если это USB-принтер
        if (connectionType === 'usb' && selectedPrinter.startsWith('USB:')) {
          const idParts = selectedPrinter.substring(4).split('-');
          if (idParts.length === 2) {
            printerConfig.vendorId = parseInt(idParts[0], 16);
            printerConfig.productId = parseInt(idParts[1], 16);
          }
        }
      } else if (connectionType === 'network') {
        printerConfig = {
          name: `Network Printer (${networkAddress}:${networkPort})`,
          connectionType: 'network',
          address: networkAddress,
          port: networkPort,
        };
      } else if (connectionType === 'serial') {
        if (!selectedSerialPort) {
          setError('COM-порт не выбран');
          return;
        }

        printerConfig = {
          name: `Serial Printer (${selectedSerialPort})`,
          connectionType: 'serial',
          serialPath: selectedSerialPort,
          baudRate: baudRate,
        };
      }

      if (!printerConfig) {
        setError('Неподдерживаемый тип подключения');
        return;
      }

      console.log(
        'Calling connectToPrinter with:',
        printerConfig.name,
        connectionType === 'network',
        connectionType === 'network' ? networkAddress : undefined
      );

      // Вызываем метод подключения к принтеру
      const result = await window.electronAPI.connectToPrinter(
        printerConfig.name,
        connectionType === 'network',
        connectionType === 'network' ? networkAddress : undefined
      );

      console.log('connectToPrinter result:', result);

      if (result.success) {
        console.log('Printer connected successfully, updating state');
        // Сохраняем конфигурацию принтера
        setPrinter(
          printerConfig.name,
          connectionType === 'network',
          connectionType === 'network' ? networkAddress : undefined,
          printerConfig
        );

        // Обновляем статус устройства
        updateDeviceStatus('label-printer', 'connected');
        updateDeviceConnection('label-printer', printerConfig.name);

        // Обновляем параметры принтера в списке устройств
        setDevices(
          devices.map(device =>
            device.id === 'label-printer'
              ? {
                  ...device,
                  isNetwork: connectionType === 'network',
                  address: connectionType === 'network' ? networkAddress : undefined,
                  connectionType: connectionType,
                  status: 'connected', // Явно устанавливаем статус
                }
              : device
          )
        );

        setTimeout(() => {
          const updatedDevices = useDeviceStore.getState().devices;
          const updatedPrinter = updatedDevices.find(d => d.id === 'label-printer');
          console.log('Updated printer device:', updatedPrinter);
        }, 100);

        onConnected?.();
      } else {
        console.error('Connection failed:', result.error);
        setError(`Ошибка подключения: ${result.error}`);
        updateDeviceStatus('label-printer', 'disconnected');
        updateDeviceConnection('label-printer', null);
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError('Произошла ошибка при подключении к принтеру');
      updateDeviceStatus('label-printer', 'disconnected');
      updateDeviceConnection('label-printer', null);
    } finally {
      setLoading(false);
    }
  };

  // Отключение от принтера
  const disconnectPrinter = () => {
    setPrinter(null, false);
    updateDeviceStatus('label-printer', 'disconnected');
    updateDeviceConnection('label-printer', null);
  };

  // Загружаем список принтеров при монтировании компонента
  useEffect(() => {
    loadPrinters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Подготавливаем опции для Select системных принтеров
  const systemPrinterOptions = printers
    .filter(printer => !printer.name.startsWith('USB:')) // Исключаем USB-принтеры из системных
    .map(printer => ({
      value: printer.name,
      content: `${printer.name}${printer.isDefault ? ' (По умолчанию)' : ''}`,
    }));

  // Подготавливаем опции для Select USB-принтеров
  const usbPrinterOptions = printers
    .filter(printer => printer.name.startsWith('USB:'))
    .map(printer => {
      // Разбираем имя USB-принтера для отображения
      const usbPrefix = 'USB:';
      const idPart = printer.name.substring(usbPrefix.length);
      const [vendorId, productId] = idPart.split('-');
      const displayName = `USB Принтер (VID:${vendorId}, PID:${productId})`;

      return {
        value: printer.name,
        content: displayName,
      };
    });

  // Опции для COM-портов
  const serialPortOptions = serialPorts.map(port => ({
    value: port.path,
    content: `${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`,
  }));

  // Опции для скорости COM-порта
  const baudRateOptions = [
    { value: '9600', content: '9600' },
    { value: '19200', content: '19200' },
    { value: '38400', content: '38400' },
    { value: '57600', content: '57600' },
    { value: '115200', content: '115200' },
  ];

  return (
    <div className={styles.printerSelect}>
      <div className={styles.header}>
        <Text variant="subheader-1">Принтер этикеток</Text>
      </div>

      <div className={styles.connectionType}>
        <Text variant="body-1">Тип подключения:</Text>
        <RadioGroup
          value={connectionType}
          onChange={value =>
            setConnectionType(
              value.target.value as unknown as 'system' | 'usb' | 'network' | 'serial'
            )
          }
          options={[
            { value: 'system', content: 'Системный принтер' },
            { value: 'usb', content: 'USB принтер' },
            { value: 'network', content: 'Сетевой принтер' },
            { value: 'serial', content: 'COM-порт' },
          ]}
          disabled={isConnected || loading}
        />
      </div>

      <div className={styles.configPanel}>
        {/* Для системного принтера */}
        {connectionType === 'system' && (
          <div className={styles.systemPrinterConfig}>
            <Text variant="body-1">Выберите системный принтер:</Text>
            <Select
              value={[selectedPrinter || '']}
              options={systemPrinterOptions}
              onUpdate={value => setSelectedPrinter(value.length > 0 ? value[0] : null)}
              placeholder="Выберите принтер"
              disabled={loading || isConnected}
              width="max"
            />

            <Button view="flat" onClick={loadPrinters} disabled={loading || isConnected}>
              Обновить список
            </Button>
          </div>
        )}

        {/* Для USB принтера */}
        {connectionType === 'usb' && (
          <div className={styles.usbPrinterConfig}>
            <Text variant="body-1">Выберите USB принтер:</Text>
            <Select
              value={[selectedPrinter || '']}
              options={usbPrinterOptions}
              onUpdate={value => setSelectedPrinter(value.length > 0 ? value[0] : null)}
              placeholder="Выберите USB принтер"
              disabled={loading || isConnected}
              width="max"
            />

            <Button view="flat" onClick={loadPrinters} disabled={loading || isConnected}>
              Обновить список
            </Button>
          </div>
        )}

        {/* Для сетевого принтера */}
        {connectionType === 'network' && (
          <div className={styles.networkPrinterConfig}>
            <div className={styles.inputGroup}>
              <Text variant="body-1">IP-адрес принтера:</Text>
              <TextInput
                value={networkAddress}
                onChange={e => setNetworkAddress(e.target.value)}
                placeholder="Например: 192.168.1.100"
                disabled={isConnected}
              />
            </div>
            <div className={styles.inputGroup}>
              <Text variant="body-1">Порт:</Text>
              <TextInput
                value={networkPort.toString()}
                onChange={e => {
                  const portValue = parseInt(e.target.value);
                  if (!isNaN(portValue) && portValue > 0 && portValue <= 65535) {
                    setNetworkPort(portValue);
                  }
                }}
                placeholder="По умолчанию: 9100"
                disabled={isConnected}
              />
            </div>
          </div>
        )}

        {/* Для COM-порта */}
        {connectionType === 'serial' && (
          <div className={styles.serialPortConfig}>
            <div className={styles.inputGroup}>
              <Text variant="body-1">COM-порт:</Text>
              <Select
                value={[selectedSerialPort || '']}
                options={serialPortOptions}
                onUpdate={value => setSelectedSerialPort(value.length > 0 ? value[0] : null)}
                placeholder="Выберите COM-порт"
                disabled={loading || isConnected}
                width="max"
              />
            </div>
            <div className={styles.inputGroup}>
              <Text variant="body-1">Скорость порта:</Text>
              <Select
                value={[baudRate.toString()]}
                options={baudRateOptions}
                onUpdate={value => setBaudRate(parseInt(value[0] || '9600'))}
                placeholder="Выберите скорость"
                disabled={loading || isConnected}
                width="max"
              />
            </div>
            <Button view="flat" onClick={loadPrinters} disabled={loading || isConnected}>
              Обновить список портов
            </Button>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            view="action"
            onClick={connectPrinter}
            disabled={loading || isConnected}
            loading={loading}
          >
            Подключить
          </Button>

          {isConnected && (
            <Button view="flat" onClick={disconnectPrinter} disabled={loading}>
              Отключить
            </Button>
          )}
        </div>
      </div>

      {isConnected && (
        <Text variant="body-1" className={styles.statusMessageSuccess}>
          Принтер{' '}
          {printerSettings.connectionType === 'network'
            ? `по адресу ${printerSettings.address}`
            : printerSettings.connectionType === 'serial'
              ? `на порту ${printerSettings.serialPath}`
              : printerSettings.name}{' '}
          подключен
        </Text>
      )}

      {error && (
        <Text variant="body-1" className={styles.statusMessageError}>
          {error}
        </Text>
      )}
    </div>
  );
};
