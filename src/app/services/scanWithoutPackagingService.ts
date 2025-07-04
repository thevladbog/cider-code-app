import { UpdateCodesStatusDto } from '../api/generated';
import { updateCodesStatus } from '../api/queries';
import { rendererLogger } from '../utils/simpleRendererLogger';

/**
 * Сервис для работы с кодами без упаковки
 */

// Функция для отправки кодов на сервер
export const sendCodesToServer = async (data: UpdateCodesStatusDto): Promise<unknown> => {
  try {
    rendererLogger.info('Sending codes to server', { data });
    const result = await updateCodesStatus(data);
    rendererLogger.info('Codes sent successfully', { result });
    return result;
  } catch (error) {
    rendererLogger.error('Error sending codes to server', { error });
    throw error;
  }
};

// Функция для создания батча кодов для отправки
export const createCodesBatch = (
  codes: string[],
  shiftId: string,
  productId?: string
): UpdateCodesStatusDto => {
  return {
    codes,
    shiftId,
    productId,
  };
};

// Функция для валидации кодов перед отправкой
export const validateCodesForSending = (codes: string[]): boolean => {
  if (!codes || codes.length === 0) {
    rendererLogger.warn('No codes to send');
    return false;
  }

  // Проверяем, что все коды являются строками и не пустые
  const invalidCodes = codes.filter(code => !code || typeof code !== 'string');
  if (invalidCodes.length > 0) {
    rendererLogger.error('Invalid codes found', { invalidCodes });
    return false;
  }

  return true;
};

// Функция для логирования отправки кодов
export const logCodesSent = (codes: string[], shiftId: string): void => {
  rendererLogger.info(`Codes sent for shift ${shiftId}`, {
    count: codes.length,
    codes: codes.slice(0, 5), // Логируем только первые 5 для краткости
    timestamp: new Date().toISOString(),
  });
};
