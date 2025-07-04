import { IShiftFindMany, OperatorShiftDto } from '../api/generated';

// Import SSCCLabelData type
import type { SSCCLabelData } from '../../printer';

// Экспорт сгенерированных типов из OpenAPI
export type {
  BoxesCodeDataDto,
  CreatedProductId,
  CreateOperatorDto,
  CreateProductDto,
  CreateShiftDto,
  IOperatorFindMany,
  IOperatorFindOne,
  IProductFindMany,
  IShiftFindOne,
  LoginOperatorDto,
  OperatorShiftDto,
  PackCodesDto,
  PackedCodesResponseDto,
  SelectProductDto,
  UpdateCodesStatusDto,
  UpdateOperatorDto,
  UpdateProductDto,
  UpdateShiftDto,
  WriteBoxesCodeDto,
  WriteIndividualCodeDto,
} from '../api/generated';

// Типы для API Electron
export interface ElectronAPI {
  // Сканер
  listSerialPorts: () => Promise<SerialPortInfo[]>;
  connectToPort: (port: string) => Promise<{ success: boolean; error?: string }>;
  getSavedPort: () => Promise<string | null>;
  onBarcodeScanned: (callback: (barcode: string) => void) => () => void;
  // Принтер
  listPrinters: () => Promise<PrinterInfo[]>;
  // Обновляем тип возвращаемого значения для корректности
  listPrinterSerialPorts: () => Promise<SerialPortInfo[]>;
  connectToPrinter: (
    printer: string,
    isNetwork?: boolean,
    address?: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Обновляем тип возвращаемого значения с расширенными настройками принтера
  getSavedPrinter: () => Promise<PrinterSettings | null>;
  printBarcode: (barcode: string) => Promise<{ success: boolean; error?: string }>;
  printZpl: (zplCode: string) => Promise<{ success: boolean; error?: string }>;
  printSSCCLabel: (
    sscc: string,
    productName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  printSSCCLabelWithData: (
    data: SSCCLabelData,
    labelTemplate?: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Бэкап
  /* eslint-disable */
  saveCodeToBackup: (
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    additionalData?: any
  ) => Promise<{ success: boolean; error?: string }>;
  logAction: (
    code: string,
    type: 'product' | 'package',
    shiftId: string,
    status: 'success' | 'error',
    errorMessage?: string,
    additionalData?: any
  ) => Promise<{ success: boolean; error?: string }>;
  getBackupCodesByShift: (shiftId: string) => Promise<BackupItem[]>;
  getAllBackupFiles: () => Promise<
    {
      date: string;
      shifts: {
        shiftId: string;
        hasGeneralLog: boolean;
        hasSuccessfulScans: boolean;
        generalLogSize?: number;
        successfulScansSize?: number;
        modifiedDate?: Date;
      }[];
    }[]
  >;
  getSuccessfulScansContent: (shiftId: string) => Promise<string>;
  restoreBackupData: (shiftId: string) => Promise<{
    generalLog: BackupItem[];
    successfulScans: string;
    canRestore: boolean;
  }>;
  exportBackup: (
    shiftId: string
  ) => Promise<{ success: boolean; error?: string; filePath?: string }>;
  deleteBackup: (shiftId: string) => Promise<{ success: boolean; error?: string }>;

  // Новые методы для работы с коробами в бэкапах
  addSSCCToSuccessfulScans: (
    ssccCode: string,
    shiftId: string
  ) => Promise<{ success: boolean; error?: string }>;
  addProductToProductOnlyFile: (
    productCode: string,
    shiftId: string
  ) => Promise<{ success: boolean; error?: string }>;
  removeBoxFromBackup: (
    ssccCode: string,
    productCodes: string[],
    shiftId: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Новый метод для сохранения упаковки в момент верификации
  savePackageToBackup: (
    ssccCode: string,
    productCodes: string[],
    shiftId: string,
    timestamp?: number
  ) => Promise<{ success: boolean; error?: string }>;

  // Тестовые методы
  testSavePackage: (shiftId: string) => Promise<{ success: boolean; error?: string }>;

  // Методы интерфейса
  toggleFullscreen: () => Promise<boolean>;
  toggleKioskMode: () => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  playSound: (soundName: string) => Promise<{ success: boolean; error?: string }>;
}

// Информация о COM-порте
export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

// Информация о принтере
export interface PrinterInfo {
  name: string;
  status: string;
  isDefault: boolean;
}

// Информация о USB-принтере
export interface USBPrinterInfo {
  vendorId: number;
  productId: number;
  manufacturer: string;
  product: string;
}

// Расширенные настройки принтера
export interface PrinterSettings {
  name: string;
  isNetwork: boolean;
  address?: string;
  port?: number;
  connectionType?: 'system' | 'usb' | 'network' | 'serial';
  vendorId?: number;
  productId?: number;
  serialPath?: string;
  baudRate?: number;
}

// Конфигурация ZPL-принтера для прямой печати
export interface ZPLPrinterConfig {
  connectionType: 'usb' | 'network' | 'serial' | 'file' | 'system';
  // Для USB соединения
  vendorId?: number;
  productId?: number;
  // Для сетевого соединения
  host?: string;
  port?: number;
  // Для последовательного порта
  serialPath?: string;
  baudRate?: number;
  // Для системного принтера
  printerName?: string;
  // Для отладки (вывод в файл)
  outputPath?: string;
  // Общие настройки
  timeout?: number;
}

// Статус устройства
export type DeviceStatus = 'disconnected' | 'connected' | 'verified';

// Информация об устройстве
export interface Device {
  id: string;
  name: string;
  type: 'scanner' | 'printer';
  status: DeviceStatus;
  connection: string | null;
  isNetwork?: boolean;
  address?: string;
  connectionType?: 'system' | 'usb' | 'network' | 'serial';
  // Для USB принтеров
  vendorId?: number;
  productId?: number;
  // Для COM-порта
  serialPath?: string;
  baudRate?: number;
}

export enum ProductStatusSchema {
  'ACTIVE',
  'INACTIVE',
  'PAUSED',
  'REGISTRATION',
  'ARCHIVED',
}

export interface IProduct {
  status: ProductStatusSchema;
  id: string;
  shortName: string;
  fullName: string;
  gtin: string;
  alcoholCode: string;
  expirationInDays: number;
  volume: string;
  pictureUrl: string | null;
  created: string;
  modified: string;
}

// Перечисление статусов смены (используем из сгенерированных типов)
export enum ShiftStatus {
  PLANNED = 'PLANNED',
  PAUSED = 'PAUSED',
  DONE = 'DONE',
  INPROGRESS = 'INPROGRESS', // В работе
  CANCELED = 'CANCELED', // Отмененная
}

// Используем сгенерированный тип OperatorShiftDto для операторских смен (содержит product)
export type IShiftScheme = OperatorShiftDto;

// Типы для данных Datamatrix
export interface DataMatrixData {
  gtin: string; // Global Trade Item Number (14 цифр)
  countryCode: string; // Код страны (1 цифра)
  serialNumber: string; // Индивидуальный серийный номер (6 символов)
  verificationCode: string; // Код проверки (4 символа)
  rawData: string; // Исходные данные сканирования
}

// Тип элемента бэкапа
export interface BackupItem {
  code: string;
  type: 'product' | 'package';
  timestamp: number;
  shiftId: string;
  rawCode?: string; // Исходный raw код со всеми символами
  status: 'success' | 'error'; // Статус обработки кода
  errorMessage?: string; // Сообщение об ошибке (если есть)
  /* eslint-disable */
  additionalData?: any;
}

// Тип для информации об упаковке
export interface PackagingInfo {
  packSize: number; // Количество единиц в упаковке
  currentCount: number; // Текущее количество отсканированных единиц
  template: {
    // Шаблон для печати этикетки
    id: string; // Идентификатор шаблона
    zplCode: string; // ZPL-код шаблона
  };
  batchNumber?: string; // Номер партии (опционально)
  lastPackageCode?: string; // Код последней созданной упаковки
}

// Информация о смене (используем сгенерированный тип)
export type Shift = IShiftFindMany;

// Тип для ответа на запрос генерации SSCC
export interface GenerateSSCCResponse {
  sscc: string; // SSCC код
  timestamp: number; // Временная метка создания
  success: boolean; // Успешно ли создан SSCC
  message?: string; // Сообщение об ошибке (если есть)
}

// Тип для упаковки с SSCC
export interface PackageWithSSCC {
  sscc: string; // SSCC код упаковки
  items: string[]; // Коды продуктов внутри упаковки
  timestamp: number; // Временная метка создания
  verifiedBy?: string; // Кто проверил (ID оператора)
  verifiedAt?: number; // Когда проверено
}

// Реэкспорт SSCCLabelData из printer модуля для удобства
export type { SSCCLabelData };
