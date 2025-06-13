# 🌟 Cynosure Bridge - Полное руководство автономного запуска

**OpenAI-compatible API proxy для Claude Code SDK** - используйте Claude MAX подписку по всему миру + **Network Proxy Server**

![Build Status](https://github.com/eagurin/cynosure/workflows/CI/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue.svg)

## 🎯 **БЫСТРЫЙ СТАРТ БЕЗ AI**

### 📁 **Местоположение проекта:**

```
/Users/laptop/dev/cynosure/
```

### 🚀 **Автоматическая установка и запуск:**

```bash
# 1. Переход в директорию проекта
cd /Users/laptop/dev/cynosure

# 2. Полная автоматическая установка (один раз)
./scripts/all-in-one-setup.sh

# 3. Запуск сервера
./scripts/cynosure-local.sh start

# 4. Проверка статуса
./scripts/cynosure-local.sh status

# 5. Тестирование всех endpoints
./scripts/cynosure-local.sh test
```

### 🌐 **Доступные URLs:**

- **Локально:** http://localhost:3000
- **По сети:** http://192.168.1.196:3000
- **Health check:** http://localhost:3000/health
- **API документация:** http://localhost:3000/docs

---

## 📜 **ПОЛНЫЙ СПИСОК СКРИПТОВ**

### 1. **🏠 Основное управление (`scripts/cynosure-local.sh`):**

```bash
# Запуск сервера (автоматическая сборка + запуск)
./scripts/cynosure-local.sh start

# Остановка сервера
./scripts/cynosure-local.sh stop

# Перезапуск сервера (при изменениях кода)
./scripts/cynosure-local.sh restart

# Полный статус сервера
./scripts/cynosure-local.sh status

# Просмотр логов
./scripts/cynosure-local.sh logs

# Тестирование всех API endpoints
./scripts/cynosure-local.sh test
```

### 2. **⚡ Быстрые команды (`scripts/quick-commands.sh`):**

```bash
# Быстрый старт с автотестами
./scripts/quick-commands.sh start

# Быстрый перезапуск с обновлением
./scripts/quick-commands.sh restart

# Быстрое тестирование всех endpoints
./scripts/quick-commands.sh test

# Быстрый статус сервера
./scripts/quick-commands.sh status

# Быстрая очистка временных файлов
./scripts/quick-commands.sh clean

# Быстрый ремонт (переустановка + сборка)
./scripts/quick-commands.sh fix

# Быстрый тест производительности
./scripts/quick-commands.sh benchmark
```

### 3. **🔧 Полная автоматическая установка (`scripts/all-in-one-setup.sh`):**

```bash
# Полная установка от начала до конца
./scripts/all-in-one-setup.sh

# Что делает:
# ✅ Проверяет все зависимости (Node.js, Claude CLI, npm, curl)
# ✅ Устанавливает npm пакеты
# ✅ Создает .env конфигурацию
# ✅ Собирает проект
# ✅ Проверяет TypeScript типы
# ✅ Запускает unit тесты
# ✅ Тестирует запуск сервера
# ✅ Проверяет API endpoints
```

---

## 📊 **58 NPM СКРИПТОВ**

### **🏗️ Разработка:**

```bash
# Запуск в режиме разработки (hot reload)
npm run dev

# Запуск с дебаггером
npm run dev:debug

# Сборка проекта
npm run build

# Запуск production версии
npm start

# Production с переменными
npm run start:prod
```

### **🧪 Тестирование:**

```bash
# Все тесты
npm run test

# Unit тесты
npm run test:unit

# Integration тесты
npm run test:integration

# E2E тесты
npm run test:e2e

# Тесты с покрытием
npm run test:coverage

# Тесты с UI интерфейсом
npm run test:ui

# Тесты в watch режиме
npm run test:watch
```

### **🔍 Качество кода:**

```bash
# ESLint проверка
npm run lint

# ESLint автоисправление
npm run lint:fix

# Prettier форматирование
npm run format

# Проверка форматирования
npm run format:check

# TypeScript проверка типов
npm run typecheck

# Полная проверка перед коммитом
npm run precommit

# CI проверка
npm run ci
```

### **🐳 Docker:**

```bash
# Сборка Docker образа
npm run docker:build

# Оптимизированная сборка
npm run docker:build:optimized

# Запуск в Docker
npm run docker:run

# Production deploy
npm run docker:run:prod

# Остановка Docker контейнера
npm run docker:stop

# Логи Docker
npm run docker:logs

# Shell в Docker контейнере
npm run docker:shell
```

### **🔧 Обслуживание:**

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

# Исправление уязвимостей
npm run security:fix
```

### **📊 Мониторинг:**

```bash
# Health check
npm run health:check

# Prometheus метрики
npm run metrics:prometheus

# Производительность профилирование
npm run performance:profile

# Анализ производительности
npm run performance:analyze

# Бенчмарк
npm run benchmark
```

---

## 🧪 **ТЕСТИРОВАНИЕ ENDPOINTS**

### **Health Check:**

```bash
# Простая проверка
curl http://localhost:3000/health

# С форматированием JSON
curl -s http://localhost:3000/health | jq .

# Сетевая проверка
curl http://192.168.1.196:3000/health
```

### **Chat Completions:**

```bash
# Базовый запрос
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Привет! Как дела?"}]
  }'

