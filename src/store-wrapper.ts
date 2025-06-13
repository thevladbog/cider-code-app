import { app } from 'electron';
import Store from 'electron-store';

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
}

Store.initRenderer();
// Создаем экземпляр Store с типизацией
const store = new Store<StoreSchema>({
  name: 'app-config',
  cwd: app.getPath('userData'),
});

// Обертка для типизированного доступа к Store
export const storeWrapper: IStoreWrapper = {
  get: <K extends keyof StoreSchema>(key: K): StoreSchema[K] => {
    // @ts-expect-error Store typing needs to be improved
    return store.get(key);
  },
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void => {
    // @ts-expect-error Store typing needs to be improved
    store.set(key, value);
  },
  delete: <K extends keyof StoreSchema>(key: K): void => {
    // @ts-expect-error Store typing needs to be improved
    store.delete(key);
  },
  clear: (): void => {
    // @ts-expect-error Store typing needs to be improved
    store.clear();
  },
};
