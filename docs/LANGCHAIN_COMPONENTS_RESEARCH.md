# LangChain Components for WebSocket/SSE Proxy Implementation

This document provides comprehensive research on LangChain components suitable for building a WebSocket/SSE proxy that handles routing, message translation, structured outputs, tools, and streaming.

## 1. Routing and Message Translation Components

### RunnablePassthrough, RunnableLambda, RunnableBranch

These components form the core routing infrastructure in LangChain.

#### Basic Routing Example

```python
from langchain_core.runnables import (
    RunnableBranch, 
    RunnablePassthrough, 
    RunnableLambda,
    RunnableParallel
)
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.schema.output_parser import StrOutputParser

# Step 1: Create a classifier using RunnableLambda
def classify_request(request: dict) -> str:
    """Classify the request into categories for routing"""
    content = request.get("messages", [{}])[-1].get("content", "").lower()
    
    if any(word in content for word in ["code", "programming", "function"]):
        return "technical"
    elif any(word in content for word in ["story", "poem", "creative"]):
        return "creative"
    elif any(word in content for word in ["streaming", "websocket", "sse"]):
        return "streaming"
    else:
        return "general"

classifier = RunnableLambda(classify_request)

# Step 2: Define different handling strategies
technical_prompt = ChatPromptTemplate.from_template(
    """You are a technical assistant specializing in programming.
    Provide detailed technical answers with code examples.
    
    Request: {request}
    Category: {category}
    """
)

streaming_prompt = ChatPromptTemplate.from_template(
    """You are an expert in real-time communication protocols.
    Focus on streaming, WebSocket, and SSE implementations.
    
    Request: {request}
    Category: {category}
    """
)

general_prompt = ChatPromptTemplate.from_template(
    """You are a helpful assistant.
    
    Request: {request}
    Category: {category}
    """
)

# Step 3: Create the routing branch
route_prompts = RunnableBranch(
    (lambda x: x["category"] == "technical", technical_prompt),
    (lambda x: x["category"] == "streaming", streaming_prompt),
    general_prompt  # default
)

# Step 4: Build the complete routing chain
llm = ChatOpenAI(model="gpt-4", streaming=True)

# Use RunnableParallel to process multiple things at once
preprocessing = RunnableParallel(
    request=RunnablePassthrough(),
    category=classifier,
)

# Complete routing chain
routing_chain = (
    preprocessing
    | route_prompts
    | llm
    | StrOutputParser()
)

# Usage example
async def handle_request(request_data):
    response = await routing_chain.ainvoke(request_data)
    return response
```

#### Provider Routing Example

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.runnables.utils import ConfigurableField

def create_provider_router():
    """Create a configurable router for multiple AI providers"""
    
    # Base model with fallbacks
    primary_model = ChatAnthropic(
        model="claude-3-5-sonnet-20241022",
        streaming=True
    ).configurable_alternatives(
        ConfigurableField(id="provider"),
        default_key="anthropic",
        openai=ChatOpenAI(model="gpt-4", streaming=True),
        openai_mini=ChatOpenAI(model="gpt-4o-mini", streaming=True),
    ).with_fallbacks([
        ChatOpenAI(model="gpt-3.5-turbo", streaming=True)
    ])
    
    return primary_model

# Usage in proxy
async def route_to_provider(request, provider_config):
    router = create_provider_router()
    
    configured_model = router.with_config(
        configurable={"provider": provider_config.get("preferred", "anthropic")}
    )
    
    return await configured_model.ainvoke(request)
