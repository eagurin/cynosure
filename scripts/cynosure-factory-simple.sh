#!/bin/bash

# 🏭 Cynosure Factory Simple - Локальная фабрика без туннелей
# Упрощённая версия для self-hosted runner и локального использования

set -e

# 🎛️ Конфигурация
FACTORY_VERSION="2.0.0"
FACTORY_NAME="Cynosure Factory Simple"

# 📁 Структура директорий
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FACTORY_DIR="$PROJECT_DIR/.factory"
RUNTIME_DIR="$FACTORY_DIR/runtime"
LOGS_DIR="$FACTORY_DIR/logs"

# Создаём структуру
mkdir -p "$RUNTIME_DIR" "$LOGS_DIR"

# 📋 Файлы состояния
PID_FILE="$RUNTIME_DIR/cynosure.pid"
STATUS_FILE="$RUNTIME_DIR/status.json"
LOG_FILE="$LOGS_DIR/factory.log"

# 🔧 Конфигурация сервиса
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-production}"
HEALTH_URL="http://localhost:$PORT/health"

# 📝 Логирование
factory_log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# 📊 Обновление статуса
update_status() {
    local service_status="$1"
    local message="$2"
    
    cat > "$STATUS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "factory_version": "$FACTORY_VERSION",
  "service_status": "$service_status",
  "port": $PORT,
  "health_url": "$HEALTH_URL",
  "message": "$message",
  "pid": $(cat "$PID_FILE" 2>/dev/null || echo "null"),
  "uptime_seconds": $(get_uptime)
}
EOF
}

# ⏱️ Время работы
get_uptime() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs -I {} date -j -f "%a %b %d %H:%M:%S %Y" "{}" "+%s" 2>/dev/null || echo "0")
            local current_time=$(date +%s)
            echo $((current_time - start_time))
        else
            echo "0"
        fi
    else
        echo "0"
    fi
}

# 🔍 Проверка зависимостей
check_dependencies() {
    factory_log "INFO" "🔍 Проверяем зависимости..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        factory_log "ERROR" "❌ Node.js не найден"
        return 1
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        factory_log "ERROR" "❌ npm не найден"
        return 1
    fi
    
    # package.json
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        factory_log "ERROR" "❌ package.json не найден в $PROJECT_DIR"
        return 1
    fi
    
    # Собранный проект
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        factory_log "WARN" "⚠️ Проект не собран, запускаем сборку..."
        cd "$PROJECT_DIR"
        npm run build
    fi
    
    factory_log "INFO" "✅ Все зависимости найдены"
    return 0
}

# 🚀 Запуск сервиса
start_service() {
    factory_log "INFO" "🚀 Запуск Cynosure Bridge..."
    
    # Проверяем что порт свободен
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        local existing_pid=$(lsof -ti:$PORT)
        factory_log "WARN" "⚠️ Порт $PORT занят процессом $existing_pid"
        
        # Убиваем существующий процесс
        kill $existing_pid 2>/dev/null || true
        sleep 2
        factory_log "INFO" "🔄 Освободили порт $PORT"
    fi
    
    cd "$PROJECT_DIR"
    
    # Запуск в фоне
    NODE_ENV=$NODE_ENV PORT=$PORT nohup npm start > "$LOGS_DIR/cynosure.log" 2>&1 &
    local service_pid=$!
    echo $service_pid > "$PID_FILE"
    
    factory_log "INFO" "🎯 Сервис запущен с PID: $service_pid"
    
    # Ждём запуска
    local retries=0
    local max_retries=10
    
    while [ $retries -lt $max_retries ]; do
        sleep 2
        if curl -f "$HEALTH_URL" >/dev/null 2>&1; then
            factory_log "INFO" "✅ Сервис успешно запущен и отвечает"
            update_status "running" "Service started successfully"
            return 0
        fi
        retries=$((retries + 1))
        factory_log "INFO" "⏳ Ожидание запуска... ($retries/$max_retries)"
    done
    
    factory_log "ERROR" "❌ Сервис не запустился в течение $(($max_retries * 2)) секунд"
    update_status "failed" "Service failed to start"
    return 1
}

# 🛑 Остановка сервиса
stop_service() {
    factory_log "INFO" "🛑 Остановка Cynosure Bridge..."
    
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            factory_log "INFO" "✅ Процесс $pid завершён"
        else
            factory_log "WARN" "⚠️ Процесс $pid уже не запущен"
        fi
        rm "$PID_FILE"
    else
        factory_log "WARN" "⚠️ PID файл не найден"
    fi
    
    # Убиваем все процессы на порту (на всякий случай)
    local port_pids=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        echo "$port_pids" | xargs kill 2>/dev/null || true
        factory_log "INFO" "🧹 Очищен порт $PORT"
    fi
    
    update_status "stopped" "Service stopped"
    factory_log "INFO" "✅ Сервис остановлен"
}

# 🔄 Перезапуск сервиса
restart_service() {
    factory_log "INFO" "🔄 Перезапуск Cynosure Bridge..."
    stop_service
    sleep 3
    start_service
}

