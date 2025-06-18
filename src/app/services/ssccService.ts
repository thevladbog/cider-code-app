import {
  BoxesCodeDataDto,
  CodesService,
  PackCodesDto,
  PackedCodesResponseDto,
  WriteBoxesCodeDto,
} from '../api/generated';
import { rendererLogger } from '../utils/simpleRendererLogger';

/**
 * Интерфейс для управления текущими SSCC кодами по сменам
 */
interface SSCCState {
  [shiftId: string]: {
    currentSSCC: string | null; // SSCC код для упаковки текущего короба
    currentSSCCId: number | null; // ID текущего SSCC кода в базе данных
    boxItemCount: number; // Количество товаров в текущем коробе
    maxBoxCount: number; // Максимальное количество товаров в коробе
    gln: string; // GLN кода для смены
    productId: string; // ID продукта для смены
  };
}

// Состояние SSCC кодов в памяти
const ssccState: SSCCState = {};

/**
 * Инициализирует SSCC состояние для смены при её открытии
 * Сразу получает SSCC код для первого короба
 */
export async function initializeSSCCForShift(
  shiftId: string,
  productId: string,
  maxBoxCount: number,
  gln?: string
): Promise<string> {
  try {
    // Запрашиваем первый SSCC код для упаковки первого короба
    const writeBoxesDto: WriteBoxesCodeDto = {
      productId,
      ...(gln && { gln }), // Добавляем GLN только если он передан
    };

    const response: BoxesCodeDataDto = await CodesService.codeControllerGetNextSscc({
      requestBody: writeBoxesDto,
    });

    // Сохраняем состояние для смены
    // Этот SSCC код будет использоваться для упаковки первого короба
    ssccState[shiftId] = {
      currentSSCC: response.sscc, // SSCC для упаковки текущего короба
      currentSSCCId: response.id, // ID этого SSCC кода
      boxItemCount: 0,
      maxBoxCount,
      gln: gln || '',
      productId,
    };

    rendererLogger.info('Initialized SSCC for shift', {
      shiftId,
      firstSSCC: response.sscc,
    });
    return response.sscc;
  } catch (error) {
    rendererLogger.error('Error initializing SSCC for shift', { error });
    throw new Error(`Не удалось получить первый SSCC код для смены: ${error}`);
  }
}

/**
 * Добавляет отсканированный код в текущий короб
 * Возвращает информацию о том, нужно ли упаковать короб
 */
export function addItemToCurrentBox(
  shiftId: string,
  _itemCode: string
): {
  shouldPackBox: boolean;
  currentBoxItemCount: number;
  maxBoxCount: number;
  currentSSCC: string | null;
} {
  const state = ssccState[shiftId];

  if (!state) {
    throw new Error(`SSCC состояние не инициализировано для смены ${shiftId}`);
  }

  // Увеличиваем счётчик товаров в текущем коробе
  state.boxItemCount++;

  const shouldPackBox = state.boxItemCount >= state.maxBoxCount;

  return {
    shouldPackBox,
    currentBoxItemCount: state.boxItemCount,
    maxBoxCount: state.maxBoxCount,
    currentSSCC: state.currentSSCC,
  };
}

/**
 * Упаковывает текущий короб и получает новый SSCC код для следующего короба
 */
export async function packCurrentBoxAndGetNextSSCC(
  shiftId: string,
  itemCodes: string[]
): Promise<{
  packedSSCC: string;
  nextSSCC: string;
}> {
  const state = ssccState[shiftId];

  rendererLogger.debug('packCurrentBoxAndGetNextSSCC called', { shiftId });
  rendererLogger.debug('Current SSCC state', { state });

  if (!state || !state.currentSSCC || !state.currentSSCCId) {
    rendererLogger.error('SSCC state not initialized for shift', { shiftId, state });
    throw new Error(`SSCC состояние не инициализировано для смены ${shiftId}`);
  }

  try {
    // Сохраняем текущий SSCC код для печати (именно этот код будет на этикетке)
    const ssccForPrinting = state.currentSSCC;

    // Упаковываем текущий короб с текущим SSCC кодом
    const packCodesDto: PackCodesDto = {
      id: state.currentSSCCId!, // Используем ID текущего SSCC кода
      ssccCode: state.currentSSCC, // SSCC код для упаковки этого короба
      codes: itemCodes,
      shiftId,
      productId: state.productId,
    };

    const packResponse: PackedCodesResponseDto = await CodesService.codeControllerPackCodes({
      requestBody: packCodesDto,
    });

    // В ответе ssccCode - это уже следующий SSCC код для следующего короба
    const nextSSCC = packResponse.ssccCode;
    const nextSSCCId = packResponse.id;

    rendererLogger.info('Packed box with SSCC', { ssccForPrinting, nextSSCC });

    // Обновляем состояние для следующего короба
    state.currentSSCC = nextSSCC; // Новый SSCC для следующего короба
    state.currentSSCCId = nextSSCCId; // ID нового SSCC кода
    state.boxItemCount = 0; // Сбрасываем счетчик товаров

    rendererLogger.debug('Updated SSCC state after packing', { state });

    return {
      packedSSCC: ssccForPrinting, // SSCC код упакованного короба (для печати)
      nextSSCC: nextSSCC, // SSCC код для следующего короба
    };
  } catch (error) {
    rendererLogger.error('Error packing box and getting next SSCC', { error });
    throw new Error(`Ошибка при упаковке короба: ${error}`);
  }
}

