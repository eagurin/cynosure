# Исследование WebSocket/SSE API-прокси для OpenAI/Anthropic совместимости

## Обзор задачи

Создать WebSocket/SSE API-прокси совместимый с OpenAI и Anthropic (Claude Code) с поддержкой:

- WebSocket/SSE endpoints для chat/completions, embeddings, tools, function calling
- Прокси для клиентов Cline, Roo, Cursor, Tabby (OpenAI-compatible)
- Маппинг моделей OpenAI ↔ Claude и маршрутизация
- Интеграция с LangChain для orchestration
- Claude Code SDK через MAX подписку
- Безопасность: CORS, аутентификация, rate limiting

## 1. Протоколы и API спецификации

### OpenAI API

- **SSE streaming**: `/v1/chat/completions`, `/v1/embeddings` с параметром `stream: true`
- **WebSocket**: Realtime API для speech/audio (GPT-4o)
- **Function calling**: через поля `tools`, `tool_choice`, `functions`, `function_call`
- **Аутентификация**: Bearer токен в заголовке Authorization
- **Формат SSE**: `data: {...}\n\n` с завершением `data: [DONE]`

### Anthropic (Claude Code) API

- **SSE streaming**: только SSE через `stream: true`, WebSocket не поддерживается
- **Messages**: поддержка `messages`, `tools`, `tool_choice`
- **Аутентификация**: Bearer токен или MAX Subscription CLI-bridge
- **Ограничения**: не все модели поддерживают tools/function calling

## 2. Совместимость с клиентами

### Поддерживаемые клиенты и их требования

**Cline** (Claude Dev)

- Автономный coding agent в VS Code
- Работает через SSE-стриминг
- Ожидает OpenAI-совместимый формат ответов
- Поддержка function calling и tools

**Roo Code**

- AI coding assistant с поддержкой MCP
- Проблемы с SSE implementation по сравнению с Cline
- Требует корректный формат чанков

**Cursor**

- MCP-совместимый IDE
- Поддерживает OpenAI API endpoints
- Multi-LLM поддержка (OpenAI, Anthropic, Gemini, Ollama)

**Tabby**

- AI coding assistant
- OpenAI API compatible

### Общие требования клиентов

- OpenAI-совместимые endpoints (`/v1/chat/completions`, `/v1/models`)
- SSE формат: `data: {...}\n\n` с правильными чанками
- Поддержка cancellation через `data: [DONE]`
- Идентичные поля в ответах: `role`, `content`, `function_call`
- Корректная обработка tool calling и structured outputs

## 3. LangChain компоненты и возможности

### Что МОЖНО делегировать LangChain

**Streaming и Model Orchestration**

```typescript
import { ChatOpenAI, ChatAnthropic } from 'langchain/chat_models';

// Streaming
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  streaming: true
});

const stream = await model.stream(messages);
for await (const chunk of stream) {
  // Chunk processing
}
```

**Structured Outputs**

```typescript
// Автоматический schema binding и parsing
const modelWithSchema = model.withStructuredOutput(schema);
const result = await modelWithSchema.invoke(messages);
```

**Tool Calling**

```typescript
// Binding tools к модели
const modelWithTools = model.bindTools(tools);
const response = await modelWithTools.invoke(messages);
```

**Message Translation и Memory**

```typescript
import { HumanMessage, SystemMessage, AIMessage } from 'langchain/schema';
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
```

### Что требует СОБСТВЕННОЙ реализации

**Transport Layer**

- SSE/WebSocket endpoints и connection handling
- HTTP server setup (Express/Fastify)
- Real-time connection management

**Request Routing и Model Mapping**

- Определение backend по модели (OpenAI vs Claude)
- Маппинг моделей: `gpt-4` → `claude-3-opus-20240229`
- Fallback логика между backends

**Protocol Translation**

- Трансляция OpenAI ↔ Claude форматов
- Модификация SSE чанков для совместимости
- Обработка различий в tool calling schema

**Security Layer**

- CORS configuration
- Authentication и API key validation
- Rate limiting implementation
- Input validation и sanitization

## 4. Стратегии маппинга моделей

### Текущий маппинг (из config/models.json)