```

### ChatPromptTemplate and Message Formatting

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

class MessageTranslator:
    """Translate between different message formats"""
    
    def __init__(self):
        self.openai_to_langchain_template = ChatPromptTemplate([
            ("system", "{system_prompt}"),
            MessagesPlaceholder("chat_history"),
            ("human", "{user_input}"),
        ])
    
    def openai_to_langchain(self, openai_messages):
        """Convert OpenAI message format to LangChain format"""
        system_prompt = ""
        chat_history = []
        user_input = ""
        
        for msg in openai_messages:
            role = msg.get("role")
            content = msg.get("content")
            
            if role == "system":
                system_prompt = content
            elif role == "user":
                user_input = content
            elif role == "assistant":
                chat_history.append(AIMessage(content=content))
        
        return {
            "system_prompt": system_prompt,
            "chat_history": chat_history,
            "user_input": user_input
        }
    
    def langchain_to_openai(self, langchain_response):
        """Convert LangChain response to OpenAI format"""
        return {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "gpt-4",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": langchain_response.content
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": len(langchain_response.content.split()),
                "total_tokens": len(langchain_response.content.split())
            }
        }

# Usage in proxy
translator = MessageTranslator()

async def handle_openai_request(openai_request):
    # Translate incoming request
    langchain_input = translator.openai_to_langchain(openai_request["messages"])
    
    # Process with LangChain
    response = await routing_chain.ainvoke(langchain_input)
    
    # Translate response back
    return translator.langchain_to_openai(response)
```

## 2. Tool and Function Calling Support

### Tool Definition and Binding

```python
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent

# Define tools using the @tool decorator
@tool
def websocket_status(connection_id: str) -> str:
    """Check the status of a WebSocket connection.
    
    Args:
        connection_id: The WebSocket connection identifier
    """
    # Implementation would check actual connection status
    return f"Connection {connection_id} is active"

@tool  
def send_sse_event(event_type: str, data: str) -> str:
    """Send a Server-Sent Event.
    
    Args:
        event_type: Type of SSE event (message, error, close)
        data: Event data to send
    """
    # Implementation would send actual SSE event
    return f"SSE event '{event_type}' sent with data: {data}"

@tool
def proxy_health_check() -> str:
    """Check the health status of the proxy service."""
    return "Proxy service is healthy and running"

# Create tool-enabled model
def create_tool_enabled_model():
    tools = [websocket_status, send_sse_event, proxy_health_check]
    llm = ChatOpenAI(model="gpt-4", temperature=0, streaming=True)
    
    # Bind tools to the model
    llm_with_tools = llm.bind_tools(tools)
    
    # Create agent for automatic tool calling
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a WebSocket/SSE proxy assistant. Use tools when needed."),
        ("placeholder", "{chat_history}"),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    
    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    
    return agent_executor

# Usage
async def handle_tool_request(user_input):
    agent = create_tool_enabled_model()
    result = await agent.ainvoke({"input": user_input})
    return result["output"]
```

### Function Calling with Multiple Providers

```python
class UniversalToolCaller:
    """Universal tool calling interface for different LLM providers"""
    
    def __init__(self):
        self.tools = [websocket_status, send_sse_event, proxy_health_check]
    
    def create_openai_tools(self):
        """Convert LangChain tools to OpenAI format"""
        openai_tools = []
        for tool in self.tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.args_schema.schema() if tool.args_schema else {}
                }
            })
        return openai_tools
    
    def create_anthropic_tools(self):
        """Convert LangChain tools to Anthropic format"""
        # Anthropic-specific tool format
        anthropic_tools = []
        for tool in self.tools:
            anthropic_tools.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.args_schema.schema() if tool.args_schema else {}
            })
        return anthropic_tools
    
    async def execute_tool_call(self, tool_name: str, arguments: dict):
        """Execute a tool call regardless of provider"""
        for tool in self.tools:
            if tool.name == tool_name:
                return await tool.ainvoke(arguments)
        raise ValueError(f"Tool {tool_name} not found")

# Provider-agnostic tool calling
async def handle_tool_calling_request(request, provider="openai"):
    tool_caller = UniversalToolCaller()
    
    if provider == "openai":
        llm = ChatOpenAI(model="gpt-4").bind_tools(tool_caller.tools)
    elif provider == "anthropic":
        llm = ChatAnthropic(model="claude-3-5-sonnet-20241022").bind_tools(tool_caller.tools)
    
    response = await llm.ainvoke(request)
    
    # Execute any tool calls
    if hasattr(response, 'tool_calls') and response.tool_calls:
        for tool_call in response.tool_calls:
            result = await tool_caller.execute_tool_call(
                tool_call['name'], 
                tool_call['args']
            )
            # Handle tool results...
    
    return response
```

