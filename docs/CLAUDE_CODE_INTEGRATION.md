# 🤖 Claude Code GitHub Integration

## Overview

Cynosure Bridge now integrates with Claude Code through GitHub Actions for automated code assistance, PR reviews, and quick fixes.

## Setup Requirements (Claude MAX Subscription)

### 1. Enable GitHub Actions

Ensure your repository has Actions enabled in Settings -> Actions -> General.

### 2. Extract Claude MAX Credentials

You need to extract authentication tokens from your local Claude installation:

```bash
# Check your Claude auth status
claude auth status

# Find auth tokens (typically in ~/.claude/auth.json)
cat ~/.claude/auth.json
```

### 3. Add GitHub Secrets

Navigate to Settings → Secrets and variables → Actions and add:

- `ANTHROPIC_ACCESS_TOKEN` - Your Claude access token
- `ANTHROPIC_REFRESH_TOKEN` - Your Claude refresh token  
- `ANTHROPIC_EXPIRES_AT` - Token expiration timestamp

**See [CLAUDE_MAX_SETUP.md](./CLAUDE_MAX_SETUP.md) for detailed instructions! 🚀**

## Available Workflows

### 🔧 Claude Code Assist (`claude-code-assist.yml`)

**Manual workflow for AI-assisted development**

**Trigger**: Manual dispatch with custom prompt
**Usage**:

1. Go to Actions tab in GitHub
2. Select "Claude Code Assist"
3. Click "Run workflow"
4. Enter your task description
5. Optionally specify target branch name

**Example Prompts**:

- "Add input validation to the chat completions endpoint"
- "Implement rate limiting middleware"
- "Add comprehensive error handling to the translation layer"
- "Create unit tests for the GitHub Models provider"

**What it does**:

- Creates a new feature branch
- Executes Claude Code with your prompt
- Runs tests and linting
- Commits changes with proper attribution
- Creates a PR to the `dev` branch

### 📝 Claude Code Review (`claude-code-review.yml`)

**Automated PR review and fix assistance**

**Triggers**:

- New pull requests (automatic review)
- Comments containing `/claude` (manual review)
- Comments containing `/claude fix <description>` (apply fixes)

**Features**:

- **Automatic PR Reviews**: Claude analyzes code changes and provides feedback
- **Manual Reviews**: Comment `/claude` on any PR for additional analysis
- **Automated Fixes**: Comment `/claude fix <issue description>` to apply fixes

**Review Focus Areas**:

- TypeScript best practices
- Security vulnerabilities
- Performance optimizations
- API compatibility
- Test coverage
- Documentation completeness

### ⚡ Quick Fix Support

**For immediate small fixes**

**Usage**: Comment `/claude quick-fix <description>` on any PR

**Ideal for**:

- Import statement corrections
- Missing TypeScript types
- ESLint/Prettier violations
- Simple bug fixes
- Dependency updates

## Usage Examples

### Example 1: Feature Development

```
Workflow: Claude Code Assist
Prompt: "Add request logging middleware with configurable log levels"
Result: New PR with logging implementation, tests, and documentation
```

### Example 2: Code Review

```
Action: Open PR with new authentication feature
Result: Claude automatically reviews and comments on security considerations
```

### Example 3: Quick Fix

```
Comment: "/claude quick-fix missing return type annotation on translateResponse function"
Result: Claude adds proper TypeScript annotations and commits the fix
```

## Implementation Details

### Claude MAX Subscription Integration

We use the powerful `grll/claude-code-base-action` with your existing Claude MAX subscription:

```yaml
- name: Execute Claude Code Task
  uses: grll/claude-code-base-action@v1
  with:
    prompt: |
      Your detailed task description for Claude...
    anthropic_access_token: ${{ secrets.ANTHROPIC_ACCESS_TOKEN }}
    anthropic_refresh_token: ${{ secrets.ANTHROPIC_REFRESH_TOKEN }}
    anthropic_expires_at: ${{ secrets.ANTHROPIC_EXPIRES_AT }}
    allowed_tools: "read,write,edit,bash,search"
```

### Safety Considerations

✅ **Enterprise-Grade Safety**: Claude MAX subscription with controlled access:

1. **Authenticated Access**: Uses your personal Claude MAX subscription
2. **Tool Restrictions**: Specific allowed tools per workflow (read, write, edit, bash, search)
3. **Branch Protection**: Changes go to feature branches, not directly to main
4. **PR Process**: All changes require review before merging
5. **Automated Testing**: CI runs tests on all changes
6. **Audit Trail**: Full logging of all Claude actions

### Workflow Architecture

```
User Prompt → Claude MAX → Direct Code Changes → Tests/Lint → Commit → PR
```

## Benefits

### 🚀 **Development Acceleration**

- AI-assisted feature development
- Automated code reviews
- Quick fixes for common issues

### 🛡️ **Quality Assurance**

- Consistent code review coverage
- Security vulnerability detection
- Performance optimization suggestions

### 🔄 **Workflow Integration**

- Seamless Git Flow integration
- Automated testing and linting
- Proper commit attribution

### 📊 **Transparency**

- All actions logged and traceable
- Clear PR descriptions
- Proper change documentation

## Best Practices

### 1. **Prompt Engineering**

- Be specific about requirements
- Include context about the project
- Mention testing and documentation needs
- Specify code style preferences

### 2. **Review Process**

- Always review Claude's changes before merging
- Test functionality manually when appropriate
- Ensure changes align with project architecture

### 3. **Security**

- Review security-related changes carefully
- Validate input handling modifications
- Check for potential vulnerabilities

### 4. **Documentation**

- Keep prompts clear and descriptive
- Document any custom workflows
- Update this guide as needed

## Troubleshooting

### Common Issues

**Issue**: GitHub Models extension not found
**Solution**: GitHub Actions automatically installs `gh models` extension

**Issue**: AI model returns empty response
**Solution**: Workflows have automatic fallback to placeholder implementations

**Issue**: PR creation fails
**Solution**: Check repository permissions for GitHub Actions

**Issue**: Tests fail after AI changes
**Solution**: Use `/claude fix test failures` comment to resolve

**Issue**: Merge conflicts
**Solution**: Rebase feature branch or use `/claude fix merge conflicts`

### Debug Workflow

1. Check Action logs in GitHub Actions tab
2. Verify GitHub Actions permissions are correct
3. Test GitHub Models availability: `gh models list`
4. Test prompts with smaller, focused requests
5. Check fallback implementations when models are unavailable

## Future Enhancements

- **Integration with GitHub Models**: Multi-model comparison and routing
- **Custom Prompt Templates**: Pre-defined prompts for common tasks
- **Usage Analytics**: Track Claude Code effectiveness
- **Advanced Workflows**: Scheduled improvements and maintenance

---

**Note**: This integration uses your existing Claude MAX subscription through GitHub Actions. All Claude executions are logged and auditable through GitHub's action history. Requires Claude MAX authentication tokens in repository secrets.
