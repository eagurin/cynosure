#!/bin/bash

# 🏭 Cynosure Factory - Production Ready Service
# Автоматическая фабрика для управления Claude мостом

set -e

# 🎛️ Конфигурация фабрики
FACTORY_VERSION="1.0.0"
FACTORY_NAME="Cynosure Factory"

# 📁 Структура директорий
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FACTORY_DIR="$PROJECT_DIR/.factory"
CONFIG_DIR="$FACTORY_DIR/config"
RUNTIME_DIR="$FACTORY_DIR/runtime"
LOGS_DIR="$FACTORY_DIR/logs"
BACKUP_DIR="$FACTORY_DIR/backups"

# Создаём структуру
mkdir -p "$CONFIG_DIR" "$RUNTIME_DIR" "$LOGS_DIR" "$BACKUP_DIR"

# 📋 Конфигурационные файлы
FACTORY_CONFIG="$CONFIG_DIR/factory.json"
SERVICES_CONFIG="$CONFIG_DIR/services.json"
TUNNELS_CONFIG="$CONFIG_DIR/tunnels.json"

# 🔧 Инициализация конфигурации фабрики
init_factory_config() {
    if [ ! -f "$FACTORY_CONFIG" ]; then
        cat > "$FACTORY_CONFIG" << 'EOF'
{
  "factory": {
    "name": "Cynosure Factory",
    "version": "1.0.0",
    "environment": "production",
    "auto_restart": true,
    "health_check_interval": 30,
    "backup_retention_days": 7
  },
  "host": {
    "primary_port": 3000,
    "backup_ports": [3001, 3002, 3003],
    "health_endpoint": "/health",
    "metrics_endpoint": "/metrics"
  },
  "monitoring": {
    "enabled": true,
    "webhook_url": "",
    "alert_on_failure": true,
    "log_level": "info"
  }
}
EOF
        echo "✅ Создана конфигурация фабрики: $FACTORY_CONFIG"
    fi
}

# 🚀 Конфигурация сервисов
init_services_config() {
    if [ ! -f "$SERVICES_CONFIG" ]; then
        cat > "$SERVICES_CONFIG" << 'EOF'
{
  "services": {
    "cynosure": {
      "name": "Cynosure Bridge",
      "command": "npm start",
      "cwd": "",
      "port": 3000,
      "env": {
        "NODE_ENV": "production",
        "PORT": "3000"
      },
      "health_check": "http://localhost:3000/health",
      "restart_policy": "always",
      "max_restarts": 5,
      "restart_delay": 5
    },
    "claude": {
      "name": "Claude CLI Monitor",
      "command": "echo 'test' | claude -p --output-format json",
      "health_check": "claude --version",
      "restart_policy": "on-failure"
    }
  }
}
EOF
        echo "✅ Создана конфигурация сервисов: $SERVICES_CONFIG"
    fi
}

# 🌐 Конфигурация туннелей
init_tunnels_config() {
    if [ ! -f "$TUNNELS_CONFIG" ]; then
        cat > "$TUNNELS_CONFIG" << 'EOF'
{
  "tunnels": {
    "primary": {
      "name": "Cynosure Primary",
      "type": "ngrok",
      "target_port": 3000,
      "subdomain": "cynosure-bridge",
      "auth_token": "",
      "region": "us",
      "enabled": true
    },
    "backup": {
      "name": "Cynosure Backup",
      "type": "cloudflared",
      "target_port": 3001,
      "enabled": false
    },
    "alternative": {
      "name": "LocalTunnel",
      "type": "localtunnel",
      "target_port": 3002,
      "subdomain": "cynosure-alt",
      "enabled": false
    }
  },
  "strategy": {
    "primary_tunnel": "primary",
    "failover_enabled": true,
    "auto_switch": true,
    "health_check_interval": 30
  }
}
EOF
        echo "✅ Создана конфигурация туннелей: $TUNNELS_CONFIG"
    fi
}

# 📊 Логирование фабрики
factory_log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="$LOGS_DIR/factory.log"
    
    echo "[$timestamp] [$level] $message" | tee -a "$log_file"
    
    # Ротация логов (оставляем последние 1000 строк)
    if [ $(wc -l < "$log_file" 2>/dev/null || echo 0) -gt 1000 ]; then
        tail -n 800 "$log_file" > "$log_file.tmp" && mv "$log_file.tmp" "$log_file"
    fi
}

# 🔍 Проверка зависимостей
check_factory_dependencies() {
    factory_log "INFO" "🔍 Проверяем зависимости фабрики..."
    
    local missing_deps=()
    
    # Основные зависимости
    for cmd in node npm jq curl; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    # Claude CLI
    if ! command -v claude &> /dev/null; then
        missing_deps+=("claude")
    fi
    
    # Туннели
    if ! command -v ngrok &> /dev/null; then
        factory_log "WARN" "ngrok не найден - туннели могут не работать"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        factory_log "ERROR" "❌ Отсутствуют зависимости: ${missing_deps[*]}"
        exit 1
    fi
    
    factory_log "INFO" "✅ Все зависимости найдены"
}

