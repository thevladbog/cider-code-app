import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  CreateShiftDto,
  IOperatorFindOne,
  IShiftFindOne,
  PackCodesDto,
  PackedCodesResponseDto,
} from '../types';
import { clearOpenAPIToken, saveOpenAPIToken } from './apiClient';
import {
  AuthenticationService,
  IShiftFindMany,
  OpenAPI,
  OperatorService,
  PackagingService,
  ShiftDto,
  ShiftService,
} from './generated';

/**
 * ЗАПРОСЫ ДЛЯ РАБОЧЕГО МЕСТА
 */

// Функция для получения данных о рабочем месте по штрих-коду
export const fetchWorkplaceByBarcode = async (barcode: string): Promise<IOperatorFindOne> => {
  console.log('Attempting to login with barcode:', barcode);
  console.log('OpenAPI BASE URL:', OpenAPI.BASE);

  // Авторизуемся с помощью штрих-кода
  const loginResponse = await AuthenticationService.operatorControllerLogin({
    requestBody: { barcode },
  });

  // Сохраняем токен для дальнейших запросов
  if (loginResponse.token) {
    console.log('Token received:', loginResponse.token);

    // Сохраняем токен в localStorage и устанавливаем для обеих библиотек
    saveOpenAPIToken(loginResponse.token);
  }

  // Получаем данные текущего оператора
  const operatorData = await AuthenticationService.operatorControllerGetMe();
  return operatorData;
};

// Хук для получения данных о рабочем месте
export const useWorkplaceData = (barcode: string | null, enabled = false) => {
  return useQuery({
    queryKey: ['workplace', barcode],
    queryFn: () => {
      if (!barcode) throw new Error('Barcode is required');
      return fetchWorkplaceByBarcode(barcode);
    },
    enabled: !!barcode && enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

/**
 * ЗАПРОСЫ ДЛЯ СМЕН
 */

// Получение списка смен
export const fetchShifts = async (): Promise<IShiftFindMany> => {
  const shiftsData = await OperatorService.shiftControllerFindAllForApp({});
  return shiftsData;
};

// Хук для получения списка смен
export const useShifts = () => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: fetchShifts,
    staleTime: 60 * 1000, // 1 минута
  });
};

// Получение информации о конкретной смене
export const fetchShiftById = async (shiftId: string): Promise<IShiftFindOne> => {
  const shiftData = await OperatorService.shiftControllerFindOneForApp({ id: shiftId });
  return shiftData;
};

// Хук для получения информации о конкретной смене
export const useShift = (shiftId: string | null) => {
  return useQuery({
    queryKey: ['shift', shiftId],
    queryFn: () => {
      if (!shiftId) throw new Error('shiftId is required');
      return fetchShiftById(shiftId);
    },
    enabled: !!shiftId,
    staleTime: 30 * 1000, // 30 секунд
  });
};

// Функция для создания новой смены
export const createShift = async (createShiftData: CreateShiftDto): Promise<ShiftDto> => {
  const shiftData = await ShiftService.shiftControllerCreate({
    requestBody: createShiftData,
  });
  return shiftData;
};

// Хук для создания новой смены
export const useCreateShift = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      // Инвалидируем кэш смен при успешном создании
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
};

// Функция для изменения статуса смены
export const updateShiftStatus = async ({
  shiftId,
  status,
}: {
  shiftId: string;
  status: 'PLANNED' | 'INPROGRESS' | 'PAUSED' | 'DONE' | 'CANCELED';
}): Promise<ShiftDto> => {
  // Поскольку UpdateShiftDto пустой в сгенерированной схеме,
  // используем прямой запрос с нужными данными
  const shiftData = await ShiftService.shiftControllerUpdate({
    id: shiftId,
    requestBody: { status } as { status: string },
  });
  return shiftData;
};

// Хук для изменения статуса смены
export const useUpdateShiftStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateShiftStatus,
    onSuccess: data => {
      // Инвалидируем кэш смен и конкретной смены
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shift', data.id] });
    },
  });
};

/**
 * ЗАПРОСЫ ДЛЯ УПАКОВОК
 */

// Запрос на упаковку кодов
export const packCodes = async (packData: PackCodesDto): Promise<PackedCodesResponseDto> => {
  const response = await PackagingService.codeControllerPackCodes({
    requestBody: packData,
  });
  return response;
};

