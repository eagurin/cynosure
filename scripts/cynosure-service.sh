#!/bin/bash

# Cynosure Bridge Service Manager
# Управляет всеми компонентами системы на одном хосте

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOGDIR="$PROJECT_DIR/logs"
PIDDIR="$PROJECT_DIR/run"

# Создаём директории
mkdir -p "$LOGDIR" "$PIDDIR"

# Конфигурация
CYNOSURE_PORT=${CYNOSURE_PORT:-3000}
NGROK_SUBDOMAIN=${NGROK_SUBDOMAIN:-cynosure-bridge}
NGROK_TOKEN=${NGROK_TOKEN:-""}

# Файлы PID
CYNOSURE_PID="$PIDDIR/cynosure.pid"
NGROK_PID="$PIDDIR/ngrok.pid"

# Логи
CYNOSURE_LOG="$LOGDIR/cynosure.log"
NGROK_LOG="$LOGDIR/ngrok.log"
SERVICE_LOG="$LOGDIR/service.log"

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$SERVICE_LOG"
}

# Проверка зависимостей
check_dependencies() {
    log "🔍 Проверяем зависимости..."
    
    if ! command -v node &> /dev/null; then
        log "❌ Node.js не найден"
        exit 1
    fi
    
    if ! command -v ngrok &> /dev/null; then
        log "❌ ngrok не найден"
        exit 1
    fi
    
    if ! command -v claude &> /dev/null; then
        log "❌ Claude CLI не найден"
        exit 1
    fi
    
    log "✅ Все зависимости найдены"
}

# Запуск Cynosure Bridge
start_cynosure() {
    if [ -f "$CYNOSURE_PID" ] && kill -0 "$(cat "$CYNOSURE_PID")" 2>/dev/null; then
        log "🟢 Cynosure Bridge уже запущен (PID: $(cat "$CYNOSURE_PID"))"
        return 0
    fi
    
    log "🚀 Запускаем Cynosure Bridge..."
    cd "$PROJECT_DIR"
    
    # Собираем проект
    npm run build >> "$CYNOSURE_LOG" 2>&1
    
    # Запускаем сервер
    PORT="$CYNOSURE_PORT" nohup npm start >> "$CYNOSURE_LOG" 2>&1 &
    echo $! > "$CYNOSURE_PID"
    
    # Ждём запуска
    sleep 5
    
    if curl -f "http://localhost:$CYNOSURE_PORT/health" > /dev/null 2>&1; then
        log "✅ Cynosure Bridge запущен на порту $CYNOSURE_PORT (PID: $(cat "$CYNOSURE_PID"))"
    else
        log "❌ Ошибка запуска Cynosure Bridge"
        return 1
    fi
}

# Запуск ngrok
start_ngrok() {
    if [ -f "$NGROK_PID" ] && kill -0 "$(cat "$NGROK_PID")" 2>/dev/null; then
        log "🟢 ngrok уже запущен (PID: $(cat "$NGROK_PID"))"
        return 0
    fi
    
    log "🌐 Запускаем ngrok туннель..."
    
    # Настраиваем ngrok команду
    NGROK_CMD="ngrok http $CYNOSURE_PORT --log=stdout"
    
    if [ ! -z "$NGROK_TOKEN" ]; then
        ngrok config add-authtoken "$NGROK_TOKEN"
        NGROK_CMD="$NGROK_CMD --subdomain=$NGROK_SUBDOMAIN"
        log "🔑 Используем authtoken для постоянного субдомена: $NGROK_SUBDOMAIN"
    fi
    
    # Запускаем ngrok
    nohup $NGROK_CMD > "$NGROK_LOG" 2>&1 &
    echo $! > "$NGROK_PID"
    
    # Ждём запуска
    sleep 10
    
    # Получаем URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
    
    if [ ! -z "$NGROK_URL" ]; then
        log "✅ ngrok туннель активен: $NGROK_URL (PID: $(cat "$NGROK_PID"))"
        echo "$NGROK_URL" > "$PROJECT_DIR/ngrok-url.txt"
        
        # Обновляем workflow файлы с новым URL
        update_workflows "$NGROK_URL"
    else
        log "❌ Ошибка получения ngrok URL"
        return 1
    fi
}

