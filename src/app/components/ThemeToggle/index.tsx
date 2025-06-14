import { Moon, Sun } from '@gravity-ui/icons';
import { Button, Icon } from '@gravity-ui/uikit';
import React from 'react';

import { useSettingsStore } from '../../store/settingsStore';
import styles from './ThemeToggle.module.scss';

interface ThemeToggleProps {
  size?: 's' | 'm' | 'l' | 'xl';
  variant?:
    | 'normal'
    | 'action'
    | 'outlined'
    | 'outlined-info'
    | 'outlined-danger'
    | 'outlined-warning'
    | 'outlined-success'
    | 'raised'
    | 'flat'
    | 'flat-info'
    | 'flat-danger'
    | 'flat-warning'
    | 'flat-success'
    | 'normal-contrast'
    | 'outlined-contrast'
    | 'flat-contrast';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'm',
  variant = 'outlined',
  className,
}) => {
  const { uiSettings, setTheme } = useSettingsStore();
  const { theme } = uiSettings;

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <Button
      view={variant}
      size={size}
      onClick={toggleTheme}
      className={`${styles.themeToggle} ${className || ''}`}
      title={`Переключить на ${theme === 'light' ? 'темную' : 'светлую'} тему`}
    >
      <Icon
        data={theme === 'light' ? Moon : Sun}
        size={size === 's' ? 14 : size === 'm' ? 16 : 18}
      />
    </Button>
  );
};
