# 🔍 Python Embeddings через Cynosure Bridge

Полное руководство по работе с векторными embedding через OpenAI API совместимость.

## 🚀 Быстрый старт

```python
import openai
import numpy as np

# Подключение к Cynosure Bridge
client = openai.OpenAI(
    base_url="http://192.168.1.196:3000/v1",
    api_key="dummy-key"
)

# Создание embedding
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="Пример текста для векторизации"
)

embedding = response.data[0].embedding
print(f"Размерность вектора: {len(embedding)}")
print(f"Использовано токенов: {response.usage.total_tokens}")
```

## 📊 Поддерживаемые модели

| OpenAI Model | Claude Alternative | Размерность | Применение |
|--------------|-------------------|-------------|------------|
| `text-embedding-3-small` | `claude-3-5-sonnet-20241022` | 1536 | Быстрая векторизация |
| `text-embedding-3-large` | `claude-3-5-sonnet-20241022` | 3072 | Высокое качество |
| `text-embedding-ada-002` | `claude-3-5-haiku-20241022` | 1536 | Совместимость |

## 💡 Практические примеры

### 1. Семантический поиск
```python
def semantic_search(query, documents):
    # Векторизация запроса
    query_response = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    query_embedding = query_response.data[0].embedding
    
    # Векторизация документов
    doc_embeddings = []
    for doc in documents:
        doc_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=doc
        )
        doc_embeddings.append(doc_response.data[0].embedding)
    
    # Поиск наиболее похожего
    similarities = [
        np.dot(query_embedding, doc_emb) for doc_emb in doc_embeddings
    ]
    
    best_match_idx = np.argmax(similarities)
    return documents[best_match_idx], similarities[best_match_idx]

# Использование
documents = [
    "Python - язык программирования",
    "JavaScript используется для веб-разработки", 
    "Claude - это AI ассистент от Anthropic"
]

result, score = semantic_search("Что такое Python?", documents)
print(f"Найдено: {result} (score: {score:.3f})")
```

### 2. Batch обработка
```python
def batch_embeddings(texts, batch_size=100):
    """Обработка больших массивов текста пакетами"""
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch
        )
        
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)
        
        print(f"Обработано {min(i + batch_size, len(texts))} из {len(texts)}")
    
    return all_embeddings

# Пример использования
large_text_list = ["Текст " + str(i) for i in range(500)]
embeddings = batch_embeddings(large_text_list)
```

### 3. Кластеризация документов
```python
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

def cluster_documents(documents, n_clusters=3):
    # Получаем embeddings
    embeddings = []
    for doc in documents:
        response = client.embeddings.create(
            model="text-embedding-3-large",  # Высокое качество для кластеризации
            input=doc
        )
        embeddings.append(response.data[0].embedding)
    
    # Кластеризация
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(embeddings)
    
    return clusters, embeddings

# Применение
documents = [
    "Программирование на Python",
    "Веб-разработка с JavaScript", 
    "Машинное обучение с TensorFlow",
    "Создание API с FastAPI",
    "Frontend разработка с React",
    "Анализ данных с pandas"
]

clusters, embeddings = cluster_documents(documents)

for i, (doc, cluster) in enumerate(zip(documents, clusters)):
    print(f"Кластер {cluster}: {doc}")
```

