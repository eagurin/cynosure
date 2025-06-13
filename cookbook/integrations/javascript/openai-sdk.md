# 🟨 JavaScript/Node.js интеграция с Cynosure Bridge

Полное руководство по использованию OpenAI SDK в JavaScript/Node.js с Cynosure Bridge.

## 🚀 Установка и настройка

```bash
npm install openai
```

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://192.168.1.196:3000/v1',
    apiKey: 'dummy-key', // Любой ключ, используется Claude MAX
});
```

## 💬 Chat Completions

### Простой чат
```javascript
async function simpleChat(message) {
    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'user', content: message }
            ],
            max_tokens: 500
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Ошибка чата:', error);
        return null;
    }
}

// Использование
const answer = await simpleChat('Привет! Как дела?');
console.log(answer);
```

### Streaming чат
```javascript
async function streamingChat(message) {
    const stream = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: message }],
        stream: true,
        max_tokens: 1000
    });

    let fullResponse = '';
    
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        process.stdout.write(content);
        fullResponse += content;
    }
    
    console.log(); // Новая строка
    return fullResponse;
}

// Использование
await streamingChat('Расскажи интересную историю');
```

### Мультитёрн диалог
```javascript
class ChatSession {
    constructor() {
        this.messages = [];
    }
    
    async sendMessage(userMessage) {
        // Добавляем сообщение пользователя
        this.messages.push({ role: 'user', content: userMessage });
        
        try {
            const response = await client.chat.completions.create({
                model: 'gpt-4',
                messages: this.messages,
                max_tokens: 1000
            });
            
            const assistantMessage = response.choices[0].message.content;
            
            // Добавляем ответ ассистента в историю
            this.messages.push({ role: 'assistant', content: assistantMessage });
            
            return assistantMessage;
        } catch (error) {
            console.error('Ошибка в диалоге:', error);
            return 'Извините, произошла ошибка.';
        }
    }
    
    getHistory() {
        return this.messages;
    }
    
    clearHistory() {
        this.messages = [];
    }
}

// Использование
const chat = new ChatSession();

console.log(await chat.sendMessage('Привет! Меня зовут Иван.'));
console.log(await chat.sendMessage('Как меня зовут?'));
console.log(await chat.sendMessage('Расскажи анекдот'));
```

## 🔍 Embeddings

### Простые embeddings
```javascript
async function createEmbedding(text) {
    try {
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text
        });
        
        return {
            embedding: response.data[0].embedding,
            dimensions: response.data[0].embedding.length,
            tokens: response.usage.total_tokens
        };
    } catch (error) {
        console.error('Ошибка создания embedding:', error);
        return null;
    }
}

// Использование
const result = await createEmbedding('Пример текста для векторизации');
console.log(`Размерность: ${result.dimensions}, Токены: ${result.tokens}`);
```

### Batch embeddings
```javascript
async function batchEmbeddings(texts, batchSize = 100) {
    const allEmbeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        try {
            const response = await client.embeddings.create({
                model: 'text-embedding-3-small',
                input: batch
            });
            
            const batchEmbeddings = response.data.map(item => item.embedding);
            allEmbeddings.push(...batchEmbeddings);
            
            console.log(`Обработано ${Math.min(i + batchSize, texts.length)} из ${texts.length}`);
            
        } catch (error) {
            console.error(`Ошибка в batch ${i}:`, error);
        }
    }
    
    return allEmbeddings;
}

// Использование
const texts = Array.from({length: 500}, (_, i) => `Текст номер ${i}`);
const embeddings = await batchEmbeddings(texts);
```

### Семантический поиск
```javascript
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

class SemanticSearch {
    constructor() {
        this.documents = [];
        this.embeddings = [];
    }
    
    async addDocument(text) {
        const embeddingResult = await createEmbedding(text);
        if (embeddingResult) {
            this.documents.push(text);
            this.embeddings.push(embeddingResult.embedding);
        }
    }
    
