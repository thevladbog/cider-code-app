// settingsStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface SettingsState {
  // Настройки сканера
  scannerPort: string | null;

  // Расширенные настройки принтера
  printer: {
    name: string | null;
    isNetwork: boolean;
    address?: string;
    port?: number;
    connectionType?: 'system' | 'usb' | 'network' | 'serial';
    vendorId?: number;
    productId?: number;
    serialPath?: string;
    baudRate?: number;
  };

  // Настройки интерфейса
  uiSettings: {
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
    soundEnabled: boolean;
    voiceEnabled: boolean;
  };

  // Методы для изменения настроек
  setScannerPort: (port: string | null) => void | null;
  setPrinter: (
    name: string | null,
    isNetwork: boolean,
    address?: string,
    additionalConfig?: Partial<{
      port: number;
      connectionType: 'system' | 'usb' | 'network' | 'serial';
      vendorId: number;
      productId: number;
      serialPath: string;
      baudRate: number;
    }>
  ) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
}

// Начальные настройки
const defaultSettings: SettingsState = {
  scannerPort: null,
  printer: {
    name: null,
    isNetwork: false,
    address: undefined,
    connectionType: 'system',
    port: undefined,
    vendorId: undefined,
    productId: undefined,
    serialPath: undefined,
    baudRate: undefined,
  },
  uiSettings: {
    theme: 'light',
    fontSize: 'medium',
    soundEnabled: true,
    voiceEnabled: true,
  },
  setScannerPort: () => null,
  setPrinter: () => null,
  setTheme: () => null,
  setFontSize: () => null,
  setSoundEnabled: () => null,
  setVoiceEnabled: () => null,
  resetSettings: () => null,
};

// Создаем хранилище с middleware для поддержки селекторов подписки
export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(set => ({
    ...defaultSettings,

    // Установка порта сканера
    setScannerPort: port => set({ scannerPort: port }),

    // Расширенная установка настроек принтера
    setPrinter: (name, isNetwork, address, additionalConfig = {}) =>
      set({
        printer: {
          name,
          isNetwork,
          address,
          // Добавляем остальные свойства из additionalConfig
          ...additionalConfig,
        },
      }),

    // Установка темы
    setTheme: theme =>
      set(state => ({
        uiSettings: { ...state.uiSettings, theme },
      })),

    // Установка размера шрифта
    setFontSize: fontSize =>
      set(state => ({
        uiSettings: { ...state.uiSettings, fontSize },
      })),

    // Включение/выключение звуков
    setSoundEnabled: soundEnabled =>
      set(state => ({
        uiSettings: { ...state.uiSettings, soundEnabled },
      })),

    // Включение/выключение голосовых подсказок
    setVoiceEnabled: voiceEnabled =>
      set(state => ({
        uiSettings: { ...state.uiSettings, voiceEnabled },
      })),

    // Сброс всех настроек на значения по умолчанию
    resetSettings: () => set(defaultSettings),
  }))
);

// Инициализация из сохраненных настроек
export const initializeSettings = async () => {
  try {
    // Загружаем настройки сканера
    const savedPort = await window.electronAPI.getSavedPort();
    if (savedPort) {
      useSettingsStore.getState().setScannerPort(savedPort);
    }

    // Загружаем настройки принтера
    const savedPrinter = await window.electronAPI.getSavedPrinter();
    if (savedPrinter) {
      useSettingsStore.getState().setPrinter(
        savedPrinter.name,
        savedPrinter.isNetwork || false,
        savedPrinter.address,
        // Передаем все дополнительные поля из сохраненных настроек
        {
          port: savedPrinter.port,
          connectionType:
            savedPrinter.connectionType || (savedPrinter.isNetwork ? 'network' : 'system'),
          vendorId: savedPrinter.vendorId,
          productId: savedPrinter.productId,
          serialPath: savedPrinter.serialPath,
          baudRate: savedPrinter.baudRate,
        }
      );
    }

    // Загружаем настройки интерфейса из localStorage
    const savedUiSettings = localStorage.getItem('ui_settings');
    if (savedUiSettings) {
      const uiSettings = JSON.parse(savedUiSettings);
      const { theme, fontSize, soundEnabled, voiceEnabled } = uiSettings;

      if (theme) useSettingsStore.getState().setTheme(theme);
      if (fontSize) useSettingsStore.getState().setFontSize(fontSize);
      if (soundEnabled !== undefined) useSettingsStore.getState().setSoundEnabled(soundEnabled);
      if (voiceEnabled !== undefined) useSettingsStore.getState().setVoiceEnabled(voiceEnabled);
    }
  } catch (error) {
    console.error('Failed to initialize settings:', error);
  }
};

// Для сохранения UI настроек при их изменении
export const setupSettingsListeners = () => {
  // Применяем текущие настройки темы при запуске
  const currentSettings = useSettingsStore.getState().uiSettings;
  document.documentElement.setAttribute('data-theme', currentSettings.theme);
  document.documentElement.setAttribute('data-font-size', currentSettings.fontSize);
  document.body.setAttribute('data-theme', currentSettings.theme);

  // Подписываемся на изменения UI настроек
  useSettingsStore.subscribe(
    state => state.uiSettings,
    uiSettings => {
      // Сохраняем настройки в localStorage
      localStorage.setItem('ui_settings', JSON.stringify(uiSettings));

      // Применяем тему
      document.documentElement.setAttribute('data-theme', uiSettings.theme);
      document.body.setAttribute('data-theme', uiSettings.theme);

      // Применяем размер шрифта
      document.documentElement.setAttribute('data-font-size', uiSettings.fontSize);
    }
  );
};
