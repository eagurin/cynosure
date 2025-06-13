# WebSocket/SSE API Proxy Technical Report

## Executive Summary

This technical report provides a comprehensive guide for building a production-ready API proxy that bridges OpenAI-compatible APIs with Claude Code SDK, supporting both SSE streaming and WebSocket bidirectional communication. The architecture emphasizes security, scalability, and maintainability while leveraging LangChain for complex orchestration tasks.

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Core Components](#core-components)
3. [LangChain Integration Strategy](#langchain-integration-strategy)
4. [Model Mapping & Routing](#model-mapping--routing)
5. [Streaming Protocols](#streaming-protocols)
6. [Security Implementation](#security-implementation)
7. [Production Deployment](#production-deployment)
8. [Implementation Roadmap](#implementation-roadmap)

## Architectural Overview

### System Architecture Diagram

```
╔════════════════════╗   ╔════════════════════╗   ╔════════════════════╗
║   Client Apps      ║   ║  Cynosure Proxy    ║   ║  Claude Code SDK   ║
║ ────────────────   ║   ║ ────────────────   ║   ║ ────────────────   ║
║ • OpenAI SDK       ║◄─►║ • FastAPI Server   ║◄─►║ • Local CLI        ║
║ • Custom Apps      ║WS ║ • Translation      ║EX ║ • API Endpoint     ║
║ • LangChain        ║/S ║ • Rate Limiting    ║EC ║ • MAX Support      ║
╚════════════════════╝SE ╚════════════════════╝   ╚════════════════════╝
          │                      │
          └──────────────┬───────┘
                         ▼
          ╔═════════════════════════════╗
          ║   LangChain Orchestration   ║
          ║ ──────────────────────────  ║
          ║ • Agent Routing             ║
          ║ • Memory Mgmt               ║
          ║ • Tool Calling              ║
          ╚═════════════════════════════╝
```

### Technology Stack

```python
# Core Dependencies
TECH_STACK = {
    "framework": "FastAPI",           # Async web framework
    "websocket": "fastapi.WebSocket", # Native WebSocket support
    "streaming": "SSE",               # Server-Sent Events
    "orchestration": "LangChain",     # Agent orchestration
    "validation": "Pydantic",         # Request/Response validation
    "security": "FastAPI Security",   # Authentication/Authorization
    "caching": "Redis",               # Response caching
    "monitoring": "Prometheus",       # Metrics collection
}
```

## Core Components

### 1. FastAPI Application Structure

```python
# src/main.py
from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

from .routers import openai_router, websocket_router
from .middleware import RateLimitMiddleware, AuthenticationMiddleware
from .config import settings

app = FastAPI(
    title="Cynosure Bridge",
    version="2.0.0",
    description="OpenAI-compatible proxy for Claude Code SDK"
)

# Middleware stack
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthenticationMiddleware)

# Include routers
app.include_router(openai_router, prefix="/v1")
app.include_router(websocket_router, prefix="/ws")

@app.on_event("startup")
async def startup_event():
    """Initialize connections and resources"""
    from .services import initialize_services
    await initialize_services()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources"""
    from .services import cleanup_services
    await cleanup_services()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        server_header=False,  # Security: Hide server info
        date_header=False,    # Security: Hide date info
    )
```

### 2. Request/Response Models

```python
# src/models/schemas.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Union, Literal
from datetime import datetime
import uuid

class Message(BaseModel):
    role: Literal["system", "user", "assistant", "function"]
    content: str
    name: Optional[str] = None
    function_call: Optional[dict] = None

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Message]
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, gt=0)
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: Optional[float] = Field(default=0, ge=-2, le=2)
    frequency_penalty: Optional[float] = Field(default=0, ge=-2, le=2)
    user: Optional[str] = None
    
    # Custom fields for advanced features
    tools: Optional[List[dict]] = None
    tool_choice: Optional[Union[str, dict]] = None
    response_format: Optional[dict] = None
    
    @validator('model')
    def validate_model(cls, v):
        """Validate and map model names"""
        from ..services.model_mapper import validate_model
        return validate_model(v)

class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:8]}")
    object: Literal["chat.completion", "chat.completion.chunk"]
    created: int = Field(default_factory=lambda: int(datetime.now().timestamp()))
    model: str
    choices: List[dict]
    usage: Optional[dict] = None
    system_fingerprint: Optional[str] = None

class WebSocketMessage(BaseModel):
    """WebSocket message format"""
    type: Literal["request", "response", "error", "control"]
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.now)
    payload: dict
    metadata: Optional[dict] = None
```

### 3. Translation Layer

```python
# src/services/translator.py
from typing import Dict, List, Any, AsyncIterator
import json
from ..models.schemas import ChatCompletionRequest, Message
from ..services.model_mapper import ModelMapper

class RequestTranslator:
    """Translates between OpenAI and Claude formats"""
    
    def __init__(self, model_mapper: ModelMapper):
        self.model_mapper = model_mapper
    
    def openai_to_claude(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        """Convert OpenAI request to Claude format"""
        # Map model name
        claude_model = self.model_mapper.map_model(request.model)
        
        # Build Claude prompt
        prompt = self._build_claude_prompt(request.messages)
        
        # Map parameters
        claude_params = {
            "model": claude_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": request.max_tokens or 4096,
            "temperature": request.temperature,
            "stream": request.stream,
        }
        
        # Handle system messages
        system_content = self._extract_system_content(request.messages)
        if system_content:
            claude_params["system"] = system_content
        
        # Handle tools/functions
        if request.tools:
            claude_params["tools"] = self._convert_tools(request.tools)
        
        return claude_params
    
    def claude_to_openai(self, claude_response: Dict[str, Any], 
                        original_request: ChatCompletionRequest) -> Dict[str, Any]:
        """Convert Claude response to OpenAI format"""
        return {
            "id": f"chatcmpl-{claude_response.get('id', 'unknown')[:8]}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": original_request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": claude_response.get("content", ""),
                },
                "finish_reason": self._map_finish_reason(claude_response),
            }],
            "usage": self._calculate_usage(claude_response),
            "system_fingerprint": f"fp_{claude_response.get('model', 'unknown')}"
        }
    
    def _build_claude_prompt(self, messages: List[Message]) -> str:
        """Build Claude-compatible prompt from messages"""
        prompt_parts = []
        
        for msg in messages:
            if msg.role == "system":
                continue  # Handle separately
            elif msg.role == "user":
                prompt_parts.append(f"Human: {msg.content}")
            elif msg.role == "assistant":
                prompt_parts.append(f"Assistant: {msg.content}")
            elif msg.role == "function":
                prompt_parts.append(f"Function ({msg.name}): {msg.content}")
        
        # Add final prompt indicator
        if messages[-1].role != "assistant":
            prompt_parts.append("Assistant:")
        
        return "\n\n".join(prompt_parts)
    
    def _extract_system_content(self, messages: List[Message]) -> Optional[str]:
        """Extract system message content"""
        system_messages = [m.content for m in messages if m.role == "system"]
        return "\n".join(system_messages) if system_messages else None
    
    def _convert_tools(self, tools: List[dict]) -> List[dict]:
        """Convert OpenAI tools format to Claude format"""
        claude_tools = []
        for tool in tools:
            if tool["type"] == "function":
                claude_tools.append({
                    "name": tool["function"]["name"],
                    "description": tool["function"]["description"],
                    "input_schema": tool["function"]["parameters"],
                })
        return claude_tools
    
    def _map_finish_reason(self, claude_response: Dict[str, Any]) -> str:
        """Map Claude stop reason to OpenAI finish reason"""
        stop_reason = claude_response.get("stop_reason", "stop")
        mapping = {
            "end_turn": "stop",
            "max_tokens": "length",
            "stop_sequence": "stop",
            "tool_use": "tool_calls",
        }
        return mapping.get(stop_reason, "stop")
    
    def _calculate_usage(self, claude_response: Dict[str, Any]) -> Dict[str, int]:
        """Calculate token usage from response"""
        usage = claude_response.get("usage", {})
        return {
            "prompt_tokens": usage.get("input_tokens", 0),
            "completion_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        }
```

## LangChain Integration Strategy

### What to Delegate to LangChain

```python
# src/services/langchain_integration.py
from langchain.chat_models.base import BaseChatModel
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.memory import ConversationBufferMemory
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from typing import AsyncIterator, Optional

class CynosureLangChainModel(BaseChatModel):
    """Custom LangChain model that routes through Cynosure"""
    
    client: Any  # Your HTTP client
    model_name: str = "gpt-4"
    streaming: bool = False
    
    @property
    def _llm_type(self) -> str:
        return "cynosure-claude"
    
    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs
    ) -> ChatResult:
        """Generate response through Cynosure proxy"""
        # Convert LangChain messages to our format
        api_messages = self._convert_messages(messages)
        
        # Make request through proxy
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=api_messages,
            stream=self.streaming,
            stop=stop,
            **kwargs
        )
        
        # Convert response back to LangChain format
        return self._convert_response(response)
    
    def _convert_messages(self, messages: List[BaseMessage]) -> List[dict]:
        """Convert LangChain messages to API format"""
        api_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                api_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                api_messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                api_messages.append({"role": "assistant", "content": msg.content})
        return api_messages

# Use Cases for LangChain Delegation

class LangChainOrchestrator:
    """Orchestrates complex workflows using LangChain"""
    
    def __init__(self, cynosure_model: CynosureLangChainModel):
        self.llm = cynosure_model
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
    
    async def create_agent_with_tools(self, tools: List[Any]) -> AgentExecutor:
        """Create an agent with tools - DELEGATE TO LANGCHAIN"""
        prompt = hub.pull("hwchase17/openai-tools-agent")
        agent = create_openai_tools_agent(
            llm=self.llm,
            tools=tools,
            prompt=prompt
        )
        
        return AgentExecutor(
            agent=agent,
            tools=tools,
            memory=self.memory,
            verbose=True,
            handle_parsing_errors=True
        )
    
    async def create_rag_chain(self, retriever: Any):
        """Create RAG chain - DELEGATE TO LANGCHAIN"""
        from langchain.chains import RetrievalQA
        
        return RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True
        )
    
    async def create_structured_output_chain(self, output_schema: Any):
        """Create structured output chain - DELEGATE TO LANGCHAIN"""
        from langchain.output_parsers import PydanticOutputParser
        from langchain.prompts import PromptTemplate
        
        parser = PydanticOutputParser(pydantic_object=output_schema)
        
        prompt = PromptTemplate(
            template="Answer the user query.\n{format_instructions}\n{query}\n",
            input_variables=["query"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        return prompt | self.llm | parser

# What NOT to Delegate to LangChain (Custom Implementation Required)

class CustomImplementations:
    """Features that require custom implementation"""
    
    async def handle_streaming_response(self, response: AsyncIterator[str]):
        """Custom SSE streaming - DO NOT DELEGATE"""
        async for chunk in response:
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    async def handle_websocket_connection(self, websocket: WebSocket):
        """WebSocket handling - DO NOT DELEGATE"""
        # Custom bidirectional communication logic
        pass
    
    async def implement_custom_auth(self, request: Request):
        """Custom authentication - DO NOT DELEGATE"""
        # Your specific auth logic
        pass
    
    async def implement_rate_limiting(self, key: str):
        """Custom rate limiting - DO NOT DELEGATE"""
        # Your specific rate limiting logic
        pass
```

### LangChain Integration Decision Matrix

| Feature | Delegate to LangChain | Custom Implementation | Reason |
|---------|----------------------|----------------------|---------|
| Agent Orchestration | ✅ | ❌ | Complex agent logic, tool calling |
| Memory Management | ✅ | ❌ | Conversation history, context window |
| RAG Pipelines | ✅ | ❌ | Document retrieval, embeddings |
| Prompt Templates | ✅ | ❌ | Structured prompts, few-shot examples |
| Output Parsing | ✅ | ❌ | JSON, Pydantic schemas |
| Chain Composition | ✅ | ❌ | Sequential, parallel chains |
| Streaming Responses | ❌ | ✅ | SSE/WebSocket specific formatting |
| Authentication | ❌ | ✅ | API-specific auth requirements |
| Rate Limiting | ❌ | ✅ | Custom business logic |
| Model Routing | ❌ | ✅ | Claude-specific model mapping |
| Error Handling | ❌ | ✅ | API-specific error codes |
| Metrics/Monitoring | ❌ | ✅ | Custom telemetry requirements |

## Model Mapping & Routing

### Intelligent Model Router

```python
# src/services/model_mapper.py
from typing import Dict, Optional, List, Tuple
from enum import Enum
import re
from datetime import datetime

class ModelCapability(Enum):
    """Model capabilities for intelligent routing"""
    CODING = "coding"
    ANALYSIS = "analysis"
    CREATIVE = "creative"
    VISION = "vision"
    FUNCTION_CALLING = "function_calling"
    LONG_CONTEXT = "long_context"

class ModelMapper:
    """Intelligent model mapping and routing"""
    
    def __init__(self):
        self.model_registry = self._initialize_model_registry()
        self.routing_rules = self._initialize_routing_rules()
    
    def _initialize_model_registry(self) -> Dict[str, Dict]:
        """Initialize model registry with capabilities and limits"""
        return {
            # OpenAI Models
            "gpt-4": {
                "claude_model": "claude-3-opus-20240229",
                "capabilities": [ModelCapability.CODING, ModelCapability.ANALYSIS],
                "context_window": 8192,
                "max_output": 4096,
                "cost_per_1k_input": 0.03,
                "cost_per_1k_output": 0.06,
            },
            "gpt-4-turbo": {
                "claude_model": "claude-3-5-sonnet-20241022",
                "capabilities": [ModelCapability.CODING, ModelCapability.VISION, 
                               ModelCapability.LONG_CONTEXT],
                "context_window": 128000,
                "max_output": 4096,
                "cost_per_1k_input": 0.01,
                "cost_per_1k_output": 0.03,
            },
            "gpt-4o": {
                "claude_model": "claude-3-5-sonnet-20241022",
                "capabilities": [ModelCapability.CODING, ModelCapability.VISION,
                               ModelCapability.FUNCTION_CALLING],
                "context_window": 128000,
                "max_output": 4096,
                "cost_per_1k_input": 0.005,
                "cost_per_1k_output": 0.015,
            },
            "gpt-4o-mini": {
                "claude_model": "claude-3-haiku-20240307",
                "capabilities": [ModelCapability.CODING, ModelCapability.ANALYSIS],
                "context_window": 128000,
                "max_output": 16384,
                "cost_per_1k_input": 0.00015,
                "cost_per_1k_output": 0.0006,
            },
            "gpt-3.5-turbo": {
                "claude_model": "claude-3-haiku-20240307",
                "capabilities": [ModelCapability.ANALYSIS],
                "context_window": 16385,
                "max_output": 4096,
                "cost_per_1k_input": 0.0005,
                "cost_per_1k_output": 0.0015,
            },
            
            # Claude Native Models (for direct requests)
            "claude-3-opus-20240229": {
                "claude_model": "claude-3-opus-20240229",
                "capabilities": [ModelCapability.CODING, ModelCapability.ANALYSIS,
                               ModelCapability.CREATIVE, ModelCapability.LONG_CONTEXT],
                "context_window": 200000,
                "max_output": 4096,
                "cost_per_1k_input": 0.015,
                "cost_per_1k_output": 0.075,
            },
            "claude-3-5-sonnet-20241022": {
                "claude_model": "claude-3-5-sonnet-20241022",
                "capabilities": [ModelCapability.CODING, ModelCapability.VISION,
                               ModelCapability.FUNCTION_CALLING, ModelCapability.LONG_CONTEXT],
                "context_window": 200000,
                "max_output": 8192,
                "cost_per_1k_input": 0.003,
                "cost_per_1k_output": 0.015,
            },
            "claude-3-haiku-20240307": {
                "claude_model": "claude-3-haiku-20240307",
                "capabilities": [ModelCapability.CODING, ModelCapability.ANALYSIS],
                "context_window": 200000,
                "max_output": 4096,
                "cost_per_1k_input": 0.00025,
                "cost_per_1k_output": 0.00125,
            },
        }
    
    def _initialize_routing_rules(self) -> List[Tuple[re.Pattern, str]]:
        """Initialize routing rules based on content patterns"""
        return [
            # Code-related queries -> Sonnet for best performance
            (re.compile(r'\b(code|debug|implement|function|class|algorithm)\b', re.I),
             "claude-3-5-sonnet-20241022"),
            
            # Creative writing -> Opus for quality
            (re.compile(r'\b(story|poem|creative|write|narrative)\b', re.I),
             "claude-3-opus-20240229"),
            
            # Quick queries -> Haiku for speed
            (re.compile(r'\b(quick|simple|brief|short|summary)\b', re.I),
             "claude-3-haiku-20240307"),
            
            # Vision tasks -> Sonnet
            (re.compile(r'\b(image|picture|visual|analyze.*photo|describe.*image)\b', re.I),
             "claude-3-5-sonnet-20241022"),
        ]
    
    def map_model(self, openai_model: str, context: Optional[Dict] = None) -> str:
        """Map OpenAI model to Claude model with intelligent routing"""
        # Direct mapping if available
        if openai_model in self.model_registry:
            base_model = self.model_registry[openai_model]["claude_model"]
            
            # Apply routing rules if context provided
            if context and context.get("messages"):
                return self._apply_routing_rules(base_model, context)
            
            return base_model
        
        # Fallback for unknown models
        return self._fallback_model_selection(openai_model)
    
    def _apply_routing_rules(self, base_model: str, context: Dict) -> str:
        """Apply routing rules based on message content"""
        # Extract all message content
        full_content = " ".join([
            msg.get("content", "") 
            for msg in context.get("messages", [])
            if isinstance(msg.get("content"), str)
        ])
        
        # Check routing rules
        for pattern, preferred_model in self.routing_rules:
            if pattern.search(full_content):
                # Check if preferred model has required capabilities
                if self._model_supports_requirements(preferred_model, context):
                    return preferred_model
        
        return base_model
    
    def _model_supports_requirements(self, model: str, context: Dict) -> bool:
        """Check if model supports required capabilities"""
        model_info = self.model_registry.get(model)
        if not model_info:
            return False
        
        # Check context window
        total_tokens = context.get("estimated_tokens", 0)
        if total_tokens > model_info["context_window"]:
            return False
        
        # Check required capabilities
        required_capabilities = context.get("required_capabilities", [])
        model_capabilities = model_info["capabilities"]
        
        return all(cap in model_capabilities for cap in required_capabilities)
    
    def _fallback_model_selection(self, model_name: str) -> str:
        """Intelligent fallback for unknown models"""
        model_lower = model_name.lower()
        
        # Pattern matching for model selection
        if "gpt-4" in model_lower:
            return "claude-3-5-sonnet-20241022"
        elif "gpt-3" in model_lower or "mini" in model_lower:
            return "claude-3-haiku-20240307"
        elif "opus" in model_lower or "best" in model_lower:
            return "claude-3-opus-20240229"
        else:
            # Default to Sonnet for balanced performance
            return "claude-3-5-sonnet-20241022"
    
    def get_model_info(self, model: str) -> Optional[Dict]:
        """Get detailed model information"""
        return self.model_registry.get(model)
    
    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost for a request"""
        model_info = self.get_model_info(model)
        if not model_info:
            return 0.0
        
        input_cost = (input_tokens / 1000) * model_info["cost_per_1k_input"]
        output_cost = (output_tokens / 1000) * model_info["cost_per_1k_output"]
        
        return input_cost + output_cost

# Advanced routing example
class SmartRouter:
    """Advanced routing with load balancing and fallbacks"""
    
    def __init__(self, model_mapper: ModelMapper):
        self.model_mapper = model_mapper
        self.model_health = {}  # Track model availability
        self.request_history = []  # Track request patterns
    
    async def route_request(self, request: ChatCompletionRequest) -> str:
        """Smart routing with fallbacks"""
        # Analyze request
        context = {
            "messages": [msg.dict() for msg in request.messages],
            "estimated_tokens": self._estimate_tokens(request),
            "required_capabilities": self._detect_required_capabilities(request),
        }
        
        # Get primary model
        primary_model = self.model_mapper.map_model(request.model, context)
        
        # Check model health
        if self._is_model_healthy(primary_model):
            return primary_model
        
        # Fallback to alternative
        return self._get_fallback_model(primary_model, context)
    
    def _estimate_tokens(self, request: ChatCompletionRequest) -> int:
        """Estimate token count for request"""
        # Simple estimation: ~4 characters per token
        total_chars = sum(len(msg.content) for msg in request.messages)
        return total_chars // 4
    
    def _detect_required_capabilities(self, request: ChatCompletionRequest) -> List[ModelCapability]:
        """Detect required capabilities from request"""
        capabilities = []
        
        # Check for function calling
        if request.tools or request.tool_choice:
            capabilities.append(ModelCapability.FUNCTION_CALLING)
        
        # Check for vision
        for msg in request.messages:
            if isinstance(msg.content, list):  # Multi-modal content
                capabilities.append(ModelCapability.VISION)
                break
        
        # Check for long context
        if self._estimate_tokens(request) > 50000:
            capabilities.append(ModelCapability.LONG_CONTEXT)
        
        return capabilities
    
    def _is_model_healthy(self, model: str) -> bool:
        """Check if model is healthy and available"""
        health_info = self.model_health.get(model, {"healthy": True, "last_check": datetime.now()})
        
        # Re-check if data is stale (> 5 minutes)
        if (datetime.now() - health_info["last_check"]).seconds > 300:
            # In production, this would ping the model endpoint
            health_info = {"healthy": True, "last_check": datetime.now()}
            self.model_health[model] = health_info
        
        return health_info["healthy"]
    
    def _get_fallback_model(self, primary_model: str, context: Dict) -> str:
        """Get fallback model based on requirements"""
        # Define fallback chains
        fallback_chains = {
            "claude-3-5-sonnet-20241022": ["claude-3-opus-20240229", "claude-3-haiku-20240307"],
            "claude-3-opus-20240229": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
            "claude-3-haiku-20240307": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
        }
        
        for fallback in fallback_chains.get(primary_model, []):
            if self._is_model_healthy(fallback) and \
               self.model_mapper._model_supports_requirements(fallback, context):
                return fallback
        
        # Last resort: return primary model anyway
        return primary_model
```

## Streaming Protocols

### SSE (Server-Sent Events) Implementation

```python
# src/streaming/sse_handler.py
from typing import AsyncIterator, Optional, Dict, Any
import json
import asyncio
from datetime import datetime
import uuid

class SSEHandler:
    """Server-Sent Events handler for streaming responses"""
    
    def __init__(self):
        self.encoder = json.JSONEncoder(ensure_ascii=False)
    
    async def stream_chat_completion(
        self,
        claude_stream: AsyncIterator[Dict[str, Any]],
        request_id: str,
        model: str
    ) -> AsyncIterator[str]:
        """Convert Claude stream to OpenAI SSE format"""
        
        # Send initial metadata
        yield self._format_sse_message({
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": int(datetime.now().timestamp()),
            "model": model,
            "system_fingerprint": f"fp_{model}",
            "choices": [{
                "index": 0,
                "delta": {"role": "assistant", "content": ""},
                "finish_reason": None
            }]
        })
        
        # Stream content chunks
        async for chunk in claude_stream:
            if chunk.get("type") == "content_block_delta":
                yield self._format_sse_message({
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "created": int(datetime.now().timestamp()),
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "delta": {"content": chunk.get("delta", {}).get("text", "")},
                        "finish_reason": None
                    }]
                })
            
            elif chunk.get("type") == "message_stop":
                # Send final chunk with finish reason
                yield self._format_sse_message({
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "created": int(datetime.now().timestamp()),
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": "stop"
                    }]
                })
        
        # Send done signal
        yield "data: [DONE]\n\n"
    
    def _format_sse_message(self, data: Dict[str, Any]) -> str:
        """Format data as SSE message"""
        json_data = self.encoder.encode(data)
        return f"data: {json_data}\n\n"
    
    async def handle_sse_errors(
        self,
        error: Exception,
        request_id: str
    ) -> AsyncIterator[str]:
        """Handle errors in SSE stream"""
        error_data = {
            "id": request_id,
            "object": "error",
            "error": {
                "type": type(error).__name__,
                "message": str(error),
                "code": getattr(error, "code", "internal_error")
            }
        }
        yield self._format_sse_message(error_data)
        yield "data: [DONE]\n\n"

# SSE Route Implementation
from fastapi import Response, Request
from fastapi.responses import StreamingResponse

class SSERouter:
    """FastAPI router for SSE endpoints"""
    
    def __init__(self, sse_handler: SSEHandler):
        self.sse_handler = sse_handler
    
    async def chat_completions_stream(
        self,
        request: Request,
        chat_request: ChatCompletionRequest
    ) -> StreamingResponse:
        """Handle streaming chat completions"""
        
        # Generate request ID
        request_id = f"chatcmpl-{uuid.uuid4().hex[:8]}"
        
        async def generate():
            try:
                # Get Claude stream
                claude_stream = await self._get_claude_stream(chat_request)
                
                # Convert to SSE format
                async for message in self.sse_handler.stream_chat_completion(
                    claude_stream,
                    request_id,
                    chat_request.model
                ):
                    yield message
                    
            except Exception as e:
                # Stream error message
                async for message in self.sse_handler.handle_sse_errors(e, request_id):
                    yield message
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable Nginx buffering
                "Access-Control-Allow-Origin": "*",  # Configure as needed
            }
        )
```

### WebSocket Implementation

```python
# src/streaming/websocket_handler.py
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Any, Optional
import asyncio
import json
from datetime import datetime
from enum import Enum

class WebSocketMessageType(Enum):
    """WebSocket message types"""
    CHAT_REQUEST = "chat.request"
    CHAT_RESPONSE = "chat.response"
    CHAT_STREAM = "chat.stream"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    CONTROL = "control"

class WebSocketHandler:
    """WebSocket handler for bidirectional communication"""
    
    def __init__(self, max_connections: int = 1000):
        self.connections: Dict[str, WebSocket] = {}
        self.max_connections = max_connections
        self.heartbeat_interval = 30  # seconds
    
    async def handle_connection(self, websocket: WebSocket, client_id: str):
        """Handle WebSocket connection lifecycle"""
        # Accept connection
        await websocket.accept()
        
        # Check connection limit
        if len(self.connections) >= self.max_connections:
            await self._send_error(websocket, "Connection limit exceeded")
            await websocket.close(code=1008)  # Policy Violation
            return
        
        # Register connection
        self.connections[client_id] = websocket
        
        # Start heartbeat
        heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(websocket, client_id)
        )
        
        try:
            # Send welcome message
            await self._send_message(websocket, {
                "type": WebSocketMessageType.CONTROL.value,
                "data": {
                    "action": "connected",
                    "client_id": client_id,
                    "timestamp": datetime.now().isoformat()
                }
            })
            
            # Handle messages
            await self._message_loop(websocket, client_id)
            
        except WebSocketDisconnect:
            print(f"Client {client_id} disconnected")
        except Exception as e:
            print(f"Error handling client {client_id}: {e}")
            await self._send_error(websocket, str(e))
        finally:
            # Cleanup
            heartbeat_task.cancel()
            self.connections.pop(client_id, None)
            try:
                await websocket.close()
            except:
                pass
    
    async def _message_loop(self, websocket: WebSocket, client_id: str):
        """Main message handling loop"""
        while True:
            # Receive message
            message = await websocket.receive_json()
            
            # Validate message
            if not self._validate_message(message):
                await self._send_error(websocket, "Invalid message format")
                continue
            
            # Route message
            message_type = message.get("type")
            
            if message_type == WebSocketMessageType.CHAT_REQUEST.value:
                await self._handle_chat_request(websocket, message)
            
            elif message_type == WebSocketMessageType.HEARTBEAT.value:
                await self._handle_heartbeat(websocket, message)
            
            elif message_type == WebSocketMessageType.CONTROL.value:
                await self._handle_control(websocket, message)
            
            else:
                await self._send_error(websocket, f"Unknown message type: {message_type}")
    
    async def _handle_chat_request(self, websocket: WebSocket, message: Dict[str, Any]):
        """Handle chat request with streaming response"""
        request_data = message.get("data", {})
        request_id = message.get("id", str(uuid.uuid4()))
        
        try:
            # Convert to ChatCompletionRequest
            chat_request = ChatCompletionRequest(**request_data)
            
            # Force streaming for WebSocket
            chat_request.stream = True
            
            # Get Claude stream
            claude_stream = await self._get_claude_stream(chat_request)
            
            # Stream response
            async for chunk in claude_stream:
                await self._send_message(websocket, {
                    "id": request_id,
                    "type": WebSocketMessageType.CHAT_STREAM.value,
                    "data": chunk
                })
            
            # Send completion signal
            await self._send_message(websocket, {
                "id": request_id,
                "type": WebSocketMessageType.CHAT_RESPONSE.value,
                "data": {
                    "status": "completed",
                    "finish_reason": "stop"
                }
            })
            
        except Exception as e:
            await self._send_error(websocket, str(e), request_id)
    
    async def _heartbeat_loop(self, websocket: WebSocket, client_id: str):
        """Send periodic heartbeats"""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                await self._send_message(websocket, {
                    "type": WebSocketMessageType.HEARTBEAT.value,
                    "data": {
                        "timestamp": datetime.now().isoformat()
                    }
                })
            except:
                break
    
    async def _send_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """Send message to WebSocket client"""
        await websocket.send_json(message)
    
    async def _send_error(self, websocket: WebSocket, error: str, request_id: Optional[str] = None):
        """Send error message"""
        await self._send_message(websocket, {
            "id": request_id,
            "type": WebSocketMessageType.ERROR.value,
            "data": {
                "error": error,
                "timestamp": datetime.now().isoformat()
            }
        })
    
    def _validate_message(self, message: Dict[str, Any]) -> bool:
        """Validate incoming message format"""
        return all([
            isinstance(message, dict),
            "type" in message,
            message["type"] in [t.value for t in WebSocketMessageType]
        ])

# WebSocket Route
class WebSocketRouter:
    """FastAPI WebSocket router"""
    
    def __init__(self, handler: WebSocketHandler):
        self.handler = handler
    
    async def websocket_endpoint(self, websocket: WebSocket):
        """WebSocket endpoint handler"""
        # Generate client ID
        client_id = str(uuid.uuid4())
        
        # Handle connection
        await self.handler.handle_connection(websocket, client_id)

# Advanced WebSocket Features
class AdvancedWebSocketHandler(WebSocketHandler):
    """Extended WebSocket handler with advanced features"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.subscriptions: Dict[str, Set[str]] = {}  # topic -> client_ids
        self.client_metadata: Dict[str, Dict] = {}
    
    async def handle_subscription(self, websocket: WebSocket, client_id: str, message: Dict):
        """Handle pub/sub subscriptions"""
        action = message.get("data", {}).get("action")
        topic = message.get("data", {}).get("topic")
        
        if action == "subscribe":
            if topic not in self.subscriptions:
                self.subscriptions[topic] = set()
            self.subscriptions[topic].add(client_id)
            
            await self._send_message(websocket, {
                "type": WebSocketMessageType.CONTROL.value,
                "data": {
                    "action": "subscribed",
                    "topic": topic
                }
            })
        
        elif action == "unsubscribe":
            if topic in self.subscriptions:
                self.subscriptions[topic].discard(client_id)
    
    async def broadcast_to_topic(self, topic: str, message: Dict[str, Any]):
        """Broadcast message to all subscribers of a topic"""
        if topic not in self.subscriptions:
            return
        
        # Get all connected subscribers
        tasks = []
        for client_id in self.subscriptions[topic]:
            if client_id in self.connections:
                websocket = self.connections[client_id]
                tasks.append(self._send_message(websocket, message))
        
        # Send to all subscribers concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def handle_authentication(self, websocket: WebSocket, client_id: str, token: str) -> bool:
        """Handle WebSocket authentication"""
        try:
            # Validate token (implement your auth logic)
            user_info = await self._validate_token(token)
            
            if user_info:
                self.client_metadata[client_id] = {
                    "user": user_info,
                    "authenticated_at": datetime.now(),
                    "permissions": user_info.get("permissions", [])
                }
                return True
            
            return False
            
        except Exception:
            return False
```

## Security Implementation

### Comprehensive Security Layer

```python
# src/security/security_layer.py
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, List
import jwt
import time
from datetime import datetime, timedelta
import hashlib
import hmac
from redis import Redis
import ipaddress

class SecurityConfig:
    """Security configuration"""
    # CORS
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "https://app.example.com",
    ]
    ALLOWED_METHODS = ["GET", "POST", "OPTIONS"]
    ALLOWED_HEADERS = ["*"]
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 60  # seconds
    RATE_LIMIT_BURST = 20
    
    # Authentication
    JWT_SECRET = "your-secret-key"  # Use environment variable
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION = 3600  # 1 hour
    
    # API Keys
    API_KEY_HEADER = "X-API-Key"
    API_KEY_PREFIX = "sk-"
    
    # IP Restrictions
    ALLOWED_IP_RANGES = [
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    ]

class AuthenticationMiddleware:
    """Multi-method authentication middleware"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.bearer_scheme = HTTPBearer(auto_error=False)
    
    async def __call__(self, request: Request) -> Optional[Dict[str, Any]]:
        """Authenticate request using multiple methods"""
        
        # Skip auth for health checks
        if request.url.path in ["/health", "/metrics"]:
            return None
        
        # Try Bearer token
        credentials = await self.bearer_scheme(request)
        if credentials:
            return await self._validate_bearer_token(credentials)
        
        # Try API Key
        api_key = request.headers.get(SecurityConfig.API_KEY_HEADER)
        if api_key:
            return await self._validate_api_key(api_key)
        
        # Try JWT in Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            return await self._validate_jwt(token)
        
        # No valid authentication found
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    async def _validate_bearer_token(self, credentials: HTTPAuthorizationCredentials) -> Dict[str, Any]:
        """Validate Bearer token"""
        token = credentials.credentials
        
        # Check token in Redis
        user_data = await self.redis.get(f"token:{token}")
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        return json.loads(user_data)
    
    async def _validate_api_key(self, api_key: str) -> Dict[str, Any]:
        """Validate API key"""
        if not api_key.startswith(SecurityConfig.API_KEY_PREFIX):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key format"
            )
        
        # Hash API key for storage
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        # Lookup in Redis
        key_data = await self.redis.get(f"api_key:{key_hash}")
        if not key_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        
        return json.loads(key_data)
    
    async def _validate_jwt(self, token: str) -> Dict[str, Any]:
        """Validate JWT token"""
        try:
            payload = jwt.decode(
                token,
                SecurityConfig.JWT_SECRET,
                algorithms=[SecurityConfig.JWT_ALGORITHM]
            )
            
            # Check expiration
            if payload.get("exp", 0) < time.time():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired"
                )
            
            return payload
            
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

class RateLimitMiddleware:
    """Advanced rate limiting with sliding window"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def __call__(self, request: Request, user_id: str):
        """Check rate limit for user"""
        # Generate rate limit key
        key = f"rate_limit:{user_id}"
        
        # Get current timestamp
        now = time.time()
        window_start = now - SecurityConfig.RATE_LIMIT_WINDOW
        
        # Remove old entries
        await self.redis.zremrangebyscore(key, 0, window_start)
        
        # Count requests in window
        request_count = await self.redis.zcard(key)
        
        # Check limit
        if request_count >= SecurityConfig.RATE_LIMIT_REQUESTS:
            # Calculate retry after
            oldest_request = await self.redis.zrange(key, 0, 0, withscores=True)
            if oldest_request:
                retry_after = int(SecurityConfig.RATE_LIMIT_WINDOW - (now - oldest_request[0][1]))
            else:
                retry_after = SecurityConfig.RATE_LIMIT_WINDOW
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(retry_after)}
            )
        
        # Add current request
        await self.redis.zadd(key, {str(uuid.uuid4()): now})
        
        # Set expiration
        await self.redis.expire(key, SecurityConfig.RATE_LIMIT_WINDOW)
        
        # Return remaining quota
        return {
            "limit": SecurityConfig.RATE_LIMIT_REQUESTS,
            "remaining": SecurityConfig.RATE_LIMIT_REQUESTS - request_count - 1,
            "reset": int(now + SecurityConfig.RATE_LIMIT_WINDOW)
        }

class IPRestrictionMiddleware:
    """IP-based access control"""
    
    def __init__(self):
        self.allowed_networks = [
            ipaddress.ip_network(cidr)
            for cidr in SecurityConfig.ALLOWED_IP_RANGES
        ]
    
    async def __call__(self, request: Request):
        """Check if IP is allowed"""
        # Get client IP (consider X-Forwarded-For for proxies)
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        
        if forwarded_for:
            # Take the first IP from the chain
            client_ip = forwarded_for.split(",")[0].strip()
        
        try:
            ip = ipaddress.ip_address(client_ip)
            
            # Check if IP is in allowed ranges
            for network in self.allowed_networks:
                if ip in network:
                    return
            
            # IP not in allowed ranges
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied from this IP address"
            )
            
        except ValueError:
            # Invalid IP address
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid IP address"
            )

class CORSMiddleware:
    """Enhanced CORS middleware with security features"""
    
    @staticmethod
    def configure(app: FastAPI):
        """Configure CORS with security best practices"""
        from fastapi.middleware.cors import CORSMiddleware as FastAPICORS
        
        app.add_middleware(
            FastAPICORS,
            allow_origins=SecurityConfig.ALLOWED_ORIGINS,
            allow_credentials=True,
            allow_methods=SecurityConfig.ALLOWED_METHODS,
            allow_headers=SecurityConfig.ALLOWED_HEADERS,
            expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
            max_age=3600,  # Cache preflight requests
        )

class SecurityHeaders:
    """Security headers middleware"""
    
    async def __call__(self, request: Request, call_next):
        """Add security headers to response"""
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Remove sensitive headers
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)
        
        return response

# Input validation and sanitization
from pydantic import validator, constr
import bleach

class SecureMessage(BaseModel):
    """Secure message model with validation"""
    
    role: Literal["system", "user", "assistant"]
    content: constr(min_length=1, max_length=100000)  # Limit message size
    
    @validator('content')
    def sanitize_content(cls, v):
        """Sanitize HTML content"""
        # Remove any HTML tags for text content
        return bleach.clean(v, tags=[], strip=True)
    
    @validator('content')
    def check_injection(cls, v):
        """Check for injection attempts"""
        # Check for common injection patterns
        injection_patterns = [
            r'<script',
            r'javascript:',
            r'on\w+\s*=',  # Event handlers
            r'data:text/html',
            r'vbscript:',
        ]
        
        import re
        for pattern in injection_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Potential injection attempt detected")
        
        return v

# API key generation and management
class APIKeyManager:
    """Secure API key management"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def generate_api_key(self, user_id: str, permissions: List[str]) -> str:
        """Generate secure API key"""
        # Generate random key
        key_bytes = os.urandom(32)
        api_key = f"{SecurityConfig.API_KEY_PREFIX}{base64.urlsafe_b64encode(key_bytes).decode().rstrip('=')}"
        
        # Hash for storage
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        # Store key data
        key_data = {
            "user_id": user_id,
            "permissions": permissions,
            "created_at": datetime.now().isoformat(),
            "last_used": None,
            "usage_count": 0
        }
        
        await self.redis.set(
            f"api_key:{key_hash}",
            json.dumps(key_data),
            ex=86400 * 30  # 30 days expiration
        )
        
        return api_key
    
    async def revoke_api_key(self, api_key: str) -> bool:
        """Revoke API key"""
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        return await self.redis.delete(f"api_key:{key_hash}") > 0
    
    async def rotate_api_key(self, old_key: str) -> Optional[str]:
        """Rotate API key"""
        # Get existing key data
        key_hash = hashlib.sha256(old_key.encode()).hexdigest()
        key_data = await self.redis.get(f"api_key:{key_hash}")
        
        if not key_data:
            return None
        
        data = json.loads(key_data)
        
        # Revoke old key
        await self.revoke_api_key(old_key)
        
        # Generate new key
        return await self.generate_api_key(
            data["user_id"],
            data["permissions"]
        )
```

## Production Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Security: Run as non-root user
RUN groupadd -r cynosure && useradd -r -g cynosure cynosure

# Install dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=cynosure:cynosure . .

# Security: Set proper permissions
RUN chmod -R 755 /app

# Switch to non-root user
USER cynosure

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health').raise_for_status()"

# Run application
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cynosure-bridge
  labels:
    app: cynosure-bridge
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cynosure-bridge
  template:
    metadata:
      labels:
        app: cynosure-bridge
    spec:
      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      containers:
      - name: cynosure
        image: cynosure-bridge:latest
        ports:
        - containerPort: 8000
          name: http
        
        # Resource limits
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # Environment variables
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: cynosure-secrets
              key: anthropic-api-key
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: cynosure-secrets
              key: redis-url
        
        # Probes
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        
        # Security
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: cynosure-bridge
spec:
  selector:
    app: cynosure-bridge
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cynosure-bridge
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - api.cynosure.example.com
    secretName: cynosure-tls
  rules:
  - host: api.cynosure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cynosure-bridge
            port:
              number: 80
```

### Monitoring and Observability

```python
# src/monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Request, Response
import time

# Metrics
request_count = Counter(
    'cynosure_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'cynosure_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

active_connections = Gauge(
    'cynosure_active_connections',
    'Number of active connections',
    ['connection_type']
)

model_usage = Counter(
    'cynosure_model_usage_total',
    'Model usage by type',
    ['model', 'user']
)

token_usage = Counter(
    'cynosure_token_usage_total',
    'Token usage',
    ['model', 'user', 'type']
)

class MetricsMiddleware:
    """Prometheus metrics middleware"""
    
    async def __call__(self, request: Request, call_next):
        """Record metrics for each request"""
        start_time = time.time()
        
        # Record active connection
        if request.url.path.startswith("/ws"):
            active_connections.labels(connection_type="websocket").inc()
        
        try:
            response = await call_next(request)
            
            # Record metrics
            request_count.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()
            
            request_duration.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(time.time() - start_time)
            
            return response
            
        finally:
            if request.url.path.startswith("/ws"):
                active_connections.labels(connection_type="websocket").dec()

# Metrics endpoint
async def metrics_endpoint(request: Request) -> Response:
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )

# Structured logging
import structlog

logger = structlog.get_logger()

class StructuredLoggingMiddleware:
    """Structured logging middleware"""
    
    async def __call__(self, request: Request, call_next):
        """Add structured logging to requests"""
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Bind request context
        with structlog.contextvars.bound_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host
        ):
            logger.info("request_started")
            
            try:
                response = await call_next(request)
                
                logger.info(
                    "request_completed",
                    status_code=response.status_code,
                    duration=time.time() - start_time
                )
                
                # Add request ID to response
                response.headers["X-Request-ID"] = request_id
                
                return response
                
            except Exception as e:
                logger.error(
                    "request_failed",
                    error=str(e),
                    error_type=type(e).__name__
                )
                raise
```

## Implementation Roadmap

### Phase 1: Core WebSocket Server (Week 1)

```python
# TODO: Implement core WebSocket server
# Location: src/websocket/server.py

"""
1. Basic WebSocket server with FastAPI
2. Connection management and lifecycle
3. Message routing and validation
4. Error handling and reconnection logic
5. Basic authentication
"""

# Key implementation tasks:
PHASE_1_TASKS = [
    "Setup FastAPI WebSocket endpoint",
    "Implement connection pool management",
    "Create message validation schemas",
    "Add basic JWT authentication",
    "Implement heartbeat/ping-pong",
    "Create WebSocket client SDK",
    "Write unit tests for WebSocket handler",
]
```

### Phase 2: Enhanced Streaming (Week 2)

```python
# TODO: Implement advanced streaming features
# Location: src/streaming/

"""
1. SSE optimization for large responses
2. WebSocket streaming with backpressure
3. Stream compression (gzip)
4. Chunked encoding optimization
5. Response caching for repeated queries
"""

PHASE_2_TASKS = [
    "Optimize SSE chunk sizing",
    "Implement WebSocket backpressure handling",
    "Add gzip compression middleware",
    "Create streaming response cache",
    "Implement stream multiplexing",
    "Add streaming metrics",
]
```

### Phase 3: Security Hardening (Week 3)

```python
# TODO: Implement comprehensive security
# Location: src/security/

"""
1. Multi-factor authentication
2. API key rotation system
3. Request signing and validation
4. DDoS protection
5. Security audit logging
"""

PHASE_3_TASKS = [
    "Implement TOTP-based 2FA",
    "Create API key rotation scheduler",
    "Add HMAC request signing",
    "Implement rate limiting with Redis",
    "Create security audit trail",
    "Add penetration testing suite",
]
```

### Phase 4: Production Features (Week 4)

```python
# TODO: Production-ready features
# Location: src/production/

"""
1. High availability setup
2. Horizontal scaling
3. Monitoring and alerting
4. Performance optimization
5. Disaster recovery
"""

PHASE_4_TASKS = [
    "Setup Redis Sentinel for HA",
    "Implement sticky sessions for WebSocket",
    "Create Grafana dashboards",
    "Add distributed tracing with Jaeger",
    "Implement backup and restore",
    "Create load testing suite",
]
```

## Final Summary: WebSocket Server Core Implementation

### Immediate Next Steps

1. **Create WebSocket Server Foundation**
   ```bash
   src/
   ├── websocket/
   │   ├── __init__.py
   │   ├── server.py         # Core WebSocket server
   │   ├── handlers.py       # Message handlers
   │   ├── connection_pool.py # Connection management
   │   └── schemas.py        # Message validation
   ```

2. **Implement Core Features**
   - FastAPI WebSocket endpoint with proper error handling
   - Connection lifecycle management (connect, disconnect, reconnect)
   - Message routing based on type
   - Authentication integration
   - Heartbeat mechanism

3. **Testing Strategy**
   - Unit tests for message handlers
   - Integration tests for WebSocket flow
   - Load tests for connection limits
   - Security tests for authentication

4. **Documentation**
   - WebSocket protocol specification
   - Client SDK documentation
   - API reference with examples
   - Deployment guide

### Key Implementation Considerations

1. **Use FastAPI's native WebSocket support** for simplicity and performance
2. **Implement connection pooling** to manage resources efficiently
3. **Add comprehensive error handling** for network issues
4. **Use Pydantic models** for message validation
5. **Implement proper cleanup** on disconnection
6. **Add metrics** from the start for monitoring
7. **Design for horizontal scaling** with Redis pub/sub

### Success Metrics

- WebSocket connections: < 100ms handshake time
- Message latency: < 50ms round trip
- Concurrent connections: 10,000+ per instance
- Reliability: 99.9% uptime
- Security: Zero authentication bypasses

This completes the comprehensive technical report for building a production-ready WebSocket/SSE API proxy with all the architectural guidance, code examples, and implementation roadmap needed for success.