    async search(query, topK = 3) {
        const queryEmbedding = await createEmbedding(query);
        if (!queryEmbedding) return [];
        
        const similarities = this.embeddings.map(embedding => 
            cosineSimilarity(queryEmbedding.embedding, embedding)
        );
        
        const results = similarities
            .map((score, index) => ({ document: this.documents[index], score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        
        return results;
    }
}

// Использование
const search = new SemanticSearch();

await search.addDocument('JavaScript - язык программирования для веба');
await search.addDocument('Python используется для машинного обучения');
await search.addDocument('React - библиотека для создания пользовательских интерфейсов');

const results = await search.search('Что такое JavaScript?');
console.log(results);
```

## 🌐 Express.js интеграция

```javascript
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Чат endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        
        const messages = [
            ...history,
            { role: 'user', content: message }
        ];
        
        const response = await client.chat.completions.create({
            model: 'gpt-4',
            messages: messages,
            max_tokens: 1000
        });
        
        const reply = response.choices[0].message.content;
        
        res.json({
            success: true,
            reply: reply,
            history: [...messages, { role: 'assistant', content: reply }]
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Streaming endpoint
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const stream = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: message }],
            stream: true
        });
        
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// Embeddings endpoint
app.post('/api/embeddings', async (req, res) => {
    try {
        const { text } = req.body;
        
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text
        });
        
        res.json({
            success: true,
            embedding: response.data[0].embedding,
            dimensions: response.data[0].embedding.length,
            tokens: response.usage.total_tokens
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(8000, () => {
    console.log('Server running on http://localhost:8000');
});
```

## ⚡ Performance оптимизации

### Кэширование с Redis
```javascript
import Redis from 'ioredis';

const redis = new Redis({
    host: 'localhost',
    port: 6379
});

class CachedEmbeddings {
    constructor(ttl = 3600) { // 1 час TTL
        this.ttl = ttl;
    }
    
    async getEmbedding(text, model = 'text-embedding-3-small') {
        const cacheKey = `embedding:${model}:${Buffer.from(text).toString('base64')}`;
        
        // Проверяем кэш
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        
        // Получаем от API
        const response = await client.embeddings.create({
            model: model,
            input: text
        });
        
        const result = {
            embedding: response.data[0].embedding,
            dimensions: response.data[0].embedding.length,
            tokens: response.usage.total_tokens,
            cached: false
        };
        
        // Сохраняем в кэш
        await redis.setex(cacheKey, this.ttl, JSON.stringify(result));
        
        return result;
    }
}

const cachedEmbeddings = new CachedEmbeddings();
```

### Rate limiting
```javascript
class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    
    canMakeRequest(clientId) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!this.requests.has(clientId)) {
            this.requests.set(clientId, []);
        }
        
        const clientRequests = this.requests.get(clientId);
        
        // Удаляем старые запросы
        const validRequests = clientRequests.filter(time => time > windowStart);
        this.requests.set(clientId, validRequests);
        
        if (validRequests.length >= this.maxRequests) {
            return false;
        }
        
        // Добавляем новый запрос
        validRequests.push(now);
        return true;
    }
}

const rateLimiter = new RateLimiter(50, 60000); // 50 запросов в минуту

// Middleware для Express
function rateLimitMiddleware(req, res, next) {
    const clientId = req.ip;
    
    if (!rateLimiter.canMakeRequest(clientId)) {
        return res.status(429).json({
            error: 'Rate limit exceeded'
        });
    }
    
    next();
}
```

## 🔍 Мониторинг и логирование

```javascript
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'api.log' }),
        new winston.transports.Console()
    ]
});

class APIMonitor {
    constructor() {
        this.stats = {
            requests: 0,
            errors: 0,
            totalResponseTime: 0
        };
    }
    
    async makeRequest(endpoint, data) {
        const startTime = Date.now();
        this.stats.requests++;
        
        try {
            let response;
            
            if (endpoint === 'chat') {
                response = await client.chat.completions.create(data);
            } else if (endpoint === 'embeddings') {
                response = await client.embeddings.create(data);
            }
            
            const responseTime = Date.now() - startTime;
            this.stats.totalResponseTime += responseTime;
            
            logger.info({
                endpoint,
                responseTime,
                success: true,
                tokens: response.usage?.total_tokens
            });
            
            return response;
            
        } catch (error) {
            this.stats.errors++;
            
            logger.error({
                endpoint,
                error: error.message,
                responseTime: Date.now() - startTime
            });
            
            throw error;
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            averageResponseTime: this.stats.requests > 0 
                ? this.stats.totalResponseTime / this.stats.requests 
                : 0,
            errorRate: this.stats.requests > 0 
                ? (this.stats.errors / this.stats.requests) * 100 
                : 0
        };
    }
}

const monitor = new APIMonitor();
```

## 🎯 Дальнейшие шаги

- **[React интеграция](react.md)** - Использование в React приложениях
- **[Express.js примеры](express.md)** - Полные примеры для Express
- **[WebSocket поддержка](../../recipes/performance/websocket.md)** - Планируемая функциональность