### 4. RAG (Retrieval Augmented Generation)
```python
import faiss
import numpy as np

class SimpleRAG:
    def __init__(self):
        self.documents = []
        self.index = None
        
    def add_documents(self, docs):
        """Добавление документов в базу знаний"""
        self.documents.extend(docs)
        
        # Создаем embeddings
        embeddings = []
        for doc in docs:
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=doc
            )
            embeddings.append(response.data[0].embedding)
        
        # Создаем FAISS индекс
        dimension = len(embeddings[0])
        if self.index is None:
            self.index = faiss.IndexFlatIP(dimension)  # Inner Product
        
        embeddings_array = np.array(embeddings).astype('float32')
        self.index.add(embeddings_array)
    
    def search(self, query, k=3):
        """Поиск релевантных документов"""
        # Векторизация запроса
        query_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=query
        )
        query_embedding = np.array([query_response.data[0].embedding]).astype('float32')
        
        # Поиск в индексе
        scores, indices = self.index.search(query_embedding, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.documents):
                results.append((self.documents[idx], float(score)))
        
        return results
    
    def ask(self, question):
        """RAG: поиск + генерация ответа"""
        # Находим релевантные документы
        relevant_docs = self.search(question, k=2)
        
        # Формируем контекст
        context = "\n".join([doc for doc, _ in relevant_docs])
        
        # Генерируем ответ с контекстом
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"Отвечай на основе предоставленного контекста:\n{context}"},
                {"role": "user", "content": question}
            ]
        )
        
        return response.choices[0].message.content

# Использование RAG
rag = SimpleRAG()

# Добавляем документы в базу знаний
knowledge_base = [
    "Cynosure Bridge - это OpenAI-совместимый прокси для Claude",
    "Bridge работает на порту 3000 и поддерживает streaming",
    "Можно использовать любой OpenAI SDK, просто поменяв base URL",
    "Поддерживаются embeddings через /v1/embeddings endpoint"
]

rag.add_documents(knowledge_base)

# Задаем вопрос
answer = rag.ask("Как использовать Cynosure Bridge?")
print(answer)
```

## 🔧 Оптимизация производительности

### Кэширование embeddings
```python
import pickle
import hashlib

class EmbeddingCache:
    def __init__(self, cache_file="embeddings_cache.pkl"):
        self.cache_file = cache_file
        try:
            with open(cache_file, 'rb') as f:
                self.cache = pickle.load(f)
        except FileNotFoundError:
            self.cache = {}
    
    def get_embedding(self, text, model="text-embedding-3-small"):
        # Создаем ключ кэша
        key = hashlib.md5(f"{model}:{text}".encode()).hexdigest()
        
        if key in self.cache:
            return self.cache[key]
        
        # Получаем embedding от API
        response = client.embeddings.create(model=model, input=text)
        embedding = response.data[0].embedding
        
        # Сохраняем в кэш
        self.cache[key] = embedding
        self.save_cache()
        
        return embedding
    
    def save_cache(self):
        with open(self.cache_file, 'wb') as f:
            pickle.dump(self.cache, f)

# Использование
cache = EmbeddingCache()
embedding = cache.get_embedding("Пример текста")
```

## 📈 Мониторинг и метрики

```python
import time
from datetime import datetime

class EmbeddingMonitor:
    def __init__(self):
        self.stats = {
            'requests': 0,
            'total_tokens': 0,
            'total_time': 0,
            'errors': 0
        }
    
    def create_embedding(self, text, model="text-embedding-3-small"):
        start_time = time.time()
        
        try:
            response = client.embeddings.create(model=model, input=text)
            
            # Обновляем статистики
            self.stats['requests'] += 1
            self.stats['total_tokens'] += response.usage.total_tokens
            self.stats['total_time'] += time.time() - start_time
            
            return response.data[0].embedding
            
        except Exception as e:
            self.stats['errors'] += 1
            print(f"Ошибка: {e}")
            return None
    
    def get_stats(self):
        if self.stats['requests'] > 0:
            avg_time = self.stats['total_time'] / self.stats['requests']
            avg_tokens = self.stats['total_tokens'] / self.stats['requests']
            
            return {
                'requests': self.stats['requests'],
                'errors': self.stats['errors'],
                'avg_response_time': f"{avg_time:.3f}s",
                'avg_tokens_per_request': f"{avg_tokens:.1f}",
                'total_tokens': self.stats['total_tokens']
            }
        return self.stats

# Использование
monitor = EmbeddingMonitor()

# Несколько запросов
texts = ["Текст 1", "Текст 2", "Текст 3"]
for text in texts:
    monitor.create_embedding(text)

print(monitor.get_stats())
```

## 🎯 Дальнейшие шаги

- **[Document Search](../../examples/embeddings/document-search.md)** - Полный пример поискового движка
- **[RAG Implementation](../../examples/embeddings/rag.md)** - Детальная реализация RAG
- **[Performance Tips](../../recipes/performance/batching.md)** - Оптимизация производительности