# 🎯 Менеджер сервисов
class_ServiceManager() {
    local action="$1"
    local service_name="$2"
    
    case "$action" in
        start)
            start_service "$service_name"
            ;;
        stop)
            stop_service "$service_name"
            ;;
        status)
            service_status "$service_name"
            ;;
        restart)
            stop_service "$service_name"
            sleep 2
            start_service "$service_name"
            ;;
    esac
}

start_service() {
    local service_name="$1"
    local pid_file="$RUNTIME_DIR/${service_name}.pid"
    local log_file="$LOGS_DIR/${service_name}.log"
    
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        factory_log "INFO" "🟢 Сервис $service_name уже запущен"
        return 0
    fi
    
    factory_log "INFO" "🚀 Запускаем сервис: $service_name"
    
    case "$service_name" in
        cynosure)
            cd "$PROJECT_DIR"
            npm run build >> "$log_file" 2>&1
            PORT=3000 nohup npm start >> "$log_file" 2>&1 &
            echo $! > "$pid_file"
            ;;
        ngrok)
            start_tunnel_manager
            ;;
        *)
            factory_log "ERROR" "❌ Неизвестный сервис: $service_name"
            return 1
            ;;
    esac
    
    # Проверяем запуск
    sleep 3
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        factory_log "INFO" "✅ Сервис $service_name запущен (PID: $(cat "$pid_file"))"
    else
        factory_log "ERROR" "❌ Ошибка запуска сервиса: $service_name"
        return 1
    fi
}

# 🌐 Менеджер туннелей
start_tunnel_manager() {
    factory_log "INFO" "🌐 Запускаем менеджер туннелей..."
    
    # Читаем конфигурацию туннелей
    local primary_tunnel=$(jq -r '.strategy.primary_tunnel' "$TUNNELS_CONFIG")
    local tunnel_config=$(jq -r ".tunnels.${primary_tunnel}" "$TUNNELS_CONFIG")
    
    if [ "$tunnel_config" = "null" ]; then
        factory_log "ERROR" "❌ Конфигурация туннеля $primary_tunnel не найдена"
        return 1
    fi
    
    local tunnel_type=$(echo "$tunnel_config" | jq -r '.type')
    local target_port=$(echo "$tunnel_config" | jq -r '.target_port')
    
    case "$tunnel_type" in
        ngrok)
            start_ngrok_tunnel "$tunnel_config"
            ;;
        cloudflared)
            start_cloudflared_tunnel "$tunnel_config"
            ;;
        localtunnel)
            start_localtunnel "$tunnel_config"
            ;;
        *)
            factory_log "ERROR" "❌ Неподдерживаемый тип туннеля: $tunnel_type"
            return 1
            ;;
    esac
}

# 🔥 ngrok туннель
start_ngrok_tunnel() {
    local config="$1"
    local target_port=$(echo "$config" | jq -r '.target_port')
    local subdomain=$(echo "$config" | jq -r '.subdomain')
    local auth_token=$(echo "$config" | jq -r '.auth_token')
    
    local ngrok_cmd="ngrok http $target_port --log=stdout"
    
    if [ "$auth_token" != "null" ] && [ ! -z "$auth_token" ]; then
        ngrok config add-authtoken "$auth_token"
        ngrok_cmd="$ngrok_cmd --subdomain=$subdomain"
        factory_log "INFO" "🔑 Используем authtoken для субдомена: $subdomain"
    fi
    
    nohup $ngrok_cmd > "$LOGS_DIR/ngrok.log" 2>&1 &
    echo $! > "$RUNTIME_DIR/ngrok.pid"
    
    # Ждём запуска и получаем URL
    sleep 10
    local ngrok_url=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
    
    if [ ! -z "$ngrok_url" ]; then
        echo "$ngrok_url" > "$RUNTIME_DIR/tunnel-url.txt"
        update_github_workflows "$ngrok_url"
        factory_log "INFO" "✅ ngrok туннель активен: $ngrok_url"
    else
        factory_log "ERROR" "❌ Ошибка запуска ngrok туннеля"
        return 1
    fi
}