## 3. Streaming Capabilities

### Custom Streaming Callback Handler

```python
import asyncio
from typing import Any, Dict, List
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.messages import BaseMessage

class WebSocketStreamingHandler(AsyncCallbackHandler):
    """Custom callback handler for WebSocket streaming"""
    
    def __init__(self, websocket_manager, connection_id: str):
        self.websocket_manager = websocket_manager
        self.connection_id = connection_id
        self.buffer = ""
    
    async def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Called when LLM starts running"""
        await self.websocket_manager.send_message(
            self.connection_id,
            {"type": "stream_start", "data": ""}
        )
    
    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Called when a new token is generated"""
        await self.websocket_manager.send_message(
            self.connection_id,
            {"type": "token", "data": token}
        )
    
    async def on_llm_end(self, response, **kwargs: Any) -> None:
        """Called when LLM ends running"""
        await self.websocket_manager.send_message(
            self.connection_id,
            {"type": "stream_end", "data": ""}
        )
    
    async def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        """Called when LLM encounters an error"""
        await self.websocket_manager.send_message(
            self.connection_id,
            {"type": "error", "data": str(error)}
        )

class SSEStreamingHandler(AsyncCallbackHandler):
    """Custom callback handler for Server-Sent Events"""
    
    def __init__(self, response_queue: asyncio.Queue):
        self.response_queue = response_queue
    
    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Send token as SSE event"""
        sse_data = f"data: {json.dumps({'token': token})}\n\n"
        await self.response_queue.put(sse_data)
    
    async def on_llm_end(self, response, **kwargs: Any) -> None:
        """Send completion event"""
        await self.response_queue.put("data: [DONE]\n\n")
```

### Streaming Integration with FastAPI

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import json
import asyncio

app = FastAPI()

