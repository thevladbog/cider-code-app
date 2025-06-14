import { Button, Text } from '@gravity-ui/uikit';
import classNames from 'classnames';
import React from 'react';

import styles from './DeviceCheckItem.module.scss';

interface DeviceCheckItemProps {
  id: string;
  name: string;
  type: 'scanner' | 'printer';
  status: 'disconnected' | 'connected' | 'verified';
  connection: string | null;
  onCheck: () => void;
  onConfigure: () => void;
  skipTest?: boolean;
}

export const DeviceCheckItem: React.FC<DeviceCheckItemProps> = ({
  name,
  type,
  status,
  connection,
  onCheck,
  onConfigure,
  skipTest = false,
}) => {
  // Получаем имя иконки в зависимости от типа устройства
  const getDeviceIcon = () => {
    if (type === 'scanner') {
      return '📷'; // Можно заменить на иконку из библиотеки
    }
    return '🖨️'; // Можно заменить на иконку из библиотеки
  };
  // Получаем текст статуса
  const getStatusText = () => {
    if (skipTest && type === 'printer') {
      return 'Пропущено';
    }
    switch (status) {
      case 'verified':
        return 'Проверено';
      case 'connected':
        return `Подключено: ${connection}`;
      default:
        return 'Не подключено';
    }
  };

  console.log({ name, type, status, connection, onCheck, onConfigure });

  return (
    <div
      className={classNames(styles.deviceItem, {
        [styles.deviceItemDisconnected]: status === 'disconnected' && !skipTest,
        [styles.deviceItemConnected]: status === 'connected',
        [styles.deviceItemVerified]: status === 'verified' || skipTest,
      })}
    >
      {' '}
      <div
        className={classNames(styles.deviceIcon, {
          [styles.deviceIconConnected]: status === 'connected',
          [styles.deviceIconVerified]: status === 'verified' || skipTest,
        })}
      >
        {getDeviceIcon()}
      </div>
      <div className={styles.deviceInfo}>
        <div className={styles.deviceName}>
          <Text variant="body-1">{name}</Text>
        </div>{' '}
        <div
          className={classNames(styles.deviceStatus, {
            [styles.deviceStatusConnected]: status === 'connected',
            [styles.deviceStatusVerified]: status === 'verified' || skipTest,
          })}
        >
          <Text variant="body-2">{getStatusText()}</Text>
        </div>
      </div>{' '}
      <div className={styles.deviceControls}>
        <Button view="normal" onClick={onConfigure} disabled={status === 'verified' || skipTest}>
          Настроить
        </Button>

        {!skipTest && (
          <Button
            view="action"
            onClick={onCheck}
            disabled={status === 'disconnected' || status === 'verified'}
          >
            Проверить
          </Button>
        )}
      </div>
    </div>
  );
};
