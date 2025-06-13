#!/bin/bash

# Скрипт для создания GitHub App для Claude Code Action
set -e

echo "🤖 Создание GitHub App для Claude Code Action"
echo "=============================================="

# Получаем информацию о репозитории
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')

echo "📁 Репозиторий: $REPO_OWNER/$REPO_NAME"

# Создаем временный файл с манифестом
MANIFEST_FILE="/tmp/github-app-manifest.json"

cat > "$MANIFEST_FILE" << EOF
{
  "name": "Claude Assistant for $REPO_NAME",
  "description": "Official Claude Code Action integration with Cynosure Bridge proxy",
  "url": "https://github.com/$REPO_OWNER/$REPO_NAME",
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
}
EOF

echo "📋 Манифест GitHub App создан:"
cat "$MANIFEST_FILE"

echo ""
echo "🚀 Следующие шаги:"
echo "=================="
echo "1. Перейдите в GitHub Settings → Developer settings → GitHub Apps"
echo "2. Нажмите 'New GitHub App'"
echo "3. Заполните форму:"
echo ""
echo "   GitHub App name: Claude Assistant for $REPO_NAME"
echo "   Homepage URL: https://github.com/$REPO_OWNER/$REPO_NAME"
echo "   Webhook URL: (оставить пустым)"
echo "   Webhook secret: (оставить пустым)"
echo ""
echo "4. Repository permissions:"
echo "   - Contents: Read and write"
echo "   - Issues: Read and write"
echo "   - Pull requests: Read and write"
echo "   - Metadata: Read"
echo ""
echo "5. Subscribe to events:"
echo "   - Issue comments"
echo "   - Issues"
echo "   - Pull request review comments"
echo "   - Pull request reviews"
echo "   - Pull requests"
echo ""
echo "6. Where can this GitHub App be installed?: Only on this account"
echo ""
echo "7. После создания:"
echo "   - Скопируйте App ID"
echo "   - Сгенерируйте Private key"
echo "   - Установите App в репозиторий $REPO_OWNER/$REPO_NAME"

echo ""
echo "🔗 Прямая ссылка для создания:"
echo "https://github.com/settings/apps/new"

echo ""
echo "📝 Или создайте App из манифеста:"
echo "https://github.com/settings/apps/new?state=$(echo '{\"url\":\"'https://github.com/$REPO_OWNER/$REPO_NAME'\"}')"

# Очистка
rm -f "$MANIFEST_FILE"

echo ""
echo "⚠️  ВАЖНО: После создания App вернитесь к этому скрипту для настройки секретов!"