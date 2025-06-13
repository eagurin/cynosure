# WebSocket/SSE API Proxy Architecture для OpenAI/Anthropic совместимости

## Обзор архитектуры

Данный документ содержит результаты исследования best practices и архитектурные рекомендации для построения WebSocket/SSE API-прокси, совместимого с OpenAI и Anthropic (Claude Code) спецификациями.

## 1. Ключевые требования и спецификации

### 1.1 Протоколы и API поддержка

**OpenAI API:**

- SSE streaming для `/v1/chat/completions`, `/v1/embeddings`
- WebSocket для Realtime API (speech/audio)
- Function calling через `tools`, `tool_choice`, `functions`
- Аутентификация: Bearer токен в заголовке Authorization
- Формат чанков: `data: {...}\n\n` с завершением `data: [DONE]`

**Anthropic (Claude Code) API:**

- SSE streaming через параметр `stream: true`
- Поддержка `messages`, `tools`, `tool_choice`
- Аутентификация: Bearer токен или MAX Subscription CLI-bridge
- Ограничения: не все модели поддерживают tools/function calling

### 1.2 Совместимость с клиентами

**Поддерживаемые клиенты:**

- **Cline** - автономный coding agent в VS Code
- **Roo Code** - AI coding assistant с поддержкой MCP
- **Cursor** - MCP-совместимый IDE
- **Tabby** - AI coding assistant

**Требования к совместимости:**

- OpenAI-совместимые endpoints
- SSE формат стриминга с корректными чанками
- Поддержка cancellation (event: [DONE])
- Идентичные поля в ответах (role, content, function_call)

## 2. Архитектурная модель

### 2.1 Компонентная архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   OpenAI Client │───▶│   Proxy Server   │───▶│ OpenAI/Claude   │
│  (Cline, Cursor)│    │                  │    │    Backend      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   LangChain      │
                       │   Orchestration  │
                       └──────────────────┘
```

### 2.2 Потоки данных

```
OpenAI Request → Route Detection → Model Mapping → LangChain Processing → Claude/OpenAI API → Response Translation → SSE/WebSocket Stream
```

## 3. Делегирование ответственности

### 3.1 LangChain компоненты (делегировать)

**Что использовать из LangChain:**

- **Streaming**: `astream()`, `stream()` методы для потокового вывода
- **Structured Outputs**: `with_structured_output()` для schema-based ответов
- **Tool Calling**: `bind_tools()` для function calling
- **Message Translation**: обработка истории сообщений
- **Model Orchestration**: `ChatOpenAI`, `ChatAnthropic` классы
- **Output Parsing**: автоматический parsing JSON и structured данных
- **Memory Management**: обработка контекста и истории

**Примеры интеграции:**

```typescript
import { ChatOpenAI, ChatAnthropic } from 'langchain/chat_models';
import { HumanMessage, SystemMessage } from 'langchain/schema';

// Streaming с LangChain
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  streaming: true
});

const stream = await model.stream([
  new SystemMessage("You are a helpful assistant"),
  new HumanMessage("Hello!")
]);

