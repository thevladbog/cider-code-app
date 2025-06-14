#!/usr/bin/env node

/**
 * Скрипт для тестирования процесса загрузки артефактов
 * Имитирует работу GitHub Actions workflow
 */

const fs = require('fs');
const path = require('path');

function findDistributables(baseDir) {
  const distributables = [];
  const extensions = ['.zip', '.exe', '.deb', '.rpm', '.dmg', '.nupkg'];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          distributables.push({
            path: fullPath,
            relativePath: path.relative(baseDir, fullPath),
            name: item,
            size: stat.size,
            sizeMB: (stat.size / 1024 / 1024).toFixed(2),
          });
        }
      }
    });
  }

  walk(path.join(baseDir, 'out', 'make'));
  return distributables;
}

function simulateArtifactUpload(distributables) {
  console.log('\n🚀 Simulating artifact upload process...');

  // Группируем по платформам (имитируя разные matrix.os)
  const platforms = {
    'windows-latest': distributables.filter(
      f => f.name.includes('.exe') || f.name.includes('.nupkg')
    ),
    'ubuntu-latest': distributables.filter(
      f => f.name.includes('.deb') || f.name.includes('.rpm') || f.name.includes('linux')
    ),
    'macos-latest': distributables.filter(
      f => f.name.includes('.dmg') || f.name.includes('darwin')
    ),
  };

  Object.entries(platforms).forEach(([platform, files]) => {
    if (files.length > 0) {
      console.log(`\n📦 Platform: ${platform}`);
      files.forEach(file => {
        console.log(`  ✅ Would upload: ${file.name} (${file.sizeMB} MB)`);
        console.log(`     Path: ${file.relativePath}`);
      });
    }
  });

  return platforms;
}

function simulateReleaseUpload(distributables) {
  console.log('\n🎯 Simulating release asset upload...');

  if (distributables.length === 0) {
    console.log('❌ No distributable files found to upload');
    return false;
  }

  console.log(`📈 Found ${distributables.length} files to upload to GitHub Release:`);
  distributables.forEach(file => {
    console.log(`  🔗 ${file.name} (${file.sizeMB} MB)`);
  });

  // Проверяем, что у нас есть файлы для всех платформ
  const hasWindows = distributables.some(f => f.name.includes('.exe') || f.name.includes('.nupkg'));
  const hasLinux = distributables.some(
    f => f.name.includes('linux') || f.name.includes('.deb') || f.name.includes('.rpm')
  );
  const hasMacOS = distributables.some(f => f.name.includes('darwin') || f.name.includes('.dmg'));

  console.log('\n🏁 Platform coverage:');
  console.log(`  Windows: ${hasWindows ? '✅' : '❌'}`);
  console.log(`  Linux: ${hasLinux ? '✅' : '❌'}`);
  console.log(`  macOS: ${hasMacOS ? '✅' : '❌'}`);

  return hasWindows && hasLinux && hasMacOS;
}

console.log('🧪 Testing artifact upload simulation...');

const baseDir = __dirname;
console.log(`📁 Base directory: ${baseDir}`);

// Найти все дистрибутивы
const distributables = findDistributables(baseDir);

if (distributables.length === 0) {
  console.log('\n❌ No distributable files found!');
  console.log('💡 Run a build first:');
  console.log('   npm run make:win   (for Windows)');
  console.log('   npm run make:linux (for Linux)');
  console.log('   npm run make:mac   (for macOS)');
  process.exit(1);
}

// Имитировать загрузку артефактов
const platforms = simulateArtifactUpload(distributables);

// Имитировать загрузку в релиз
const success = simulateReleaseUpload(distributables);

if (success) {
  console.log('\n🎉 Simulation completed successfully!');
  console.log('✅ All platforms have distributable files ready for release.');
} else {
  console.log('\n⚠️  Simulation completed with warnings.');
  console.log('🔍 Some platforms may be missing distributable files.');
}

console.log('\n📋 Summary:');
console.log(`Total files: ${distributables.length}`);
console.log(
  `Total size: ${distributables.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024 / 1024} GB`
);

// Создать файл-отчет
const report = {
  timestamp: new Date().toISOString(),
  totalFiles: distributables.length,
  platforms: Object.keys(platforms).map(platform => ({
    name: platform,
    files: platforms[platform].length,
    fileNames: platforms[platform].map(f => f.name),
  })),
  distributables: distributables.map(f => ({
    name: f.name,
    path: f.relativePath,
    size: f.size,
    sizeMB: f.sizeMB,
  })),
};

fs.writeFileSync(path.join(baseDir, 'artifact-test-report.json'), JSON.stringify(report, null, 2));
console.log('\n📄 Report saved to: artifact-test-report.json');
