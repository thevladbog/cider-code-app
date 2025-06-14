import { useCallback, useState } from 'react';

import { finalizePackaging, preparePackaging } from '../services/ssccService';
import { IShiftScheme } from '../types';

interface PendingPackData {
  shiftId: string;
  ssccCode: string;
  ssccId: number;
  codes: string[];
  productId: string;
}

interface UsePackagingWithVerificationResult {
  isWaitingForVerification: boolean;
  pendingSSCC: string | null;
  preparePackagingForVerification: (
    shiftId: string,
    itemCodes: string[],
    shift: IShiftScheme
  ) => Promise<string>;
  finalizePendingPackaging: () => Promise<string>;
  cancelPendingPackaging: () => void;
  // Новый метод для получения данных упаковки
  getPendingPackageData: () => { ssccCode: string; productCodes: string[] } | null;
}

/**
 * Хук для управления процессом упаковки с верификацией
 */
export function usePackagingWithVerification(): UsePackagingWithVerificationResult {
  const [pendingPackData, setPendingPackData] = useState<PendingPackData | null>(null);
  const [pendingSSCC, setPendingSSCC] = useState<string | null>(null);

  const isWaitingForVerification = pendingPackData !== null;

  /**
   * Подготавливает упаковку и печатает этикетку
   * Возвращает SSCC код для верификации
   */
  const preparePackagingForVerification = useCallback(
    async (shiftId: string, itemCodes: string[], shift: IShiftScheme): Promise<string> => {
      try {
        // Подготавливаем упаковку (без отправки на бэкенд)
        const { ssccForPrinting, pendingPackData } = preparePackaging(shiftId, itemCodes);

        // Сохраняем данные для финализации
        setPendingPackData(pendingPackData);
        setPendingSSCC(ssccForPrinting);

        // Печатаем этикетку
        await printSSCCLabel(shift, ssccForPrinting);

        console.log(`Prepared packaging for verification. SSCC: ${ssccForPrinting}`);
        return ssccForPrinting;
      } catch (error) {
        console.error('Error preparing packaging for verification:', error);
        // Сбрасываем состояние при ошибке
        setPendingPackData(null);
        setPendingSSCC(null);
        throw error;
      }
    },
    []
  );

  /**
   * Финализирует упаковку после успешной верификации
   */
  const finalizePendingPackaging = useCallback(async (): Promise<string> => {
    if (!pendingPackData) {
      throw new Error('Нет данных для финализации упаковки');
    }

    try {
      // Отправляем данные на бэкенд
      const { nextSSCC } = await finalizePackaging(pendingPackData);

      console.log(`Packaging finalized. Next SSCC: ${nextSSCC}`);

      // Сбрасываем состояние
      setPendingPackData(null);
      setPendingSSCC(null);

      return nextSSCC;
    } catch (error) {
      console.error('Error finalizing packaging:', error);
      throw error;
    }
  }, [pendingPackData]);

  /**
   * Отменяет ожидающую упаковку
   */
  const cancelPendingPackaging = useCallback(() => {
    setPendingPackData(null);
    setPendingSSCC(null);
    console.log('Pending packaging cancelled');
  }, []);

  /**
   * Печатает SSCC этикетку
   */
  const printSSCCLabel = async (shift: IShiftScheme, ssccCode: string): Promise<void> => {
    try {
      // Вычисляем дату истечения срока годности
      const plannedDate = new Date(shift.plannedDate);
      const expirationDate = new Date(plannedDate);
      expirationDate.setDate(plannedDate.getDate() + shift.product.expirationInDays);

      const printResult = await window.electronAPI.printSSCCLabelWithData({
        ssccCode: ssccCode,
        shiftId: shift.id,
        fullName: shift.product.fullName,
        plannedDate: shift.plannedDate,
        expiration: expirationDate.toISOString().split('T')[0], // Форматируем как YYYY-MM-DD
        barcode: shift.product.gtin,
        alcoholCode: shift.product.alcoholCode || '',
        currentCountInBox: shift.countInBox || 0,
        volume: shift.product.volume,
        pictureUrl: shift.product.pictureUrl || '', // URL изображения продукции
      });

      if (printResult.success) {
        console.log(`SSCC label printed successfully: ${ssccCode}`);
      } else {
        console.error(`Failed to print SSCC label: ${printResult.error}`);
        throw new Error(`Failed to print SSCC label: ${printResult.error}`);
      }
    } catch (error) {
      console.error('Error printing SSCC label:', error);
      throw error;
    }
  };

  /**
   * Получает данные ожидающей упаковки для сохранения в бэкап
   */
  const getPendingPackageData = useCallback((): {
    ssccCode: string;
    productCodes: string[];
  } | null => {
    if (!pendingPackData || !pendingSSCC) {
      return null;
    }

    return {
      ssccCode: pendingSSCC,
      productCodes: pendingPackData.codes,
    };
  }, [pendingPackData, pendingSSCC]);

  return {
    isWaitingForVerification,
    pendingSSCC,
    preparePackagingForVerification,
    finalizePendingPackaging,
    cancelPendingPackaging,
    getPendingPackageData,
  };
}
