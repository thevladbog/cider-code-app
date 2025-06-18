// scripts/copy-preload.js
// Скрипт для поиска и копирования сгенерированного preload.js в dist/preload.js
// Работает после сборки Vite, чтобы preload.js гарантированно был в корне dist

const fs = require('fs');
const path = require('path');

// Корневая папка сборки
const distDir = path.resolve(__dirname, '../dist');

// Рекурсивный поиск файла preload.js в dist (или вложенных папках)
function findPreloadJs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findPreloadJs(fullPath);
      if (found) return found;
    } else if (entry.isFile() && entry.name === 'preload.js') {
      return fullPath;
    }
  }
  return null;
}

function main() {
  const found = findPreloadJs(distDir);
  if (!found) {
    console.error('preload.js not found in dist');
    process.exit(1);
  }
  const target = path.join(distDir, 'preload.js');
  if (found !== target) {
    fs.copyFileSync(found, target);
    console.log(`Copied ${found} -> ${target}`);
  } else {
    console.log('preload.js already in dist root');
  }
}

main();
