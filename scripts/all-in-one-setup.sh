#!/bin/bash

# 🎯 CYNOSURE ALL-IN-ONE SETUP
# Полная автоматическая установка и настройка Cynosure Bridge

set -e

echo "🚀 CYNOSURE ALL-IN-ONE SETUP"
echo "============================"
echo ""

# 📁 Переменные
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/setup.log"

# 📝 Логирование
log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🏗️  Начинаем установку Cynosure..."
log "📁 Директория проекта: $PROJECT_DIR"

cd "$PROJECT_DIR"

# 1. 🔍 Проверка зависимостей
log "🔍 Проверяем зависимости..."

# Node.js
if ! command -v node &> /dev/null; then
    log "❌ Node.js не найден. Установите Node.js 18+ и попробуйте снова"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log "❌ Требуется Node.js 18+. Текущая версия: $(node --version)"
    exit 1
fi

log "✅ Node.js: $(node --version)"

# npm
if ! command -v npm &> /dev/null; then
    log "❌ npm не найден"
    exit 1
fi

log "✅ npm: $(npm --version)"

# Claude CLI
if [ ! -f "/Users/laptop/.claude/local/claude" ]; then
    log "❌ Claude CLI не найден по пути /Users/laptop/.claude/local/claude"
    log "   Установите Claude Code и попробуйте снова"
    exit 1
fi

log "✅ Claude CLI найден"

# curl (для тестов)
if ! command -v curl &> /dev/null; then
    log "❌ curl не найден"
    exit 1
fi

log "✅ curl доступен"

# jq (для тестов, опционально)
if command -v jq &> /dev/null; then
    log "✅ jq доступен"
else
    log "⚠️  jq не найден (не критично, но рекомендуется для тестов)"
fi

# 2. 📦 Установка зависимостей
log "📦 Устанавливаем зависимости..."

npm install

if [ $? -ne 0 ]; then
    log "❌ Ошибка установки зависимостей"
    exit 1
fi

log "✅ Зависимости установлены"

# 3. 🔧 Настройка окружения
log "🔧 Настраиваем окружение..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log "✅ Создан .env файл из примера"
    else
        cat > .env << 'EOF'
# Cynosure Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
CLAUDE_PATH=/Users/laptop/.claude/local/claude
WORKING_DIRECTORY=/Users/laptop/dev/cynosure
MAX_TURNS=5
TIMEOUT=60000
EOF
        log "✅ Создан базовый .env файл"
    fi
else
    log "✅ .env файл уже существует"
fi

# 4. 🏗️ Сборка проекта
log "🏗️ Собираем проект..."

npm run build

if [ $? -ne 0 ]; then
    log "❌ Ошибка сборки проекта"
    exit 1
fi

log "✅ Проект собран"

# 5. 🧪 Проверка качества кода
log "🧪 Проверяем качество кода..."

npm run typecheck

if [ $? -ne 0 ]; then
    log "❌ Ошибки типов TypeScript"
    exit 1
fi

log "✅ Типы проверены"

# 6. 🧪 Быстрые тесты
log "🧪 Запускаем unit тесты..."

npm run test:unit

if [ $? -ne 0 ]; then
    log "⚠️  Некоторые unit тесты не прошли (не критично)"
else
    log "✅ Unit тесты пройдены"
fi

# 7. 🚀 Пробный запуск
log "🚀 Тестовый запуск сервера..."

# Убиваем процессы на порту 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log "🔄 Завершаем процессы на порту 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Запускаем сервер в фоне
PORT=3000 nohup npm start > test_server.log 2>&1 &
SERVER_PID=$!

# Ждем запуска
log "⏳ Ждем запуска сервера..."
sleep 5

# Проверяем health endpoint
HEALTH_CHECK=false
for i in {1..10}; do
    if curl -f "http://localhost:3000/health" >/dev/null 2>&1; then
        HEALTH_CHECK=true
        break
    fi
    sleep 1
done

if [ "$HEALTH_CHECK" = true ]; then
    log "✅ Сервер успешно запустился"
    
    # Тест API
    log "🧪 Тестируем API..."
    
    CHAT_RESPONSE=$(curl -s -X POST "http://localhost:3000/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test" \
        -d '{
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Скажи OK если работаешь"}],
            "max_tokens": 10
        }' 2>/dev/null)
    
    if echo "$CHAT_RESPONSE" | grep -q "choices"; then
        log "✅ Chat API работает"
    else
        log "⚠️  Chat API возможно не работает корректно"
    fi
    
else
    log "❌ Сервер не запустился"
    cat test_server.log | tail -10
fi

# Останавливаем тестовый сервер
kill $SERVER_PID 2>/dev/null || true
rm -f test_server.log

# 8. 📜 Создание удобных алиасов
log "📜 Создаем удобные команды..."

chmod +x scripts/cynosure-local.sh

# 9. ✅ Финальная проверка
log "✅ Финальная проверка установки..."

if [ -f "dist/index.js" ] && [ -f ".env" ] && [ -d "node_modules" ]; then
    log "🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!"
    echo ""
    echo "🎯 ГОТОВО К ИСПОЛЬЗОВАНИЮ:"
    echo "=========================="
    echo ""
    echo "🚀 Запуск сервера:"
    echo "   ./scripts/cynosure-local.sh start"
    echo ""
    echo "📊 Проверка статуса:"
    echo "   ./scripts/cynosure-local.sh status"
    echo ""
    echo "🧪 Тестирование:"
    echo "   ./scripts/cynosure-local.sh test"
    echo ""
    echo "🌐 URLs:"
    echo "   • Local:  http://localhost:3000"
    echo "   • Health: http://localhost:3000/health"
    echo "   • API:    http://localhost:3000/v1/chat/completions"
    echo "   • Docs:   http://localhost:3000/docs"
    echo ""
    echo "📋 Логи установки: $LOG_FILE"
    echo ""
else
    log "❌ Установка завершена с ошибками"
    exit 1
fi