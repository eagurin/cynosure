#!/bin/bash

# 🏠 Cynosure Local - Упрощённое управление без туннелей
# Локальная фабрика для self-hosted GitHub Actions

set -e

# 🎛️ Конфигурация
LOCAL_VERSION="1.0.0"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$PROJECT_DIR/.local"
PID_FILE="$LOCAL_DIR/cynosure.pid"
LOG_FILE="$LOCAL_DIR/cynosure.log"
PORT="${PORT:-3000}"

# Создаём директорию
mkdir -p "$LOCAL_DIR"

# 📝 Логирование
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 🚀 Запуск сервера
start_local() {
    log "🚀 Запуск Cynosure Bridge..."
    
    # Проверяем что порт свободен
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "⚠️  Порт $PORT уже занят"
        local existing_pid=$(lsof -ti:$PORT)
        if [ -n "$existing_pid" ]; then
            log "🔄 Завершаем существующий процесс ($existing_pid)"
            kill $existing_pid 2>/dev/null || true
            sleep 2
        fi
    fi
    
    cd "$PROJECT_DIR"
    
    # Сборка проекта
    log "🔨 Сборка проекта..."
    npm run build
    
    # Запуск в фоне
    log "▶️  Запуск сервера на порту $PORT..."
    PORT=$PORT nohup npm start > "$LOG_FILE" 2>&1 &
    local server_pid=$!
    echo $server_pid > "$PID_FILE"
    
    # Ждём запуска
    sleep 3
    
    # Проверяем что сервер запустился
    if curl -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
        log "✅ Сервер успешно запущен"
        log "🌐 URL: http://localhost:$PORT"
        log "📊 Health: http://localhost:$PORT/health"
        log "🔗 API: http://localhost:$PORT/v1/chat/completions"
        log "📋 PID: $server_pid"
        return 0
    else
        log "❌ Ошибка запуска сервера"
        return 1
    fi
}

# 🛑 Остановка сервера
stop_local() {
    log "🛑 Остановка Cynosure Bridge..."
    
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            log "✅ Процесс $pid завершён"
        else
            log "⚠️  Процесс $pid уже не запущен"
        fi
        rm "$PID_FILE"
    else
        log "⚠️  PID файл не найден"
    fi
    
    # Убиваем все процессы на порту (на всякий случай)
    local port_pids=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        echo "$port_pids" | xargs kill 2>/dev/null || true
        log "🧹 Очищен порт $PORT"
    fi
    
    log "✅ Сервер остановлен"
}

# 🔄 Перезапуск
restart_local() {
    log "🔄 Перезапуск Cynosure Bridge..."
    stop_local
    sleep 2
    start_local
}

# 📊 Статус сервера
status_local() {
    echo "🏠 =========================================="
    echo "   Cynosure Local v$LOCAL_VERSION"
    echo "=========================================="
    echo ""
    
    # Проверяем PID файл
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "📋 PID: $pid (запущен)"
        else
            echo "📋 PID: $pid (не отвечает)"
            rm "$PID_FILE"
        fi
    else
        echo "📋 PID: файл не найден"
    fi
    
    # Проверяем порт
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "🌐 Порт $PORT: занят"
    else
        echo "🌐 Порт $PORT: свободен"
    fi
    
    # Проверяем health endpoint
    if curl -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
        echo "🟢 Статус: РАБОТАЕТ"
        echo "🔗 URL: http://localhost:$PORT"
        
        # Получаем данные о здоровье
        local health=$(curl -s "http://localhost:$PORT/health" 2>/dev/null)
        if [ -n "$health" ]; then
            echo "📊 Uptime: $(echo "$health" | jq -r '.uptime // "unknown"' 2>/dev/null || echo "unknown")"
            echo "💾 Memory: $(echo "$health" | jq -r '.memory.heapUsed // "unknown"' 2>/dev/null || echo "unknown") bytes"
        fi
    else
        echo "🔴 Статус: НЕ ОТВЕЧАЕТ"
    fi
    
    echo ""
    echo "🎯 Команды:"
    echo "   start    - Запустить сервер"
    echo "   stop     - Остановить сервер"  
    echo "   restart  - Перезапустить"
    echo "   logs     - Показать логи"
    echo "   test     - Тест API"
}

# 📋 Показать логи
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo "📋 Последние 20 строк логов:"
        echo "================================"
        tail -20 "$LOG_FILE"
    else
        echo "📋 Лог файл не найден: $LOG_FILE"
    fi
}

# 🧪 Тест API
test_api() {
    log "🧪 Тестирование локального API..."
    
    if ! curl -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
        log "❌ Сервер не отвечает на health check"
        return 1
    fi
    
    log "✅ Health check: OK"
    
    # Тест Claude API
    log "🤖 Тестирование Claude API..."
    
    local response=$(curl -s -X POST "http://localhost:$PORT/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test" \
        -d '{
            "model": "gpt-4",
            "messages": [
                {
                    "role": "user",
                    "content": "Скажи \"тест успешен\" если ты можешь отвечать"
                }
            ],
            "max_tokens": 20
        }' 2>&1)
    
    if echo "$response" | jq . >/dev/null 2>&1; then
        local claude_message=$(echo "$response" | jq -r '.choices[0].message.content // "error"')
        log "✅ Claude API: $claude_message"
        return 0
    else
        log "❌ Claude API не отвечает"
        log "Ответ: $response"
        return 1
    fi
}

# 🔧 Основная функция
main() {
    case "${1:-status}" in
        start)
            start_local
            ;;
        stop)
            stop_local
            ;;
        restart)
            restart_local
            ;;
        status)
            status_local
            ;;
        logs)
            show_logs
            ;;
        test)
            test_api
            ;;
        *)
            echo "Использование: $0 {start|stop|restart|status|logs|test}"
            echo ""
            echo "🏠 Cynosure Local - локальное управление без туннелей"
            echo ""
            echo "Команды:"
            echo "  start    - Запустить Cynosure Bridge на localhost:$PORT"
            echo "  stop     - Остановить сервер"
            echo "  restart  - Перезапустить сервер"
            echo "  status   - Показать статус сервера"
            echo "  logs     - Показать логи сервера"
            echo "  test     - Протестировать API"
            exit 1
            ;;
    esac
}

main "$@"