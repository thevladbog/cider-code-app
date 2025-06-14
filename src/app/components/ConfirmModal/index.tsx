import { Button, Modal, Text } from '@gravity-ui/uikit';
import React from 'react';

import styles from './ConfirmModal.module.scss';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  return (
    <Modal open={visible} onClose={onCancel} className={styles.confirmModal}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Text variant="header-2" className={styles.title}>
            {title}
          </Text>
        </div>

        <div className={styles.body}>
          <Text variant="body-1" className={styles.message}>
            {message}
          </Text>
        </div>

        <div className={styles.footer}>
          <Button view="flat" size="l" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            view={
              variant === 'danger'
                ? 'action'
                : variant === 'warning'
                  ? 'outlined-warning'
                  : 'action'
            }
            size="l"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
