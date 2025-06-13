import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import apiClient, { saveAuthToken } from './apiClient';
import { Shift, ShiftStatus, GenerateSSCCResponse, IShiftScheme } from '../types';

/**
 * ЗАПРОСЫ ДЛЯ РАБОЧЕГО МЕСТА
 */

// Функция для получения данных о рабочем месте по штрих-коду
export const fetchWorkplaceByBarcode = async (barcode: string) => {
  const { data: loginData } = await apiClient.post<{ token: string }>('/operator/login', {
    barcode,
  });

  saveAuthToken(loginData.token);

  const { data } = await apiClient.get('/operator/me', {
    withCredentials: true,
  });
  return data;
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
export const fetchShifts = async (): Promise<Shift> => {
  const { data } = await apiClient.get('/shift/operator', {
    withCredentials: true,
  });
  return data;
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
export const fetchShiftById = async (shiftId: string): Promise<{ result: IShiftScheme }> => {
  const { data } = await apiClient.get(`/shift/operator/${shiftId}`);
  return data;
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
export const createShift = async (productCode: string): Promise<Shift> => {
  const { data } = await apiClient.post('/shifts', { productCode });
  return data;
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
  status: ShiftStatus;
}): Promise<Shift> => {
  const { data } = await apiClient.patch(`/shifts/${shiftId}/status`, { status });
  return data;
};

// Хук для изменения статуса смены
export const useUpdateShiftStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateShiftStatus,
    onSuccess: data => {
      // Инвалидируем кэш смен и конкретной смены
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shift', data.result] });
    },
  });
};

/**
 * ЗАПРОСЫ ДЛЯ УПАКОВОК
 */

// Запрос на генерацию SSCC кода для упаковки
export const generateSSCC = async ({
  shiftId,
  productCodes,
}: {
  shiftId: string;
  productCodes: string[];
}): Promise<GenerateSSCCResponse> => {
  const { data } = await apiClient.post(`/shifts/${shiftId}/packages/sscc`, {
    productCodes,
  });
  return data;
};

// Хук для запроса генерации SSCC
export const useGenerateSSCC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateSSCC,
    onSuccess: () => {
      // Инвалидируем кэш смены при успешном создании упаковки
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
};

// Запрос на подтверждение верификации упаковки
export const verifyPackage = async ({
  shiftId,
  sscc,
  verifiedBy,
}: {
  shiftId: string;
  sscc: string;
  verifiedBy?: string;
}): Promise<{ success: boolean; message?: string }> => {
  const { data } = await apiClient.post(`/shifts/${shiftId}/packages/${sscc}/verify`, {
    verifiedBy,
  });
  return data;
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

// Получение списка упаковок для смены
export const fetchPackagesByShift = async (shiftId: string) => {
  const { data } = await apiClient.get(`/shifts/${shiftId}/packages`);
  return data;
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

// Получение статистики по смене
export const fetchShiftStats = async (shiftId: string) => {
  const { data } = await apiClient.get(`/shifts/${shiftId}/stats`);
  return data;
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
 * ЗАПРОСЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
 */

// Получение информации о пользователе
export const fetchUserProfile = async () => {
  const { data } = await apiClient.get('/users/me');
  return data;
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

// Функция для входа по штрих-коду
export const loginByBarcode = async (barcode: string) => {
  const { data } = await apiClient.post('/auth/login-by-barcode', { barcode });
  return data;
};

// Хук для входа по штрих-коду
export const useLoginByBarcode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginByBarcode,
    onSuccess: data => {
      // Сохраняем токен и инвалидируем кэш профиля
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      }
    },
  });
};
