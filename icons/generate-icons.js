// #!/usr/bin/env node

// /**
//  * Скрипт для генерации иконок в различных форматах из PNG файла
//  * Требует установки Sharp: npm install sharp
//  */

// const fs = require('fs');
// const path = require('path');

// const assetsDir = path.join(__dirname, '..', 'icons');
// const iconPath = path.join(assetsDir, 'icon.png');

// // Проверяем наличие Sharp
// function hasSharp() {
//   try {
//     require.resolve('sharp');
//     return true;
//   } catch (error) {
//     return false;
//   }
// }

// async function installSharp() {
//   console.log('🔄 Установка Sharp...');
//   const { execSync } = require('child_process');
//   try {
//     execSync('npm install sharp', { stdio: 'inherit' });
//     console.log('✅ Sharp успешно установлен!');
//     return true;
//   } catch (installError) {
//     console.error('❌ Не удалось установить Sharp:', installError.message);
//     return false;
//   }
// }

// async function generateIcons() {
//   try {
//     // Проверяем, существует ли исходная иконка
//     if (!fs.existsSync(iconPath)) {
//       console.error('❌ Файл icon.png не найден в src/assets/');
//       process.exit(1);
//     }

//     console.log('🎨 Генерация иконок из', iconPath);

//     const sharp = require('sharp');

//     // Загружаем исходное изображение
//     const image = sharp(iconPath);
//     const metadata = await image.metadata();

//     console.log(`📏 Размер исходного изображения: ${metadata.width}x${metadata.height}`); // Генерируем иконку для Windows (.ico)
//     const iconWinPath = path.join(assetsDir, 'icon-win.png');
//     console.log('🔨 Создание иконки для Windows...');

//     // Создаем PNG версию с размером 256x256 для Windows
//     await image.resize(256, 256).png().toFile(iconWinPath);

//     console.log('✅ Создан icon-win.png (256x256) для Windows');

//     // Для macOS нужен ICNS формат
//     // Sharp не поддерживает ICNS напрямую, но мы можем создать нужные размеры
//     const iconMacPath = path.join(assetsDir, 'icon-mac.png');
//     console.log('🔨 Создание иконки для macOS...');

//     // Создаем PNG версию для macOS (будет работать как временное решение)
//     await image.resize(512, 512).png().toFile(iconMacPath);

//     console.log('✅ Создан icon-mac.png (512x512) для macOS');

//     // Создаем иконки разных размеров для общего использования
//     const sizes = [16, 32, 48, 64, 128, 256, 512];

//     for (const size of sizes) {
//       const outputPath = path.join(assetsDir, `icon-${size}.png`);
//       await image.resize(size, size).png().toFile(outputPath);
//       console.log(`✅ Создан icon-${size}.png`);
//     }
//     console.log('🎉 Все иконки успешно созданы!');
//     console.log('\n📋 Список созданных файлов:');
//     console.log('  - icon.png (оригинал)');
//     console.log('  - icon-win.png (256x256 для Windows)');
//     console.log('  - icon-mac.png (512x512 для macOS)');
//     console.log('  - icon-{16,32,48,64,128,256,512}.png (разные размеры)');

//     console.log('\n💡 Следующие шаги:');
//     console.log('  - Переименуйте icon-win.png в icon.ico или используйте онлайн конвертер');
//     console.log('  - Переименуйте icon-mac.png в icon.icns или используйте iconutil на macOS');
//     console.log('  - Проверьте настройки forge.config.ts');
//   } catch (error) {
//     console.error('❌ Ошибка при генерации иконок:', error.message);
//     process.exit(1);
//   }
// }

// async function main() {
//   if (!hasSharp()) {
//     console.error('❌ Sharp не установлен.');
//     const installed = await installSharp();
//     if (!installed) {
//       console.log('\n💡 Вы можете установить Sharp вручную командой: npm install sharp');
//       process.exit(1);
//     }
//   }

//   await generateIcons();
// }

// main();
