# 🌐 Примеры клиентов для Cynosure Bridge прокси

Твой Cynosure Bridge работает на `http://192.168.1.196:3000` и доступен для всех устройств в сети!

## 🐍 Python клиент

### Базовый пример

```python
import openai

# Подключение к твоему прокси
client = openai.OpenAI(
    base_url="http://192.168.1.196:3000/v1",
    api_key="dummy-key"  # Любой ключ, используется Claude MAX
)

def chat_with_claude(message):
    response = client.chat.completions.create(
        model="gpt-4",  # Автоматически мапится в Claude 3.5 Sonnet
        messages=[
            {"role": "user", "content": message}
        ],
        max_tokens=500
    )
    return response.choices[0].message.content

# Использование
if __name__ == "__main__":
    answer = chat_with_claude("Привет! Как дела?")
    print(f"Claude: {answer}")
```

### Streaming пример

```python
import openai

client = openai.OpenAI(
    base_url="http://192.168.1.196:3000/v1",
    api_key="dummy"
)

def stream_chat(message):
    stream = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": message}],
        stream=True,
        max_tokens=1000
    )
    
    print("Claude: ", end="", flush=True)
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print()  # Новая строка в конце

# Использование
stream_chat("Расскажи историю про кота")
```

## 🟨 JavaScript/Node.js клиент

### ES6 модули

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://192.168.1.196:3000/v1',
    apiKey: 'dummy-key', // Не важно какой
});

async function askClaude(question) {
    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: question }],
            max_tokens: 500
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Ошибка:', error);
        return null;
    }
}

// Использование
askClaude('Объясни квантовую физику просто')
    .then(answer => console.log('Claude:', answer));
```

### Streaming в Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://192.168.1.196:3000/v1',
    apiKey: 'dummy',
});

async function streamResponse(prompt) {
    const stream = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
    });

    process.stdout.write('Claude: ');
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        process.stdout.write(content);
    }
    console.log(); // Новая строка
}

// Использование
streamResponse('Напиши короткий рассказ');
```

## 🔷 TypeScript клиент

```typescript
import OpenAI from 'openai';

interface ClaudeConfig {
    baseURL: string;
    apiKey: string;
}

class ClaudeProxyClient {
    private client: OpenAI;

    constructor(config: ClaudeConfig) {
        this.client = new OpenAI({
            baseURL: config.baseURL,
            apiKey: config.apiKey,
        });
    }

    async chat(
        message: string, 
        options?: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
        }
    ): Promise<string> {
        const completion = await this.client.chat.completions.create({
            model: options?.model || 'gpt-4',
            messages: [{ role: 'user', content: message }],
            max_tokens: options?.maxTokens || 1000,
            temperature: options?.temperature || 0.7,
        });

        return completion.choices[0].message.content || '';
    }

    async *streamChat(message: string): AsyncGenerator<string, void, unknown> {
        const stream = await this.client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: message }],
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }
}

// Использование
const claude = new ClaudeProxyClient({
    baseURL: 'http://192.168.1.196:3000/v1',
    apiKey: 'dummy-key'
});

// Обычный чат
claude.chat('Привет Claude!').then(console.log);

// Streaming
(async () => {
    process.stdout.write('Claude: ');
    for await (const chunk of claude.streamChat('Расскажи анекдот')) {
        process.stdout.write(chunk);
    }
    console.log();
})();
```

## 🌐 Frontend/Browser примеры

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <title>Claude Proxy Chat</title>
</head>
<body>
    <div id="chat"></div>
    <input type="text" id="message" placeholder="Напишите сообщение...">
    <button onclick="sendMessage()">Отправить</button>

    <script>
        async function sendMessage() {
            const message = document.getElementById('message').value;
            const chatDiv = document.getElementById('chat');
            
            // Добавляем сообщение пользователя
            chatDiv.innerHTML += `<p><strong>Вы:</strong> ${message}</p>`;
            
            try {
                const response = await fetch('http://192.168.1.196:3000/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer dummy-key'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4',
                        messages: [{ role: 'user', content: message }],
                        max_tokens: 500
                    })
                });
                
                const data = await response.json();
                const answer = data.choices[0].message.content;
                
                // Добавляем ответ Claude
                chatDiv.innerHTML += `<p><strong>Claude:</strong> ${answer}</p>`;
                
            } catch (error) {
                console.error('Ошибка:', error);
                chatDiv.innerHTML += `<p style="color: red;">Ошибка подключения</p>`;
            }
            
            document.getElementById('message').value = '';
        }
    </script>
</body>
</html>
```

### React компонент

```jsx
import React, { useState } from 'react';

