# 🤖 CYNOSURE - Полное руководство по автономному запуску

## 📋 Быстрый старт без помощи AI

### 1. 🚀 Запуск сервера

```bash
# Переход в директорию проекта
cd /Users/laptop/dev/cynosure

# Запуск сервера (автоматическая сборка + запуск)
./scripts/cynosure-local.sh start

# Проверка статуса
./scripts/cynosure-local.sh status

# Тестирование API
./scripts/cynosure-local.sh test
```

### 2. 🔧 Управление сервером

```bash
# Остановка сервера
./scripts/cynosure-local.sh stop

# Перезапуск (при изменениях кода)
./scripts/cynosure-local.sh restart

# Просмотр логов
./scripts/cynosure-local.sh logs

# Статус и информация
./scripts/cynosure-local.sh status
```

### 3. 🧪 Тестирование endpoints

```bash
# Health check
curl http://localhost:3000/health

# Список моделей
curl http://localhost:3000/v1/models

# Chat completion
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Привет!"}]
  }'

# Embeddings
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "Hello world"
  }'
```

## 📊 NPM скрипты

### 🏗️ Разработка

```bash
# Запуск в режиме разработки (hot reload)
npm run dev

# Запуск с дебаггером
npm run dev:debug

# Сборка проекта
npm run build

# Запуск production версии
npm run start
```

### 🧪 Тестирование

```bash
# Все тесты
npm run test

# Только unit тесты
npm run test:unit

# Integration тесты
npm run test:integration

# E2E тесты
npm run test:e2e

# Тесты с покрытием
npm run test:coverage

# Тесты с UI
npm run test:ui
```

### 🔍 Качество кода

```bash
# Проверка ESLint
npm run lint

# Автоисправление ESLint
npm run lint:fix

# Форматирование Prettier
npm run format

# Проверка типов TypeScript
npm run typecheck

# Полная проверка перед коммитом
npm run precommit
```

### 🐳 Docker

```bash
# Сборка Docker образа
npm run docker:build

# Оптимизированная сборка
npm run docker:build:optimized

# Запуск в Docker
npm run docker:run

# Production deploy с Docker Compose
npm run docker:run:prod

# Остановка Docker контейнера
npm run docker:stop

# Логи Docker
npm run docker:logs
```

### 🔧 Обслуживание

```bash
# Очистка временных файлов
npm run clean

# Полная очистка (включая node_modules)
npm run clean:all

# Проверка устаревших зависимостей
npm run deps:check

# Обновление зависимостей
npm run deps:update

# Аудит безопасности
npm run security:audit
```

## 🌐 Сетевой доступ

### Локальная сеть
- **URL:** `http://192.168.1.196:3000`
- **Health:** `http://192.168.1.196:3000/health`
- **API:** `http://192.168.1.196:3000/v1/chat/completions`

### Автозапуск на macOS

```bash
# Установка LaunchAgent для автозапуска
cp scripts/com.cynosure.factory.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.cynosure.factory.plist

# Проверка статуса автозапуска
launchctl list | grep cynosure
```

## 🔧 Конфигурация

### Переменные окружения (.env)

```bash
# Claude конфигурация
ANTHROPIC_API_KEY=<optional>         # Не нужен для MAX subscription
CLAUDE_PATH=/Users/laptop/.claude/local/claude

# Сервер
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Директории
WORKING_DIRECTORY=/Users/laptop/dev/cynosure
MAX_TURNS=5
TIMEOUT=60000
```

### Важные пути

```bash
# Claude CLI
/Users/laptop/.claude/local/claude

# Проект
/Users/laptop/dev/cynosure

# Логи
/Users/laptop/dev/cynosure/.local/cynosure.log

# PID файл
/Users/laptop/dev/cynosure/.local/cynosure.pid
```

## 🚨 Устранение проблем

### 1. Порт занят

```bash
# Убить процесс на порту 3000
lsof -ti:3000 | xargs kill -9

# Или использовать скрипт (он делает это автоматически)
./scripts/cynosure-local.sh restart
```

### 2. Claude CLI не найден

```bash
# Проверить путь к Claude
which claude

# Проверить файл
ls -la /Users/laptop/.claude/local/claude

# При необходимости исправить в src/claude/api-client.ts
```

### 3. Сборка не работает

```bash
# Очистить все и пересобрать
npm run clean
npm install
npm run build
```

### 4. Проблемы с зависимостями

```bash
# Переустановка зависимостей
rm -rf node_modules package-lock.json
npm install

# Аудит и исправление
npm audit fix
```

## 🎯 Быстрые команды

### Полный рестарт
```bash
cd /Users/laptop/dev/cynosure && ./scripts/cynosure-local.sh restart
```

### Проверка всего
```bash
cd /Users/laptop/dev/cynosure && ./scripts/cynosure-local.sh test
```

### Просмотр логов в реальном времени
```bash
tail -f /Users/laptop/dev/cynosure/.local/cynosure.log
```

### Health check
```bash
curl -s http://localhost:3000/health | jq .
```

## 🔗 Полезные ссылки

- **Локальный:** http://localhost:3000
- **Сетевой:** http://192.168.1.196:3000
- **Health:** http://localhost:3000/health
- **API Docs:** http://localhost:3000/docs
- **Models:** http://localhost:3000/v1/models

## 📞 OpenAI SDK Integration

```javascript
// Использование с OpenAI SDK
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key'
});

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

```python
# Python с OpenAI SDK
import openai

openai.base_url = "http://localhost:3000/v1"
openai.api_key = "dummy-key"

response = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

**✨ Теперь вы можете запускать и управлять Cynosure полностью автономно!**