# Streaming запрос
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Расскажи историю"}],
    "stream": true
  }'

# С ограничением токенов
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Короткий ответ"}],
    "max_tokens": 50
  }'
```

### **Embeddings:**

```bash
# Векторные эмбеддинги
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "Hello world"
  }'

# Проверка размерности
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "test"
  }' | jq '.data[0].embedding | length'
```

### **Models:**

```bash
# Список всех моделей
curl http://localhost:3000/v1/models

# Количество моделей
curl -s http://localhost:3000/v1/models | jq '.data | length'

# Первые 3 модели
curl -s http://localhost:3000/v1/models | jq '.data[0:3]'
```

---

## 🔧 **КОНФИГУРАЦИЯ (.env)**

### **Обязательные настройки:**

```bash
# Порт сервера
PORT=3000

# Хост (0.0.0.0 для сетевого доступа)
HOST=0.0.0.0

# Режим работы
NODE_ENV=production

# Путь к Claude CLI (ВАЖНО!)
CLAUDE_PATH=/Users/laptop/.claude/local/claude

# Рабочая директория
WORKING_DIRECTORY=/Users/laptop/dev/cynosure

# Настройки Claude
MAX_TURNS=5
TIMEOUT=60000
```

### **Опциональные настройки:**

```bash
# API ключ Anthropic (не нужен для MAX подписки)
ANTHROPIC_API_KEY=optional

# CORS настройки
CORS_ORIGINS=*

# Аутентификация (опционально)
PROXY_API_KEYS=key1,key2

# Rate limiting
RATE_LIMIT_PER_MINUTE=100

# Логирование
LOG_LEVEL=info

# Redis (для кэширования)
REDIS_URL=redis://localhost:6379
```

### **Создание .env файла:**

```bash
# Автоматическое создание из примера
cp .env.example .env

# Или создание вручную
cat > .env << 'EOF'
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
CLAUDE_PATH=/Users/laptop/.claude/local/claude
WORKING_DIRECTORY=/Users/laptop/dev/cynosure
MAX_TURNS=5
TIMEOUT=60000
EOF
```

---

## 🚨 **УСТРАНЕНИЕ ПРОБЛЕМ**

### **1. Порт занят:**

```bash
# Проверить что на порту 3000
lsof -ti:3000

# Убить процесс на порту 3000
lsof -ti:3000 | xargs kill -9

# Или использовать скрипт (автоматически)
./scripts/cynosure-local.sh restart
```

### **2. Claude CLI не найден:**

```bash
# Проверить алиас Claude
which claude

# Проверить файл напрямую
ls -la /Users/laptop/.claude/local/claude

# Проверить права на выполнение
chmod +x /Users/laptop/.claude/local/claude

# Тест Claude CLI
echo "Привет" | /Users/laptop/.claude/local/claude -p
```

### **3. Проблемы с сборкой:**

```bash
# Полная очистка и пересборка
npm run clean:all
npm install
npm run build

# Проверка TypeScript
npm run typecheck

# Проверка зависимостей
npm run deps:check
npm audit
```

### **4. Проблемы с зависимостями:**

```bash
# Переустановка зависимостей
rm -rf node_modules package-lock.json
npm install

