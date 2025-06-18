import { create } from 'zustand';

import { Device, DeviceStatus } from '../types';
import { rendererLogger } from '../utils/simpleRendererLogger';

interface DeviceState {
  devices: Device[];
  addDevice: (device: Device) => void;
  updateDeviceStatus: (id: string, status: DeviceStatus) => void;
  updateDeviceConnection: (id: string, connection: string | null) => void;
  setDevices: (devices: Device[]) => void;
}

// Начальный список устройств
const initialDevices: Device[] = [
  {
    id: 'barcode-scanner',
    name: 'Сканер штрих-кодов',
    type: 'scanner',
    status: 'disconnected',
    connection: null,
  },
  {
    id: 'label-printer',
    name: 'Принтер этикеток',
    type: 'printer',
    status: 'disconnected',
    connection: null,
    isNetwork: false,
  },
];

export const useDeviceStore = create<DeviceState>((set, get) => ({
  // Начальное состояние
  devices: initialDevices,

  // Добавление нового устройства
  addDevice: device => set(state => ({ devices: [...state.devices, device] })),

  // Обновление статуса устройства
  updateDeviceStatus: (id, newStatus) => {
    rendererLogger.debug('Updating device status', { id, newStatus });
    const { devices } = get();
    const newDevices = devices.map(device =>
      device.id === id ? { ...device, status: newStatus } : device
    );
    rendererLogger.debug('Updated devices list', { newDevices });

    set(_state => ({
      devices: newDevices,
    }));

    const { devices: settedDev } = get();
    rendererLogger.debug('Set devices result', { settedDev });
  },
  // Обновление информации о подключении устройства
  updateDeviceConnection: (id, connection) => {
    rendererLogger.debug('Updating device connection', { id, connection });
    const { devices } = get();
    const newDevices = devices.map(device =>
      device.id === id ? { ...device, connection: connection } : device
    );
    rendererLogger.debug('Updated devices with connection', { newDevices });
    set(_state => ({
      devices: newDevices,
    }));

    const { devices: settedDev } = get();
    rendererLogger.debug('Connection update result', { settedDev });
  },

  // Полная замена списка устройств
  setDevices: devices => set({ devices }),
}));

// Функция для инициализации устройств из сохраненных настроек
export const initializeDevices = async () => {
  try {
    // Получаем сохраненные настройки сканера
    const savedPort = await window.electronAPI.getSavedPort();
    if (savedPort) {
      // Устанавливаем статус сканера как подключенный
      useDeviceStore.getState().updateDeviceStatus('barcode-scanner', 'connected');
      useDeviceStore.getState().updateDeviceConnection('barcode-scanner', savedPort);

      // Пробуем подключиться к сканеру
      try {
        await window.electronAPI.connectToPort(savedPort);
      } catch (error) {
        rendererLogger.error('Failed to connect to saved scanner port', { error });
        // В случае ошибки сбрасываем статус
        useDeviceStore.getState().updateDeviceStatus('barcode-scanner', 'disconnected');
        useDeviceStore.getState().updateDeviceConnection('barcode-scanner', null);
      }
    }

    // Получаем сохраненные настройки принтера
    const savedPrinter = await window.electronAPI.getSavedPrinter();
    if (savedPrinter && savedPrinter.name) {
      // Устанавливаем статус принтера как подключенный
      useDeviceStore.getState().updateDeviceStatus('label-printer', 'connected');
      useDeviceStore.getState().updateDeviceConnection('label-printer', savedPrinter.name);

      // Обновляем параметр isNetwork
      useDeviceStore.getState().setDevices(
        useDeviceStore.getState().devices.map(device =>
          device.id === 'label-printer'
            ? {
                ...device,
                isNetwork: savedPrinter.isNetwork,
                address: savedPrinter.address,
              }
            : device
        )
      );
    }
  } catch (error) {
    rendererLogger.error('Failed to initialize devices', { error });
  }
};
