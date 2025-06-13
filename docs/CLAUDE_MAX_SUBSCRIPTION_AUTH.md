# 🔐 Claude MAX Subscription Authentication

## Как устроена авторизация в Claude Code с MAX подпиской

### ✅ Главный вывод

Claude Code с MAX подпиской работает **БЕЗ API ключей** через глобальную установку!

## 🔍 Анализ авторизации

### 1. Типы авторизации в Claude Code

Claude Code поддерживает несколько способов аутентификации:

```json
{
  "ANTHROPIC_API_KEY": "Платный API ключ ($20+/месяц)",
  "ANTHROPIC_AUTH_TOKEN": "Кастомный токен авторизации", 
  "MAX_SUBSCRIPTION": "Встроенная авторизация через браузер",
  "apiKeyHelper": "Скрипт для генерации токенов"
}
```

### 2. MAX подписка vs API ключи

| Параметр | MAX Subscription | API Key |
|----------|------------------|---------|
| **Стоимость** | ~$20/месяц | $20+/месяц дополнительно |
| **Установка** | `npm install -g @anthropic-ai/claude-code` | Переменная окружения |
| **Авторизация** | Через браузер (одноразово) | Каждый запрос |
| **Место хранения** | Global npm | Environment variables |
| **Путь** | `/Users/laptop/.npm-global/bin/claude` | Любой |

### 3. Как работает MAX авторизация

```bash
# 1. Глобальная установка
npm install -g @anthropic-ai/claude-code

# 2. Первичная авторизация (через браузер)
claude

# 3. Токен сохраняется локально
# В ~/.claude/ или подобном
```

## 🐛 Проблема которую мы решили

### Изначальная ошибка

```json
{
  "is_error": true,
  "result": "Invalid API key · Fix external API key"
}
```

### Причина

Cynosure Bridge использовал неправильный путь:

```typescript
❌ const claudePath = '/Users/laptop/.claude/local/claude';  // Локальная версия
✅ const claudePath = '/Users/laptop/.npm-global/bin/claude'; // Глобальная версия
```

### Различия версий

#### Локальная версия (`~/.claude/local/claude`)

- Wrapper script для специальных задач
- Не имеет доступа к глобальной авторизации
- Требует отдельной настройки

#### Глобальная версия (`~/.npm-global/bin/claude`)

- Полная установка Claude Code
- Встроенная авторизация с MAX подпиской
- Работает "из коробки"

## 🔧 Техническая реализация

### Конфигурация в коде

```typescript
// src/claude/api-client.ts
const claudePath = process.env.CLAUDE_PATH || '/Users/laptop/.npm-global/bin/claude';
```

### Настройки Claude Code

Файлы конфигурации:

- `~/.claude/settings.json` - Глобальные настройки
- `~/.claude/settings.local.json` - Локальные настройки
- `~/.claude/CLAUDE.md` - Memory и инструкции

### Переменные окружения

```bash
# Авторизация
ANTHROPIC_API_KEY=        # НЕ НУЖНО для MAX
ANTHROPIC_AUTH_TOKEN=     # Альтернативный токен

# Конфигурация
CLAUDE_PATH=              # Кастомный путь к CLI
CLAUDE_CODE_ENTRYPOINT=   # Точка входа (cli/browser)
```

## 📊 Мониторинг авторизации

### Проверка статуса

```bash
# Проверить установку
which claude
# /Users/laptop/.npm-global/bin/claude

# Проверить версию  
claude --version
# @anthropic-ai/claude-code@1.0.21

# Тест авторизации
echo "test" | claude -p --output-format json
```

### Логи и мониторинг

Claude ведёт логи в `~/.claude/logs/`:

```bash
tail -f ~/.claude/logs/monitor.log
cat ~/.claude/logs/health.json
```

### Статус через health endpoint

```bash
curl http://localhost:3000/health | jq '.claude_code_available'
# true
```

## 🎯 Результат фикса

### До исправления ❌

```bash
curl localhost:3000/v1/chat/completions
# {"error": {"message": "Internal server error"}}
```

### После исправления ✅

```bash
curl localhost:3000/v1/chat/completions
# {
#   "id": "chatcmpl-...",
#   "choices": [{
#     "message": {
#       "content": "Привет!"
#     }
#   }]
# }
```

## 💡 Ключевые выводы

### ✅ Что работает с MAX подпиской

1. **Глобальная установка Claude Code**
2. **Локальный сервер Cynosure Bridge**
3. **Ngrok туннель для GitHub Actions**
4. **Нет необходимости в API ключах**

### ❌ Что НЕ работает

1. Локальная версия Claude без авторизации
2. API запросы без правильного пути к CLI
3. Workflows без ngrok туннеля

### 🔮 Рекомендации

1. **Всегда используйте глобальную установку** для production
2. **Настройте переменную CLAUDE_PATH** для гибкости
3. **Мониторьте статус авторизации** через health endpoints
4. **Периодически обновляйте Claude Code** для безопасности

## 📚 Дополнительные ресурсы

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Settings Reference](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Security Guide](https://docs.anthropic.com/en/docs/claude-code/security)

---

**Итог**: MAX подписка даёт полноценный доступ к Claude через CLI без дополнительных API ключей! 🎉
