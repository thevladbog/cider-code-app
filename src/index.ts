import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';

import { saveCodeToBackup } from './backupService';
import {
  connectToPrinter,
  listPrinters,
  listSerialPortsForPrinter,
  printBarcode,
  printSSCCLabel,
  printSSCCLabelWithData,
  printZpl,
  type SSCCLabelData,
} from './printer';
import {
  connectToPort,
  disconnectFromPort,
  listSerialPorts,
  setupSerialPort,
} from './serialPortConfig';
import { storeWrapper } from './store-wrapper';

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    // Начинаем с полноэкранного режима
    //fullscreen: true,  // Полноэкранный режим
    //kiosk: true,       // Режим киоска (скрывает панель пуск)
    //autoHideMenuBar: true, // Скрываем меню
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // Используем URL, предоставленный Electron Forge Webpack Plugin
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // В режиме разработки можно оставить DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Очистка ссылки при закрытии окна
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Добавляем хоткей для выхода из полноэкранного режима (только для разработки)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F11') {
        mainWindow?.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      }
    });
  }
}

app.whenReady().then(() => {
  setupSerialPort();

  // Настройка CSP для разрешения запросов к API и изображений
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* https://api.test.in.bottlecode.app:3035; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: blob: https: https://online.sbis.ru https://*.sbis.ru; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
        ],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC события для работы с COM-портами и сканером
ipcMain.handle('list-serial-ports', async () => {
  return await listSerialPorts();
});

ipcMain.handle('list-printer-serial-ports', async () => {
  try {
    // Используем функцию из printer.ts
    return await listSerialPortsForPrinter();
  } catch (error) {
    console.error('Error listing printer serial ports:', error);
    return [];
  }
});

ipcMain.handle('connect-to-port', async (_, portPath: string) => {
  try {
    await connectToPort(portPath);
    // Сохраняем успешное подключение
    storeWrapper.set('selectedPort', portPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to connect:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('disconnect-from-port', async () => {
  try {
    await disconnectFromPort();
    // Удаляем сохраненное подключение
    storeWrapper.delete('selectedPort');
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Получить сохраненный порт
ipcMain.handle('get-saved-port', () => {
  return storeWrapper.get('selectedPort');
});

// Передача отсканированного штрих-кода
ipcMain.on('barcode-scanned', (event, barcode) => {
  if (mainWindow) {
    mainWindow.webContents.send('barcode-data', barcode);
  }
});

// IPC события для работы с принтером
ipcMain.handle('list-printers', async () => {
  return await listPrinters();
});

ipcMain.handle(
  'connect-to-printer',
  async (_, printerName: string, isNetwork: boolean, address?: string) => {
    console.log(`IPC: connect-to-printer called with ${printerName}, ${isNetwork}, ${address}`);
    try {
      const result = await connectToPrinter(printerName, isNetwork, address);
      console.log('IPC: connect-to-printer result:', result);
      return result;
    } catch (error) {
      console.error('IPC: connect-to-printer error:', error);
      return { success: false, error: (error as Error).message };
    }
  }
);

ipcMain.handle('get-saved-printer', () => {
  return storeWrapper.get('printer');
});

ipcMain.handle('print-barcode', async (_, barcode: string) => {
  return await printBarcode(barcode);
});

ipcMain.handle('print-zpl', async (_, zplCode: string) => {
  return await printZpl(zplCode);
});

ipcMain.handle('print-sscc-label', async (_, sscc: string, productName?: string) => {
  return await printSSCCLabel(sscc, productName);
});

ipcMain.handle(
  'print-sscc-label-with-data',
  async (_, data: SSCCLabelData, labelTemplate?: string) => {
    return await printSSCCLabelWithData(data, labelTemplate);
  }
);

// Добавляем обработчик выхода из полноэкранного режима
ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    const isFullscreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullscreen);
    return !isFullscreen;
  }
  return false;
});

// Добавляем обработчик для выхода из приложения
ipcMain.handle('quit-app', () => {
  app.quit();
});

// Обработчики управления окном
ipcMain.handle('toggle-kiosk-mode', () => {
  console.log('Toggle kiosk mode called');
  if (mainWindow) {
    const isKiosk = mainWindow.isKiosk();
    console.log('Current kiosk state:', isKiosk);
    mainWindow.setKiosk(!isKiosk);
    console.log('New kiosk state:', !isKiosk);
    return !isKiosk;
  }
  console.log('No main window available');
  return false;
});

ipcMain.handle('minimize-window', () => {
  console.log('Minimize window called');
  if (mainWindow) {
    mainWindow.minimize();
    console.log('Window minimized');
  } else {
    console.log('No main window available');
  }
});

ipcMain.handle('maximize-window', () => {
  console.log('Maximize window called');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      console.log('Window is maximized, unmaximizing');
      mainWindow.unmaximize();
    } else {
      console.log('Window is not maximized, maximizing');
      mainWindow.maximize();
    }
  } else {
    console.log('No main window available');
  }
});

ipcMain.handle('close-window', () => {
  console.log('Close window called');
  if (mainWindow) {
    mainWindow.close();
    console.log('Window closed');
  } else {
    console.log('No main window available');
  }
});

// Обработчик для воспроизведения звуков
ipcMain.handle('play-sound', async (_, soundName: string) => {
  try {
    // Путь к каталогу звуков
    const soundsDir = path.join(app.getAppPath(), 'resources', 'sounds');
    const soundFile = path.join(soundsDir, `${soundName}.mp3`);

    // Проверяем существование файла
    if (!fs.existsSync(soundFile)) {
      console.error(`Sound file not found: ${soundFile}`);
      return { success: false, error: 'Sound file not found' };
    }

    // Используем подходящую команду для воспроизведения звука в зависимости от ОС
    let command: string;
    let args: string[];

    if (process.platform === 'win32') {
      // Для Windows используем встроенный командный интерпретатор
      command = 'powershell';
      args = ['-c', `(New-Object Media.SoundPlayer "${soundFile}").PlaySync();`];
    } else if (process.platform === 'darwin') {
      // Для macOS используем afplay
      command = 'afplay';
      args = [soundFile];
    } else {
      // Для Linux предполагаем наличие mpg123
      command = 'mpg123';
      args = ['-q', soundFile];
    }

    // Запускаем процесс воспроизведения
    const childProcess = spawn(command, args);

    // Не ждем завершения, чтобы не блокировать UI
    childProcess.on('error', err => {
      console.error('Error playing sound:', err);
    });

    return { success: true };
  } catch (error) {
    console.error('Error playing sound:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Добавляем обработчик для сохранения резервной копии
ipcMain.handle('save-backup', async (_, data: unknown, filename: string) => {
  try {
    const savePath = path.join(app.getPath('userData'), 'backups');

    // Создаем директорию для бэкапов, если она не существует
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    const filePath = path.join(savePath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving backup:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle(
  'save-code-to-backup',
  async (
    _,
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    additionalData?: unknown
  ) => {
    return saveCodeToBackup(code, type, shiftId, additionalData);
  }
);

// Получение списка файлов бэкапов
ipcMain.handle('get-backup-files', async () => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');

    // Проверяем существование директории
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs
      .readdirSync(backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);

        return {
          name: file,
          path: filePath,
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
        };
      });

    return files;
  } catch (error) {
    console.error('Error getting backup files:', error);
    return [];
  }
});

// Экспорт бэкапа
ipcMain.handle('export-backup', async (_, sourceFile: string) => {
  try {
    const result = await dialog.showSaveDialog({
      title: 'Экспорт резервной копии',
      defaultPath: path.basename(sourceFile),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, reason: 'canceled' };
    }

    fs.copyFileSync(sourceFile, result.filePath);

    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('Error exporting backup:', error);
    return { success: false, error: (error as Error).message };
  }
});
