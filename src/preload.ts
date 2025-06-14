// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

import { ElectronAPI } from './types'; // Импортируем типы

// Экспортируем API, которое будет доступно в React приложении
contextBridge.exposeInMainWorld('electronAPI', {
  // Методы для работы с COM-портами и сканером
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  connectToPort: (port: string) => ipcRenderer.invoke('connect-to-port', port),
  getSavedPort: () => ipcRenderer.invoke('get-saved-port'),

  // Обработка событий сканирования
  onBarcodeScanned: (callback: (barcode: string) => void) => {
    /* eslint-disable */
    const listener = (_: any, barcode: string) => callback(barcode);
    ipcRenderer.on('barcode-data', listener);
    return () => {
      ipcRenderer.removeListener('barcode-data', listener);
    };
  },

  // Методы для работы с принтером
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  listPrinterSerialPorts: () => ipcRenderer.invoke('list-printer-serial-ports'),
  connectToPrinter: (printer: string, isNetwork?: boolean, address?: string) =>
    ipcRenderer.invoke('connect-to-printer', printer, isNetwork, address),
  getSavedPrinter: () => ipcRenderer.invoke('get-saved-printer'),
  printBarcode: (barcode: string) => ipcRenderer.invoke('print-barcode', barcode),
  printZpl: (zplCode: string) => ipcRenderer.invoke('print-zpl', zplCode),
  printSSCCLabel: (sscc: string, productName?: string) =>
    ipcRenderer.invoke('print-sscc-label', sscc, productName),
  printSSCCLabelWithData: (data: any, labelTemplate?: string) =>
    ipcRenderer.invoke('print-sscc-label-with-data', data, labelTemplate),
  // Методы для работы с бэкапами
  /* eslint-disable */
  saveCodeToBackup: (
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    additionalData?: any
  ) => ipcRenderer.invoke('save-code-to-backup', code, type, shiftId, additionalData),

  logAction: (
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    status: 'success' | 'error',
    errorMessage?: string,
    additionalData?: any
  ) => ipcRenderer.invoke('log-action', code, type, shiftId, status, errorMessage, additionalData),

  getBackupCodesByShift: (shiftId: string) =>
    ipcRenderer.invoke('get-backup-codes-by-shift', shiftId),

  getAllBackupFiles: () => ipcRenderer.invoke('get-all-backup-files'),

  getSuccessfulScansContent: (shiftId: string) =>
    ipcRenderer.invoke('get-successful-scans-content', shiftId),

  restoreBackupData: (shiftId: string) => ipcRenderer.invoke('restore-backup-data', shiftId),
  exportBackup: (shiftId: string) => ipcRenderer.invoke('export-backup', shiftId),
  deleteBackup: (shiftId: string) => ipcRenderer.invoke('delete-backup', shiftId),
  // Новые методы для работы с коробами в бэкапах
  addSSCCToSuccessfulScans: (ssccCode: string, shiftId: string, prepend?: boolean) =>
    ipcRenderer.invoke('add-sscc-to-successful-scans', ssccCode, shiftId, prepend),

  reorderSuccessfulScans: (shiftId: string) =>
    ipcRenderer.invoke('reorder-successful-scans', shiftId),

  addProductToProductOnlyFile: (productCode: string, shiftId: string) =>
    ipcRenderer.invoke('add-product-to-product-only-file', productCode, shiftId),

  removeBoxFromBackup: (ssccCode: string, productCodes: string[], shiftId: string) =>
    ipcRenderer.invoke('remove-box-from-backup', ssccCode, productCodes, shiftId),

  // Методы интерфейса
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  toggleKioskMode: () => ipcRenderer.invoke('toggle-kiosk-mode'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  playSound: (soundName: string) => ipcRenderer.invoke('play-sound', soundName), // Новый метод для сохранения упаковки в момент верификации
  savePackageToBackup: (
    ssccCode: string,
    productCodes: string[],
    shiftId: string,
    timestamp?: number
  ) => ipcRenderer.invoke('save-package-to-backup', ssccCode, productCodes, shiftId, timestamp),

  // Тестовые методы (только в разработке)
  testSavePackage: (shiftId: string) => ipcRenderer.invoke('test-save-package', shiftId),
} as ElectronAPI); // Приводим к типу ElectronAPI
