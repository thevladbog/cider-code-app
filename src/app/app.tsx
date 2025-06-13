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

// Hot Module Replacement для React компонентов
if (module.hot) {
  module.hot.accept('./AppWrapper', () => {
    const NextAppWrapper = require('./AppWrapper').default;
    root.render(
      <React.StrictMode>
        <NextAppWrapper />
      </React.StrictMode>
    );
  });
}
