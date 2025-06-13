import { BrowserWindow } from 'electron';
import * as net_socket from 'net';

import { storeWrapper } from './store-wrapper';

const usb = require('usb');
const { SerialPort } = require('serialport');

// Адаптированный тип для принтера
interface PrinterInfoCustom {
  name: string;
  status: string;
  isDefault: boolean;
}

interface USBPrinter {
  vendorId: number;
  productId: number;
  manufacturer: string;
  product: string;
}

let printingInProgress = false;

let printingTimeout: NodeJS.Timeout | null = null;

// Список установленных принтеров
export async function listPrinters(): Promise<PrinterInfoCustom[]> {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      throw new Error('No active window found');
    }

    const printers = await mainWindow.webContents.getPrintersAsync();

    // Базовый список принтеров из системы
    const systemPrinters = printers.map(printer => {
      const customPrinter: PrinterInfoCustom = {
        name: printer.name,
        status: 'unknown',
        isDefault: false,
      };
      return customPrinter;
    });

    // Добавляем USB принтеры этикеток
    const usbPrinters = findUSBPrinters();
    for (const usbPrinter of usbPrinters) {
      // Создаем идентификатор USB-принтера
      const usbPrinterName = `USB:${usbPrinter.vendorId.toString(16)}-${usbPrinter.productId.toString(16)}`;
      // Не используем displayName, просто добавляем принтер в список
      systemPrinters.push({
        name: usbPrinterName,
        status: 'unknown',
        isDefault: false,
      });
    }

    return systemPrinters;
  } catch (error) {
    console.error('Error listing printers:', error);
    throw error;
  }
}

