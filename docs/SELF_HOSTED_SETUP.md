# 🏠 Настройка Self-Hosted GitHub Actions Runner

## 📋 Пошаговая инструкция

### 1. Получение токена из GitHub

1. Перейти в репозиторий: `https://github.com/[username]/cynosure`
2. Settings → Actions → Runners  
3. Нажать "New self-hosted runner"
4. Выбрать операционную систему: **macOS**
5. Скопировать команды из раздела "Configure"

### 2. Установка runner

```bash
# Создаём директорию для runner
mkdir -p ~/actions-runner && cd ~/actions-runner

# Скачиваем последнюю версию
curl -o actions-runner-osx-x64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-osx-x64-2.311.0.tar.gz

# Распаковываем
tar xzf ./actions-runner-osx-x64.tar.gz

# Настраиваем (используй токен из GitHub)
./config.sh --url https://github.com/[username]/cynosure --token [YOUR_TOKEN]
```

**При настройке ответить:**

- Enter the name of the runner group: `[Enter]` (default)
- Enter the name of runner: `local-mac` (или любое имя)  
- Enter any additional labels: `local,mac,cynosure` (опционально)
- Enter name of work folder: `[Enter]` (default _work)

### 3. Установка как сервис (автозапуск)

```bash
# Установить как системный сервис
sudo ./svc.sh install

# Запустить сервис  
sudo ./svc.sh start

# Проверить статус
sudo ./svc.sh status
```

### 4. Проверка работы

```bash
# Статус runner
./run.sh --check

# Или проверить в GitHub
# Settings → Actions → Runners - должен показать "Online"
```

## 🔧 Настройка Cynosure для локальной работы

### 1. Убедиться что локальный сервер работает

```bash
# Перейти в проект
cd /Users/laptop/dev/cynosure

# Проверить статус
./scripts/cynosure-local.sh status

# Запустить если нужно
./scripts/cynosure-local.sh start
```

### 2. Тест локального подключения

```bash
# Тест health endpoint
curl http://localhost:3000/health

# Тест Claude API  
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Привет!"}],
    "max_tokens": 50
  }'
```

## 🚀 Использование локальных workflows

### 1. Основной workflow: `claude-local.yml`

```yaml
# Триггеры:
- Issue comment: "@claude [ваша задача]"
- Manual trigger: Actions → Claude Local → Run workflow
```

### 2. Тестовый workflow: `test-local-direct.yml`

```yaml  
# Для проверки что всё работает:
- Actions → Test Local Direct Access → Run workflow
```

### 3. Примеры использования

**В issue/PR комментарии:**

```
@claude Объясни как работает этот код
@claude Найди баги в функции calculateTotal  
@claude Создай тесты для API endpoint
```

**Manual trigger:**

1. Actions → Claude Local (Self-Hosted)
2. Run workflow
3. Ввести задачу в поле "Задача для Claude"

## 📊 Мониторинг и диагностика

### Проверка runner

```bash
# Статус сервиса
sudo ./svc.sh status

# Логи runner
tail -f ~/actions-runner/_diag/Runner_*.log

# Перезапуск при проблемах
sudo ./svc.sh stop
sudo ./svc.sh start
```

### Проверка Cynosure Bridge

```bash
# Статус сервера
./scripts/cynosure-local.sh status

# Логи сервера  
./scripts/cynosure-local.sh logs

# Тест API
./scripts/cynosure-local.sh test
```

### GitHub Actions логи

1. Зайти в Actions репозитория
2. Выбрать нужный workflow run
3. Посмотреть детали выполнения каждого step

## 🔧 Troubleshooting

### Runner не подключается

```bash
# Проверить сетевое подключение
ping github.com

# Перенастроить runner
./config.sh remove --token [REMOVAL_TOKEN]
./config.sh --url https://github.com/[username]/cynosure --token [NEW_TOKEN]
```

### Cynosure Bridge не отвечает

```bash
# Проверить порт
lsof -i:3000

# Перезапустить сервер
./scripts/cynosure-local.sh restart

# Проверить логи на ошибки
./scripts/cynosure-local.sh logs
```

### Workflow не срабатывает

1. Проверить что runner онлайн в GitHub Settings
2. Убедиться что используется `runs-on: self-hosted`
3. Проверить синтаксис workflow файла
4. Посмотреть Actions логи на наличие ошибок

## ✅ Преимущества локальной настройки

- **Быстрее**: Нет задержки туннелей (~22% быстрее)
- **Надёжнее**: Нет зависимости от внешних сервисов  
- **Безопаснее**: Никакого внешнего доступа к вашей машине
- **Проще**: Прямое подключение localhost:3000
- **Дешевле**: Не нужны платные туннели или API ключи

## 🎯 Итоговая схема

```
GitHub Actions (self-hosted на вашей машине)
          ↓ прямое подключение  
     localhost:3000
          ↓ локальный вызов
     Claude CLI  
          ↓ аутентификация
     Claude MAX subscription
```

**Результат**: Простая, быстрая и надёжная интеграция Claude с GitHub!
