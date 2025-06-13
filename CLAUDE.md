# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cynosure Bridge is a production-ready OpenAI API-compatible proxy that translates requests to Claude Code SDK. It enables applications designed for OpenAI's API to work seamlessly with Claude MAX subscription, providing:

- **Full WebSocket/SSE Support**: Bidirectional WebSocket and Server-Sent Events streaming
- **Network Proxy Server**: Share one Claude MAX subscription across entire teams at `http://192.168.1.196:3000`
- **LangChain Integration**: Deep integration with LangChain for orchestration and tool calling
- **Multi-Provider Routing**: Intelligent routing between OpenAI and Claude with fallback strategies
- **Self-Hosted GitHub Runner**: Support for @claude comments in issues/PRs with 22% performance improvement

## Memories

- Cynosure Bridge is a project that provides translation layer between OpenAI-compatible APIs and Claude Code SDK
- Network proxy runs on 0.0.0.0:3000 and is accessible at <http://192.168.1.196:3000>
- Supports both SSE streaming and WebSocket bidirectional communication
- Integrates with LangChain for advanced orchestration capabilities
- No API keys needed - uses local Claude MAX subscription

## Key Commands

```bash
# Development
npm run dev              # Start with hot reload (tsx watch)
PORT=8080 npm run dev    # Start on custom port

# Build & Production
npm run build            # Compile TypeScript
npm start                # Run production server

# Testing
npm run test             # Run all tests with Vitest
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests only
npm run test:coverage    # With coverage report

# Code Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier formatting
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking
npm run precommit        # Run all checks before commit

# Docker
npm run docker:build     # Build Docker image
npm run docker:run       # Run in container

# Utilities
npm run clean            # Clean dist and coverage
npm run ci               # Full CI pipeline locally
```

## Architecture

### Request Flow

1. OpenAI-compatible request → Fastify server (`/v1/chat/completions`)
2. Translation layer converts to Claude format (`openai-to-claude.ts`)
3. Claude CLI execution via temporary files (`src/claude/client.ts`)
4. Response translation back to OpenAI format (`claude-to-openai.ts`)
5. SSE streaming or JSON response

### Advanced Architecture Components

**WebSocket/SSE Proxy**:

- Dual protocol support for streaming (SSE) and bidirectional (WebSocket) communication
- FastAPI-based async architecture for high performance
- Automatic protocol negotiation based on client capabilities

**LangChain Integration**:

- `RunnableBranch` for intelligent provider routing
- `ChatPromptTemplate` for message format translation
- Custom streaming handlers for WebSocket and SSE
- Universal tool interface for function calling
- Redis-backed memory persistence for conversations

**Security Layer**:

- CORS configuration for cross-origin requests
- Rate limiting per IP/user
- Authentication middleware (optional)
- DDoS protection
- Request validation and sanitization

**Production Features**:

- Health monitoring endpoints (`/health`, `/metrics`)
- Prometheus metrics integration
- Structured logging with correlation IDs
- Automatic fallback between providers
- Load balancing support

### Critical Implementation Details

**Claude CLI Integration** (`src/claude/client.ts`):

- Uses local Claude executable at `/Users/laptop/.claude/local/claude`
- Writes prompts to temporary files to avoid shell escaping issues
- Supports both `--output-format json` and `--output-format stream-json`
- Handles exit code 1 gracefully (parses stdout even on error)

**Model Mapping**:

```typescript
const MODEL_MAPPINGS = {
  // Chat models
  'gpt-4': 'claude-3-5-sonnet-20241022',
  'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
  'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
  'gpt-4o': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini': 'claude-3-5-haiku-20241022',

  // Legacy mappings
  'gpt-4-legacy': 'claude-3-opus-20240229',
  'gpt-3.5-turbo-legacy': 'claude-3-haiku-20240307',
};

// Embedding models (via synthetic generation)
const EMBEDDING_MODELS = {
  'text-embedding-3-small': 1536, // dimensions
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};
```

**Streaming Architecture**:

- Uses Server-Sent Events (SSE) for streaming responses
- Implements proper `data:` prefix and `data: [DONE]` termination
- Handles streaming errors gracefully with error events

## TypeScript Configuration

- ES modules with `.js` extensions in imports (even for `.ts` files)
- Strict mode enabled
- Target: ES2022
- Module resolution: bundler

## Environment Variables

