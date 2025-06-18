import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIdleTimeout } from '../../hooks';
import { DeviceCheckScreen } from '../DeviceCheckScreen';
import { ScanScreen } from '../ScanScreen';
import { ShiftDetailScreen } from '../ShiftDetailScreen';
import { ShiftsScreen } from '../ShiftsScreen';

/**
 * Компонент-обертка для маршрутов с автоматической блокировкой по таймауту
 */
export const AppRoutes: React.FC = () => {
  // Подключаем автоматическую блокировку через 30 минут бездействия
  useIdleTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 минут
    enabled: true,
    onTimeout: () => {
      console.log('Система заблокирована из-за бездействия пользователя');
    },
  });

  return (
    <div className="app-container">
      <Routes>
        {/* Начальный экран - аутентификация по скану */}
        <Route path="/" element={<ScanScreen />} />

        {/* Экран проверки оборудования */}
        <Route path="/devices" element={<DeviceCheckScreen />} />

        {/* Экран списка смен */}
        <Route path="/shifts" element={<ShiftsScreen />} />

        {/* Экран детальной информации о смене */}
        <Route path="/shifts/:shiftId" element={<ShiftDetailScreen />} />

        {/* Редирект для неизвестных маршрутов */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};
