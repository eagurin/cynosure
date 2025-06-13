#!/bin/bash

# 🎯 CYNOSURE QUICK COMMANDS
# Быстрые команды для ежедневного использования

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 🎨 Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 📝 Логирование с цветами
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_header() { echo -e "${PURPLE}🎯 $1${NC}"; }

# 🚀 Быстрый старт
quick_start() {
    log_header "БЫСТРЫЙ СТАРТ CYNOSURE"
    echo ""
    
    cd "$PROJECT_DIR"
    
    log_info "Останавливаем существующие процессы..."
    ./scripts/cynosure-local.sh stop >/dev/null 2>&1 || true
    
    log_info "Запускаем сервер..."
    if ./scripts/cynosure-local.sh start; then
        log_success "Сервер запущен!"
        echo ""
        echo "🌐 Доступно по адресам:"
        echo "   • http://localhost:3000"
        echo "   • http://192.168.1.196:3000"
        echo ""
        echo "🧪 Тестируем API..."
        sleep 2
        ./scripts/cynosure-local.sh test
    else
        log_error "Ошибка запуска сервера"
        return 1
    fi
}

# 🔄 Быстрый перезапуск с обновлением
quick_restart() {
    log_header "БЫСТРЫЙ ПЕРЕЗАПУСК"
    echo ""
    
    cd "$PROJECT_DIR"
    
    log_info "Пересобираем проект..."
    npm run build
    
    log_info "Перезапускаем сервер..."
    ./scripts/cynosure-local.sh restart
    
    log_success "Перезапуск завершен!"
}