# Обновление workflow файлов
update_workflows() {
    local ngrok_url="$1"
    log "🔄 Обновляем workflow файлы с URL: $ngrok_url"
    
    # Находим и обновляем все workflow файлы с ngrok URL
    find "$PROJECT_DIR/.github/workflows" -name "*.yml" -exec \
        sed -i.bak "s|https://[^.]*\.ngrok[^\"]*|$ngrok_url|g" {} \;
    
    log "✅ Workflow файлы обновлены"
}

# Остановка сервисов
stop_service() {
    local service_name="$1"
    local pid_file="$2"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log "⏹️  Останавливаем $service_name (PID: $pid)..."
            kill "$pid"
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid"
            fi
        fi
        rm -f "$pid_file"
        log "✅ $service_name остановлен"
    else
        log "🟡 $service_name не запущен"
    fi
}

# Статус сервисов
status() {
    log "📊 Статус сервисов:"
    
    # Cynosure Bridge
    if [ -f "$CYNOSURE_PID" ] && kill -0 "$(cat "$CYNOSURE_PID")" 2>/dev/null; then
        log "🟢 Cynosure Bridge: РАБОТАЕТ (PID: $(cat "$CYNOSURE_PID"))"
        if curl -f "http://localhost:$CYNOSURE_PORT/health" > /dev/null 2>&1; then
            log "   └─ API доступен на http://localhost:$CYNOSURE_PORT"
        else
            log "   └─ ❌ API недоступен"
        fi
    else
        log "🔴 Cynosure Bridge: НЕ РАБОТАЕТ"
    fi
    
    # ngrok
    if [ -f "$NGROK_PID" ] && kill -0 "$(cat "$NGROK_PID")" 2>/dev/null; then
        log "🟢 ngrok: РАБОТАЕТ (PID: $(cat "$NGROK_PID"))"
        if [ -f "$PROJECT_DIR/ngrok-url.txt" ]; then
            log "   └─ URL: $(cat "$PROJECT_DIR/ngrok-url.txt")"
        fi
    else
        log "🔴 ngrok: НЕ РАБОТАЕТ"
    fi
    
    # Claude CLI
    if command -v claude &> /dev/null; then
        log "🟢 Claude CLI: ДОСТУПЕН"
        log "   └─ Путь: $(which claude)"
    else
        log "🔴 Claude CLI: НЕ НАЙДЕН"
    fi
}

# Основные команды
case "${1:-}" in
    start)
        log "🚀 Запускаем Cynosure Service..."
        check_dependencies
        start_cynosure
        start_ngrok
        status
        log "✅ Все сервисы запущены!"
        ;;
    stop)
        log "⏹️  Останавливаем все сервисы..."
        stop_service "ngrok" "$NGROK_PID"
        stop_service "Cynosure Bridge" "$CYNOSURE_PID"
        log "✅ Все сервисы остановлены"
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        status
        ;;
    logs)
        echo "📋 Логи Cynosure Bridge:"
        tail -n 20 "$CYNOSURE_LOG" 2>/dev/null || echo "Логи не найдены"
        echo ""
        echo "📋 Логи ngrok:"
        tail -n 20 "$NGROK_LOG" 2>/dev/null || echo "Логи не найдены"
        ;;
    url)
        if [ -f "$PROJECT_DIR/ngrok-url.txt" ]; then
            cat "$PROJECT_DIR/ngrok-url.txt"
        else
            echo "ngrok URL не найден"
            exit 1
        fi
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs|url}"
        echo ""
        echo "Команды:"
        echo "  start    - Запустить все сервисы"
        echo "  stop     - Остановить все сервисы"
        echo "  restart  - Перезапустить все сервисы"
        echo "  status   - Показать статус"
        echo "  logs     - Показать логи"
        echo "  url      - Показать ngrok URL"
        exit 1
        ;;
esac