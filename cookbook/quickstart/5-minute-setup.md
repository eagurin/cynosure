# ⚡ 5-минутная настройка Cynosure Bridge

Самый быстрый способ начать использовать Claude через OpenAI API.

## ✅ Ваш Bridge уже готов!

Если вы читаете это в проекте Cynosure, то сервер **уже запущен** и готов к использованию:

- **Локальный URL**: `http://localhost:3000/v1`
- **Сетевой URL**: `http://192.168.1.196:3000/v1`

## 🧪 Быстрый тест

### 1. Проверка доступности
```bash
curl http://192.168.1.196:3000/health
```

**Ожидаемый ответ:**
```json
{
  "status": "ok",
  "service": "cynosure-bridge",
  "version": "1.0.0"
}
```

### 2. Первый чат-запрос
```bash
curl -X POST http://192.168.1.196:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Привет! Ты работаешь?"}],
    "max_tokens": 50
  }'
```

### 3. Тест embeddings
```bash
curl -X POST http://192.168.1.196:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "Это тест векторизации"
  }'
```

## 🔧 Интеграция в существующее приложение

### Python
```python
import openai

# Просто замените base URL!
client = openai.OpenAI(
    base_url="http://192.168.1.196:3000/v1",
    api_key="any-key-works"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### JavaScript
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://192.168.1.196:3000/v1',
    apiKey: 'any-key-works',
});

const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
});
```

## 🏗️ Если нужно настроить с нуля

### 1. Клонирование и установка
```bash
git clone https://github.com/eagurin/cynosure.git
cd cynosure
npm install
```

### 2. Запуск
```bash
# Простой запуск
npm run build && npm start

# Или через управляющий скрипт
./scripts/cynosure-local.sh start
```

### 3. Проверка статуса
```bash
./scripts/cynosure-local.sh status
```

## 🎯 Что дальше?

- **[Первый запрос](first-request.md)** - детальное руководство по API
- **[Python интеграция](../integrations/python/openai-sdk.md)** - полное руководство для Python
- **[JavaScript интеграция](../integrations/javascript/openai-sdk.md)** - полное руководство для JS
- **[Embeddings](../integrations/python/embeddings.md)** - работа с векторизацией

**🎉 Готово! Теперь у вас есть локальный OpenAI-совместимый API, работающий через Claude MAX!**