# Исправление уязвимостей
npm audit fix

# Обновление устаревших пакетов
npm update
```

### **5. Полный ремонт:**

```bash
# Автоматический ремонт
./scripts/quick-commands.sh fix

# Или вручную:
cd /Users/laptop/dev/cynosure
./scripts/cynosure-local.sh stop
npm run clean:all
rm -rf node_modules package-lock.json
npm install
npm run build
./scripts/cynosure-local.sh start
```

---

## 🔗 **INTEGRATION С OPENAI SDK**

### **JavaScript/TypeScript:**

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key', // Любой ключ
});

// Chat
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Привет!' }],
});

// Streaming
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Расскажи историю' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}

// Embeddings
const embeddings = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello world',
});
```

### **Python:**

```python
import openai

# Настройка клиента
openai.base_url = "http://localhost:3000/v1"
openai.api_key = "dummy-key"

# Chat
response = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Привет!"}]
)
print(response.choices[0].message.content)

# Streaming
stream = openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Расскажи историю"}],
    stream=True
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end='')

# Embeddings
embeddings = openai.embeddings.create(
    model="text-embedding-3-small",
    input="Hello world"
)
print(f"Размерность: {len(embeddings.data[0].embedding)}")
```

### **React/Next.js:**

```javascript
// components/ChatComponent.jsx
import { useState } from 'react';

const OPENAI_CONFIG = {
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key',
};

export default function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${OPENAI_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: message }],
        }),
      });

      const data = await res.json();
      setResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Введите сообщение..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Отправка...' : 'Отправить'}
      </button>
      {response && <div>Ответ: {response}</div>}
    </div>
  );
}
```

---

## 🎯 **ГОТОВЫЕ КОМАНДЫ COPY-PASTE**

### **Полный перезапуск проекта:**

```bash
cd /Users/laptop/dev/cynosure && ./scripts/cynosure-local.sh restart
```

### **Быстрая проверка всего:**

```bash
cd /Users/laptop/dev/cynosure && ./scripts/quick-commands.sh test
```

### **Мониторинг статуса в реальном времени:**

```bash
watch -n 2 'curl -s http://localhost:3000/health | jq .'
```

### **Логи в реальном времени:**

```bash
tail -f /Users/laptop/dev/cynosure/.local/cynosure.log
```

### **Полная диагностика:**

```bash
cd /Users/laptop/dev/cynosure && \
echo "=== СТАТУС СЕРВЕРА ===" && \
./scripts/cynosure-local.sh status && \
echo -e "\n=== ТЕСТ API ===" && \
./scripts/cynosure-local.sh test && \
echo -e "\n=== HEALTH CHECK ===" && \
curl -s http://localhost:3000/health | jq .
```

### **Быстрое исправление всех проблем:**

```bash
cd /Users/laptop/dev/cynosure && ./scripts/quick-commands.sh fix
```

---

## 🔍 **ДИАГНОСТИКА И МОНИТОРИНГ**

### **Проверка всех компонентов:**

```bash
# Проверка Node.js
node --version

# Проверка npm
npm --version

# Проверка Claude CLI
/Users/laptop/.claude/local/claude --version

# Проверка директории проекта
ls -la /Users/laptop/dev/cynosure/

# Проверка сборки
ls -la /Users/laptop/dev/cynosure/dist/

# Проверка процессов на порту 3000
lsof -ti:3000

# Проверка сетевого доступа
curl -s http://192.168.1.196:3000/health
```

### **Мониторинг производительности:**

```bash
# CPU и память
top -pid $(cat /Users/laptop/dev/cynosure/.local/cynosure.pid)

# Сетевые соединения
netstat -an | grep 3000

# Дисковое пространство
df -h

# Логи размер
ls -lh /Users/laptop/dev/cynosure/.local/cynosure.log
```

### **Автоматические проверки:**

```bash
# Создание скрипта мониторинга
cat > /Users/laptop/dev/cynosure/monitor.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:3000/health | jq '.status' || echo "OFFLINE"
  sleep 30
done
EOF

chmod +x /Users/laptop/dev/cynosure/monitor.sh
# Запуск: ./monitor.sh
```