// Подключение к принтеру
// Обновленная функция connectToPrinter
export async function connectToPrinter(printerName: string, isNetwork = false, address?: string) {
  try {
    console.log(
      `Connecting to printer: ${printerName}, isNetwork: ${isNetwork}, address: ${address}`
    ); // Определяем тип принтера и его конфигурацию
    let printerConfig: {
      name: string;
      isNetwork: boolean;
      address?: string;
      connectionType?: 'system' | 'usb' | 'network' | 'serial';
      vendorId?: number;
      productId?: number;
      port?: number;
      serialPath?: string;
      baudRate?: number;
    } = {
      name: printerName,
      isNetwork,
      address,
    };

    // Если это USB-принтер (имя имеет формат USB:vendorId-productId)
    if (printerName.startsWith('USB:')) {
      const idParts = printerName.substring(4).split('-');
      if (idParts.length === 2) {
        const vendorId = parseInt(idParts[0], 16);
        const productId = parseInt(idParts[1], 16);

        // Добавляем информацию о USB-принтере
        printerConfig = {
          ...printerConfig,
          vendorId,
          productId,
          connectionType: 'usb',
        };

        console.log(`USB printer detected: VID=${vendorId}, PID=${productId}`);
      }
    }
    // Если это сетевой принтер
    else if (isNetwork && address) {
      printerConfig.connectionType = 'network';
      printerConfig.port = 9100; // Добавляем стандартный порт
      console.log(`Network printer detected: ${address}:9100`);
    }
    // В остальных случаях считаем, что это системный принтер
    else {
      printerConfig.connectionType = 'system';
      console.log(`System printer detected: ${printerName}`);
    }

    // Проверяем доступность принтера, если это USB или сетевой принтер
    let printerAvailable = false;

    if (printerConfig.connectionType === 'usb') {
      const device = usb.findByIds(printerConfig.vendorId, printerConfig.productId);
      if (!device) {
        console.error('USB printer not found');
        return { success: false, error: 'USB принтер не найден' };
      }
      printerAvailable = true;
      console.log('USB printer found successfully');
    } else if (printerConfig.connectionType === 'network' && printerConfig.address) {
      // Пробуем подключиться к принтеру по сети
      try {
        console.log('Testing network printer connection...');
        const result = await testNetworkPrinter(printerConfig.address, printerConfig.port || 9100);
        if (!result.success) {
          console.error(`Network printer test failed: ${result.error}`);
          return { success: false, error: result.error };
        }
        printerAvailable = true;
        console.log('Network printer tested successfully');
      } catch (error) {
        console.error('Network printer test error:', error);
        return {
          success: false,
          error: `Ошибка подключения к сетевому принтеру: ${(error as Error).message}`,
        };
      }
    } else if (printerConfig.connectionType === 'system') {
      // Проверяем наличие принтера в системе
      try {
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          const printers = await mainWindow.webContents.getPrintersAsync();
          printerAvailable = printers.some(p => p.name === printerName);

          if (!printerAvailable) {
            console.error('System printer not found in the list');
            return { success: false, error: 'Принтер не найден в списке системных принтеров' };
          }
          console.log('System printer found in the list');
        } else {
          console.warn('No active window to check system printers');
        }
      } catch (error) {
        console.error('Error checking system printer:', error);
      }

      // Принтер считаем доступным, даже если не смогли проверить (для обратной совместимости)
      printerAvailable = true;
    }

    // Сохраняем выбранный принтер в настройках, только если он доступен
    if (printerAvailable) {
      console.log('Printer is available, saving to store');
      storeWrapper.set('printer', printerConfig);
      return { success: true };
    } else {
      console.error('Printer is not available');
      return { success: false, error: 'Принтер недоступен' };
    }
  } catch (error) {
    console.error('Error connecting to printer:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Печать штрих-кода
export async function printBarcode(barcode: string) {
  console.log({ barcode });
  try {
    if (printingInProgress) {
      console.log('Printing already in progress, ignoring duplicate request');
      return { success: false, error: 'Печать уже выполняется' };
    }

    printingInProgress = true;

    if (printingTimeout) {
      clearTimeout(printingTimeout);
    }
    printingTimeout = setTimeout(() => {
      console.log('Print lock timeout, resetting lock');
      printingInProgress = false;
    }, 10000);

    console.log('Print lock acquired, printing barcode:', barcode);

    const printer = storeWrapper.get('printer');

    if (!printer || !printer.name) {
      printingInProgress = false;
      throw new Error('No printer selected');
    }

    // Создаем ZPL код для штрих-кода
    const zplCode = createBarcodeZPL(barcode);

    console.log({ zplCode });

    // Используем функцию печати ZPL
    const result = await printZpl(zplCode);

    printingInProgress = false;
    if (printingTimeout) {
      clearTimeout(printingTimeout);
      printingTimeout = null;
    }

    return result;
  } catch (error) {
    printingInProgress = false;
    if (printingTimeout) {
      clearTimeout(printingTimeout);
      printingTimeout = null;
    }

    console.error('Error printing barcode:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Функция для создания ZPL кода штрих-кода
function createBarcodeZPL(barcode: string): string {
  // Базовый ZPL код для штрих-кода Code 128
  //   return `^XA
  // ^FO50,50^BY3^BCN,100,Y,N,N^FD${barcode}^FS
  // ^FO50,180^A0N,30,30^FD${barcode}^FS
  // ^XZ`;

  return `^XA
^PW599
^LL960
^LH0,0
^CI28
^FX Label: "" - Size: 75mm x 120mm ^FS
^FO26,504^BY2,2.5,80^BCN,80,N,N,N^FD${barcode}^FS
^FO26,594^AAN,18,10^FB520,1,0,C,0^FD${barcode}\\&^FS^XZ`;
}

// Печать ZPL кода для принтера этикеток
export async function printZpl(zplCode: string) {
  try {
    const printer = storeWrapper.get('printer');

    if (!printer) {
      throw new Error('No printer selected');
    }

    // Определяем метод печати в зависимости от типа принтера
    if (printer.connectionType === 'network' && printer.address) {
      // Для сетевого принтера
      return await sendZPLToNetworkPrinter(zplCode, printer.address, printer.port || 9100);
    } else if (printer.connectionType === 'usb' && printer.vendorId && printer.productId) {
      // Для USB принтера
      return await sendZPLToUSBPrinter(zplCode, printer.vendorId, printer.productId);
    } else if (printer.connectionType === 'serial' && printer.serialPath) {
      // Для принтера на последовательном порту
      return await sendZPLToSerialPrinter(zplCode, printer.serialPath, printer.baudRate || 9600);
    } else {
      // Для обычного системного принтера
      // Предупреждаем, что это не идеальный вариант для ZPL
      console.warn(
        'Printing ZPL to system printer is not ideal. Consider using a direct connection method.'
      );
      return await printZplToLocalPrinter(zplCode, printer.name);
    }
  } catch (error) {
    console.error('Error printing ZPL:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Тестирование подключения к сетевому принтеру
async function testNetworkPrinter(
  host: string,
  port = 9100
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    const socket = new net_socket.Socket();
    let connected = false;

    // Устанавливаем таймаут подключения
    socket.setTimeout(3000);

    socket.on('connect', () => {
      connected = true;
      socket.end();
      resolve({ success: true });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Превышено время ожидания подключения' });
    });

    socket.on('error', err => {
      resolve({ success: false, error: `Ошибка подключения: ${err.message}` });
    });

    socket.on('close', () => {
      if (!connected) {
        resolve({ success: false, error: 'Соединение закрыто до установки' });
      }
    });

    socket.connect(port, host);
  });
}

// Отправка ZPL на сетевой принтер
async function sendZPLToNetworkPrinter(
  zplCode: string,
  host: string,
  port = 9100
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    const socket = new net_socket.Socket();
    let connected = false;

    console.log({ zplCode });

    // Устанавливаем таймаут подключения
    socket.setTimeout(5000);

    socket.on('connect', () => {
      connected = true;
      // Отправляем ZPL
      socket.write(zplCode, 'utf8', err => {
        if (err) {
          socket.destroy();
          resolve({ success: false, error: `Ошибка отправки данных: ${err.message}` });
        } else {
          socket.end();
        }
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Превышено время ожидания отправки' });
    });

    socket.on('error', err => {
      resolve({ success: false, error: `Ошибка: ${err.message}` });
    });

    socket.on('close', () => {
      if (connected) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: 'Соединение закрыто до установки' });
      }
    });

    socket.connect(port, host);
  });
}

// Отправка ZPL на USB принтер
async function sendZPLToUSBPrinter(
  zplCode: string,
  vendorId: number,
  productId: number
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    try {
      // Находим устройство по vendorId и productId
      const device = usb.findByIds(vendorId, productId);

      if (!device) {
        return resolve({
          success: false,
          error: `Принтер с vendorId=${vendorId}, productId=${productId} не найден`,
        });
      }

      try {
        // Открываем устройство
        device.open();

        // Находим интерфейс устройства
        if (!device.interfaces || device.interfaces.length === 0) {
          device.close();
          return resolve({ success: false, error: 'Не найдены интерфейсы устройства' });
        }

        const iface = device.interfaces[0];

        // Захватываем интерфейс
        if (iface.isKernelDriverActive()) {
          try {
            iface.detachKernelDriver();
          } catch {
            console.warn('Отсоединение драйвера ядра не требуется или не удалось');
          }
        }

        iface.claim();

        // Находим выходной эндпоинт (для записи)
        const outEndpoint = iface.endpoints.find((ep: { direction: string }) => {
          return ep.direction === 'out';
        });

        if (!outEndpoint) {
          iface.release(() => {
            device.close();
            resolve({ success: false, error: 'Не найден выходной endpoint' });
          });
          return;
        }

        // Преобразуем ZPL-команды в буфер
        const buffer = Buffer.from(zplCode, 'utf8');

        // Устанавливаем таймаут на 5 секунд
        const timeoutId = setTimeout(() => {
          try {
            iface.release(() => {
              device.close();
              resolve({ success: false, error: 'Превышено время ожидания USB-передачи' });
            });
          } catch (e) {
            resolve({
              success: false,
              error: `Ошибка при закрытии соединения: ${(e as Error).message}`,
            });
          }
        }, 5000); // Используем обходное решение для типов Endpoint
        try {
          // Используем типизацию с расширенными методами endpoint для обхода проверки типов TypeScript
          const anyEndpoint = outEndpoint as {
            transfer?: (buffer: Buffer, callback: (error: Error | null) => void) => void;
            transferOut?: (buffer: Buffer, callback: (error: Error | null) => void) => void;
          };

          if (typeof anyEndpoint.transfer === 'function') {
            // Используем transfer, если он доступен
            anyEndpoint.transfer(buffer, (error: Error | null) => {
              clearTimeout(timeoutId);

              try {
                iface.release(() => {
                  device.close();

                  if (error) {
                    resolve({ success: false, error: `Ошибка отправки данных: ${error.message}` });
                  } else {
                    resolve({ success: true });
                  }
                });
              } catch (e) {
                resolve({
                  success: false,
                  error: `Ошибка при закрытии соединения: ${(e as Error).message}`,
                });
              }
            });
          } else if (typeof anyEndpoint.transferOut === 'function') {
            // Используем transferOut, если он доступен
            anyEndpoint.transferOut(buffer, (error: Error | null) => {
              clearTimeout(timeoutId);

              iface.release(() => {
                device.close();

                if (error) {
                  resolve({ success: false, error: `Ошибка отправки данных: ${error.message}` });
                } else {
                  resolve({ success: true });
                }
              });
            });
          } else {
            // Запасной вариант: используем низкоуровневый контрольный трансфер
            device.controlTransfer(
              0x21, // Тип запроса: класс, интерфейс
              0x09, // Запрос: HID SET_REPORT
              0x200, // Значение: отчет типа 2 (выход)
              iface.interfaceNumber, // Индекс: номер интерфейса
              buffer,
              (error: { message: string } | null) => {
                clearTimeout(timeoutId);

                iface.release(() => {
                  device.close();

                  if (error) {
                    resolve({ success: false, error: `Ошибка отправки данных: ${error.message}` });
                  } else {
                    resolve({ success: true });
                  }
                });
              }
            );
          }
        } catch (error) {
          clearTimeout(timeoutId);

          iface.release(() => {
            device.close();
            resolve({
              success: false,
              error: `Ошибка при передаче данных: ${(error as Error).message}`,
            });
          });
        }
      } catch (error) {
        try {
          device.close();
        } catch {
          // Игнорируем ошибки при закрытии
        }
        resolve({ success: false, error: `Ошибка USB-соединения: ${(error as Error).message}` });
      }
    } catch (error) {
      resolve({ success: false, error: `Ошибка доступа к USB: ${(error as Error).message}` });
    }
  });
}

// Отправка ZPL на последовательный порт
async function sendZPLToSerialPrinter(
  zplCode: string,
  serialPath: string,
  baudRate = 9600
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    let timeoutId: NodeJS.Timeout;

    try {
      const port = new SerialPort({
        path: serialPath,
        baudRate: baudRate,
        autoOpen: false,
      }); // Таймаут операции
      timeoutId = setTimeout(() => {
        try {
          port.close();
        } catch {
          // Игнорируем ошибки закрытия порта
        }
        resolve({
          success: false,
          error: 'Превышено время ожидания операции последовательного порта',
        });
      }, 5000);

      // Обработка событий
      port.on('error', (err: { message: string }) => {
        clearTimeout(timeoutId);
        try {
          port.close();
        } catch {
          // Игнорируем ошибки закрытия порта
        }
        resolve({ success: false, error: `Ошибка последовательного порта: ${err.message}` });
      });

      port.open((err: { message: string } | null) => {
        if (err) {
          clearTimeout(timeoutId);
          resolve({ success: false, error: `Ошибка открытия порта: ${err.message}` });
          return;
        }

        // Порт открыт, отправляем данные
        port.write(Buffer.from(zplCode, 'utf8'), (writeErr: { message: string } | null) => {
          if (writeErr) {
            clearTimeout(timeoutId);
            port.close();
            resolve({ success: false, error: `Ошибка записи в порт: ${writeErr.message}` });
            return;
          }

          // Дренируем буфер и закрываем порт
          port.drain(() => {
            clearTimeout(timeoutId);
            port.close();
            resolve({ success: true });
          });
        });
      });
    } catch (error) {
      resolve({
        success: false,
        error: `Ошибка последовательного порта: ${(error as Error).message}`,
      });
    }
  });
}

