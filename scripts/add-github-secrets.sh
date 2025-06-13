#!/bin/bash

# Скрипт для добавления GitHub App секретов
set -e

echo "🔐 Добавление GitHub App секретов в репозиторий"
echo "==============================================="

# Проверяем параметры
if [ $# -lt 2 ]; then
    echo "❌ Использование: $0 <APP_ID> <PRIVATE_KEY_FILE>"
    echo ""
    echo "Параметры:"
    echo "  APP_ID          - ID GitHub App (число)"
    echo "  PRIVATE_KEY_FILE - путь к .pem файлу с приватным ключом"
    echo ""
    echo "Пример:"
    echo "  $0 123456 ~/Downloads/github-app-private-key.pem"
    exit 1
fi

APP_ID="$1"
PRIVATE_KEY_FILE="$2"

# Проверяем что файл с ключом существует
if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "❌ Файл с приватным ключом не найден: $PRIVATE_KEY_FILE"
    exit 1
fi

# Проверяем что APP_ID это число
if ! [[ "$APP_ID" =~ ^[0-9]+$ ]]; then
    echo "❌ APP_ID должен быть числом, получен: $APP_ID"
    exit 1
fi

echo "📋 App ID: $APP_ID"
echo "🔑 Private Key: $PRIVATE_KEY_FILE"

# Читаем приватный ключ
PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE")

# Проверяем формат ключа
if [[ "$PRIVATE_KEY" != *"BEGIN RSA PRIVATE KEY"* ]] && [[ "$PRIVATE_KEY" != *"BEGIN PRIVATE KEY"* ]]; then
    echo "❌ Неверный формат приватного ключа в файле $PRIVATE_KEY_FILE"
    echo "Ожидается PEM формат начинающийся с '-----BEGIN PRIVATE KEY-----'"
    exit 1
fi

echo "✅ Формат приватного ключа корректен"

# Получаем информацию о репозитории
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')

echo "📁 Репозиторий: $REPO_OWNER/$REPO_NAME"

# Добавляем секреты
echo "🔐 Добавляем секреты в репозиторий..."

echo "1️⃣ Добавляем CLAUDE_GITHUB_APP_ID..."
if gh secret set CLAUDE_GITHUB_APP_ID --body "$APP_ID"; then
    echo "✅ CLAUDE_GITHUB_APP_ID добавлен успешно"
else
    echo "❌ Ошибка добавления CLAUDE_GITHUB_APP_ID"
    exit 1
fi

echo "2️⃣ Добавляем CLAUDE_GITHUB_APP_PRIVATE_KEY..."
if gh secret set CLAUDE_GITHUB_APP_PRIVATE_KEY --body "$PRIVATE_KEY"; then
    echo "✅ CLAUDE_GITHUB_APP_PRIVATE_KEY добавлен успешно"
else
    echo "❌ Ошибка добавления CLAUDE_GITHUB_APP_PRIVATE_KEY"
    exit 1
fi

# Проверяем что секреты добавлены
echo "🔍 Проверяем добавленные секреты..."
SECRETS=$(gh secret list --json name --jq '.[].name')

if echo "$SECRETS" | grep -q "CLAUDE_GITHUB_APP_ID"; then
    echo "✅ CLAUDE_GITHUB_APP_ID найден в списке секретов"
else
    echo "❌ CLAUDE_GITHUB_APP_ID не найден в секретах"
fi

if echo "$SECRETS" | grep -q "CLAUDE_GITHUB_APP_PRIVATE_KEY"; then
    echo "✅ CLAUDE_GITHUB_APP_PRIVATE_KEY найден в списке секретов"
else
    echo "❌ CLAUDE_GITHUB_APP_PRIVATE_KEY не найден в секретах"
fi

echo ""
echo "🎉 GitHub App секреты настроены успешно!"
echo ""
echo "📋 Следующие шаги:"
echo "=================="
echo "1. ✅ GitHub App создан (ID: $APP_ID)"
echo "2. ✅ Приватный ключ сгенерирован"
echo "3. ✅ Секреты добавлены в репозиторий"
echo "4. 🔄 Установите App в репозиторий $REPO_OWNER/$REPO_NAME"
echo "5. 🚀 Протестируйте: напишите '@claude тест' в любом issue"

echo ""
echo "🔗 Ссылки:"
echo "• Управление App: https://github.com/settings/apps/$APP_ID"
echo "• Установки App: https://github.com/settings/apps/$APP_ID/installations"
echo "• Секреты репозитория: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"

echo ""
echo "🧪 Для тестирования создайте комментарий:"
echo "@claude Привет! Покажи что ты можешь делать"

# Удаляем временный файл если он был создан
if [[ "$PRIVATE_KEY_FILE" == /tmp/* ]]; then
    rm -f "$PRIVATE_KEY_FILE"
    echo "🧹 Временный файл ключа удален"
fi

echo ""
echo "✨ Готово! Официальный Claude Code Action готов к использованию!"