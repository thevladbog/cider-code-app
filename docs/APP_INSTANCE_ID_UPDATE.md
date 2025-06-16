# APP_INSTANCE_ID Update

## Изменения в релизном workflow

Обновлен формат `APP_INSTANCE_ID` для более детальной идентификации инстансов приложения в логах.

### Старый формат:

```
bottle-code-app-beta-ci
bottle-code-app-prod-ci
```

### Новый формат:

```
bottle-code-app-{тип}-{версия}-{ос}
```

### Примеры новых значений:

**Beta релизы:**

- `bottle-code-app-beta-1.0.0-beta.5-win`
- `bottle-code-app-beta-1.0.0-beta.5-linux`
- `bottle-code-app-beta-1.0.0-beta.5-macos`

**Production релизы:**

- `bottle-code-app-prod-1.0.1-win`
- `bottle-code-app-prod-1.0.1-linux`
- `bottle-code-app-prod-1.0.1-macos`

## Преимущества

✅ **Уникальная идентификация** каждой сборки по версии и платформе  
✅ **Легкий поиск логов** для конкретной версии приложения  
✅ **Отслеживание проблем** по платформам и версиям  
✅ **Детальная аналитика** использования разных версий

## Что изменилось в коде

### В `.github/workflows/release.yml`:

- Обновлены все три секции сборки (Windows, Linux, macOS)
- `APP_INSTANCE_ID` теперь динамически формируется из:
  - `needs.release.outputs.version` - версия из semantic-release
  - `github.ref_name` - определяет beta/prod
  - `matrix.os` - определяет win/linux/macos

### В документации:

- Обновлен `GITHUB_SECRETS_SETUP.md` с новыми примерами
- Добавлены детальные объяснения формата APP_INSTANCE_ID

## Отладка в CI

В логах CI теперь будет видно:

```
APP_INSTANCE_ID pattern: bottle-code-app-{type}-{version}-{os}
Release type: beta
Version: 1.0.0-beta.5
OS suffix: win
Final APP_INSTANCE_ID will be: bottle-code-app-beta-1.0.0-beta.5-win
```

Это поможет легко понять, какая именно версия и платформа логируется.