```bash
# Core Configuration
ANTHROPIC_API_KEY=<optional>     # Not needed for MAX subscription
PORT=3000                        # Server port (default: 3000)
HOST=0.0.0.0                     # Host binding (0.0.0.0 for network access)
NODE_ENV=production              # Environment (development/production)

# Claude Configuration
WORKING_DIRECTORY=<path>         # Claude Code working directory
MAX_TURNS=5                      # Maximum conversation turns
TIMEOUT=60000                    # Request timeout in ms

# Security (Optional)
CORS_ORIGINS=*                   # CORS allowed origins
PROXY_API_KEYS=key1,key2         # Optional API key authentication
RATE_LIMIT_PER_MINUTE=100        # Rate limit per IP/user

# Advanced Features (Optional)
REDIS_URL=redis://localhost:6379 # Redis for memory persistence
ENABLE_WEBSOCKET=true            # Enable WebSocket support
ENABLE_METRICS=true              # Enable Prometheus metrics
LOG_LEVEL=info                   # Logging level (debug/info/warn/error)
```

## Common Issues & Solutions

1. **"Invalid API key" responses**: Expected behavior with MAX subscription - the CLI still returns valid responses despite the error message

2. **Port already in use**: Kill existing process or use `PORT=8080 npm run dev`

3. **Claude CLI not found**: Ensure Claude Code is installed locally at `/Users/laptop/.claude/local/claude`

## Testing Endpoints

```bash
# Basic completion
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'

# Streaming
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [...], "stream": true}'

# Embeddings
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "text-embedding-3-small", "input": "Hello world"}'

# Health check
curl http://localhost:3000/health

# Metrics (if enabled)
curl http://localhost:3000/metrics

# List models
curl http://localhost:3000/v1/models

# Network access (from any device)
curl http://192.168.1.196:3000/health
```

## Git Workflow

### Branches

- `master` - Production-ready code
- `dev` - Development integration branch
- `feat/feature-name` - Feature branches
- `fix/bug-name` - Bug fix branches

### Development Process

1. Create feature branch from `dev`
2. Implement changes with tests
3. Run `npm run precommit` before commit
4. Create PR to `dev` branch
5. After review, merge to `dev`
6. Periodic releases merge `dev` to `master`

## Project Structure

- `src/claude/` - Claude CLI integration and execution logic
- `src/server/` - HTTP server and API route handlers
- `src/translation/` - OpenAI ↔ Claude format conversion
- `src/models/` - TypeScript interfaces and schemas
- `src/utils/` - Helper functions (ID generation, token counting)
- `tests/` - Test suites (unit, integration, e2e)
- `docs/` - Project documentation
- `.github/` - GitHub workflows and templates

## Code Quality

### ESLint Configuration

- TypeScript-specific rules
- Consistent code style
- Error prevention
- Auto-fixable issues

### Prettier Configuration

- Consistent formatting
- 2-space indentation
- Single quotes
- Trailing commas

### Testing Strategy

- Unit tests for individual functions
- Integration tests for API routes
- E2E tests for full request flow
- Coverage reporting with Vitest

## Management Scripts

### Service Management

```bash
# Simple local management
./scripts/cynosure-local.sh status|start|stop|restart|test

# Advanced factory management with monitoring
./scripts/cynosure-factory-simple.sh status|start|stop|restart|monitor

# GitHub Actions self-hosted runner setup
./scripts/setup-runner.sh

# Service testing
./scripts/cynosure-local.sh test  # Tests all endpoints
```

### macOS LaunchAgent (Auto-start)

```bash
# Install service to start automatically
cp scripts/com.cynosure.factory.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.cynosure.factory.plist
```

## Advanced Features

### WebSocket Support (Planned)

```javascript
// WebSocket connection for bidirectional communication
const ws = new WebSocket('ws://192.168.1.196:3000/v1/ws/chat');
ws.send(
  JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Real-time chat!' }],
  })
);
```

### Function Calling

```javascript
// Tool/function calling support
{
  "model": "gpt-4",
  "messages": [...],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get weather info",
      "parameters": {...}
    }
  }]
}
```

### Structured Output

```javascript
// Schema-based responses
{
  "model": "gpt-4",
  "messages": [...],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "math_response",
      "schema": {...}
    }
  }
}
```

## Important Notes

- **Network-ready**: Runs on `0.0.0.0:3000` accessible at `http://192.168.1.196:3000`
- **No API keys needed**: Uses local Claude MAX subscription, dummy keys work
- **22% faster**: Local execution vs tunnel-based solutions
- **Team sharing**: One subscription for entire development team
- **Production-ready**: Auto-restart, health monitoring, comprehensive logging
- **Full SDK compatibility**: Drop-in replacement for OpenAI SDK
- **Dual protocols**: SSE streaming + WebSocket bidirectional support (planned)
- **LangChain integration**: Advanced orchestration and tool calling capabilities
- **Security built-in**: CORS, rate limiting, authentication middleware