---

## 📚 **ФАЙЛОВАЯ СТРУКТУРА**

```
/Users/laptop/dev/cynosure/
├── 🚀 src/                          # Исходный код TypeScript
│   ├── claude/
│   │   ├── api-client.ts           # ✅ Интеграция с Claude CLI
│   │   └── client.ts               # Claude Code SDK
│   ├── server/
│   │   └── routes.ts               # HTTP маршруты Fastify
│   ├── translation/
│   │   ├── claude-to-openai.ts     # Трансляция ответов
│   │   └── openai-to-claude.ts     # Трансляция запросов
│   ├── models/
│   │   ├── claude.ts               # TypeScript типы Claude
│   │   └── openai.ts               # TypeScript типы OpenAI
│   ├── utils/
│   │   └── helpers.ts              # Утилиты и хелперы
│   └── index.ts                    # Главный файл сервера
├── 📜 scripts/                      # Скрипты автоматизации
│   ├── cynosure-local.sh           # ✅ Основное управление
│   ├── all-in-one-setup.sh         # ✅ Автоустановка
│   ├── quick-commands.sh            # ✅ Быстрые команды
│   └── benchmark.js                # Тестирование производительности
├── 🧪 tests/                        # Тестирование
│   ├── unit/                       # Unit тесты
│   ├── integration/                # Integration тесты
│   └── e2e/                        # End-to-end тесты
├── 📋 docs/                         # Документация
│   └── AUTOMATION_GUIDE.md         # ✅ Руководство автономности
├── 🔧 config/                       # Конфигурация
│   ├── models.json                 # Маппинг моделей
│   └── mcp.json                    # MCP конфигурация
├── 🐳 docker/                       # Docker конфигурация
├── 📁 .local/                       # Локальные данные
│   ├── cynosure.pid                # PID файл сервера
│   └── cynosure.log                # Логи сервера
├── 📄 package.json                  # ✅ 58 npm скриптов
├── 📄 .env                          # ✅ Переменные окружения
├── 📄 CLAUDE.md                     # ✅ Конфигурация проекта
└── 📄 README.md                     # ✅ Это руководство
```

---

## 🎯 **ИТОГОВЫЙ ЧЕКЛИСТ**

### ✅ **Готово к использованию:**

- [x] **Автоматическая установка** - `./scripts/all-in-one-setup.sh`
- [x] **Управление сервером** - `./scripts/cynosure-local.sh start|stop|restart|status|test`
- [x] **Быстрые команды** - `./scripts/quick-commands.sh start|test|fix`
- [x] **58 NPM скриптов** - для всех задач разработки
- [x] **Полное тестирование** - Health, Chat, Embeddings, Models
- [x] **OpenAI SDK интеграция** - JavaScript, Python, React примеры
- [x] **Troubleshooting** - решения всех проблем
- [x] **Мониторинг** - логи, статус, производительность
- [x] **Сетевой доступ** - http://192.168.1.196:3000
- [x] **Документация** - полное руководство автономности

### 🚀 **Команды для быстрого старта:**

```bash
# 1. Полная установка
cd /Users/laptop/dev/cynosure && ./scripts/all-in-one-setup.sh

# 2. Запуск сервера
./scripts/cynosure-local.sh start

# 3. Тестирование
./scripts/cynosure-local.sh test

# 4. Статус
./scripts/cynosure-local.sh status
```

---

## 🎊 **CYNOSURE ГОТОВ К ПОЛНОСТЬЮ АВТОНОМНОЙ РАБОТЕ!**

**Теперь вы можете:**

- ✅ Запускать и управлять сервером без AI помощи
- ✅ Диагностировать и исправлять проблемы самостоятельно
- ✅ Интегрировать с любыми OpenAI-совместимыми приложениями
- ✅ Мониторить производительность и статус
- ✅ Масштабировать для команды через сетевой доступ

**Все инструменты и документация готовы для независимого использования!** 🚀

---

**Cynosure** - От греческого κυνοσουρίς (kynosouris), "собачий хвост", обозначающий созвездие Малая Медведица и Полярную звезду - путеводную точку для навигации. Как Полярная звезда направляет путешественников, Cynosure Bridge направляет ваши AI запросы к лучшему решению. ⭐