class StreamingProxyManager:
    """Manage streaming connections and responses"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.llm_chain = self.create_streaming_chain()
    
    def create_streaming_chain(self):
        """Create a streaming-enabled LangChain chain"""
        llm = ChatOpenAI(model="gpt-4", streaming=True)
        prompt = ChatPromptTemplate.from_template("{input}")
        return prompt | llm | StrOutputParser()
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_text(json.dumps(message))
    
    async def stream_response(self, client_id: str, user_input: str):
        """Stream LLM response via WebSocket"""
        handler = WebSocketStreamingHandler(self, client_id)
        
        try:
            async for chunk in self.llm_chain.astream(
                {"input": user_input},
                config={"callbacks": [handler]}
            ):
                # Chunks are automatically handled by the callback
                pass
        except Exception as e:
            await handler.on_llm_error(e)

manager = StreamingProxyManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "chat":
                await manager.stream_response(client_id, message["content"])
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.post("/v1/chat/completions")
async def chat_completions(request: dict):
    """OpenAI-compatible SSE streaming endpoint"""
    
    if request.get("stream", False):
        return StreamingResponse(
            stream_chat_completion(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    else:
        # Non-streaming response
        response = await manager.llm_chain.ainvoke({
            "input": request["messages"][-1]["content"]
        })
        return {"choices": [{"message": {"content": response}}]}

async def stream_chat_completion(request: dict):
    """Generate SSE stream for chat completion"""
    response_queue = asyncio.Queue()
    handler = SSEStreamingHandler(response_queue)
    
    # Start the LLM processing in the background
    asyncio.create_task(
        manager.llm_chain.astream(
            {"input": request["messages"][-1]["content"]},
            config={"callbacks": [handler]}
        ).__anext__()  # Start the stream
    )
    
    # Stream the responses
    while True:
        try:
            chunk = await asyncio.wait_for(response_queue.get(), timeout=1.0)
            yield chunk
            if chunk.strip() == "data: [DONE]":
                break
        except asyncio.TimeoutError:
            # Send keep-alive
            yield "data: {}\n\n"
```

## 4. Multi-Provider Support

### Custom LLM Wrapper for Proxy Implementation

```python
from typing import Any, Dict, Iterator, List, Optional
from langchain_core.llms.base import LLM
from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.outputs import GenerationChunk

class ProxyLLM(LLM):
    """Custom LLM wrapper for proxy implementations"""
    
    target_url: str
    api_key: str
    model_name: str = "gpt-4"
    streaming: bool = True
    
    @property
    def _llm_type(self) -> str:
        return "proxy_llm"
    
    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Non-streaming call to the proxy"""
        response = self._make_request(prompt, stream=False)
        return response["choices"][0]["message"]["content"]
    
    def _stream(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[GenerationChunk]:
        """Streaming call to the proxy"""
        for chunk_data in self._make_request(prompt, stream=True):
            if chunk_data.get("choices"):
                delta = chunk_data["choices"][0].get("delta", {})
                content = delta.get("content", "")
                
                if content:
                    chunk = GenerationChunk(text=content)
                    if run_manager:
                        run_manager.on_llm_new_token(content, chunk=chunk)
                    yield chunk
    
    def _make_request(self, prompt: str, stream: bool = False):
        """Make request to the target proxy"""
        import requests
        
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": stream
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        if stream:
            response = requests.post(
                f"{self.target_url}/v1/chat/completions",
                json=payload,
                headers=headers,
                stream=True
            )
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data = line_str[6:]  # Remove 'data: ' prefix
                        if data != '[DONE]':
                            yield json.loads(data)
        else:
            response = requests.post(
                f"{self.target_url}/v1/chat/completions",
                json=payload,
                headers=headers
            )
            return response.json()

# Usage
proxy_llm = ProxyLLM(
    target_url="http://localhost:3000",
    api_key="dummy-key",
    model_name="gpt-4",
    streaming=True
)

# Use in chains
chain = ChatPromptTemplate.from_template("{input}") | proxy_llm
response = await chain.ainvoke({"input": "Hello, world!"})
```

### Provider Abstraction Layer

```python
from abc import ABC, abstractmethod
from enum import Enum

class ProviderType(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    PROXY = "proxy"

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def create_model(self, config: Dict[str, Any]):
        pass
    
    @abstractmethod
    async def stream_completion(self, messages: List[Dict], **kwargs):
        pass
    
    @abstractmethod
    def supports_tools(self) -> bool:
        pass

class OpenAIProvider(LLMProvider):
    async def create_model(self, config: Dict[str, Any]):
        return ChatOpenAI(**config)
    
    async def stream_completion(self, messages: List[Dict], **kwargs):
        model = await self.create_model(kwargs.get("model_config", {}))
        async for chunk in model.astream(messages):
            yield chunk
    
    def supports_tools(self) -> bool:
        return True

class AnthropicProvider(LLMProvider):
    async def create_model(self, config: Dict[str, Any]):
        return ChatAnthropic(**config)
    
    async def stream_completion(self, messages: List[Dict], **kwargs):
        model = await self.create_model(kwargs.get("model_config", {}))
        async for chunk in model.astream(messages):
            yield chunk
    
    def supports_tools(self) -> bool:
        return True

class ProxyProvider(LLMProvider):
    async def create_model(self, config: Dict[str, Any]):
        return ProxyLLM(**config)
    
    async def stream_completion(self, messages: List[Dict], **kwargs):
        model = await self.create_model(kwargs.get("model_config", {}))
        async for chunk in model.astream(messages):
            yield chunk
    
    def supports_tools(self) -> bool:
        return False  # Depends on proxy implementation

class ProviderManager:
    """Manage multiple LLM providers"""
    
    def __init__(self):
        self.providers = {
            ProviderType.OPENAI: OpenAIProvider(),
            ProviderType.ANTHROPIC: AnthropicProvider(),
            ProviderType.PROXY: ProxyProvider(),
        }
    
    async def get_provider(self, provider_type: ProviderType) -> LLMProvider:
        return self.providers[provider_type]
    
    async def route_request(self, request: Dict, provider_preference: List[ProviderType]):
        """Route request to preferred provider with fallbacks"""
        
        for provider_type in provider_preference:
            try:
                provider = await self.get_provider(provider_type)
                
                # Check if tools are required
                if request.get("tools") and not provider.supports_tools():
                    continue
                
                return await provider.stream_completion(
                    request["messages"],
                    model_config=request.get("model_config", {})
                )
                
            except Exception as e:
                print(f"Provider {provider_type} failed: {e}")
                continue
        
        raise Exception("All providers failed")

# Usage
async def handle_multi_provider_request(request):
    manager = ProviderManager()
    
    # Define fallback order
    provider_order = [
        ProviderType.OPENAI,
        ProviderType.ANTHROPIC, 
        ProviderType.PROXY
    ]
    
    async for chunk in manager.route_request(request, provider_order):
        yield chunk
```

## 5. Memory and Conversation Management

### Session-Based Memory Management

```python
from langchain.memory import ConversationBufferMemory, ConversationSummaryBufferMemory
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
import uuid
from typing import Dict
import json

class SessionMemoryManager:
    """Manage conversation memory across WebSocket/SSE sessions"""
    
    def __init__(self, redis_client=None):
        self.sessions: Dict[str, Dict] = {}
        self.redis_client = redis_client  # Optional Redis for persistence
    
    def create_session(self, session_id: str = None) -> str:
        """Create a new conversation session"""
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Create memory based on session requirements
        memory = ConversationSummaryBufferMemory(
            llm=ChatOpenAI(model="gpt-3.5-turbo"),
            max_token_limit=1000,
            return_messages=True
        )
        
        self.sessions[session_id] = {
            "memory": memory,
            "created_at": time.time(),
            "last_activity": time.time(),
            "message_count": 0
        }
        
        return session_id
    
    def get_session_memory(self, session_id: str):
        """Get memory for a session"""
        if session_id not in self.sessions:
            self.create_session(session_id)
        
        session = self.sessions[session_id]
        session["last_activity"] = time.time()
        return session["memory"]
    
    def save_interaction(self, session_id: str, human_input: str, ai_output: str):
        """Save an interaction to session memory"""
        memory = self.get_session_memory(session_id)
        memory.save_context(
            {"input": human_input},
            {"output": ai_output}
        )
        
        self.sessions[session_id]["message_count"] += 1
        
        # Optionally persist to Redis
        if self.redis_client:
            self.persist_session(session_id)
    
    def get_conversation_history(self, session_id: str) -> List[Dict]:
        """Get formatted conversation history"""
        memory = self.get_session_memory(session_id)
        messages = memory.chat_memory.messages
        
        formatted_history = []
        for msg in messages:
            formatted_history.append({
                "role": "user" if hasattr(msg, 'content') and msg.__class__.__name__ == "HumanMessage" else "assistant",
                "content": msg.content
            })
        
        return formatted_history
    
    def persist_session(self, session_id: str):
        """Persist session to Redis"""
        if not self.redis_client:
            return
        
        session_data = {
            "history": self.get_conversation_history(session_id),
            "message_count": self.sessions[session_id]["message_count"],
            "created_at": self.sessions[session_id]["created_at"],
            "last_activity": self.sessions[session_id]["last_activity"]
        }
        
        self.redis_client.set(
            f"session:{session_id}",
            json.dumps(session_data),
            ex=86400  # Expire after 24 hours
        )
    
    def load_session(self, session_id: str):
        """Load session from Redis"""
        if not self.redis_client:
            return False
        
        session_data = self.redis_client.get(f"session:{session_id}")
        if not session_data:
            return False
        
        data = json.loads(session_data)
        
        # Recreate memory from history
        memory = ConversationSummaryBufferMemory(
            llm=ChatOpenAI(model="gpt-3.5-turbo"),
            max_token_limit=1000,
            return_messages=True
        )
        
        # Reload conversation history
        for i in range(0, len(data["history"]), 2):
            if i + 1 < len(data["history"]):
                human_msg = data["history"][i]
                ai_msg = data["history"][i + 1]
                memory.save_context(
                    {"input": human_msg["content"]},
                    {"output": ai_msg["content"]}
                )
        
        self.sessions[session_id] = {
            "memory": memory,
            "created_at": data["created_at"],
            "last_activity": time.time(),
            "message_count": data["message_count"]
        }
        
        return True
    
    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old inactive sessions"""
        current_time = time.time()
        sessions_to_remove = []
        
        for session_id, session_data in self.sessions.items():
            age_hours = (current_time - session_data["last_activity"]) / 3600
            if age_hours > max_age_hours:
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            del self.sessions[session_id]

# Integration with streaming chain
class MemoryEnabledStreamingChain:
    """Streaming chain with session memory"""
    
    def __init__(self, memory_manager: SessionMemoryManager):
        self.memory_manager = memory_manager
        self.base_chain = self.create_chain()
    
    def create_chain(self):
        """Create the base LangChain chain"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful assistant. Use the conversation history to provide context-aware responses."),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}")
        ])
        
        llm = ChatOpenAI(model="gpt-4", streaming=True)
        return prompt | llm | StrOutputParser()
    
    async def stream_with_memory(
        self, 
        session_id: str, 
        user_input: str,
        callback_handler=None
    ):
        """Stream response while maintaining conversation memory"""
        
        # Get conversation history
        memory = self.memory_manager.get_session_memory(session_id)
        history = memory.chat_memory.messages
        
        # Build input with history
        chain_input = {
            "input": user_input,
            "history": history
        }
        
        # Stream the response
        full_response = ""
        config = {"callbacks": [callback_handler]} if callback_handler else {}
        
        async for chunk in self.base_chain.astream(chain_input, config=config):
            full_response += chunk
            yield chunk
        
        # Save the interaction to memory
        self.memory_manager.save_interaction(session_id, user_input, full_response)

# Usage in WebSocket handler
memory_manager = SessionMemoryManager()
streaming_chain = MemoryEnabledStreamingChain(memory_manager)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint_with_memory(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # Load existing session or create new one
    if not memory_manager.load_session(session_id):
        memory_manager.create_session(session_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "chat":
                handler = WebSocketStreamingHandler(websocket, session_id)
                
                async for chunk in streaming_chain.stream_with_memory(
                    session_id,
                    message["content"],
                    callback_handler=handler
                ):
                    # Streaming handled by callback
                    pass
                    
    except WebSocketDisconnect:
        # Session persists even after disconnect
        pass
```

## Summary

This comprehensive research provides the building blocks for implementing a sophisticated WebSocket/SSE proxy using LangChain components:

1. **Routing**: Use RunnableBranch and RunnableLambda for intelligent request routing
2. **Message Translation**: Implement custom translators between OpenAI and LangChain formats
3. **Tool Calling**: Universal tool interface supporting multiple providers
4. **Streaming**: Custom callback handlers for real-time WebSocket and SSE streaming
5. **Multi-Provider**: Configurable provider switching with fallbacks
6. **Memory Management**: Session-based conversation memory with persistence

Each component is designed to work together, providing a robust foundation for building production-ready streaming AI proxies.