# 🔄 Обновление GitHub workflows
update_github_workflows() {
    local new_url="$1"
    factory_log "INFO" "🔄 Обновляем GitHub workflows с URL: $new_url"
    
    if [ -d "$PROJECT_DIR/.github/workflows" ]; then
        # Создаём бэкап
        cp -r "$PROJECT_DIR/.github/workflows" "$BACKUP_DIR/workflows-$(date +%Y%m%d-%H%M%S)"
        
        # Обновляем workflows
        find "$PROJECT_DIR/.github/workflows" -name "*.yml" -type f | while read -r file; do
            if grep -q "ngrok" "$file"; then
                sed -i.bak "s|https://[^.]*\.ngrok[^\"']*|$new_url|g" "$file"
                rm -f "${file}.bak"
                factory_log "INFO" "   └─ Обновлён: $(basename "$file")"
            fi
        done
        
        # Создаём файл с текущим URL для workflows
        cat > "$PROJECT_DIR/.github/TUNNEL_URL" << EOF
# Автоматически обновляемый URL туннеля
TUNNEL_URL=$new_url
UPDATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
        
        factory_log "INFO" "✅ GitHub workflows обновлены"
    fi
}

# 📊 Мониторинг здоровья
health_monitor() {
    while true; do
        # Проверяем Cynosure Bridge
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            factory_log "DEBUG" "✅ Cynosure Bridge здоров"
        else
            factory_log "WARN" "⚠️ Cynosure Bridge недоступен - перезапускаем"
            class_ServiceManager restart cynosure
        fi
        
        # Проверяем туннель
        if [ -f "$RUNTIME_DIR/tunnel-url.txt" ]; then
            local tunnel_url=$(cat "$RUNTIME_DIR/tunnel-url.txt")
            if curl -f "$tunnel_url/health" > /dev/null 2>&1; then
                factory_log "DEBUG" "✅ Туннель здоров: $tunnel_url"
            else
                factory_log "WARN" "⚠️ Туннель недоступен - перезапускаем"
                class_ServiceManager restart ngrok
            fi
        fi
        
        sleep 30
    done
}

# 🎛️ Dashboard
show_dashboard() {
    clear
    echo "🏭 =========================================="
    echo "   $FACTORY_NAME v$FACTORY_VERSION"
    echo "=========================================="
    echo ""
    
    # Статус сервисов
    echo "📊 Статус сервисов:"
    if [ -f "$RUNTIME_DIR/cynosure.pid" ] && kill -0 "$(cat "$RUNTIME_DIR/cynosure.pid")" 2>/dev/null; then
        echo "   🟢 Cynosure Bridge: РАБОТАЕТ"
    else
        echo "   🔴 Cynosure Bridge: ОСТАНОВЛЕН"
    fi
    
    if [ -f "$RUNTIME_DIR/ngrok.pid" ] && kill -0 "$(cat "$RUNTIME_DIR/ngrok.pid")" 2>/dev/null; then
        echo "   🟢 Туннель: АКТИВЕН"
        if [ -f "$RUNTIME_DIR/tunnel-url.txt" ]; then
            echo "      └─ URL: $(cat "$RUNTIME_DIR/tunnel-url.txt")"
        fi
    else
        echo "   🔴 Туннель: НЕАКТИВЕН"
    fi
    
    echo ""
    echo "🎯 Команды:"
    echo "   start    - Запустить фабрику"
    echo "   stop     - Остановить фабрику"
    echo "   restart  - Перезапустить"
    echo "   monitor  - Режим мониторинга"
    echo "   logs     - Показать логи"
    echo "   url      - Получить URL туннеля"
    echo ""
}

# 🚀 Основные команды фабрики
case "${1:-}" in
    init)
        factory_log "INFO" "🏭 Инициализация фабрики..."
        init_factory_config
        init_services_config
        init_tunnels_config
        factory_log "INFO" "✅ Фабрика инициализирована"
        ;;
    start)
        factory_log "INFO" "🚀 Запуск фабрики..."
        check_factory_dependencies
        class_ServiceManager start cynosure
        class_ServiceManager start ngrok
        factory_log "INFO" "✅ Фабрика запущена"
        ;;
    stop)
        factory_log "INFO" "⏹️ Остановка фабрики..."
        class_ServiceManager stop ngrok
        class_ServiceManager stop cynosure
        factory_log "INFO" "✅ Фабрика остановлена"
        ;;
    restart)
        $0 stop
        sleep 3
        $0 start
        ;;
    monitor)
        factory_log "INFO" "📊 Запуск мониторинга..."
        health_monitor &
        echo $! > "$RUNTIME_DIR/monitor.pid"
        factory_log "INFO" "✅ Мониторинг запущен"
        ;;
    dashboard)
        show_dashboard
        ;;
    logs)
        echo "📋 Последние логи фабрики:"
        tail -n 30 "$LOGS_DIR/factory.log" 2>/dev/null || echo "Логи не найдены"
        ;;
    url)
        if [ -f "$RUNTIME_DIR/tunnel-url.txt" ]; then
            cat "$RUNTIME_DIR/tunnel-url.txt"
        else
            echo "URL туннеля не найден"
            exit 1
        fi
        ;;
    *)
        show_dashboard
        echo "Использование: $0 {init|start|stop|restart|monitor|dashboard|logs|url}"
        exit 1
        ;;
esac