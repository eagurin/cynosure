#!/bin/bash

# Автоматическое создание GitHub App
set -e

echo "🤖 Автоматическое создание GitHub App для Claude Code Action"
echo "============================================================"

# Получаем информацию о репозитории
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')
REPO_URL="https://github.com/$REPO_OWNER/$REPO_NAME"

echo "📁 Репозиторий: $REPO_URL"

# Генерируем случайный webhook secret (не используется, но требуется)
WEBHOOK_SECRET=$(openssl rand -hex 16)

echo "🔧 Создаем GitHub App..."

# Формируем JSON для создания App
APP_DATA='{
  "name": "Claude Assistant for '"$REPO_NAME"'",
  "description": "Official Claude Code Action integration with Cynosure Bridge proxy", 
  "url": "'"$REPO_URL"'",
  "webhook_active": false,
  "public": false,
  "default_permissions": {
    "contents": "write",
    "issues": "write",
    "pull_requests": "write", 
    "metadata": "read"
  },
  "default_events": [
    "issue_comment",
    "issues",
    "pull_request_review", 
    "pull_request_review_comment",
    "pull_request"
  ]
}'

echo "📋 App конфигурация:"
echo "$APP_DATA" | jq '.'

# Пытаемся создать через разные API endpoints
echo "🚀 Создание через GitHub API..."

# Сначала пробуем user apps endpoint
echo "Попытка 1: /user/apps"
RESPONSE1=$(gh api /user/apps --method POST --input <(echo "$APP_DATA") 2>&1 || echo "FAILED")

if [[ "$RESPONSE1" != "FAILED" ]] && [[ "$RESPONSE1" != *"404"* ]]; then
    echo "✅ App создан через /user/apps!"
    echo "$RESPONSE1" | jq '.'
    
    # Извлекаем App ID
    APP_ID=$(echo "$RESPONSE1" | jq -r '.id')
    echo "🔑 App ID: $APP_ID"
    
    # Генерируем приватный ключ
    echo "🔐 Генерируем приватный ключ..."
    PRIVATE_KEY_RESPONSE=$(gh api "/user/apps/$APP_ID/installations" --method POST 2>&1 || echo "KEY_FAILED")
    
    if [[ "$PRIVATE_KEY_RESPONSE" != "KEY_FAILED" ]]; then
        echo "✅ Приватный ключ сгенерирован!"
    fi
    
    exit 0
fi

# Пробуем organizations endpoint  
echo "Попытка 2: /orgs/$REPO_OWNER/apps"
RESPONSE2=$(gh api "/orgs/$REPO_OWNER/apps" --method POST --input <(echo "$APP_DATA") 2>&1 || echo "FAILED")

if [[ "$RESPONSE2" != "FAILED" ]] && [[ "$RESPONSE2" != *"404"* ]]; then
    echo "✅ App создан через /orgs/$REPO_OWNER/apps!"
    echo "$RESPONSE2" | jq '.'
    exit 0
fi

# Если API не работает, создаем через веб-интерфейс
echo "⚠️  API создание не удалось, используем веб-интерфейс..."

# Создаем URL для быстрого создания
CREATE_URL="https://github.com/settings/apps/new"
CREATE_URL+="?name=Claude+Assistant+for+$REPO_NAME"
CREATE_URL+="&description=Official+Claude+Code+Action+integration"
CREATE_URL+="&url=$REPO_URL"

echo ""
echo "🌐 Откройте эту ссылку для создания GitHub App:"
echo "$CREATE_URL"

echo ""
echo "📝 Настройки для заполнения:"
echo "=========================="
echo "• GitHub App name: Claude Assistant for $REPO_NAME"
echo "• Homepage URL: $REPO_URL"
echo "• Webhook URL: (оставить пустым)"
echo "• Webhook secret: (оставить пустым)"
echo ""
echo "📋 Repository permissions:"
echo "• Contents: Read and write"
echo "• Issues: Read and write" 
echo "• Pull requests: Read and write"
echo "• Metadata: Read"
echo ""
echo "🔔 Subscribe to events:"
echo "• Issue comments ✓"
echo "• Issues ✓"
echo "• Pull request review comments ✓"
echo "• Pull request reviews ✓"
echo "• Pull requests ✓"
echo ""
echo "🏠 Where can this app be installed?: Only on this account"

echo ""
echo "⏭️  После создания App:"
echo "====================="
echo "1. Скопируйте App ID из страницы настроек"
echo "2. Сгенерируйте Private key (кнопка 'Generate a private key')"
echo "3. Установите App в репозиторий $REPO_OWNER/$REPO_NAME"
echo "4. Запустите: ./scripts/add-github-secrets.sh [APP_ID] [path_to_private_key.pem]"

# Открываем браузер если возможно
if command -v open >/dev/null 2>&1; then
    echo ""
    read -p "🖱️  Открыть ссылку в браузере? (y/n): " OPEN_BROWSER
    if [[ "$OPEN_BROWSER" =~ ^[Yy]$ ]]; then
        open "$CREATE_URL"
        echo "✅ Браузер открыт!"
    fi
elif command -v xdg-open >/dev/null 2>&1; then
    echo ""
    read -p "🖱️  Открыть ссылку в браузере? (y/n): " OPEN_BROWSER
    if [[ "$OPEN_BROWSER" =~ ^[Yy]$ ]]; then
        xdg-open "$CREATE_URL"
        echo "✅ Браузер открыт!"
    fi
fi

echo ""
echo "🎯 Следующий шаг: создать GitHub App по ссылке выше!"