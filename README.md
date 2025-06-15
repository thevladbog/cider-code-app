<p align="center">
  <img src="https://github.com/user-attachments/assets/a98ece47-f42e-4780-ba7b-434b3ed3a1d7" height="200">
</p>

# Cider Code App

**Современное Electron приложение для управления штрих-кодами и упаковкой товаров**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
[![Release](https://github.com/thevladbog/cider-code-app/actions/workflows/release.yml/badge.svg?branch=release-stable)](https://github.com/thevladbog/cider-code-app/actions/workflows/release.yml)
![Electron](https://img.shields.io/badge/Electron-36.2.1-47848f.svg)
![React](https://img.shields.io/badge/React-19.1.0-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178c6.svg)

## 📖 Описание

Cider Code App — это десктопное приложение для автоматизации процессов сканирования штрих-кодов, упаковки товаров и печати этикеток. Приложение предназначено для складских операций и производства, обеспечивая seamless интеграцию с различными типами сканеров и принтеров.

## ✨ Основные функции

### 🔍 Сканирование штрих-кодов

- Поддержка различных типов сканеров через последовательные порты (COM)
- Автоматическое обнаружение и подключение к сканерам
- Поддержка DataMatrix кодов
- Real-time валидация отсканированных данных

### 🖨️ Печать этикеток

- Поддержка различных типов принтеров:
  - Системные принтеры Windows
  - USB принтеры этикеток (Zebra, SATO, Datamax и др.)
  - Сетевые принтеры (TCP/IP)
  - Принтеры на последовательных портах
- Печать в формате ZPL (Zebra Programming Language)
- Генерация штрих-кодов Code 128
- Автоматическое создание SSCC кодов

### 📦 Управление смен и упаковкой

- Создание и управление рабочими сменами
- Отслеживание процесса упаковки товаров
- Подсчет отсканированных единиц
- Верификация упаковок по SSCC кодам
- Backup и восстановление данных

### 🔧 Настройки и конфигурация

- Гибкая настройка устройств
- Сохранение конфигураций принтеров и сканеров
- Настройка параметров упаковки
- Управление операторами

## 🛠️ Технический стек

### Frontend

- **Electron** 36.2.1 - Кроссплатформенная среда
- **React** 19.1.0 - UI библиотека
- **TypeScript** 5.8.3 - Типизированный JavaScript
- **Gravity UI** - Компоненты интерфейса
- **React Query** - Управление состоянием сервера
- **Zustand** - Управление клиентским состоянием
- **React Router** - Маршрутизация
- **SASS** - Стили

### Backend & APIs

- **Electron Store** - Локальное хранение данных
- **SerialPort** - Работа с COM портами
- **USB** - Работа с USB устройствами
- **Axios** - HTTP клиент
- **JSBarcode** - Генерация штрих-кодов

### Development Tools

- **Webpack** - Сборка проекта
- **ESLint** 9.x - Статический анализ кода (современный flat config)
- **Prettier** - Форматирование кода
- **Electron Forge** - Упаковка и дистрибуция

## 🚀 Установка и запуск

### Системные требования

- **OS**: Windows 10/11, macOS, Linux
- **Node.js**: 22+
- **Yarn**: 1.22+ (рекомендуется)

### Установка зависимостей

```bash
# Клонирование репозитория
git clone <repository-url>
cd cider-code-app

# Установка зависимостей
yarn install

# Или с npm
npm install
```

### Запуск в режиме разработки

```bash
# Запуск приложения
yarn start

# Или с npm
npm start
```

### Сборка для продакшена

```bash
# Создание пакета приложения
yarn package

# Создание установщика
yarn make

# Публикация
yarn publish
```

## 📁 Структура проекта

```
src/
├── app/                        # Основной код приложения
│   ├── components/            # React компоненты
│   │   ├── DeviceCheckScreen/ # Экран проверки устройств
│   │   ├── ScanScreen/        # Экран сканирования
│   │   ├── ShiftsScreen/      # Управление сменами
│   │   ├── PrinterSelect/     # Выбор принтера
│   │   └── ...
│   ├── api/                   # API клиенты и запросы
│   ├── hooks/                 # Пользовательские React хуки
│   ├── services/              # Бизнес-логика
│   ├── store/                 # Управление состоянием (Zustand)
│   ├── types/                 # TypeScript типы
│   └── utils/                 # Утилиты
├── assets/                    # Статические ресурсы
├── printer.ts                 # Модуль работы с принтерами
├── serialPortConfig.ts        # Конфигурация COM портов
└── index.ts                   # Точка входа приложения
```

## 🔧 Основные скрипты

```bash
# Разработка
yarn start              # Запуск в режиме разработки
yarn rebuild            # Пересборка нативных модулей

# Линтинг и форматирование
yarn lint               # Проверка кода ESLint
yarn lint:fix           # Автоисправление ESLint
yarn prettier           # Проверка форматирования
yarn prettier:fix       # Автоформатирование
yarn format             # Форматирование + линтинг

# Сборка и упаковка
yarn package            # Создание пакета
yarn make               # Создание установщика
yarn publish            # Публикация
```

## 🔌 Поддерживаемые устройства

### Сканеры штрих-кодов

- Любые сканеры с интерфейсом RS-232/USB-to-Serial
- Автоматическое определение COM портов
- Поддержка различных скоростей передачи данных

### Принтеры этикеток

- **Zebra** (GK420t, GX420t, ZD420, и др.)
- **SATO**
- **Datamax-O'Neil**
- **TSC**
- **Citizen**
- **Brother**
- **Epson**
- Любые принтеры с поддержкой ZPL

## 🎯 Основные экраны приложения

1. **Проверка устройств** - Настройка и тестирование сканеров и принтеров
2. **Управление сменами** - Создание и просмотр рабочих смен
3. **Сканирование** - Основной экран для работы с товарами
4. **Детали смены** - Подробная информация о текущей смене
5. **Упаковка** - Процесс упаковки и создания SSCC кодов

## 🔐 Безопасность

- Локальное хранение данных с помощью Electron Store
- Валидация всех входящих данных
- Безопасная работа с USB и COM портами
- Автоматическое резервное копирование

## 🚀 Релизы

Проект использует автоматическую систему релизов на основе [semantic-release](https://semantic-release.gitbook.io/):

- **Бета-релизы**: создаются при мерже в ветку `release-beta`
- **Продакшн релизы**: создаются при мерже в ветку `release-stable`

### Формат релизов

- `v1.0.1` - patch релиз (исправления)
- `v1.1.0` - minor релиз (новые функции)
- `v2.0.0` - major релиз (breaking changes)
- `v1.1.0-beta.1` - бета релиз

См. [RELEASE_GUIDE.md](RELEASE_GUIDE.md) для подробной информации.

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Внесите изменения и добавьте тесты
4. Используйте [Conventional Commits](CONVENTIONAL_COMMITS.md) для сообщений
5. Push в branch (`git push origin feature/amazing-feature`)
6. Создайте Pull Request в `main`

### Стандарты кода

- Используется ESLint 9.x с современным flat config
- Prettier для форматирования
- TypeScript для типизации
- [Conventional Commits](https://www.conventionalcommits.org/) для сообщений коммитов
- Semantic Release для автоматических релизов

## 📝 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 👤 Автор

**Vladislav Bogatyrev**

- Email: vladislav.bogatyrev@gmail.com

## 🐛 Сообщить об ошибке

Если вы нашли ошибку, пожалуйста, создайте [issue](issues) с подробным описанием проблемы.

## 📞 Поддержка

Для получения поддержки:

1. Проверьте [FAQ](docs/FAQ.md)
2. Посмотрите [Issues](issues)
3. Создайте новый Issue
4. Напишите автору

---

_Разработано с ❤️ для автоматизации складских процессов_