```typescript
const MODEL_MAPPINGS = {
  'gpt-4': 'claude-3-opus-20240229',
  'gpt-4-turbo': 'claude-3-5-sonnet-20241022', 
  'gpt-3.5-turbo': 'claude-3-haiku-20240307',
  'gpt-4o': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini': 'claude-3-haiku-20240307'
};
```

### Routing Logic

```typescript
function routeRequest(model: string): 'openai' | 'claude' {
  if (model.startsWith('claude') || MODEL_MAPPINGS[model]) {
    return 'claude';
  }
  return 'openai';
}

function mapModel(inputModel: string, backend: string): string {
  if (backend === 'claude') {
    return MODEL_MAPPINGS[inputModel] || 'claude-3-5-sonnet-20241022';
  }
  return inputModel;
}
```

### Fallback Strategy

```typescript
class ModelRouter {
  async handleRequest(request: OpenAIRequest): Promise<Response> {
    const primaryBackend = this.determineBackend(request.model);
    
    try {
      return await this.routeToBackend(request, primaryBackend);
    } catch (error) {
      // Fallback to alternative backend
      const fallbackBackend = primaryBackend === 'claude' ? 'openai' : 'claude';
      return await this.routeToBackend(request, fallbackBackend);
    }
  }
}
```

## 5. Протоколы стриминга

### SSE vs WebSocket выбор

**Используй SSE когда:**

- Односторонняя передача данных (сервер → клиент)
- Простая реализация
- Совместимость с HTTP infrastructure
- Большинство AI API endpoints (OpenAI chat/completions, Anthropic messages)

**Используй WebSocket когда:**

- Двусторонняя коммуникация
- Real-time взаимодействие
- Speech/audio applications (OpenAI Realtime API)
- Низкая латентность критична

### SSE Implementation

```typescript
app.post('/v1/chat/completions', async (req, res) => {
  if (req.body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
      const backend = routeRequest(req.body.model);
      const stream = await createBackendStream(req.body, backend);
      
      for await (const chunk of stream) {
        const openaiChunk = translateToOpenAIFormat(chunk);
        res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
    } catch (error) {
      res.write(`data: ${JSON.stringify({error: error.message})}\n\n`);
    } finally {
      res.end();
    }
  } else {
    // Non-streaming response
    const response = await handleNonStreamingRequest(req.body);
    res.json(response);
  }
});
```

