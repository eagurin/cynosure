# Настройка официального Claude Code Action через Cynosure Bridge

## Обзор

Этот документ описывает интеграцию официального Claude Code Action от Anthropic с вашим Cynosure Bridge прокси-сервером. Такая схема позволяет использовать Claude MAX подписку через OpenAI-совместимый интерфейс.

## Архитектура

```
GitHub Action → Cynosure Bridge (localhost:3000) → Claude MAX → Ответ
```

1. **GitHub Action** запускает официальный `anthropics/claude-code-action@beta`
2. **Cynosure Bridge** стартует как прокси на порту 3000
3. **Claude Code Action** отправляет запросы на `http://localhost:3000`
4. **Cynosure Bridge** переводит OpenAI API → Claude CLI
5. **Claude MAX** обрабатывает запросы через локальную подписку

## Необходимые секреты

Добавьте в GitHub Repository Secrets:

### Для GitHub App (обязательно)

```bash
CLAUDE_GITHUB_APP_ID=123456
CLAUDE_GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

### Создание GitHub App

1. Перейдите в **Settings** → **Developer settings** → **GitHub Apps**
2. Нажмите **New GitHub App**
3. Заполните форму:

```yaml
GitHub App name: Claude Assistant for [ваш-репозиторий]
Homepage URL: https://github.com/[username]/[repository]
Webhook URL: https://github.com/[username]/[repository] (не используется)
Webhook secret: (оставить пустым)
```

4. **Permissions** (Repository permissions):
   - Contents: Read and write
   - Issues: Read and write  
   - Pull requests: Read and write
   - Metadata: Read

5. **Subscribe to events**:
   - Issue comments
   - Issues
   - Pull request review comments
   - Pull request reviews
   - Pull requests

6. **Where can this GitHub App be installed?**: Only on this account

7. После создания:
   - Скопируйте **App ID** → `CLAUDE_GITHUB_APP_ID`
   - Сгенерируйте **Private key** → `CLAUDE_GITHUB_APP_PRIVATE_KEY`
   - **Install App** в ваш репозиторий

## Использование

### Через комментарии

В Pull Request или Issue напишите:

```
@claude Добавь обработку ошибок в функцию parseConfig
```

```
@claude Проведи код-ревью этого PR
```

```
@claude Исправь TypeScript ошибки в проекте
```

### Через manual dispatch

1. Перейдите в **Actions** → **Claude Code Official**
2. Нажмите **Run workflow**
3. Введите задачу: `Добавь валидацию входных параметров`

## Особенности интеграции

### Преимущества

✅ **Официальный action** от Anthropic
✅ **Claude MAX подписка** без API ключей
✅ **Полная совместимость** с OpenAI API
✅ **Автоматическое управление ветками** и PR
✅ **Безопасность** через GitHub App токены

### Ограничения

⚠️ **Работает только в GitHub Actions** (нужен runner)
⚠️ **Требует настройки GitHub App** 
⚠️ **Cynosure Bridge должен стартовать** в том же job

## Workflow структура

```yaml
jobs:
  # 1. Запуск прокси-сервера
  start-proxy:
    - Билд Cynosure Bridge
    - Запуск на порту 3000
    - Проверка API совместимости
    
  # 2. Официальный Claude Action
  claude-response:
    needs: start-proxy
    - Генерация GitHub App токена
    - Настройка OPENAI_API_BASE
    - Запуск anthropics/claude-code-action@beta
    
  # 3. Очистка ресурсов
  cleanup:
    - Остановка прокси-сервера
```

## Тестирование

### Локальная проверка

```bash
# 1. Запустите Cynosure Bridge
npm run dev

# 2. Проверьте API
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Проверка GitHub Action

1. Создайте тестовый Issue
2. Напишите комментарий: `@claude Покажи структуру проекта`
3. Проследите выполнение в **Actions**

## Troubleshooting

### Прокси не запускается

```bash
# Проверьте порт
lsof -i :3000

# Проверьте логи
npm run dev
```

### GitHub App ошибки

- Проверьте правильность App ID и Private Key
- Убедитесь что App установлен в репозиторий
- Проверьте permissions App'а

### Claude Code Action ошибки

- Проверьте что OPENAI_API_BASE настроен правильно  
- Убедитесь что Cynosure Bridge отвечает на `/v1/chat/completions`
- Проверьте логи в Actions

## Альтернативные конфигурации

### С кастомным хостом

Если нужно использовать внешний хост:

```yaml
env:
  OPENAI_API_BASE: "https://your-cynosure-host.com"
```

### С дополнительными инструментами

```yaml
allowed_tools: |
  Edit,Replace,
  Bash(npm install),
  Bash(npm test),
  Bash(docker-compose up)
```

## Безопасность

- GitHub App токены имеют ограниченное время жизни
- Прокси работает только во время выполнения Action
- Никакие API ключи не сохраняются в логах
- Весь трафик проходит внутри GitHub runner

---

**Готово!** Теперь у вас есть полноценная интеграция официального Claude Code Action с вашим Cynosure Bridge прокси-сервером.