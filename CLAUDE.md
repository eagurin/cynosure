# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cynosure Bridge is an OpenAI API-compatible proxy that translates requests to Claude Code SDK. It enables applications designed for OpenAI's API to work seamlessly with Claude MAX subscription, bypassing Tokyo region limitations.

## Key Commands

```bash
# Development
npm run dev              # Start with hot reload (tsx watch)
PORT=8080 npm run dev    # Start on custom port

# Build & Production
npm run build            # Compile TypeScript
npm start                # Run production server

# Testing
npm test                 # Run all tests with Vitest
npm run test:watch       # Watch mode for tests

# Docker
npm run docker:build     # Build Docker image
npm run docker:run       # Run in container
```

## Architecture

### Request Flow
1. OpenAI-compatible request → Fastify server (`/v1/chat/completions`)
2. Translation layer converts to Claude format (`openai-to-claude.ts`)
3. Claude CLI execution via temporary files (`src/claude/client.ts`)
4. Response translation back to OpenAI format (`claude-to-openai.ts`)
5. SSE streaming or JSON response

### Critical Implementation Details

**Claude CLI Integration** (`src/claude/client.ts`):
- Uses local Claude executable at `/Users/laptop/.claude/local/claude`
- Writes prompts to temporary files to avoid shell escaping issues
- Supports both `--output-format json` and `--output-format stream-json`
- Handles exit code 1 gracefully (parses stdout even on error)

**Model Mapping**:
```typescript
const MODEL_MAPPINGS = {
  'gpt-4': 'claude-3-opus-20240229',
  'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
  'gpt-3.5-turbo': 'claude-3-haiku-20240307',
  'gpt-4o': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini': 'claude-3-haiku-20240307'
};
```

**Streaming Architecture**:
- Uses Server-Sent Events (SSE) for streaming responses
- Implements proper `data: ` prefix and `data: [DONE]` termination
- Handles streaming errors gracefully with error events

## TypeScript Configuration

- ES modules with `.js` extensions in imports (even for `.ts` files)
- Strict mode enabled
- Target: ES2022
- Module resolution: bundler

## Environment Variables

```bash
ANTHROPIC_API_KEY=<optional>     # Not needed for MAX subscription
PORT=3000                        # Server port
WORKING_DIRECTORY=<path>         # Claude Code working directory
MAX_TURNS=5                      # Maximum conversation turns
TIMEOUT=60000                    # Request timeout in ms
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

# Health check
curl http://localhost:3000/health

# List models
curl http://localhost:3000/v1/models
```

## Project Structure

- `src/claude/` - Claude CLI integration and execution logic
- `src/server/` - HTTP server and API route handlers  
- `src/translation/` - OpenAI ↔ Claude format conversion
- `src/models/` - TypeScript interfaces and schemas
- `src/utils/` - Helper functions (ID generation, token counting)

## Important Notes

- The project uses Claude CLI as a fallback when SDK direct integration fails
- All OpenAI model names are automatically mapped to appropriate Claude models
- Streaming responses use chunked transfer encoding with SSE format
- The system preserves OpenAI's response structure including system_fingerprint and usage metrics