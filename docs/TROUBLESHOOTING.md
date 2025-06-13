# Troubleshooting Guide

## Common Issues

### Installation Issues

#### Claude Code CLI Not Found

```bash
Error: Claude CLI not found at /Users/laptop/.claude/local/claude
```

**Solution:**

```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Check path
which claude
```

#### Dependencies Installation Failed

```bash
npm ERR! peer dep missing
```

**Solution:**

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Runtime Issues

#### Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use different port
PORT=8080 npm run dev

# Option 3: Find and kill process
ps aux | grep node
kill -9 <process-id>
```

#### Invalid API Key Error

```bash
Invalid API key · Fix external API key
```

**Solutions:**

1. **For Claude MAX subscription** (expected behavior):
   - This error is normal when using Claude MAX
   - The API will still return responses
   - No action needed

2. **For API key users**:

   ```bash
   # Set your API key
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   
   # Or in .env file
   echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
   ```

#### TypeScript Compilation Errors

```bash
src/index.ts(1,24): error TS2307: Cannot find module
```

**Solutions:**

```bash
# Check TypeScript configuration
npm run typecheck

# Rebuild
npm run clean
npm run build

# Check import paths (use .js extension)
import { helper } from './utils/helpers.js';
```

### API Issues

#### 404 Not Found

```bash
curl: (22) The requested URL returned error: 404 Not Found
```

**Solutions:**

1. **Check server is running:**

   ```bash
   curl http://localhost:3000/health
   ```

2. **Verify endpoint URL:**

   ```bash
   # Correct endpoints
   POST /v1/chat/completions
   GET /v1/models
   GET /health
   ```

3. **Check content-type:**

   ```bash
   curl -H "Content-Type: application/json" \
        -X POST http://localhost:3000/v1/chat/completions
   ```

#### Streaming Not Working

```bash
# No streaming data received
```

**Solutions:**

1. **Check stream parameter:**

   ```json
   {
     "model": "gpt-4",
     "messages": [...],
     "stream": true
   }
   ```

2. **Test with curl:**

   ```bash
   curl -X POST http://localhost:3000/v1/chat/completions \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"stream":true}'
   ```

3. **Check Claude CLI flags:**
   - Non-streaming: `--output-format json`
   - Streaming: `--output-format stream-json --verbose`

### Performance Issues

#### Slow Response Times

**Diagnostics:**

```bash
# Check system resources
top
htop

# Monitor network
ping api.anthropic.com

# Check logs for bottlenecks
npm run dev | grep "duration"
```

**Solutions:**

1. **Implement caching** (Redis)
2. **Optimize prompts** (reduce token count)
3. **Use appropriate models** (Haiku for speed)
4. **Check network connectivity**

#### Memory Leaks

**Diagnostics:**

```bash
# Monitor memory usage
ps aux | grep node

# Node.js memory info
node --inspect src/index.js
```

**Solutions:**

1. **Profile with Node.js inspector**
2. **Check for unclosed streams**
3. **Implement proper cleanup**
4. **Use memory profiling tools**

### Development Issues

#### Hot Reload Not Working

```bash
# Changes not reflected
```

**Solutions:**

```bash
# Check tsx watch mode
npm run dev

# If still not working, restart
pkill -f tsx
npm run dev

# Check file permissions
ls -la src/
```

#### Tests Failing

```bash
# Test failures
```

**Solutions:**

```bash
# Run specific test
npm run test -- helpers.test.ts

# Clear test cache
npm run test -- --clearCache

# Check test configuration
cat vitest.config.ts

# Update snapshots if needed
npm run test -- --update-snapshots
```

#### Linting Errors

```bash
# ESLint errors
```

**Solutions:**

```bash
# Auto-fix issues
npm run lint:fix

# Check specific file
npx eslint src/server/routes.ts

# Disable rule for specific line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
```

## Docker Issues

### Docker Build Failures

```bash
# Build failures
```

**Solutions:**

```bash
# Clean Docker cache
docker system prune -a

# Build with no cache
docker build --no-cache -t cynosure .

# Check Dockerfile syntax
docker build --dry-run .
```

### Container Not Starting

```bash
# Container exits immediately
```

**Solutions:**

```bash
# Check logs
docker logs cynosure

# Run interactive shell
docker run -it cynosure /bin/bash

# Check environment variables
docker run cynosure env
```

## Debugging Tips

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=debug
npm run dev

# Claude CLI debug
export ANTHROPIC_LOG=debug
```

### Network Debugging

```bash
# Test connectivity
curl -v http://localhost:3000/health

# Check firewall
sudo ufw status

# Monitor network traffic
sudo netstat -tlnp | grep 3000
```

### API Request Debugging

```bash
# Log all requests
curl -v -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# Check request/response headers
curl -I http://localhost:3000/health
```

## Getting Help

### Log Collection

When reporting issues, include:

1. **System Information:**

   ```bash
   node --version
   npm --version
   claude --version
   uname -a
   ```

2. **Application Logs:**

   ```bash
   npm run dev 2>&1 | tee debug.log
   ```

3. **Configuration:**

   ```bash
   cat package.json
   cat tsconfig.json
   env | grep -E "(NODE|ANTHROPIC|PORT)"
   ```

### Resources

- GitHub Issues: [Create Issue](https://github.com/eagurin/cynosure/issues/new)
- Claude Code Docs: [Documentation](https://docs.anthropic.com/en/docs/claude-code)
- Discord Community: [Join](https://discord.gg/anthropic)

### Issue Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Environment:**
- OS: [e.g. macOS 14.0]
- Node.js: [e.g. 20.11.0]
- Cynosure: [e.g. 1.0.0]

**Logs**
```

Paste relevant logs here

```
```
