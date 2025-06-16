// Загружаем переменные окружения из .env файла
import dotenv from 'dotenv';
dotenv.config();

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';

import {
  addProductToProductOnlyFile,
  addSSCCToSuccessfulScans,
  clearBackupFiles,
  deleteBackup,
  exportBackup,
  getAllBackupFiles,
  getBackupCodesByShift,
  getSuccessfulScansContent,
  logAction,
  removeBoxFromBackup,
  reorderSuccessfulScans,
  restoreBackupData,
  saveCodeToBackup,
  savePackageToBackup,
  testReorderLogic,
} from './backupService';
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
import { logger } from './services';
import { createSDKLoggerConfig } from './services/loggerConfig';
import { LogMessage, LogResult, validateLogData } from './services/loggerTypes';
import { storeWrapper } from './store-wrapper';
import { getAppEnvironment } from './utils/environment';

let mainWindow: BrowserWindow | null = null;

// Инициализация логгера
async function initializeLogger() {
  try {
    const config = createSDKLoggerConfig();
    await logger.initialize(config);

    // Устанавливаем logger в модуле environment
    import('./utils/environment').then(({ setLogger }) => {
      setLogger(logger);
    });

    logger.info('Приложение запущено', {
      environment: getAppEnvironment(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    });
  } catch (error) {
    // В случае ошибки инициализации логгера используем стандартный console
    // Здесь мы не можем использовать logger, так как он не инициализирован
    console.error('Ошибка инициализации логгера:', error);
  }
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  // Определяем пути в зависимости от режима
  const appPath = app.getAppPath();
  const preloadPath = isDev
    ? path.join(appPath, 'dist', 'preload.js')
    : path.join(appPath, 'dist', 'preload.js');

  const rendererPath = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(appPath, 'dist', 'renderer', 'index.html')}`;

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    // Начинаем с полноэкранного режима
    //fullscreen: true,  // Полноэкранный режим
    //kiosk: true,       // Режим киоска (скрывает панель пуск)
    //autoHideMenuBar: true, // Скрываем меню
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadURL(rendererPath);

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
    mainWindow.webContents.on(
      'before-input-event',
      (event: Electron.Event, input: Electron.Input) => {
        if (input.key === 'F11') {
          mainWindow?.setFullScreen(!mainWindow.isFullScreen());
          event.preventDefault();
        }
      }
    );
  }
}

app.whenReady().then(async () => {
  // Инициализируем логгер перед всеми остальными операциями
  await initializeLogger();

  setupSerialPort();

  // Настройка CSP для разрешения запросов к API и изображений
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* https://api.test.in.bottlecode.app:3035 https://api.bottlecode.app https://*.bottlecode.app; " +
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
  logger.info('Toggle kiosk mode called');
  if (mainWindow) {
    const isKiosk = mainWindow.isKiosk();
    logger.info('Current kiosk state', { isKiosk });
    mainWindow.setKiosk(!isKiosk);
    logger.info('New kiosk state', { isKiosk: !isKiosk });
    return !isKiosk;
  }
  logger.warn('No main window available');
  return false;
});

ipcMain.handle('minimize-window', () => {
  logger.info('Minimize window called');
  if (mainWindow) {
    mainWindow.minimize();
    logger.info('Window minimized');
  } else {
    logger.warn('No main window available');
  }
});

ipcMain.handle('maximize-window', () => {
  logger.info('Maximize window called');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      logger.info('Window is maximized, unmaximizing');
      mainWindow.unmaximize();
    } else {
      logger.info('Window is not maximized, maximizing');
      mainWindow.maximize();
    }
  } else {
    logger.warn('No main window available');
  }
});

ipcMain.handle('close-window', () => {
  logger.info('Close window called');
  if (mainWindow) {
    mainWindow.close();
    logger.info('Window closed');
  } else {
    logger.warn('No main window available');
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
      logger.error(`Sound file not found`, { soundFile });
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
    const childProcess = spawn(command, args); // Не ждем завершения, чтобы не блокировать UI
    childProcess.on('error', err => {
      logger.error('Error playing sound', { error: err.message });
    });

    return { success: true };
  } catch (error) {
    logger.error('Error playing sound', { error: (error as Error).message });
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
    logger.info('Backup saved successfully', { path: filePath });
    return { success: true, path: filePath };
  } catch (error) {
    logger.error('Error saving backup', { error: (error as Error).message });
    return { success: false, error: (error as Error).message };
  }
});

// Добавляем обработчик для отправки логов в облако
ipcMain.handle('send-log', async (_, logData: LogMessage): Promise<LogResult> => {
  try {
    // Validate log data in main process as well for extra safety
    const validation = validateLogData(logData);

    if (!validation.isValid) {
      console.error('Log validation failed in main process:', validation.error);
      return {
        success: false,
        error: `Log validation failed: ${validation.error}`,
      };
    }

    const sanitizedData = validation.sanitizedData!;

    // Используем существующий logger для отправки в облако
    const logPayload = {
      message: sanitizedData.message,
      level: sanitizedData.level,
      timestamp: sanitizedData.timestamp,
      source: sanitizedData.source,
      ...sanitizedData.payload,
    };

    // Отправляем лог через существующий логгер
    switch (sanitizedData.level) {
      case 'DEBUG':
        logger.debug(sanitizedData.message, logPayload);
        break;
      case 'INFO':
        logger.info(sanitizedData.message, logPayload);
        break;
      case 'WARN':
        logger.warn(sanitizedData.message, logPayload);
        break;
      case 'ERROR':
        logger.error(sanitizedData.message, logPayload);
        break;
      case 'FATAL':
        logger.error(sanitizedData.message, logPayload); // Use error for FATAL as fallback
        break;
      default:
        logger.info(sanitizedData.message, logPayload); // Default fallback
    }

    return { success: true };
  } catch (error) {
    const errorMessage = `Error sending log to cloud: ${(error as Error).message}`;
    console.error(errorMessage, error);
    return { success: false, error: errorMessage };
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

// Новый обработчик для логирования действий
ipcMain.handle(
  'log-action',
  async (
    _,
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    status: 'success' | 'error',
    errorMessage?: string,
    additionalData?: unknown
  ) => {
    return logAction(code, type, shiftId, status, errorMessage, additionalData);
  }
);

// Получение кодов бэкапа для смены
ipcMain.handle('get-backup-codes-by-shift', async (_, shiftId: string) => {
  return getBackupCodesByShift(shiftId);
});

// Получение всех файлов бэкапов (новая структура)
ipcMain.handle('get-all-backup-files', async () => {
  return getAllBackupFiles();
});

// Получение содержимого файла успешных сканирований
ipcMain.handle('get-successful-scans-content', async (_, shiftId: string) => {
  return getSuccessfulScansContent(shiftId);
});

// Переупорядочивание файла успешных сканирований
ipcMain.handle('reorder-successful-scans', async (_, shiftId: string) => {
  return reorderSuccessfulScans(shiftId);
});

// Восстановление данных бэкапа
ipcMain.handle('restore-backup-data', async (_, shiftId: string) => {
  return restoreBackupData(shiftId);
});

// Экспорт бэкапа
ipcMain.handle('export-backup', async (_, shiftId: string) => {
  try {
    const result = await dialog.showSaveDialog({
      title: 'Экспорт бэкапа',
      defaultPath: `backup_${shiftId}`,
      filters: [
        { name: 'Архивы', extensions: ['zip'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export canceled' };
    }

    const exportResult = exportBackup(shiftId, path.dirname(result.filePath));
    return { ...exportResult, filePath: result.filePath };
  } catch (error) {
    console.error('Error during backup export:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Удаление бэкапа
ipcMain.handle('delete-backup', async (_, shiftId: string) => {
  return deleteBackup(shiftId);
});

// Добавление SSCC кода в файл успешных сканирований
ipcMain.handle(
  'add-sscc-to-successful-scans',
  async (_, ssccCode: string, shiftId: string, prepend: boolean = false) => {
    try {
      const result = addSSCCToSuccessfulScans(ssccCode, shiftId, prepend);

      // После добавления SSCC кода, переупорядочиваем файл для правильного порядка
      if (result.success) {
        reorderSuccessfulScans(shiftId);
      }

      return result;
    } catch (error) {
      console.error('Error adding SSCC to successful scans:', error);
      return { success: false, error: (error as Error).message };
    }
  }
);

// Добавление кода продукции в файл только с продукцией
ipcMain.handle(
  'add-product-to-product-only-file',
  async (_, productCode: string, shiftId: string) => {
    try {
      addProductToProductOnlyFile(productCode, shiftId);
      return { success: true };
    } catch (error) {
      console.error('Error adding product to product-only file:', error);
      return { success: false, error: (error as Error).message };
    }
  }
);

// Удаление короба из файлов бэкапа
ipcMain.handle(
  'remove-box-from-backup',
  async (_, ssccCode: string, productCodes: string[], shiftId: string) => {
    return removeBoxFromBackup(ssccCode, productCodes, shiftId);
  }
);

// Сохранение упаковки в бэкап (новый подход - в момент верификации)
ipcMain.handle(
  'save-package-to-backup',
  async (_, ssccCode: string, productCodes: string[], shiftId: string, timestamp?: number) => {
    return savePackageToBackup(ssccCode, productCodes, shiftId, timestamp);
  }
);

// Тестовая функция для отладки переупорядочивания (только в режиме разработки)
if (process.env.NODE_ENV === 'development') {
  ipcMain.handle('test-reorder-logic', async (_, shiftId: string) => {
    try {
      testReorderLogic(shiftId);
      return { success: true };
    } catch (error) {
      console.error('Error testing reorder logic:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  // Очистка файлов бэкапа для тестирования (только в режиме разработки)
  ipcMain.handle('clear-backup-files', async (_, shiftId: string) => {
    return clearBackupFiles(shiftId);
  });
  // Тестовая функция для отладки savePackageToBackup
  ipcMain.handle('test-save-package', async (_, shiftId: string) => {
    try {
      const testSSCC = '046800899000003384';
      const testProductCodes = [
        '0104680089900239215WTFZuE93Y+oG',
        '0104680089900239215WqZq"-93rP97',
        '0104680089900239215GDl(EW93ya/A',
      ];
      const result = savePackageToBackup(testSSCC, testProductCodes, shiftId, Date.now());
      console.log('Test savePackageToBackup result:', result);
      return result;
    } catch (error) {
      console.error('Error testing savePackageToBackup:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}

// Инициализация логгера
initializeLogger();
