import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import AppWrapper from './AppWrapper';
import './styles/global.scss';
import { rendererLogger } from './utils/rendererLogger';

const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

// Vite Hot Module Replacement - отключено для совместимости с TypeScript конфигурацией
// В продакшене HMR не используется, поэтому можно безопасно отключить
if (process.env.NODE_ENV === 'development') {
  // HMR код временно отключен из-за конфигурации TypeScript
  // При необходимости можно обновить tsconfig.json для поддержки import.meta
  rendererLogger.debug('HMR support temporarily disabled due to TypeScript configuration');
}
