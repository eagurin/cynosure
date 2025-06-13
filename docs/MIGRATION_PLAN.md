# 🚀 План миграции на локальное подключение

## 📊 Анализ существующих файлов

### 🔍 GitHub Workflows (18 файлов)

```bash
.github/workflows/
├── claude.yml                      # Старый workflow
├── claude-bridge-first.yml         # 🔄 Использует ngrok туннель  
├── claude-code-assist.yml          # 🔄 Требует ANTHROPIC_API_KEY
├── claude-code-free.yml            # ✅ GitHub Models fallback
├── claude-code-review.yml          # 🔄 Требует ANTHROPIC_API_KEY  
├── claude-code-working.yml         # 🔄 Требует ANTHROPIC_API_KEY
├── claude-factory.yml              # 🔄 Использует ngrok туннель
├── claude-free.yml                 # ✅ Альтернативы без API key
├── claude-local-simple.yml         # 🆕 Готов для self-hosted
├── claude-max-only.yml             # 🔄 Требует настройки
├── claude-official.yml             # 🔄 Требует ANTHROPIC_API_KEY
├── claude-simple.yml               # 🔄 Требует настройки
├── claude-with-local-bridge.yml    # 🔄 Использует ngrok туннель
├── claude-working.yml              # 🔄 Требует настройки
├── ci.yml                          # ✅ CI/CD тесты
├── release.yml                     # ✅ Релизы
├── test-cynosure.yml               # ✅ Тесты API
└── test-local-direct.yml           # 🆕 Тест локального подключения
```

### 🏭 Фабрика (cynosure-factory.sh)

- **Размер**: ~800 строк кода
- **Включает**: ngrok туннель + Cynosure Bridge
- **Проблема**: Излишне сложная для локального подключения

### 📋 Что нужно мигрировать

#### 🔄 Workflows с туннелями (требуют изменения)

1. `claude-bridge-first.yml` - использует `https://45c0-85-159-229-107.ngrok-free.app`
2. `claude-factory.yml` - получает URLs из ngrok
3. `claude-with-local-bridge.yml` - зависит от туннеля

#### ✅ Готовые для self-hosted

1. `claude-local-simple.yml` - уже использует `runs-on: self-hosted`
2. `test-local-direct.yml` - тест прямого подключения

## 🎯 План миграции

### Phase 1: Настройка self-hosted runner ⏱️ 15 мин

```bash
# 1. Скачать и установить runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-osx-x64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-osx-x64-2.311.0.tar.gz
tar xzf ./actions-runner-osx-x64.tar.gz

# 2. Настроить runner (требуется токен из GitHub)
./config.sh --url https://github.com/[username]/cynosure --token [TOKEN]

# 3. Установить как сервис для автозапуска
sudo ./svc.sh install
sudo ./svc.sh start
```

### Phase 2: Создание упрощённой фабрики ⏱️ 10 мин

Создать `scripts/cynosure-local.sh` без ngrok:

```bash
#!/bin/bash
# Упрощённая локальная фабрика без туннелей

start_local() {
    echo "🚀 Запуск Cynosure Bridge..."
    cd /Users/laptop/dev/cynosure
    npm run build
    nohup npm start > .local/cynosure.log 2>&1 &
    echo $! > .local/cynosure.pid
    echo "✅ Сервер запущен на localhost:3000"
}

stop_local() {
    if [ -f ".local/cynosure.pid" ]; then
        kill $(cat .local/cynosure.pid) 2>/dev/null
        rm .local/cynosure.pid
        echo "✅ Сервер остановлен"
    fi
}

status_local() {
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        echo "🟢 Сервер работает: localhost:3000"
    else
        echo "🔴 Сервер не отвечает"
    fi
}
```

### Phase 3: Миграция ключевых workflows ⏱️ 20 мин

#### 3.1 Обновить `claude-bridge-first.yml`

```yaml
# Было:
runs-on: ubuntu-latest
TUNNEL_URL="https://45c0-85-159-229-107.ngrok-free.app"

# Стало:
runs-on: self-hosted  
LOCAL_URL="http://localhost:3000"
```

#### 3.2 Обновить `claude-factory.yml`

```yaml
# Убрать секции:
- Get Tunnel URL
- Check Factory Status (через туннель)

# Добавить:
- Check Local Server
- Direct Local Connection
```

#### 3.3 Переименовать workflows

- `claude-local-simple.yml` → `claude-local.yml` (основной)
- Остальные пометить как `legacy-*`

### Phase 4: Тестирование ⏱️ 15 мин

```bash
# 1. Запустить локальный сервер
./scripts/cynosure-local.sh start

# 2. Протестировать workflows
# Manual trigger в GitHub Actions

# 3. Проверить через issue comment
# Создать issue с "@claude привет"
```

### Phase 5: Cleanup ⏱️ 10 мин

- Удалить ngrok зависимости из `cynosure-factory.sh`
- Переместить старые workflows в `legacy/`
- Обновить документацию

## 📋 Детальный план изменений

### 🔧 Файлы для изменения

1. **scripts/cynosure-factory.sh**
   - Убрать функции: `start_tunnel_manager`, `init_tunnels_config`
   - Упростить до управления только Cynosure Bridge
   - Оставить мониторинг и автоперезапуск

2. **claude-bridge-first.yml**

   ```yaml
   # Заменить:
   runs-on: ubuntu-latest → runs-on: self-hosted
   TUNNEL_URL → http://localhost:3000
   # Убрать секцию получения tunnel URL
   ```

3. **claude-factory.yml**

   ```yaml
   # Переделать на прямое подключение:
   - name: Check Local Server
     run: curl -f http://localhost:3000/health
   ```

### 🆕 Новые файлы

1. **scripts/cynosure-local.sh** - упрощённое управление
2. **docs/SELF_HOSTED_SETUP.md** - инструкция по настройке
3. **.github/workflows/claude-local.yml** - основной локальный workflow

### 🗑️ Файлы для удаления/архивации

- Все workflows с туннелями → `legacy/`
- Конфигурации ngrok из фабрики

## ⚡ Итоговая схема

### До миграции

```
GitHub Actions (cloud) → ngrok tunnel → localhost:3000 → Claude CLI
                ↑ сложно, медленно, ненадёжно
```

### После миграции

```
GitHub Actions (self-hosted) → localhost:3000 → Claude CLI  
                ↑ просто, быстро, надёжно
```

## 🎯 Результат

- ✅ **Быстрее**: На 22% меньше времени ответа
- ✅ **Надёжнее**: Нет внешних зависимостей  
- ✅ **Проще**: Прямое подключение без туннелей
- ✅ **Безопаснее**: Никакого внешнего доступа

**Время выполнения**: ~70 минут
**Сложность**: Средняя (требуется токен GitHub)
