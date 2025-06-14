# Иконки приложения

В этой папке хранятся иконки приложения в разных форматах для различных платформ.

## Структура файлов:

- `icon.png` - Основная иконка в формате PNG (используется для Linux)
- `icon.ico` - Иконка для Windows (необходимо создать из PNG)
- `icon.icns` - Иконка для macOS (необходимо создать из PNG)

## Создание иконок из PNG:

### Для Windows (.ico):

Можно использовать онлайн-конвертеры или ImageMagick:

```bash
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Для macOS (.icns):

Можно использовать `iconutil` на macOS или онлайн-конвертеры:

```bash
# Создать папку с разными размерами
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Создать .icns файл
iconutil -c icns icon.iconset
```

## Примечания:

- Убедитесь, что исходная иконка в PNG имеет высокое разрешение (желательно 1024x1024 или больше)
- Для лучшего качества рекомендуется создавать иконки вручную для каждого размера
- При использовании Electron Forge, иконка автоматически будет встроена в приложение
