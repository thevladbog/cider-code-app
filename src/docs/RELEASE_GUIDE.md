# Система релизов

Этот проект использует автоматическую систему релизов на основе [semantic-release](https://semantic-release.gitbook.io/) и [Conventional Commits](https://www.conventionalcommits.org/).

## Как это работает

### Ветки релизов

- **`release-beta`** - создает бета-релизы (например, `v1.2.0-beta.1`)
- **`release-stable`** - создает продакшн релизы (например, `v1.2.0`)

### Типы релизов

- **PATCH** (1.0.0 → 1.0.1) - для `fix:`, `perf:`, `refactor:`, `build:`, `revert:`
- **MINOR** (1.0.0 → 1.1.0) - для `feat:`
- **MAJOR** (1.0.0 → 2.0.0) - для breaking changes (с `!` или `BREAKING CHANGE:`)

## Настройка репозитория

### 1. Создание веток релизов

```bash
# Создание ветки для бета-релизов
git checkout -b release-beta
git push -u origin release-beta

# Создание ветки для продакшн релизов
git checkout -b release-stable
git push -u origin release-stable
```

### 2. Настройка GitHub Secrets

В настройках репозитория (Settings → Secrets and variables → Actions) добавьте:

- `GITHUB_TOKEN` - автоматически доступен, дополнительная настройка не требуется
- `NPM_TOKEN` - если планируете публиковать в NPM (опционально)

### 3. Защита веток релизов

В настройках репозитория (Settings → Branches) настройте Branch Protection Rules для:

- `release-beta`
- `release-stable`

Рекомендуемые настройки:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
- ✅ Require conversation resolution before merging
- ✅ Include administrators

## Рабочий процесс

### Разработка

1. Создавайте feature-ветки от `main`
2. Используйте Conventional Commits для сообщений коммитов
3. Создавайте Pull Request в `main`

### Бета-релиз

1. Создайте Pull Request из `main` в `release-beta`
2. После мержа автоматически создастся бета-релиз

### Продакшн релиз

1. Создайте Pull Request из `main` в `release-stable`
2. После мержа автоматически создастся продакшн релиз

## Примеры коммитов

```bash
# Создаст patch релиз (1.0.0 → 1.0.1)
git commit -m "fix: resolve printer connection timeout"

# Создаст minor релиз (1.0.0 → 1.1.0)
git commit -m "feat: add barcode scanner support"

# Создаст major релиз (1.0.0 → 2.0.0)
git commit -m "feat!: remove legacy API endpoints"

# Не создаст релиз
git commit -m "docs: update installation guide"
git commit -m "chore: update dependencies"
```

## Мониторинг релизов

### GitHub Actions

Все релизы отслеживаются через GitHub Actions:

- `.github/workflows/release.yml` - основной процесс релиза
- `.github/workflows/publish-release.yml` - публикация артефактов
- `.github/workflows/validate-commits.yml` - валидация коммитов

### Артефакты

После каждого релиза создаются:

- GitHub Release с changelog
- Собранные приложения для Windows, Linux, macOS
- Обновление версии в `package.json`
- Автоматический `CHANGELOG.md`

## Откат релиза

Если релиз нужно откатить:

1. Удалите тег: `git tag -d v1.2.0 && git push --delete origin v1.2.0`
2. Удалите GitHub Release через веб-интерфейс
3. Создайте фикс коммит с правильной версией

## Настройка локального окружения

Для локальной проверки semantic-release:

```bash
# Установка зависимостей
npm install

# Проверка конфигурации (dry-run)
npx semantic-release --dry-run

# Проверка коммитов
npx commitlint --from HEAD~1 --to HEAD --verbose
```

## Troubleshooting

### Релиз не создался

1. Проверьте формат коммитов в GitHub Actions
2. Убедитесь, что есть коммиты, которые должны создать релиз
3. Проверьте логи в GitHub Actions

### Ошибка доступа

1. Проверьте настройки GITHUB_TOKEN
2. Убедитесь, что бот имеет права на создание релизов
3. Проверьте настройки защиты веток

### Конфликты версий

1. Убедитесь, что version в package.json не изменяется вручную
2. Позвольте semantic-release управлять версионированием
3. При конфликтах используйте git rebase для очистки истории
