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
  'gpt-4o-mini': 'claude-3-haiku-20240307',
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

## Important Notes

- The project uses Claude CLI as a fallback when SDK direct integration fails
- All OpenAI model names are automatically mapped to appropriate Claude models
- Streaming responses use chunked transfer encoding with SSE format
- The system preserves OpenAI's response structure including system_fingerprint and usage metrics
- CI/CD pipeline enforces code quality and testing before deployment
