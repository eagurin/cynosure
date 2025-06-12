# Contributing to Cynosure Bridge

We love your input! We want to make contributing to Cynosure Bridge as easy and transparent as possible.

## Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing style
5. Issue that pull request!

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear commit messages:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:

```
feat: add support for GPT-4 Vision model mapping
fix: handle streaming errors gracefully
docs: update README with Docker instructions
```

## Pull Request Process

1. Update the README.md with details of changes to the interface
2. Update the CLAUDE.md if you change architecture or commands
3. The PR will be merged once you have approval from a maintainer

## Local Development

```bash
# Clone your fork
git clone https://github.com/your-username/cynosure.git
cd cynosure

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Testing

- Write tests for any new functionality
- Ensure all tests pass before submitting PR
- Include both unit and integration tests where appropriate

## Code Style

- TypeScript with strict mode
- ES modules with .js extensions in imports
- Use async/await over callbacks
- Follow existing patterns in the codebase

## Reporting Bugs

Use GitHub Issues with the bug report template. Include:

- Detailed steps to reproduce
- Expected vs actual behavior
- Logs and error messages
- Environment details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
