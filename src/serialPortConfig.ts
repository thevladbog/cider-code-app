import { ipcMain } from 'electron';
import { logger } from './services';

// Для версии 10.5.0 используйте require
const { SerialPort } = require('serialport');

import type { SerialPort as SerialPortType } from 'serialport';

let currentPort: SerialPortType | null = null;
let dataBuffer = '';

// Настройка обработки данных с COM-порта
export function setupSerialPort() {
  logger.info('Serial port service initialized');
}

// Получение списка доступных COM-портов
type SerialPortInfo = {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
};

export async function listSerialPorts() {
  try {
    const ports = await SerialPort.list();
    return ports.map((port: SerialPortInfo) => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Unknown',
      serialNumber: port.serialNumber || '',
      vendorId: port.vendorId || '',
      productId: port.productId || '',
    }));
  } catch (error) {
    logger.error('Error listing serial ports', { error: (error as Error).message });
    throw error;
  }
}

// Подключение к порту
export async function connectToPort(portPath: string) {
  try {
    // Закрываем текущее соединение, если есть
    if (currentPort && currentPort.isOpen) {
      await new Promise<void>((resolve, reject) => {
        currentPort?.close((err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Создаем новое соединение для версии 10.5.0
    currentPort = new SerialPort({
      path: portPath,
      baudRate: 9600,
      autoOpen: false,
    }); // Обработка данных со сканера
    (currentPort as SerialPortType).on('data', (data: Buffer) => {
      dataBuffer += data.toString();

      // Проверяем, есть ли символ окончания строки
      if (dataBuffer.includes('\r') || dataBuffer.includes('\n')) {
        const barcode = dataBuffer.trim();
        if (barcode) {
          // Отправляем событие в renderer process
          ipcMain.emit('barcode-scanned', null, barcode);
        }
        dataBuffer = ''; // Сбрасываем буфер
      }
    });

    // Обработка ошибок
    (currentPort as SerialPortType).on('error', (err: Error) => {
      logger.error('Serial port error', { error: err.message });
      ipcMain.emit('serial-port-error', null, err.message);
    });

    // Открываем порт
    await new Promise<void>((resolve, reject) => {
      currentPort?.open((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`Connected to serial port`, { portPath });
    return true;
  } catch (error) {
    logger.error('Error connecting to port', { error: (error as Error).message, portPath });
    throw error;
  }
}

// Отключение от порта
export async function disconnectFromPort() {
  if (!currentPort || !currentPort.isOpen) {
    return true;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      currentPort?.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
    currentPort = null;
    logger.info('Disconnected from serial port');
    return true;
  } catch (error) {
    logger.error('Error disconnecting from port', { error: (error as Error).message });
    throw error;
  }
}

// Получение текущего статуса подключения
export function getConnectionStatus() {
  return {
    isConnected: currentPort !== null && currentPort.isOpen,
    portPath: currentPort?.path,
  };
}

// Отправка данных на порт (если понадобится)
export async function sendDataToPort(data: string) {
  if (!currentPort || !currentPort.isOpen) {
    throw new Error('Serial port is not connected');
  }

  try {
    await new Promise<void>((resolve, reject) => {
      currentPort?.write(data, (err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>(resolve => {
      currentPort?.drain(() => resolve());
    });

    return true;
  } catch (error) {
    logger.error('Error sending data to port', { error: (error as Error).message });
    throw error;
  }
}

export { SerialPort };
