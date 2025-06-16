import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './services';

// Определяем схему для хранения данных
interface StoreSchema {
  selectedPort?: string;
  printer?: {
    name: string;
    isNetwork: boolean;
    address?: string;
    port?: number;
    connectionType?: 'system' | 'usb' | 'network' | 'serial';
    vendorId?: number;
    productId?: number;
    serialPath?: string;
    baudRate?: number;
  } | null;
}

interface IStoreWrapper {
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K];
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void;
  delete: <K extends keyof StoreSchema>(key: K) => void;
  clear: () => void;
  isInitialized: () => boolean;
}

// Простое файловое хранилище как замена electron-store
class SimpleFileStore {
  private storePath: string;
  private data: StoreSchema = {};

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'app-config.json');
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const rawData = fs.readFileSync(this.storePath, 'utf8');
        this.data = JSON.parse(rawData);
      }
    } catch (error) {
      logger.error('Failed to load store data', { error: (error as Error).message });
      this.data = {};
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error('Failed to save store data', { error: (error as Error).message });
    }
  }

  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.data[key];
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.data[key] = value;
    this.saveData();
  }

  delete<K extends keyof StoreSchema>(key: K): void {
    delete this.data[key];
    this.saveData();
  }

  clear(): void {
    this.data = {};
    this.saveData();
  }
}

const store = new SimpleFileStore();

// Обертка для типизированного доступа к Store
export const storeWrapper: IStoreWrapper = {
  get: <K extends keyof StoreSchema>(key: K): StoreSchema[K] => {
    return store.get(key);
  },
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void => {
    store.set(key, value);
  },
  delete: <K extends keyof StoreSchema>(key: K): void => {
    store.delete(key);
  },
  clear: (): void => {
    store.clear();
  },
  isInitialized: (): boolean => {
    return true; // Всегда инициализирован
  },
};
