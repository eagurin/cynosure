# 🚀 Claude MAX GitHub Integration Setup

## Для пользователей Claude MAX subscription

Теперь ты можешь использовать свою Claude MAX подписку в GitHub Actions!

## 🔧 Настройка

### 1. Проверь подписку Claude MAX

```bash
# Убедись что у тебя есть доступ к Claude Code
claude --version

# Проверь аутентификацию
claude auth status
```

### 2. Извлеки токены аутентификации

Токены хранятся в локальных файлах Claude. Найди их:

**macOS/Linux:**

```bash
# Путь к файлам конфигурации
ls ~/.claude/

# Найди файлы с токенами
cat ~/.claude/auth.json
cat ~/.claude/config.json
```

**Windows:**

```bash
# Путь для Windows
ls %USERPROFILE%\.claude\

# Просмотр токенов
type %USERPROFILE%\.claude\auth.json
```

### 3. Получи необходимые секреты

Тебе нужно найти эти значения:

```json
{
  "access_token": "your_access_token_here",
  "refresh_token": "your_refresh_token_here", 
  "expires_at": "timestamp_here"
}
```

### 4. Добавь GitHub Secrets

Перейди в свой репозиторий:
**Settings → Secrets and variables → Actions → New repository secret**

Добавь эти секреты:

1. **`ANTHROPIC_ACCESS_TOKEN`**
   - Значение: твой access_token

2. **`ANTHROPIC_REFRESH_TOKEN`**  
   - Значение: твой refresh_token

3. **`ANTHROPIC_EXPIRES_AT`**
   - Значение: expires_at timestamp

### 5. Активируй GitHub Actions

**Settings → Actions → General → Allow all actions**

## 🎯 Как использовать

### Автоматический Code Review

Просто создай Pull Request - Claude автоматически проведёт review!

### Ручной Code Assistant

1. **Actions tab** → "Claude Code Assist"
2. **Run workflow**
3. Введи задачу: "Add error handling to API routes"
4. Claude создаст PR с изменениями!

### Quick Fixes

Комментируй в любом PR:

```
/claude fix missing TypeScript types in helpers.ts
```

## 🔍 Отладка

### Проблема: "Authentication failed"

```bash
# Обнови токены
claude auth login

# Проверь файлы аутентификации
cat ~/.claude/auth.json
```

### Проблема: "Action failed"

1. Проверь что все 3 секрета добавлены
2. Убедись что токены актуальные
3. Проверь логи в Actions tab

### Проблема: "Token expired"

```bash
# Перелогинься в Claude
claude auth logout
claude auth login

# Обнови секреты в GitHub
```

## ⚡ Альтернативный способ извлечения токенов

Если файлы auth.json недоступны, попробуй:

### Через браузер

1. Открой Claude в браузере
2. F12 → Network tab
3. Найди запросы к claude.ai
4. Скопируй Authorization header

### Через Claude CLI в debug режиме

```bash
# Запусти Claude в verbose режиме
claude --verbose auth status

# Или используй debug флаг
CLAUDE_DEBUG=1 claude auth status
```

## 🎉 Готово

Теперь у тебя есть полноценный AI Code Assistant, работающий с твоей Claude MAX подпиской:

✅ **Автоматические code review**  
✅ **AI-генерация кода по запросу**  
✅ **Quick fixes по комментариям**  
✅ **Полный доступ к Claude MAX возможностям**  

**Всё работает через твою существующую подписку!**

## 📚 Документация Actions

- `grll/claude-code-base-action@v1` - основной action
- Поддерживает все инструменты: read, write, edit, bash, search
- Автоматическое управление токенами
- Полная интеграция с GitHub workflows

---

**Важно**: Токены могут устаревать. Если workflows начнут падать, обнови секреты в GitHub.
