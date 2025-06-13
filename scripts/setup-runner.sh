#!/bin/bash

# 🤖 Скрипт настройки GitHub Actions Self-Hosted Runner

set -e

RUNNER_DIR="/Users/laptop/actions-runner"
PROJECT_DIR="/Users/laptop/dev/cynosure"

echo "🤖 Настройка GitHub Actions Runner для Cynosure"
echo "=============================================="
echo ""

# Проверяем что директория runner существует
if [ ! -d "$RUNNER_DIR" ]; then
    echo "❌ Директория runner не найдена: $RUNNER_DIR"
    echo "Запустите сначала установку runner"
    exit 1
fi

cd "$RUNNER_DIR"

# Проверяем что runner уже настроен
if [ -f ".runner" ]; then
    echo "✅ Runner уже настроен"
    echo "Проверяем статус..."
    
    if pgrep -f "Runner.Listener" > /dev/null; then
        echo "🟢 Runner запущен и работает"
    else
        echo "🔴 Runner настроен но не запущен"
        echo "Запускаем runner..."
        nohup ./run.sh > runner.log 2>&1 &
        sleep 3
        
        if pgrep -f "Runner.Listener" > /dev/null; then
            echo "✅ Runner успешно запущен"
        else
            echo "❌ Не удалось запустить runner"
            echo "Проверьте логи: tail -f $RUNNER_DIR/runner.log"
        fi
    fi
    exit 0
fi

echo "⚠️  Runner не настроен"
echo ""
echo "📋 Для настройки нужно:"
echo "1. Перейти в GitHub: https://github.com/[USERNAME]/cynosure"
echo "2. Settings → Actions → Runners"
echo "3. New self-hosted runner → macOS"
echo "4. Скопировать команду ./config.sh с токеном"
echo ""
echo "Пример команды (замените TOKEN):"
echo "./config.sh --url https://github.com/[USERNAME]/cynosure --token [TOKEN]"
echo ""
echo "После настройки запустите:"
echo "  cd $RUNNER_DIR"
echo "  nohup ./run.sh > runner.log 2>&1 &"
echo ""
echo "Или используйте этот скрипт для автонастройки:"

cat << 'EOF'

# Функция автонастройки (требует токен)
setup_runner() {
    local TOKEN="$1"
    local USERNAME="$2"
    
    if [ -z "$TOKEN" ] || [ -z "$USERNAME" ]; then
        echo "Использование: setup_runner TOKEN USERNAME"
        return 1
    fi
    
    cd /Users/laptop/actions-runner
    
    # Настройка runner
    ./config.sh \
        --url "https://github.com/$USERNAME/cynosure" \
        --token "$TOKEN" \
        --name "cynosure-local-mac" \
        --labels "local,mac,cynosure" \
        --work "_work" \
        --replace
    
    # Запуск runner
    nohup ./run.sh > runner.log 2>&1 &
    
    echo "✅ Runner настроен и запущен"
    echo "Проверьте статус в GitHub Settings → Actions → Runners"
}

# Использование:
# setup_runner "GHRT_xxxxxxxxxxxxx" "your-username"

EOF

echo ""
echo "🎯 После настройки runner сможете использовать:"
echo "   - claude-local.yml workflow"
echo "   - Прямое подключение localhost:3000"
echo "   - Комментарии @claude в issues/PR"