# Cynosure Bridge — архитектурный обзор (с учётом запроса по векторам)

**Назначение проекта**  
Cynosure Bridge — серверное приложение, реализующее мост между OpenAI-совместимыми API и Claude Code SDK (Anthropic). Оно предназначено для прозрачной интеграции приложений, использующих OpenAI API, с инфраструктурой Claude, позволяя использовать привычные эндпоинты `/v1/chat/completions`, `/v1/models` и др.

---

## Архитектура

- **Точка входа**: [`src/index.ts`](src/index.ts:1)  
  Запуск Fastify-сервера, регистрация middleware (CORS, Swagger), маршрутов, обработчиков ошибок.

- **Маршруты API**: [`src/server/routes.ts`](src/server/routes.ts:1)  
  - `/health` — проверка статуса сервиса
  - `/v1/models` — список поддерживаемых моделей (OpenAI-совместимый формат)
  - `/v1/chat/completions` — основной чат-эндпоинт (OpenAI Chat Completions API), поддержка потоковых и обычных ответов
  - `/v1/completions` — устаревший эндпоинт (выдаёт ошибку)

- **Модели данных**:
  - [`src/models/openai.ts`](src/models/openai.ts:1) — типы и интерфейсы OpenAI API
  - [`src/models/claude.ts`](src/models/claude.ts:1) — типы и интерфейсы Claude Code SDK + маппинг моделей

- **Клиенты и адаптеры**:
  - [`src/claude/client.ts`](src/claude/client.ts:1) — клиент для работы с Claude Code SDK
  - [`src/translation/openai-to-claude.ts`](src/translation/openai-to-claude.ts:1) и [`src/translation/claude-to-openai.ts`](src/translation/claude-to-openai.ts:1) — преобразование запросов и ответов между форматами OpenAI и Claude

- **Вспомогательные функции**:  
  [`src/utils/helpers.ts`](src/utils/helpers.ts:1) — генерация идентификаторов, SSE, обработка ошибок, throttle/debounce, deepMerge и др.

- **Конфигурация**:
  - Переменные окружения
  - [`config/mcp.json`](config/mcp.json), [`config/models.json`](config/models.json) — параметры моделей и MCP

- **Контейнеризация**:  
  [`docker-compose.yml`](docker-compose.yml:1), [`docker/Dockerfile`](docker/Dockerfile:1)

---

## Векторные эндпоинты

**По результатам анализа исходного кода проект НЕ содержит эндпоинта для работы с векторами (vector/embedding/similarity/search/upsert) или маршрутов типа `/v1/vectors`, `/v1/embeddings`.**

Если требуется добавить поддержку работы с векторными представлениями (например, для поиска по эмбеддингам, хранения и поиска векторов, интеграции с базой векторного поиска), необходимо реализовать дополнительный маршрут и соответствующую бизнес-логику. Пример архитектурного расширения:

```mermaid
graph TD
    subgraph Существующая архитектура
        A[Клиент<br/>(OpenAI API)] --> B[Fastify сервер]
        B --> C[Маршрутизатор]
        C --> D[ClaudeCodeClient/Translators]
    end
    subgraph Расширение для векторов
        B --> V[Vector Router<br/>(/v1/vectors)]
        V --> S[Vector Service<br/>(поиск/управление)]
        S --> DB[Vector DB/Storage]
    end
```

---

## Ключевые особенности

- **OpenAI API-совместимость**: поддержка стандартных эндпоинтов и форматов
- **Трансляция запросов/ответов**: OpenAI ↔️ Claude Code SDK
- **Потоковые и обычные ответы**
- **Гибкая конфигурация**
- **Контейнеризация**
- **[Векторные эндпоинты не реализованы в текущей версии]**

---

**Вывод:**  
Cynosure Bridge — сервер-адаптер для OpenAI API поверх Claude Code SDK. На данный момент поддержка работы с векторами/эмбеддингами отсутствует. Для добавления такого функционала потребуется расширить маршруты и реализовать соответствующую бизнес-логику обработки векторов.