const ClaudeChat = () => {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!message.trim()) return;

        const newMessage = { role: 'user', content: message };
        setChat(prev => [...prev, newMessage]);
        setLoading(true);

        try {
            const response = await fetch('http://192.168.1.196:3000/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer dummy-key'
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [...chat, newMessage],
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            const claudeMessage = { 
                role: 'assistant', 
                content: data.choices[0].message.content 
            };

            setChat(prev => [...prev, claudeMessage]);
        } catch (error) {
            console.error('Ошибка:', error);
            setChat(prev => [...prev, { 
                role: 'error', 
                content: 'Ошибка подключения к Claude прокси' 
            }]);
        } finally {
            setLoading(false);
            setMessage('');
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px' }}>
            <h2>Claude Proxy Chat</h2>
            
            <div style={{ 
                height: '400px', 
                border: '1px solid #ccc', 
                padding: '10px', 
                overflowY: 'scroll',
                marginBottom: '10px'
            }}>
                {chat.map((msg, idx) => (
                    <div key={idx} style={{ 
                        marginBottom: '10px',
                        color: msg.role === 'error' ? 'red' : 'black'
                    }}>
                        <strong>
                            {msg.role === 'user' ? 'Вы' : 
                             msg.role === 'assistant' ? 'Claude' : 'Ошибка'}:
                        </strong> {msg.content}
                    </div>
                ))}
                {loading && <div>Claude печатает...</div>}
            </div>

            <div style={{ display: 'flex' }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Напишите сообщение..."
                    style={{ flex: 1, marginRight: '10px', padding: '8px' }}
                />
                <button 
                    onClick={sendMessage} 
                    disabled={loading}
                    style={{ padding: '8px 16px' }}
                >
                    Отправить
                </button>
            </div>
        </div>
    );
};

export default ClaudeChat;
```

## 📱 Мобильные приложения

### React Native

```javascript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

const ClaudeChatScreen = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);

    const sendToClaude = async () => {
        if (!message.trim()) return;

        const userMessage = { role: 'user', content: message };
        setMessages(prev => [...prev, userMessage]);

        try {
            const response = await fetch('http://192.168.1.196:3000/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer dummy-key'
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [userMessage],
                    max_tokens: 500
                })
            });

            const data = await response.json();
            const claudeMessage = { 
                role: 'assistant', 
                content: data.choices[0].message.content 
            };

            setMessages(prev => [...prev, claudeMessage]);
        } catch (error) {
            console.error('Ошибка:', error);
        }

        setMessage('');
    };

    return (
        <View style={{ flex: 1, padding: 20 }}>
            <ScrollView style={{ flex: 1, marginBottom: 20 }}>
                {messages.map((msg, idx) => (
                    <View key={idx} style={{ marginBottom: 10 }}>
                        <Text style={{ fontWeight: 'bold' }}>
                            {msg.role === 'user' ? 'Вы' : 'Claude'}:
                        </Text>
                        <Text>{msg.content}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={{ flexDirection: 'row' }}>
                <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Сообщение..."
                    style={{ 
                        flex: 1, 
                        borderWidth: 1, 
                        borderColor: '#ccc', 
                        padding: 10, 
                        marginRight: 10 
                    }}
                />
                <TouchableOpacity 
                    onPress={sendToClaude}
                    style={{ 
                        backgroundColor: '#007AFF', 
                        padding: 10, 
                        borderRadius: 5 
                    }}
                >
                    <Text style={{ color: 'white' }}>Отправить</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default ClaudeChatScreen;
```

## 🐳 Docker клиент

### docker-compose.yml для другого проекта

```yaml
version: '3.8'

services:
  my-app:
    build: .
    environment:
      # Подключение к твоему Claude прокси
      - OPENAI_BASE_URL=http://192.168.1.196:3000/v1
      - OPENAI_API_KEY=dummy-key
      - CLAUDE_PROXY_HOST=192.168.1.196
      - CLAUDE_PROXY_PORT=3000
    networks:
      - default

  # Другие сервисы тоже могут использовать прокси
  api-service:
    build: ./api
    environment:
      - AI_PROVIDER_URL=http://192.168.1.196:3000/v1
```

### Использование в Dockerfile

```dockerfile
FROM python:3.11-slim

# Устанавливаем зависимости
RUN pip install openai

# Копируем приложение
COPY . /app
WORKDIR /app

# Переменные окружения для Claude прокси
ENV OPENAI_BASE_URL=http://192.168.1.196:3000/v1
ENV OPENAI_API_KEY=dummy-key

CMD ["python", "app.py"]
```

## 🔧 cURL примеры для тестирования

### Базовый запрос

```bash
curl -X POST http://192.168.1.196:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Привет Claude!"}
    ],
    "max_tokens": 100
  }'
```

### Streaming запрос

```bash
curl -X POST http://192.168.1.196:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Расскажи короткую историю"}
    ],
    "stream": true,
    "max_tokens": 500
  }'
```

### Health check

```bash
curl http://192.168.1.196:3000/health
```

### Список моделей

```bash
curl http://192.168.1.196:3000/v1/models
```

## 🎯 Ключевые особенности

### ✅ **Совместимость**

- Полная совместимость с OpenAI API
- Работает с любыми OpenAI SDK
- Поддержка streaming ответов
- Автоматический маппинг моделей

### ✅ **Простота интеграции**

- Замена только base URL
- API ключ может быть любой
- Не нужно менять код приложений
- Работает из любой точки сети 192.168.1.x

### ✅ **Производительность**

- Прямое подключение к локальному серверу
- Низкая задержка в локальной сети
- Поддержка множественных подключений
- Эффективное использование Claude MAX подписки

**Твой Cynosure Bridge - это готовый к производству OpenAI-совместимый прокси! 🚀**
