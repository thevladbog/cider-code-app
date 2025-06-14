import { ThemeProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom';

import { configureOpenAPI } from './api/config';
import { DeviceCheckScreen } from './components/DeviceCheckScreen';
import { ScanScreen } from './components/ScanScreen';
import { ShiftDetailScreen } from './components/ShiftDetailScreen';
import { ShiftsScreen } from './components/ShiftsScreen';
import { initializeDevices } from './store/deviceStore';
import {
  initializeSettings,
  setupSettingsListeners,
  useSettingsStore,
} from './store/settingsStore';
import './styles/global.scss';

// Инициализируем OpenAPI перед запуском приложения
configureOpenAPI();

// Создаем QueryClient для React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppWrapper() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { uiSettings } = useSettingsStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeSettings();
        await initializeDevices();
        setupSettingsListeners();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return (
      <ThemeProvider theme={uiSettings.theme}>
        <div className="app-container loading">
          <div className="loading-spinner">
            <div>Загрузка приложения...</div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={uiSettings.theme}>
      <QueryClientProvider client={queryClient}>
        <Router>
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
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default AppWrapper;
