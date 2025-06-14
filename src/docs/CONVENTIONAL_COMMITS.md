# Conventional Commits

Этот проект использует [Conventional Commits](https://www.conventionalcommits.org/) для автоматического создания релизов.

## Формат коммитов

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Типы коммитов

- **feat**: новая функциональность (создает MINOR релиз)
- **fix**: исправление бага (создает PATCH релиз)
- **perf**: улучшение производительности (создает PATCH релиз)
- **refactor**: рефакторинг кода (создает PATCH релиз)
- **build**: изменения в системе сборки (создает PATCH релиз)
- **revert**: откат изменений (создает PATCH релиз)
- **docs**: изменения в документации (НЕ создает релиз)
- **style**: изменения стиля кода (НЕ создает релиз)
- **test**: добавление тестов (НЕ создает релиз)
- **ci**: изменения в CI/CD (НЕ создает релиз)
- **chore**: прочие изменения (НЕ создает релиз)

## Breaking Changes

Для создания MAJOR релиза добавьте `!` после типа или включите `BREAKING CHANGE:` в footer:

```
feat!: remove support for Node 14
```

или

```
feat: add new API endpoint

BREAKING CHANGE: The old API endpoint is no longer supported
```

## Примеры

```
feat: add barcode scanning functionality
fix: resolve issue with printer connection
perf: improve scanning speed
docs: update installation guide
refactor: restructure component hierarchy
build: update electron to v36
ci: add automated testing workflow
chore: update dependencies
```

## Scope (опционально)

Можно указать область изменений:

```
feat(scanner): add support for QR codes
fix(printer): resolve timeout issues
docs(api): update endpoint documentation
```

## Ветки релизов

- **release-beta**: создает бета-релизы (например, v1.2.0-beta.1)
- **release-stable**: создает продакшн релизы (например, v1.2.0)