for await (const chunk of stream) {
  // Передача в SSE endpoint
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
```

### 3.2 Собственная реализация (custom)

**Что реализовать самостоятельно:**

- **Transport Layer**: SSE/WebSocket endpoints
- **Request Routing**: определение backend по модели
- **Model Mapping**: OpenAI ↔ Claude маппинг
- **Protocol Translation**: трансляция форматов запросов/ответов
- **Security Layer**: CORS, authentication, rate limiting
- **Error Handling**: edge-case обработка и fallback логика
- **Chunk Processing**: модификация SSE чанков для совместимости

## 4. Маппинг моделей и маршрутизация

### 4.1 Стратегия маппинга

Основано на существующей конфигурации `config/models.json`:

```typescript
const MODEL_MAPPINGS = {
  'gpt-4': 'claude-3-opus-20240229',
  'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
  'gpt-3.5-turbo': 'claude-3-haiku-20240307',
  'gpt-4o': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini': 'claude-3-haiku-20240307'
};

function routeByModel(model: string): 'openai' | 'claude' {
  return model.startsWith('claude') || MODEL_MAPPINGS[model] ? 'claude' : 'openai';
}
```

### 4.2 Fallback стратегия

```typescript
class ModelRouter {
  async route(request: OpenAIRequest): Promise<Response> {
    const backend = this.determineBackend(request.model);
    
    try {
      if (backend === 'claude') {
        return await this.handleClaudeRequest(request);
      }
      return await this.handleOpenAIRequest(request);
    } catch (error) {
      // Fallback to alternative backend
      return await this.handleFallback(request, error);
    }
  }
}
```

## 5. Протоколы стриминга

### 5.1 SSE Implementation

```typescript
import express from 'express';

app.post('/v1/chat/completions', async (req, res) => {
  if (req.body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stream = await createLangChainStream(req.body);
    
    for await (const chunk of stream) {
      const openaiChunk = translateToOpenAIChunk(chunk);
      res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  }
});
```

### 5.2 WebSocket Implementation

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const request = JSON.parse(data.toString());
    const stream = await createLangChainStream(request);
    
    for await (const chunk of stream) {
      const openaiChunk = translateToOpenAIChunk(chunk);
      ws.send(JSON.stringify(openaiChunk));
    }
    
    ws.send(JSON.stringify({ type: 'done' }));
  });
});
```

## 6. Безопасность

### 6.1 CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: ['https://trusted-client.com', 'vscode-webview://'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### 6.2 Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/v1/', limiter);
```

### 6.3 Authentication

```typescript
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.apiKey = token;
  next();
};

app.use('/v1/', authenticate);
```

## 7. Примеры кода

### 7.1 Unified Handler

```typescript
class UnifiedProxyHandler {
  private langchainRouter: LangChainRouter;
  private modelMapper: ModelMapper;
  
  async handleRequest(req: Request, res: Response) {
    const { model, messages, stream, tools } = req.body;
    
    // 1. Route determination
    const backend = this.modelMapper.getBackend(model);
    const targetModel = this.modelMapper.mapModel(model, backend);
    
    // 2. LangChain orchestration
    const langchainModel = this.langchainRouter.createModel(backend, targetModel);
    
    // 3. Tools binding if present
    if (tools?.length) {
      langchainModel.bindTools(tools);
    }
    
    // 4. Streaming
    if (stream) {
      return this.handleStreaming(langchainModel, messages, res);
    }
    
    // 5. Non-streaming
    const response = await langchainModel.invoke(messages);
    res.json(this.translateResponse(response, model));
  }
  
  private async handleStreaming(model: any, messages: any[], res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    
    const stream = await model.stream(messages);
    
    for await (const chunk of stream) {
      const openaiChunk = this.translateChunk(chunk);
      res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
```

### 7.2 LangChain Integration

```typescript
import { ChatOpenAI, ChatAnthropic } from 'langchain/chat_models';
import { StructuredOutputParser } from 'langchain/output_parsers';

class LangChainProxyIntegration {
  createModel(backend: 'openai' | 'claude', model: string) {
    if (backend === 'claude') {
      return new ChatAnthropic({
        modelName: model,
        streaming: true,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY
      });
    }
    
    return new ChatOpenAI({
      modelName: model,
      streaming: true,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async withStructuredOutput(model: any, schema: any) {
    return model.withStructuredOutput(schema);
  }
  
  async withTools(model: any, tools: any[]) {
    return model.bindTools(tools);
  }
}
```

## 8. Ключевые библиотеки и зависимости

### 8.1 Core Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0",
    "ws": "^8.13.0",
    "langchain": "^0.1.30",
    "@langchain/openai": "^0.0.28",
    "@langchain/anthropic": "^0.1.21"
  }
}
```

### 8.2 LangChain Modules

```typescript
// Streaming
import { ChatOpenAI, ChatAnthropic } from 'langchain/chat_models';

// Messages
import { HumanMessage, SystemMessage, AIMessage } from 'langchain/schema';

// Tools
import { DynamicTool } from 'langchain/tools';

// Output Parsing
import { StructuredOutputParser, OutputFixingParser } from 'langchain/output_parsers';

// Memory
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
```

## 9. Тестирование и мониторинг

### 9.1 Unit Tests

```typescript
describe('Model Routing', () => {
  test('routes GPT-4 to Claude Opus', () => {
    const mapper = new ModelMapper();
    expect(mapper.getBackend('gpt-4')).toBe('claude');
    expect(mapper.mapModel('gpt-4', 'claude')).toBe('claude-3-opus-20240229');
  });
});
```

### 9.2 Integration Tests

```typescript
describe('Streaming Endpoint', () => {
  test('streams Claude responses in OpenAI format', async () => {
    const response = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      })
    });
    
    expect(response.headers.get('content-type')).toBe('text/event-stream');
  });
});
```

## 10. Производительность и масштабирование

### 10.1 Оптимизация

- **Connection Pooling**: для HTTP клиентов к backend API
- **Caching**: кеширование маппинга моделей и конфигурации
- **Load Balancing**: между несколькими instances прокси
- **Health Checks**: мониторинг backend доступности

### 10.2 Мониторинг

```typescript
const metrics = {
  requestCount: 0,
  errorCount: 0,
  latency: [],
  activeConnections: 0
};

app.use((req, res, next) => {
  metrics.requestCount++;
  const start = Date.now();
  
  res.on('finish', () => {
    metrics.latency.push(Date.now() - start);
    if (res.statusCode >= 400) metrics.errorCount++;
  });
  
  next();
});
```

## Резюме для следующей задачи

### Готово к реализации

1. **Архитектурный фундамент**: Определена четкая граница между LangChain (orchestration) и custom implementation (transport/routing)

2. **Protocol Specifications**: SSE/WebSocket протоколы изучены, формат чанков определен

3. **Model Mapping Strategy**: Готова стратегия маппинга моделей с fallback

4. **Security Framework**: CORS, authentication, rate limiting best practices определены

5. **LangChain Integration Points**: Определены компоненты для делегирования

### Следующий шаг

**"Реализация ядра WebSocket сервера на TypeScript/Node.js с поддержкой OpenAI/Anthropic спецификаций через LangChain"**

**Ключевые задачи для реализации:**

- Express/Fastify сервер с SSE/WebSocket endpoints
- LangChain integration для streaming и model orchestration  
- Model routing и mapping implementation
- Request/Response translation слой
- Security middleware (CORS, auth, rate limiting)
- Error handling и logging
- Unit/Integration тесты

Архитектура готова к практической реализации с четким планом делегирования между custom кодом и LangChain компонентами.
