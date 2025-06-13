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

    // Методы для работы с бэкапами
    /* eslint-disable */
    saveCodeToBackup: (
        code: string,
        type: 'product' | 'package',
        shiftId: string,
        additionalData?: any
    ) => ipcRenderer.invoke('save-code-to-backup', code, type, shiftId, additionalData),

    getBackupCodesByShift: (shiftId: string) =>
        ipcRenderer.invoke('get-backup-codes-by-shift', shiftId),

    getAllBackupFiles: () => ipcRenderer.invoke('get-all-backup-files'),

    exportBackup: (shiftId: string) => ipcRenderer.invoke('export-backup', shiftId),

    // Методы интерфейса
    toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    playSound: (soundName: string) => ipcRenderer.invoke('play-sound', soundName),
} as ElectronAPI); // Приводим к типу ElectronAPI
