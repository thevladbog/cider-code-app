import { ArrowLeft, ArrowRotateLeft, Eye, Plus } from '@gravity-ui/icons';
import { Button, Spin, Tab, TabList, Text } from '@gravity-ui/uikit';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLogout, useShifts } from '../../api/queries';
import { ShiftStatus } from '../../types';
import { AppHeader } from '../AppHeader';
import { CreateShiftModal } from '../CreateShiftModal';
import { ShiftCard } from '../ShiftCard';
import styles from './ShiftsScreen.module.scss';

interface TabsItem {
  id: string;
  title: string;
}

// Опции фильтра для табов
const filterOptions: TabsItem[] = [
  { id: 'all', title: 'Все' },
  { id: ShiftStatus.PLANNED, title: 'Активные' },
  { id: ShiftStatus.INPROGRESS, title: 'В работе' },
  { id: ShiftStatus.DONE, title: 'Архивные' },
  { id: ShiftStatus.CANCELED, title: 'Отмененные' },
];

export const ShiftsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const { data: shifts, isLoading, error, refetch } = useShifts();
  const logout = useLogout();

  // Фильтрация смен по статусу
  const filteredShifts = shifts
    ? filter === 'all'
      ? shifts.result
      : shifts.result.filter(shift => shift.status === filter)
    : [];

  // Обработчик нажатия на карточку смены
  const handleShiftClick = (shiftId: string) => {
    navigate(`/shifts/${shiftId}`);
  };

  // Обработчик успешного создания смены
  const handleShiftCreated = (shiftId: string) => {
    setCreateModalVisible(false);
    navigate(`/shifts/${shiftId}`);
  };
  // Обработчик выхода пользователя
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate('/');
      },
    });
  };
  return (
    <div className={styles.shiftsScreen}>
      <AppHeader />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Text variant="display-3">Управление сменами</Text>
          </div>
          <div className={styles.headerActions}>
            <Button
              view="outlined"
              size="l"
              onClick={handleLogout}
              loading={logout.isPending}
              className={styles.buttonWithIcon}
            >
              <ArrowLeft />
              Выйти
            </Button>
            <Button
              view="action"
              size="l"
              onClick={() => setCreateModalVisible(true)}
              className={styles.buttonWithIcon}
            >
              <Plus />
              Создать новую смену
            </Button>
          </div>
        </div>
        <div className={styles.gridContainer}>
          <div className={styles.gridHeader}>
            <div className={styles.filters}>
              <TabList size="m" value={filter} onUpdate={tabId => setFilter(tabId)}>
                {filterOptions.map(item => {
                  return (
                    <Tab key={item.id} value={item.id}>
                      {item.title}
                    </Tab>
                  );
                })}
              </TabList>
            </div>

            <Text variant="body-2" color="secondary">
              {filteredShifts.length > 0
                ? `Найдено смен: ${filteredShifts.length}`
                : 'Нет смен для отображения'}
            </Text>
          </div>
          {isLoading ? (
            <div className={styles.loader}>
              <Spin size="l" />
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <div className={styles.errorHeader}>
                <Text variant="subheader-1">Не удалось загрузить список смен</Text>
              </div>
              <Text variant="body-1">
                Произошла ошибка при получении данных о сменах. Пожалуйста, попробуйте еще раз.
              </Text>{' '}
              <Button
                view="flat"
                onClick={() => refetch()}
                className={`${styles.retryButton} ${styles.buttonWithIcon}`}
              >
                <ArrowRotateLeft />
                Повторить загрузку
              </Button>
            </div>
          ) : filteredShifts.length > 0 ? (
            <div className={styles.shiftsGrid}>
              {filteredShifts.map(shift => (
                <ShiftCard key={shift.id} shift={shift} onClick={handleShiftClick} />
              ))}
            </div>
          ) : (
            <div className={styles.noShifts}>
              <div className={styles.noShiftsIcon}>📦</div>
              <Text variant="subheader-1">Нет смен для отображения</Text>
              <Text variant="body-1" style={{ marginTop: '8px' }}>
                {filter === 'all'
                  ? 'Создайте новую смену, чтобы начать работу'
                  : `Нет смен со статусом "${filterOptions.find(item => item.id === filter)?.title}"`}
              </Text>{' '}
              {filter !== 'all' && (
                <Button
                  view="flat"
                  onClick={() => setFilter('all')}
                  style={{ marginTop: '16px' }}
                  className={styles.buttonWithIcon}
                >
                  <Eye />
                  Показать все смены
                </Button>
              )}
            </div>
          )}{' '}
        </div>
        <CreateShiftModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onCreated={handleShiftCreated}
        />
      </div>
    </div>
  );
};