// Хук для упаковки кодов
export const usePackCodes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: packCodes,
    onSuccess: () => {
      // Инвалидируем кэш смены при успешном создании упаковки
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
};

// TODO: Эти функции нужно будет обновить, когда появятся соответствующие endpoints в OpenAPI

// Запрос на подтверждение верификации упаковки (временная заглушка)
export const verifyPackage = async ({
  shiftId: _shiftId,
  sscc: _sscc,
  verifiedBy: _verifiedBy,
}: {
  shiftId: string;
  sscc: string;
  verifiedBy?: string;
}): Promise<{ success: boolean; message?: string }> => {
  // TODO: Заменить на вызов соответствующего OpenAPI метода
  console.warn(
    'verifyPackage: функция временно недоступна - нужен соответствующий OpenAPI endpoint'
  );
  return { success: false, message: 'Endpoint not implemented' };
};

// Хук для запроса верификации упаковки
export const useVerifyPackage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyPackage,
    onSuccess: () => {
      // Инвалидируем кэш смены при успешной верификации
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
};

// Получение списка упаковок для смены (временная заглушка)
export const fetchPackagesByShift = async (_shiftId: string) => {
  // TODO: Заменить на вызов соответствующего OpenAPI метода
  console.warn(
    'fetchPackagesByShift: функция временно недоступна - нужен соответствующий OpenAPI endpoint'
  );
  return [];
};

// Хук для получения списка упаковок
export const usePackagesByShift = (shiftId: string | null) => {
  return useQuery({
    queryKey: ['packages', shiftId],
    queryFn: () => {
      if (!shiftId) throw new Error('shiftId is required');
      return fetchPackagesByShift(shiftId);
    },
    enabled: !!shiftId,
    staleTime: 30 * 1000, // 30 секунд
  });
};

/**
 * ЗАПРОСЫ ДЛЯ СТАТИСТИКИ
 */

// Получение статистики по смене (временная заглушка)
export const fetchShiftStats = async (_shiftId: string) => {
  // TODO: Заменить на вызов соответствующего OpenAPI метода
  console.warn(
    'fetchShiftStats: функция временно недоступна - нужен соответствующий OpenAPI endpoint'
  );
  return { completed: 0, total: 0, packaged: 0 };
};

// Хук для получения статистики
export const useShiftStats = (shiftId: string | null) => {
  return useQuery({
    queryKey: ['shiftStats', shiftId],
    queryFn: () => {
      if (!shiftId) throw new Error('shiftId is required');
      return fetchShiftStats(shiftId);
    },
    enabled: !!shiftId,
    staleTime: 60 * 1000, // 1 минута
    refetchInterval: 30 * 1000, // Обновляем каждые 30 секунд
  });
};

/**
 * ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
 */

// Получение информации о пользователе (используем уже существующую функцию для оператора)
export const fetchUserProfile = async (): Promise<IOperatorFindOne> => {
  return await AuthenticationService.operatorControllerGetMe();
};

// Хук для получения профиля пользователя
export const useUserProfile = () => {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchUserProfile,
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: 1,
  });
};

// Функция для входа по штрих-коду (используем уже существующую функцию)
export const loginByBarcode = async (barcode: string): Promise<IOperatorFindOne> => {
  return await fetchWorkplaceByBarcode(barcode);
};

// Хук для входа по штрих-коду
export const useLoginByBarcode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginByBarcode,
    onSuccess: () => {
      // Инвалидируем кэш профиля при успешном входе
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
  });
};

// Функция для выхода пользователя (очистка токенов и данных)
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        // Попытка отозвать токен на сервере
        await AuthenticationService.userControllerRevokeToken();
      } catch (error) {
        // Игнорируем ошибки отзыва токена, важно очистить локальные данные
        console.warn('Failed to revoke token on server:', error);
      }
    },
    onSuccess: () => {
      // Очищаем токены
      clearOpenAPIToken();

      // Очищаем все кеши React Query
      queryClient.clear();

      // Очищаем данные из localStorage
      localStorage.removeItem('workplaceData');

      console.log('User logged out successfully');
    },
    onError: error => {
      console.error('Logout error:', error);

      // Даже при ошибке очищаем локальные данные
      clearOpenAPIToken();
      queryClient.clear();
      localStorage.removeItem('workplaceData');
    },
  });
};