// Печать ZPL на локальный принтер через стандартные средства печати
async function printZplToLocalPrinter(zplCode: string, printerName: string) {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      throw new Error('No active window found');
    }

    // Создаем HTML для печати ZPL-кода
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ZPL Print</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: monospace;
            }
            pre {
              white-space: pre-wrap;
              word-break: break-all;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <pre>${zplCode}</pre>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    // Создаем временное окно для печати
    const printWindow = new BrowserWindow({
      width: 400,
      height: 300,
      show: false,
    });

    // Загружаем HTML для печати
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printContent)}`);

    // Ждем загрузки контента
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Печатаем
    return new Promise<{ success: boolean; error?: string }>(resolve => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName,
        },
        (success, errorType) => {
          printWindow.close();
          if (!success) {
            const errorMessage = `Print failed: ${errorType}`;
            console.error(errorMessage);
            resolve({ success: false, error: errorMessage });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in printZplToLocalPrinter:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Поиск доступных USB-принтеров
function findUSBPrinters(): USBPrinter[] {
  try {
    const devices = usb.getDeviceList();
    const printers: USBPrinter[] = [];

    // Список известных VendorID для популярных производителей принтеров этикеток
    const knownPrinterVendors = [
      0x0a5f, // Zebra
      0x0525, // Zebra/PLX
      0x0483, // Zebra
      0x0eb8, // Zebra
      0x0828, // SATO
      0x0b8c, // Datamax-O'Neil
      0x04b8, // Epson
      0x04f9, // Brother
      0x0921, // Citizen
      0x1fc9, // Toshiba TEC
      0x0409, // TSC
    ];

    for (const device of devices) {
      try {
        // Получаем основную информацию об устройстве
        const desc = device.deviceDescriptor;
        if (!desc) continue;

        const vendorId = desc.idVendor;
        const productId = desc.idProduct;

        // Проверяем, является ли это вероятным принтером этикеток
        if (!knownPrinterVendors.includes(vendorId)) {
          continue;
        }

        // Используем базовую информацию без попытки получить строки
        const manufacturer = 'Unknown';
        const product = 'Printer';

        // Добавляем принтер в список
        printers.push({
          vendorId,
          productId,
          manufacturer,
          product,
        });
      } catch {
        // Игнорируем ошибки при обработке устройства
        continue;
      }
    }

    return printers;
  } catch (error) {
    console.error('Error finding USB printers:', error);
    return [];
  }
}

// Проверка доступности принтера
export async function checkPrinter(printerName: string): Promise<boolean | undefined> {
  try {
    // Получаем сохраненную конфигурацию принтера
    const printer = storeWrapper.get('printer');

    // Исправление: Добавляем явную проверку на null и undefined
    if (!printer) {
      console.error('cannot find printer');
      return false;
    }

    // Если это системный принтер
    if (printer.connectionType === 'system' || !printer.connectionType) {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (!mainWindow) {
        return false;
      }

      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers.some(p => p.name === printerName);
    }
    // Если это USB принтер
    else if (printer.connectionType === 'usb' && printer.vendorId && printer.productId) {
      const device = usb.findByIds(printer.vendorId, printer.productId);
      return !!device;
    }
    // Если это сетевой принтер
    else if (printer.connectionType === 'network' && printer.address) {
      const result = await testNetworkPrinter(printer.address, printer.port || 9100);
      return result.success;
    }
    // Если это принтер на последовательном порту
    else if (printer.connectionType === 'serial' && printer.serialPath) {
      try {
        const ports = await SerialPort.list();
        return ports.some((port: { path: string }) => port.path === printer.serialPath);
      } catch {
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking printer:', error);
    return false;
  }
}

// Отключение от принтера (удаление из настроек)
export function disconnectPrinter(): { success: boolean; error?: string } {
  try {
    storeWrapper.delete('printer');
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting printer:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Функция для получения списка доступных последовательных портов
export async function listSerialPortsForPrinter() {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (error) {
    console.error('Error listing serial ports:', error);
    return [];
  }
}
