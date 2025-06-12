# Development Guide

## Git Workflow

We use a Git Flow approach with the following branches:

### Main Branches
- `master` - Production-ready code
- `dev` - Integration branch for development

### Feature Branches
- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/update-name` - Documentation updates
- `chore/task-name` - Maintenance tasks

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm 8+
- Claude Code CLI installed globally

### Initial Setup
```bash
# Clone repository
git clone https://github.com/eagurin/cynosure.git
cd cynosure

# Switch to dev branch
git checkout dev

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

### Development Workflow

1. **Create Feature Branch**
```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name
```

2. **Development**
```bash
# Start development server
npm run dev

# Run tests in watch mode
npm run test

# Check code quality
npm run lint
npm run typecheck
```

3. **Before Committing**
```bash
# Run pre-commit checks
npm run precommit

# Or run individually
npm run lint:fix
npm run format
npm run typecheck
npm run test:coverage
```

4. **Commit Changes**
```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature description"
```

5. **Push and Create PR**
```bash
# Push branch
git push -u origin feat/your-feature-name

# Create PR to dev branch
gh pr create --base dev --title "feat: your feature" --body "Description"
```

## Code Standards

### TypeScript
- Use strict mode
- Prefer type-safe code
- Use interfaces for object shapes
- Use enums for constants

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(api): add embeddings endpoint
fix(auth): resolve token validation issue
docs(readme): update installation guide
chore(deps): update dependencies
```

### Code Style
- ESLint and Prettier enforced
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in ES5

## Testing

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

### Running Tests
```bash
npm run test                # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only
npm run test:coverage     # With coverage report
```

### Writing Tests
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

## CI/CD Pipeline

### GitHub Actions
- **Lint & Format**: ESLint and Prettier checks
- **Test**: Unit, integration, and E2E tests
- **Build**: TypeScript compilation
- **Docker**: Image build and testing

### Branch Protection
- `master`: Requires PR, reviews, status checks
- `dev`: Requires status checks

## Documentation

### Required Documentation
- API changes → Update OpenAPI spec
- New features → Update README
- Configuration → Update CLAUDE.md
- Architecture → Update project overview

### Documentation Standards
- Clear, concise writing
- Code examples for features
- Step-by-step instructions
- Screenshots for UI changes

## Performance

### Guidelines
- Monitor memory usage
- Optimize streaming responses
- Cache when appropriate
- Profile performance bottlenecks

### Monitoring
- Request/response times
- Error rates
- Token usage
- Memory consumption

## Security

### Best Practices
- Never commit secrets
- Validate all inputs
- Use type-safe schemas
- Implement rate limiting
- Audit dependencies regularly

### Security Checklist
- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] Error messages don't leak info
- [ ] Dependencies updated
- [ ] Security headers configured