# 🧪 Быстрые тесты
quick_test() {
    log_header "БЫСТРОЕ ТЕСТИРОВАНИЕ"
    echo ""
    
    cd "$PROJECT_DIR"
    
    # Health check
    log_info "Health check..."
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Health OK"
    else
        log_error "Сервер не отвечает"
        return 1
    fi
    
    # Models
    log_info "Проверяем модели..."
    MODELS_COUNT=$(curl -s http://localhost:3000/v1/models | jq '.data | length' 2>/dev/null || echo "0")
    if [ "$MODELS_COUNT" -gt 0 ]; then
        log_success "Доступно $MODELS_COUNT моделей"
    else
        log_warning "Модели не загружены"
    fi
    
    # Chat API
    log_info "Тестируем Chat API..."
    CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test" \
        -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "test"}]}' 2>/dev/null)
    
    if echo "$CHAT_RESPONSE" | jq '.choices[0].message.content' >/dev/null 2>&1; then
        log_success "Chat API работает"
    else
        log_warning "Chat API возможно не работает"
    fi
    
    # Embeddings
    log_info "Тестируем Embeddings..."
    EMB_RESPONSE=$(curl -s -X POST http://localhost:3000/v1/embeddings \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test" \
        -d '{"model": "text-embedding-3-small", "input": "test"}' 2>/dev/null)
    
    if echo "$EMB_RESPONSE" | jq '.data[0].embedding | length' >/dev/null 2>&1; then
        DIMENSIONS=$(echo "$EMB_RESPONSE" | jq '.data[0].embedding | length' 2>/dev/null)
        log_success "Embeddings работают ($DIMENSIONS dimensions)"
    else
        log_warning "Embeddings возможно не работают"
    fi
    
    log_success "Тестирование завершено!"
}

# 📊 Быстрый статус
quick_status() {
    log_header "СТАТУС CYNOSURE"
    echo ""
    
    cd "$PROJECT_DIR"
    
    # Процесс
    if ./scripts/cynosure-local.sh status | grep -q "РАБОТАЕТ"; then
        log_success "Сервер работает"
    else
        log_warning "Сервер не запущен"
    fi
    
    # Порт
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_success "Порт 3000 занят"
    else
        log_warning "Порт 3000 свободен"
    fi
    
    # Health
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
        UPTIME=$(echo "$HEALTH" | jq -r '.uptime // "unknown"' 2>/dev/null)
        MEMORY=$(echo "$HEALTH" | jq -r '.memory.heapUsed // "unknown"' 2>/dev/null)
        
        log_success "Health OK (uptime: ${UPTIME}s, memory: $MEMORY bytes)"
    else
        log_warning "Health endpoint не отвечает"
    fi
    
    # Логи (последние 5 строк)
    if [ -f "$PROJECT_DIR/.local/cynosure.log" ]; then
        echo ""
        log_info "Последние логи:"
        echo "$(tail -5 "$PROJECT_DIR/.local/cynosure.log")"
    fi
}

# 🧹 Быстрая очистка
quick_clean() {
    log_header "БЫСТРАЯ ОЧИСТКА"
    echo ""
    
    cd "$PROJECT_DIR"
    
    log_info "Останавливаем сервер..."
    ./scripts/cynosure-local.sh stop >/dev/null 2>&1 || true
    
    log_info "Очищаем временные файлы..."
    npm run clean
    
    log_info "Очищаем логи..."
    rm -f .local/cynosure.log
    
    log_info "Убиваем процессы на порту 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    log_success "Очистка завершена!"
}

# 🔧 Быстрый ремонт
quick_fix() {
    log_header "БЫСТРЫЙ РЕМОНТ"
    echo ""
    
    cd "$PROJECT_DIR"
    
    log_info "Останавливаем все процессы..."
    ./scripts/cynosure-local.sh stop >/dev/null 2>&1 || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    log_info "Переустанавливаем зависимости..."
    rm -rf node_modules package-lock.json
    npm install
    
    log_info "Пересобираем проект..."
    npm run build
    
    log_info "Запускаем сервер..."
    ./scripts/cynosure-local.sh start
    
    log_success "Ремонт завершен!"
}

# 📈 Производительность
quick_benchmark() {
    log_header "БЫСТРЫЙ БЕНЧМАРК"
    echo ""
    
    cd "$PROJECT_DIR"
    
    if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log_error "Сервер не запущен. Запустите: quick start"
        return 1
    fi
    
    log_info "Тестируем производительность..."
    
    # 10 запросов к chat API
    START_TIME=$(date +%s.%N)
    for i in {1..10}; do
        curl -s -X POST http://localhost:3000/v1/chat/completions \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test" \
            -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}' \
            >/dev/null 2>&1
    done
    END_TIME=$(date +%s.%N)
    
    DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "unknown")
    AVG_TIME=$(echo "scale=3; $DURATION / 10" | bc -l 2>/dev/null || echo "unknown")
    
    log_success "10 запросов за ${DURATION}s (среднее: ${AVG_TIME}s на запрос)"
}

# 🎯 Главная функция
main() {
    case "${1:-help}" in
        start|s)
            quick_start
            ;;
        restart|r)
            quick_restart
            ;;
        test|t)
            quick_test
            ;;
        status|st)
            quick_status
            ;;
        clean|c)
            quick_clean
            ;;
        fix|f)
            quick_fix
            ;;
        benchmark|b)
            quick_benchmark
            ;;
        help|h|*)
            echo "🎯 CYNOSURE QUICK COMMANDS"
            echo "=========================="
            echo ""
            echo "Быстрые команды:"
            echo "  start, s      - Быстрый запуск сервера"
            echo "  restart, r    - Быстрый перезапуск с обновлением"
            echo "  test, t       - Быстрое тестирование всех endpoints"
            echo "  status, st    - Быстрый статус сервера"
            echo "  clean, c      - Быстрая очистка временных файлов"
            echo "  fix, f        - Быстрый ремонт (переустановка + сборка)"
            echo "  benchmark, b  - Быстрый тест производительности"
            echo "  help, h       - Показать это меню"
            echo ""
            echo "Примеры:"
            echo "  ./scripts/quick-commands.sh start"
            echo "  ./scripts/quick-commands.sh test"
            echo "  ./scripts/quick-commands.sh status"
            echo ""
            ;;
    esac
}

main "$@"