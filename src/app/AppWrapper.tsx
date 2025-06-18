import { ThemeProvider } from '@gravity-ui/uikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { HashRouter as Router } from 'react-router-dom';

import { configureOpenAPI } from './api/config';
import { AppRoutes } from './components/AppRoutes';
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
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default AppWrapper;
