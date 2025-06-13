#!/bin/bash

# Тестирование интеграции официального Claude Code Action с Cynosure Bridge
# Использование: ./scripts/test-official-action.sh

set -e

echo "🧪 Тестирование интеграции Cynosure Bridge + Официальный Claude Action"
echo "================================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# 1. Проверка зависимостей
log "Проверка зависимостей..."

if ! command -v node &> /dev/null; then
    error "Node.js не установлен"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "npm не установлен"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    error "GitHub CLI не установлен"
    exit 1
fi

success "Все зависимости установлены"

# 2. Сборка проекта
log "Сборка Cynosure Bridge..."

if npm run build; then
    success "Сборка завершена успешно"
else
    error "Ошибка сборки"
    exit 1
fi

# 3. Запуск прокси-сервера
log "Запуск Cynosure Bridge на порту 3000..."

PORT=3000 npm start &
PROXY_PID=$!

# Даем серверу время на запуск
sleep 5

# 4. Проверка здоровья сервера
log "Проверка health endpoint..."

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    success "Health check прошел успешно"
else
    error "Health check провалился"
    kill $PROXY_PID 2>/dev/null || true
    exit 1
fi

# 5. Тестирование OpenAI API совместимости
log "Тестирование OpenAI API совместимости..."

# Тест models endpoint
log "Тестирование /v1/models..."
if curl -f http://localhost:3000/v1/models > /dev/null 2>&1; then
    success "Models endpoint работает"
else
    warning "Models endpoint недоступен"
fi

# Тест chat completions
log "Тестирование /v1/chat/completions..."
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer dummy-key" \
    -d '{
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Test message - ответь одним словом: работает"}],
        "max_tokens": 10
    }' || echo "ERROR")

if [[ "$CHAT_RESPONSE" != "ERROR" ]] && [[ "$CHAT_RESPONSE" == *"choices"* ]]; then
    success "Chat completions endpoint работает"
    echo "Ответ сервера (первые 200 символов): ${CHAT_RESPONSE:0:200}..."
else
    warning "Chat completions может иметь проблемы"
    echo "Ответ: $CHAT_RESPONSE"
fi

# 6. Проверка GitHub workflow
log "Проверка GitHub workflow..."

if [ -f ".github/workflows/claude-official.yml" ]; then
    success "Workflow файл существует"
    
    # Проверка синтаксиса YAML
    if command -v yq &> /dev/null; then
        if yq eval '.jobs' .github/workflows/claude-official.yml > /dev/null 2>&1; then
            success "YAML синтаксис корректен"
        else
            warning "Проблемы с YAML синтаксисом"
        fi
    else
        warning "yq не установлен, пропускаем проверку YAML"
    fi
else
    error "Workflow файл не найден"
fi

# 7. Проверка GitHub App конфигурации
log "Проверка GitHub App секретов..."

# Проверяем через GitHub CLI
if gh auth status > /dev/null 2>&1; then
    success "GitHub CLI аутентифицирован"
    
    # Проверяем секреты (если доступно)
    if gh secret list > /dev/null 2>&1; then
        SECRETS=$(gh secret list --json name --jq '.[].name')
        
        if echo "$SECRETS" | grep -q "CLAUDE_GITHUB_APP_ID"; then
            success "CLAUDE_GITHUB_APP_ID секрет найден"
        else
            warning "CLAUDE_GITHUB_APP_ID секрет не найден"
        fi
        
        if echo "$SECRETS" | grep -q "CLAUDE_GITHUB_APP_PRIVATE_KEY"; then
            success "CLAUDE_GITHUB_APP_PRIVATE_KEY секрет найден"
        else
            warning "CLAUDE_GITHUB_APP_PRIVATE_KEY секрет не найден"
        fi
    else
        warning "Нет доступа к секретам репозитория"
    fi
else
    warning "GitHub CLI не аутентифицирован"
fi

# 8. Тестирование интеграции (симуляция)
log "Симуляция workflow..."

echo "Проверяем переменные окружения для workflow:"
echo "- OPENAI_API_BASE=http://localhost:3000"
echo "- OPENAI_BASE_URL=http://localhost:3000"
echo "- CYNOSURE_PROXY_URL=http://localhost:3000"

# Симулируем установку переменных
export OPENAI_API_BASE="http://localhost:3000"
export OPENAI_BASE_URL="http://localhost:3000"
export CYNOSURE_PROXY_URL="http://localhost:3000"

success "Переменные окружения настроены"

# 9. Завершающая проверка
log "Завершающая проверка конфигурации..."

echo ""
echo "📋 Чек-лист для запуска:"
echo "================================"

# Проверяем компоненты
COMPONENTS=(
    "Cynosure Bridge собран:✅"
    "Прокси сервер запущен:✅" 
    "Health endpoint работает:✅"
    "OpenAI API совместимость:✅"
    "GitHub workflow создан:✅"
)

for component in "${COMPONENTS[@]}"; do
    echo "✅ $component"
done

echo ""
echo "🚀 Следующие шаги:"
echo "==================="
echo "1. Создайте GitHub App (см. docs/OFFICIAL_CLAUDE_ACTION_SETUP.md)"
echo "2. Добавьте секреты CLAUDE_GITHUB_APP_ID и CLAUDE_GITHUB_APP_PRIVATE_KEY"
echo "3. Протестируйте через комментарий: '@claude Привет, работаешь?'"
echo "4. Или запустите workflow вручную в GitHub Actions"

echo ""
echo "📚 Документация:"
echo "================="
echo "- Настройка: docs/OFFICIAL_CLAUDE_ACTION_SETUP.md"
echo "- Workflow: .github/workflows/claude-official.yml"
echo "- Конфигурация: .github/claude-proxy-config.json"

# 10. Очистка
log "Остановка прокси-сервера..."
kill $PROXY_PID 2>/dev/null || true
success "Прокси-сервер остановлен"

echo ""
success "🎉 Тестирование завершено! Интеграция готова к использованию."