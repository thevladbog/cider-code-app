import { Text } from '@gravity-ui/uikit';
import classNames from 'classnames';
import React from 'react';

import styles from './ShiftCard.module.scss';
import { IShiftScheme, ShiftStatus } from '../../types';

// Заглушка изображения для смен без картинки
import DEFAULT_IMAGE from '@/assets/default-product-image.svg'
// Функция форматирования даты
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface ShiftCardProps {
  shift: IShiftScheme;
  onClick: (shiftId: string) => void;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({ shift, onClick }) => {
  const handleClick = () => {
    onClick(shift.id);
  };

  // Определение стилей статуса
  const getStatusClassName = () => {
    switch (shift.status) {
      case ShiftStatus.PLANNED:
        return styles.statusActive;
      case ShiftStatus.INPROGRESS:
        return styles.statusInProgress;
      case ShiftStatus.DONE:
        return styles.statusArchived;
      case ShiftStatus.CANCELED:
        return styles.statusCanceled;
      default:
        return '';
    }
  };

  // Определение текста статуса
  const getStatusText = () => {
    switch (shift.status) {
      case ShiftStatus.PLANNED:
        return 'Запланирована';
      case ShiftStatus.INPROGRESS:
        return 'В работе';
      case ShiftStatus.DONE:
        return 'Архив';
      case ShiftStatus.CANCELED:
        return 'Отменена';
      default:
        return 'Неизвестно';
    }
  };

  return (
    <div className={styles.shiftCard} onClick={handleClick}>
      <div className={classNames(styles.statusFlag, getStatusClassName())} />

      <div className={styles.imageContainer}>
        <img
          src={shift.product.pictureUrl || DEFAULT_IMAGE}
          alt={shift.product.shortName}
          onError={e => {
            e.currentTarget.src = DEFAULT_IMAGE;
          }}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.title}>
          <Text variant="subheader-2">
            {shift.product.shortName}, {shift.product.volume} л.
          </Text>
        </div>

        <div className={styles.code}>
          <Text variant="body-2">Код: {shift.product.gtin}</Text>
        </div>

        <div className={styles.code}>
          <Text variant="body-2">Планируемое количество: {shift.plannedCount}</Text>
        </div>

        <div className={styles.footer}>
          <div className={styles.date}>
            <Text variant="caption-1">{formatDate(shift.plannedDate)}</Text>
          </div>

          <div className={classNames(styles.status, getStatusClassName())}>
            <Text variant="caption-1">{getStatusText()}</Text>
          </div>
        </div>
      </div>
    </div>
  );
};