# 📊 Статус сервиса
show_status() {
    clear
    echo "🏭 =========================================="
    echo "   $FACTORY_NAME v$FACTORY_VERSION"
    echo "=========================================="
    echo ""
    
    # Основная информация
    echo "📍 Проект: $PROJECT_DIR"
    echo "🌐 Порт: $PORT"
    echo "🔗 Health: $HEALTH_URL"
    echo ""
    
    # PID и процесс
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🟢 Статус: РАБОТАЕТ"
            echo "📋 PID: $pid"
            echo "⏱️ Uptime: $(get_uptime) секунд"
        else
            echo "🔴 Статус: НЕ РАБОТАЕТ (PID устарел)"
            rm "$PID_FILE"
        fi
    else
        echo "🔴 Статус: НЕ ЗАПУЩЕН"
    fi
    
    # Health check
    if curl -f "$HEALTH_URL" >/dev/null 2>&1; then
        echo "✅ Health Check: OK"
        
        # Получаем информацию о сервисе
        local health_data=$(curl -s "$HEALTH_URL" 2>/dev/null)
        if [ -n "$health_data" ]; then
            echo "📊 Версия: $(echo "$health_data" | jq -r '.version // "unknown"')"
            echo "⚡ Uptime: $(echo "$health_data" | jq -r '.uptime // "unknown"') секунд"
            echo "💾 Memory: $(echo "$health_data" | jq -r '.memory.heapUsed // "unknown"') bytes"
        fi
    else
        echo "❌ Health Check: FAIL"
    fi
    
    # Проверка порта
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "🌐 Порт $PORT: СЛУШАЕТ"
        echo "📡 Network: http://$(hostname -I | awk '{print $1}'):$PORT (внешний доступ)"
    else
        echo "🔴 Порт $PORT: НЕ СЛУШАЕТ"
    fi
    
    echo ""
    echo "🎯 Команды:"
    echo "   start      - Запустить сервис"
    echo "   stop       - Остановить сервис"
    echo "   restart    - Перезапустить сервис"
    echo "   logs       - Показать логи"
    echo "   monitor    - Мониторинг в реальном времени"
    echo "   test       - Тест API"
    
    # Последние логи
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "📋 Последние события:"
        tail -5 "$LOG_FILE" | while read line; do
            echo "   $line"
        done
    fi
}

# 📋 Показать логи
show_logs() {
    echo "📋 Логи Cynosure Factory:"
    echo "========================="
    
    if [ -f "$LOG_FILE" ]; then
        tail -30 "$LOG_FILE"
    else
        echo "Логи не найдены"
    fi
    
    echo ""
    echo "📋 Логи сервиса:"
    echo "================"
    
    if [ -f "$LOGS_DIR/cynosure.log" ]; then
        tail -20 "$LOGS_DIR/cynosure.log"
    else
        echo "Логи сервиса не найдены"
    fi
}

# 📊 Мониторинг
monitor_service() {
    echo "📊 Мониторинг Cynosure Bridge (Ctrl+C для выхода)"
    echo "================================================="
    
    while true; do
        clear
        show_status
        echo ""
        echo "🔄 Обновление через 5 секунд..."
        sleep 5
    done
}

# 🧪 Тест API
test_api() {
    factory_log "INFO" "🧪 Тестирование API..."
    
    # Health check
    if curl -f "$HEALTH_URL" >/dev/null 2>&1; then
        factory_log "INFO" "✅ Health check: OK"
    else
        factory_log "ERROR" "❌ Health check: FAIL"
        return 1
    fi
    
    # Тест Claude API
    factory_log "INFO" "🤖 Тестирование Claude API..."
    
    local test_response=$(curl -s -X POST "http://localhost:$PORT/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test" \
        -d '{
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Скажи коротко что ты Claude"}],
            "max_tokens": 50
        }' 2>&1)
    
    if echo "$test_response" | jq . >/dev/null 2>&1; then
        local claude_message=$(echo "$test_response" | jq -r '.choices[0].message.content // "error"')
        factory_log "INFO" "✅ Claude API: $claude_message"
        return 0
    else
        factory_log "ERROR" "❌ Claude API: $test_response"
        return 1
    fi
}

# 🔧 Инициализация
init_factory() {
    factory_log "INFO" "🏭 Инициализация простой фабрики..."
    
    # Создаём конфигурацию
    cat > "$RUNTIME_DIR/config.json" << EOF
{
  "factory_name": "$FACTORY_NAME",
  "factory_version": "$FACTORY_VERSION",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mode": "local",
  "tunnels_enabled": false,
  "port": $PORT,
  "health_url": "$HEALTH_URL"
}
EOF
    
    update_status "initialized" "Factory initialized"
    factory_log "INFO" "✅ Простая фабрика инициализирована"
}

# 🔧 Главная функция
main() {
    case "${1:-status}" in
        init)
            init_factory
            ;;
        start)
            if ! check_dependencies; then
                exit 1
            fi
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            if ! check_dependencies; then
                exit 1
            fi
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        monitor)
            monitor_service
            ;;
        test)
            test_api
            ;;
        *)
            echo "🏭 Cynosure Factory Simple v$FACTORY_VERSION"
            echo ""
            echo "Использование: $0 {init|start|stop|restart|status|logs|monitor|test}"
            echo ""
            echo "Команды:"
            echo "  init      - Инициализация фабрики"
            echo "  start     - Запустить Cynosure Bridge"
            echo "  stop      - Остановить сервис"
            echo "  restart   - Перезапустить сервис"
            echo "  status    - Показать статус сервиса"
            echo "  logs      - Показать логи"
            echo "  monitor   - Мониторинг в реальном времени"
            echo "  test      - Протестировать API"
            echo ""
            echo "🏠 Простая фабрика без туннелей для локального использования"
            echo "🚀 Для self-hosted GitHub Actions runner"
            echo "🌐 Сетевой доступ: http://$(hostname -I | awk '{print $1}'):$PORT"
            exit 1
            ;;
    esac
}

main "$@"