### WebSocket Implementation

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws, req) => {
  ws.on('message', async (data) => {
    try {
      const request = JSON.parse(data.toString());
      const backend = routeRequest(request.model);
      const stream = await createBackendStream(request, backend);
      
      for await (const chunk of stream) {
        const openaiChunk = translateToOpenAIFormat(chunk);
        ws.send(JSON.stringify(openaiChunk));
      }
      
      ws.send(JSON.stringify({ type: 'done' }));
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});
```

## 6. Безопасность

### CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: [
    'https://trusted-client.com',
    'vscode-webview://',
    /^vscode-webview:\/\//
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-ID']
};

app.use(cors(corsOptions));
```

### Authentication

```typescript
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: { 
        message: 'Missing or invalid authorization header',
        type: 'invalid_request_error' 
      }
    });
  }
  
  const token = authHeader.slice(7);
  
  if (!isValidApiKey(token)) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error'
      }
    });
  }
  
  req.apiKey = token;
  next();
};

app.use('/v1/', authenticate);
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: {
      message: 'Too many requests, please try again later',
      type: 'rate_limit_exceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Streaming specific rate limiting
const streamingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 streaming requests per minute
  message: {
    error: {
      message: 'Streaming rate limit exceeded',
      type: 'rate_limit_exceeded'
    }
  }
});

app.use('/v1/', generalLimiter);
app.use('/v1/chat/completions', streamingLimiter);
```

### Input Validation

```typescript
import Joi from 'joi';

const chatCompletionSchema = Joi.object({
  model: Joi.string().required(),
  messages: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('system', 'user', 'assistant', 'function').required(),
      content: Joi.string().required(),
      name: Joi.string().optional()
    })
  ).required(),
  max_tokens: Joi.number().integer().min(1).max(4096).optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  stream: Joi.boolean().optional(),
  tools: Joi.array().optional(),
  tool_choice: Joi.alternatives().try(
    Joi.string().valid('none', 'auto'),
    Joi.object()
  ).optional()
});

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: error.details[0].message,
        type: 'invalid_request_error'
      }
    });
  }
  next();
};

app.post('/v1/chat/completions', validateRequest(chatCompletionSchema), handleChatCompletion);
```

## 7. Архитектурный шаблон сервера

### Core Server Structure

```typescript
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { ChatOpenAI, ChatAnthropic } from 'langchain/chat_models';

class UnifiedProxyServer {
  private app: express.Application;
  private wss: WebSocketServer;
  private modelRouter: ModelRouter;
  private langchainManager: LangChainManager;
  
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }
  
  private setupMiddleware() {
    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(generalLimiter);
    this.app.use('/v1/', authenticate);
  }
  
  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Models endpoint
    this.app.get('/v1/models', this.handleModels.bind(this));
    
    // Chat completions
    this.app.post('/v1/chat/completions', 
      validateRequest(chatCompletionSchema),
      this.handleChatCompletion.bind(this)
    );
    
    // Embeddings
    this.app.post('/v1/embeddings', 
      validateRequest(embeddingsSchema),
      this.handleEmbeddings.bind(this)
    );
  }
  
  private async handleChatCompletion(req: Request, res: Response) {
    const { model, messages, stream, tools, ...options } = req.body;
    
    try {
      const backend = this.modelRouter.determineBackend(model);
      const targetModel = this.modelRouter.mapModel(model, backend);
      
      // Create LangChain model instance
      const langchainModel = this.langchainManager.createModel(backend, targetModel, {
        streaming: stream,
        ...options
      });
      
      // Bind tools if present
      if (tools?.length) {
        langchainModel.bindTools(tools);
      }
      
      if (stream) {
        await this.handleStreamingResponse(langchainModel, messages, res);
      } else {
        await this.handleNonStreamingResponse(langchainModel, messages, res);
      }
    } catch (error) {
      console.error('Chat completion error:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }
  
  private async handleStreamingResponse(model: any, messages: any[], res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const stream = await model.stream(messages);
      let chunkIndex = 0;
      
      for await (const chunk of stream) {
        const openaiChunk = this.translateToOpenAIChunk(chunk, chunkIndex++);
        res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
    } catch (error) {
      res.write(`data: ${JSON.stringify({
        error: {
          message: error.message,
          type: 'streaming_error'
        }
      })}\n\n`);
    } finally {
      res.end();
    }
  }
  
  private async handleNonStreamingResponse(model: any, messages: any[], res: Response) {
    try {
      const response = await model.invoke(messages);
      const openaiResponse = this.translateToOpenAIResponse(response);
      res.json(openaiResponse);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error.message,
          type: 'api_error'
        }
      });
    }
  }
}
```

### LangChain Integration Manager

```typescript
class LangChainManager {
  createModel(backend: 'openai' | 'claude', model: string, options: any = {}) {
    if (backend === 'claude') {
      return new ChatAnthropic({
        modelName: model,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        streaming: options.streaming || false,
        maxTokens: options.max_tokens,
        temperature: options.temperature
      });
    }
    
    return new ChatOpenAI({
      modelName: model,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: options.streaming || false,
      maxTokens: options.max_tokens,
      temperature: options.temperature
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

### Model Router

```typescript
class ModelRouter {
  private modelMappings: Record<string, string>;
  
  constructor() {
    this.modelMappings = {
      'gpt-4': 'claude-3-opus-20240229',
      'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
      'gpt-3.5-turbo': 'claude-3-haiku-20240307',
      'gpt-4o': 'claude-3-5-sonnet-20241022',
      'gpt-4o-mini': 'claude-3-haiku-20240307'
    };
  }
  
  determineBackend(model: string): 'openai' | 'claude' {
    if (model.startsWith('claude') || this.modelMappings[model]) {
      return 'claude';
    }
    return 'openai';
  }
  
  mapModel(inputModel: string, backend: string): string {
    if (backend === 'claude') {
      return this.modelMappings[inputModel] || 'claude-3-5-sonnet-20241022';
    }
    return inputModel;
  }
}
```

## 8. Translation Layer

### OpenAI ↔ Claude Format Translation

```typescript
class FormatTranslator {
  translateToOpenAIChunk(langchainChunk: any, index: number): any {
    return {
      id: `chatcmpl-${generateId()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4', // Will be mapped back
      choices: [{
        index: 0,
        delta: {
          role: index === 0 ? 'assistant' : undefined,
          content: langchainChunk.content || ''
        },
        finish_reason: null
      }]
    };
  }
  
  translateToOpenAIResponse(langchainResponse: any): any {
    return {
      id: `chatcmpl-${generateId()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: langchainResponse.content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0, // TODO: implement token counting
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }
}
```

## 9. Deployment и Production

### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 8080

CMD ["npm", "start"]
```

### Environment Variables

```bash
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Server Configuration
PORT=3000
WEBSOCKET_PORT=8080
NODE_ENV=production

# Security
CORS_ORIGINS=https://trusted-client.com,vscode-webview://
API_KEY_VALIDATION=strict

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
STREAMING_RATE_LIMIT_MAX=50

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

### Health Checks и Monitoring

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    backends: {
      openai: await checkOpenAIHealth(),
      claude: await checkClaudeHealth()
    }
  };
  
  const hasUnhealthyBackend = Object.values(health.backends).some(status => status !== 'ok');
  
  res.status(hasUnhealthyBackend ? 503 : 200).json(health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = {
    requests_total: requestCount,
    requests_errors: errorCount,
    active_connections: activeConnections,
    response_time_avg: calculateAverageResponseTime(),
    backend_usage: {
      openai: openaiRequestCount,
      claude: claudeRequestCount
    }
  };
  
  res.json(metrics);
});
```

## 10. Тестирование

### Unit Tests

```typescript
import { describe, test, expect } from 'vitest';
import { ModelRouter } from '../src/ModelRouter';

describe('ModelRouter', () => {
  const router = new ModelRouter();
  
  test('routes GPT-4 to Claude backend', () => {
    expect(router.determineBackend('gpt-4')).toBe('claude');
  });
  
  test('maps GPT-4 to Claude Opus', () => {
    expect(router.mapModel('gpt-4', 'claude')).toBe('claude-3-opus-20240229');
  });
  
  test('routes Claude models to Claude backend', () => {
    expect(router.determineBackend('claude-3-5-sonnet-20241022')).toBe('claude');
  });
});
```

### Integration Tests

```typescript
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Chat Completions API', () => {
  test('returns streaming response for GPT-4', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .send({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      });
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
  });
  
  test('handles non-streaming requests', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-key')
      .send({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('choices');
    expect(response.body.choices[0]).toHaveProperty('message');
  });
});
```

## Резюме для следующей задачи

### Архитектура готова к реализации

**✅ Исследованы все ключевые аспекты:**

- Протоколы OpenAI/Anthropic API (SSE, WebSocket)
- Совместимость с клиентами (Cline, Roo, Cursor, Tabby)
- LangChain интеграция и делегирование
- Маппинг моделей и маршрутизация
- Streaming протоколы (SSE vs WebSocket)
- Безопасность (CORS, auth, rate limiting)

**✅ Определена архитектура:**

- LangChain: orchestration, streaming, structured outputs, tools
- Custom: transport, routing, security, translation
- Express/Fastify сервер с SSE/WebSocket endpoints
- Model router с fallback стратегией
- Translation layer для форматов

**✅ Готовы примеры кода:**

- Unified proxy server structure
- LangChain integration patterns
- Security middleware
- Streaming implementation
- Model mapping logic

### Следующая задача: "Реализация ядра WebSocket сервера"

**Конкретные компоненты для реализации:**

1. **Express сервер** с middleware (CORS, auth, rate limiting)
2. **LangChain integration** для streaming и model management
3. **Model router** с маппингом OpenAI ↔ Claude
4. **SSE/WebSocket endpoints** для streaming
5. **Translation layer** для form compatibility
6. **Error handling** и monitoring
7. **Unit/Integration тесты**

Вся необходимая информация и архитектурные решения задокументированы для начала реализации.