/**
 * Подготавливает упаковку без отправки на бэкенд (для печати этикетки)
 */
export function preparePackaging(
  shiftId: string,
  itemCodes: string[]
): {
  ssccForPrinting: string;
  pendingPackData: {
    shiftId: string;
    ssccCode: string;
    ssccId: number;
    codes: string[];
    productId: string;
  };
} {
  const state = ssccState[shiftId];

  if (!state || !state.currentSSCC || !state.currentSSCCId) {
    throw new Error(`SSCC состояние не инициализировано для смены ${shiftId}`);
  }

  const ssccForPrinting = state.currentSSCC;

  const pendingPackData = {
    shiftId,
    ssccCode: state.currentSSCC,
    ssccId: state.currentSSCCId,
    codes: itemCodes,
    productId: state.productId,
  };

  return {
    ssccForPrinting,
    pendingPackData,
  };
}

/**
 * Финализирует упаковку после успешной верификации
 */
export async function finalizePackaging(pendingPackData: {
  shiftId: string;
  ssccCode: string;
  ssccId: number;
  codes: string[];
  productId: string;
}): Promise<{ nextSSCC: string }> {
  try {
    // Упаковываем короб с подготовленными данными
    const packCodesDto: PackCodesDto = {
      id: pendingPackData.ssccId,
      ssccCode: pendingPackData.ssccCode,
      codes: pendingPackData.codes,
      shiftId: pendingPackData.shiftId,
      productId: pendingPackData.productId,
    };

    const packResponse: PackedCodesResponseDto = await CodesService.codeControllerPackCodes({
      requestBody: packCodesDto,
    });

    // В ответе ssccCode - это уже следующий SSCC код для следующего короба
    const nextSSCC = packResponse.ssccCode;

    rendererLogger.info('Finalized packaging for SSCC', {
      ssccCode: pendingPackData.ssccCode,
      nextSSCC,
    });

    // Обновляем состояние для следующего короба
    const state = ssccState[pendingPackData.shiftId];
    if (state) {
      state.currentSSCC = nextSSCC;
      state.currentSSCCId = null; // Сбрасываем ID, так как новый SSCC еще не имеет ID в базе
      state.boxItemCount = 0; // Сбрасываем счетчик товаров
    }

    return { nextSSCC };
  } catch (error) {
    rendererLogger.error('Error finalizing packaging', { error });
    throw new Error(`Ошибка при финализации упаковки: ${error}`);
  }
}

/**
 * Получает текущий SSCC код для смены
 */
export function getCurrentSSCC(shiftId: string): string | null {
  return ssccState[shiftId]?.currentSSCC || null;
}

/**
 * Получает информацию о текущем коробе
 */
export function getCurrentBoxInfo(shiftId: string): {
  currentSSCC: string | null;
  boxItemCount: number;
  maxBoxCount: number;
} | null {
  const state = ssccState[shiftId];

  if (!state) {
    return null;
  }

  return {
    currentSSCC: state.currentSSCC,
    boxItemCount: state.boxItemCount,
    maxBoxCount: state.maxBoxCount,
  };
}

/**
 * Очищает SSCC состояние для смены (при закрытии смены)
 */
export function clearSSCCState(shiftId: string): void {
  delete ssccState[shiftId];
  rendererLogger.info('Cleared SSCC state for shift', { shiftId });
}

/**
 * Проверяет, инициализирована ли смена для работы с SSCC
 */
export function isShiftInitializedForSSCC(shiftId: string): boolean {
  return !!ssccState[shiftId];
}

/**
 * Сбрасывает текущий короб для смены (очищает содержимое, но оставляет SSCC)
 */
export function resetCurrentBox(shiftId: string): void {
  const state = ssccState[shiftId];

  if (!state) {
    rendererLogger.warn('SSCC state not found for shift', { shiftId });
    return;
  }

  // Сбрасываем только счетчик товаров в коробе, SSCC остается тем же
  state.boxItemCount = 0;

  rendererLogger.info('Reset current box for shift', { shiftId, boxItemCount: 0 });
}
