import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import AppWrapper from './AppWrapper';
import './styles/global.scss';

const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

// Vite Hot Module Replacement
if (import.meta.hot) {
  import.meta.hot.accept('./AppWrapper', newModule => {
    if (newModule) {
      const NextAppWrapper = newModule.default;
      root.render(
        <React.StrictMode>
          <NextAppWrapper />
        </React.StrictMode>
      );
    }
  });
}
