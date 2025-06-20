// Глобальные типы для Electron API
export {};

declare global {
  interface ElectronAPI {
    getAllScannedCodesForShift: (shiftId: string) => Promise<string[]>;
  }
  interface Window {
    electronAPI: ElectronAPI;
  }
}
