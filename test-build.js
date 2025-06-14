#!/usr/bin/env node

/**
 * Скрипт для тестирования сборки приложения
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}`);
  console.log(`Executing: ${command}`);
  try {
    const output = execSync(command, {
      stdio: 'inherit',
      cwd: __dirname,
      encoding: 'utf8',
    });
    console.log(`✅ ${description} - SUCCESS`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} - FAILED`);
    console.error(error.message);
    process.exit(1);
  }
}

function checkOutputDirectory() {
  const outDir = path.join(__dirname, 'out');
  const makeDir = path.join(outDir, 'make');

  console.log('\n📁 Checking output directory structure...');

  if (!fs.existsSync(outDir)) {
    console.log('❌ Output directory does not exist');
    return;
  }

  if (!fs.existsSync(makeDir)) {
    console.log('❌ Make directory does not exist');
    return;
  }

  // Рекурсивно обходим директорию и показываем все файлы
  function walkDir(dir, indent = '') {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        console.log(`${indent}📁 ${item}/`);
        walkDir(fullPath, indent + '  ');
      } else {
        const size = (stat.size / 1024 / 1024).toFixed(2);
        console.log(`${indent}📄 ${item} (${size} MB)`);
      }
    });
  }

  console.log('📁 out/');
  walkDir(outDir, '  ');

  // Проверяем наличие дистрибутивов
  const distributables = [];
  function findDistributables(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findDistributables(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (['.zip', '.exe', '.deb', '.rpm', '.dmg', '.nupkg'].includes(ext)) {
          distributables.push(fullPath);
        }
      }
    });
  }

  findDistributables(makeDir);

  console.log('\n📦 Found distributables:');
  if (distributables.length === 0) {
    console.log('❌ No distributable files found!');
  } else {
    distributables.forEach(file => {
      const relativePath = path.relative(__dirname, file);
      const size = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
      console.log(`✅ ${relativePath} (${size} MB)`);
    });
  }
}

console.log('🚀 Starting build test...');

// Проверяем платформу
const platform = process.platform;
console.log(`📋 Platform: ${platform}`);

// Выбираем команду сборки в зависимости от платформы
let buildCommand;
switch (platform) {
  case 'win32':
    buildCommand = 'npm run make:win';
    break;
  case 'linux':
    buildCommand = 'npm run make:linux';
    break;
  case 'darwin':
    buildCommand = 'npm run make:mac';
    break;
  default:
    console.log('❌ Unsupported platform');
    process.exit(1);
}

// Устанавливаем зависимости
runCommand('npm ci', 'Installing dependencies');

// Собираем приложение
runCommand(buildCommand, `Building application for ${platform}`);

// Проверяем результат
checkOutputDirectory();

console.log('\n🎉 Build test completed successfully!');
