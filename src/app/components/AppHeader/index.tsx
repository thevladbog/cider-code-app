import { Display, Gear, Minus, Square, SquareDashed, Xmark } from '@gravity-ui/icons';
import { Button, Icon } from '@gravity-ui/uikit';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmModal } from '../ConfirmModal';
import { ThemeToggle } from '../ThemeToggle';
import styles from './AppHeader.module.scss';

interface AppHeaderProps {
  className?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ className }) => {
  const navigate = useNavigate();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleSettings = () => {
    navigate('/devices');
  };

  const handleMinimize = async () => {
    try {
      console.log('Attempting to minimize window...');
      await window.electronAPI?.minimizeWindow?.();
      console.log('Window minimized successfully');
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      console.log('Attempting to maximize window...');
      await window.electronAPI?.maximizeWindow?.();
      console.log('Window maximized successfully');
    } catch (error) {
      console.error('Failed to maximize window:', error);
    }
  };

  const handleClose = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = async () => {
    try {
      await window.electronAPI?.quitApp?.();
    } catch (error) {
      console.error('Failed to quit app:', error);
    }
    setShowExitConfirm(false);
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  const handleFullscreen = async () => {
    try {
      await window.electronAPI?.toggleFullscreen?.();
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
    }
  };

  const handleKioskMode = async () => {
    try {
      console.log('Attempting to toggle kiosk mode...');
      await window.electronAPI?.toggleKioskMode?.();
      console.log('Kiosk mode toggled successfully');
    } catch (error) {
      console.error('Failed to toggle kiosk mode:', error);
    }
  };

  return (
    <div className={`${styles.appHeader} ${className || ''}`}>
      <div className={styles.leftSection}>{/* Пустая секция для будущих элементов */}</div>

      <div className={styles.centerSection}>
        {/* Центральная секция для заголовка или логотипа */}
      </div>

      <div className={styles.rightSection}>
        <Button
          view="flat-contrast"
          size="s"
          onClick={handleSettings}
          title="Настройки и проверка оборудования"
          className={styles.headerButton}
        >
          <Icon data={Gear} size={14} />
        </Button>

        <ThemeToggle size="s" variant="flat-contrast" />

        <Button
          view="flat-contrast"
          size="s"
          onClick={handleFullscreen}
          title="Полноэкранный режим"
          className={styles.headerButton}
        >
          <Icon data={SquareDashed} size={16} />
        </Button>

        <Button
          view="flat-contrast"
          size="s"
          onClick={handleKioskMode}
          title="Режим киоска"
          className={styles.headerButton}
        >
          <Icon data={Display} size={16} />
        </Button>

        <div className={styles.windowControls}>
          <Button
            view="flat-contrast"
            size="s"
            onClick={handleMinimize}
            title="Свернуть"
            className={styles.windowButton}
          >
            <Icon data={Minus} size={14} />
          </Button>

          <Button
            view="flat-contrast"
            size="s"
            onClick={handleMaximize}
            title="Развернуть/Восстановить"
            className={styles.windowButton}
          >
            <Icon data={Square} size={14} />
          </Button>

          <Button
            view="flat-contrast"
            size="s"
            onClick={handleClose}
            title="Закрыть"
            className={`${styles.windowButton} ${styles.closeButton}`}
          >
            <Icon data={Xmark} size={14} />
          </Button>
        </div>
      </div>

      <ConfirmModal
        visible={showExitConfirm}
        title="Подтверждение выхода"
        message="Вы уверены, что хотите закрыть приложение? Все несохранённые данные будут потеряны."
        confirmText="Выйти"
        cancelText="Отмена"
        variant="danger"
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
      />
    </div>
  );
};
