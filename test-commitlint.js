#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки валидации коммитов
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Тестовые сообщения коммитов
const testCommits = [
  // Валидные коммиты
  'feat: add new feature',
  'fix: resolve bug in printer',
  'docs: update README',
  'style: format code with prettier',
  'refactor: improve code structure',
  'test: add unit tests',
  'chore: update dependencies',
  'perf: optimize scanning performance',
  'ci: update workflow',
  'build: configure webpack',
  'feat(scanner): add barcode validation',
  'fix(printer): resolve connection timeout',

  // Невалидные коммиты
  'Add new feature', // Нет типа
  'feature: add something', // Неправильный тип
  'feat add feature', // Нет двоеточия
  'fix:resolve bug', // Нет пробела после двоеточия
  'FEAT: add feature', // Заглавные буквы
  'feat: ', // Пустое описание
  '', // Пустой коммит
];

function testCommitMessage(message) {
  try {
    console.log(`\n🧪 Testing: "${message}"`);

    if (!message.trim()) {
      console.log('❌ Empty commit message');
      return false;
    }

    // Создаем временный файл с сообщением
    const tempFile = 'temp-commit-msg.txt';
    fs.writeFileSync(tempFile, message);

    try {
      // Запускаем commitlint
      execSync(`npx commitlint --edit ${tempFile}`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      console.log('✅ Valid commit message');
      return true;
    } catch (error) {
      console.log('❌ Invalid commit message');
      console.log(`   Error: ${error.message.split('\n')[0]}`);
      return false;
    } finally {
      // Удаляем временный файл
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

console.log('🚀 Testing commit message validation...');
console.log('Using commitlint configuration from commitlint.config.js\n');

// Проверяем наличие commitlint
try {
  execSync('npx commitlint --version', { stdio: 'pipe' });
  console.log('✅ commitlint is available');
} catch {
  console.log('❌ commitlint not found, installing...');
  execSync('npm install -g @commitlint/config-conventional @commitlint/cli', { stdio: 'inherit' });
}

let validCount = 0;
let invalidCount = 0;

console.log('\n📋 Running tests...');

testCommits.forEach(message => {
  const isValid = testCommitMessage(message);
  if (isValid) {
    validCount++;
  } else {
    invalidCount++;
  }
});

console.log('\n📊 Test Results:');
console.log(`✅ Valid commits: ${validCount}`);
console.log(`❌ Invalid commits: ${invalidCount}`);
console.log(`📈 Total tested: ${testCommits.length}`);

if (invalidCount > 0) {
  console.log('\n💡 Tip: Use the format "type(scope): description"');
  console.log(
    '   Valid types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert'
  );
}

console.log('\n🎉 Commit validation test completed!');
