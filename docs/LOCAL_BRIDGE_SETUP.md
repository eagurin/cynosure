# 🌐 Local Bridge Setup for GitHub Actions

This guide explains how to use your local Cynosure Bridge with GitHub Actions using ngrok.

## 🚀 Quick Start

### 1. Start Local Cynosure Bridge

```bash
# Build and start the server
npm run build
npm start
```

Server will run at: `http://localhost:3000`

### 2. Create Ngrok Tunnel

```bash
# Install ngrok if needed
brew install ngrok/ngrok/ngrok

# Start tunnel
ngrok http 3000
```

You'll get a public URL like: `https://xxxx-xx-xxx-xxx-xxx.ngrok-free.app`

### 3. Test the Tunnel

```bash
# Test health endpoint
curl https://your-ngrok-url.ngrok-free.app/health

# Test API endpoint
curl -X POST https://your-ngrok-url.ngrok-free.app/v1/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## 📋 GitHub Actions Integration

### Manual Workflow Dispatch

1. Go to Actions → Claude with Local Bridge
2. Click "Run workflow"
3. Enter:
   - **Task**: Your question for Claude
   - **Bridge URL**: Your ngrok URL

### Issue Comments

Format:

```
@claude-local https://your-ngrok-url.ngrok-free.app Your question here
```

Example:

```
@claude-local https://45c0-85-159-229-107.ngrok-free.app Tell me about Cynosure Bridge
```

## 🔧 Technical Details

### Architecture

```
GitHub Actions → Ngrok Tunnel → Local Cynosure Bridge → Claude CLI
```

### Benefits

- ✅ Uses your local MAX subscription
- ✅ No API keys needed in GitHub
- ✅ Full Claude capabilities
- ✅ Secure tunnel connection

### Limitations

- ⚠️ Requires local server running
- ⚠️ Ngrok URL changes on restart
- ⚠️ Traffic goes through your machine
- ⚠️ Free ngrok has request limits

## 🛠️ Troubleshooting

### Common Issues

1. **"Cannot connect to bridge"**
   - Check local server is running: `curl http://localhost:3000/health`
   - Check ngrok is running: `curl http://localhost:4040/api/tunnels`
   - Verify ngrok URL is correct

2. **"Invalid API key" errors**
   - Expected with MAX subscription
   - The bridge still works despite this error

3. **Workflow not triggering**
   - Ensure workflow is in master branch
   - Check comment format: `@claude-local URL message`
   - Verify permissions on repository

### Debug Commands

```bash
# Check server logs
tail -f /tmp/cynosure.log

# Check ngrok logs
tail -f /tmp/ngrok.log

# Monitor connections
watch -n 1 'netstat -an | grep 3000'
```

## 🔒 Security Considerations

1. **Ngrok exposes local server**
   - Use authentication if needed
   - Monitor access logs
   - Stop when not in use

2. **GitHub Actions security**
   - Don't commit ngrok URLs
   - Use workflow dispatch for sensitive tasks
   - Review action logs regularly

## 📚 Advanced Usage

### Custom Headers

```bash
curl -X POST https://your-ngrok-url/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "X-Custom-Header: value" \
  -d '{...}'
```

### Monitoring

```bash
# Ngrok dashboard
open http://localhost:4040

# Server metrics
curl http://localhost:3000/health | jq '.memory'
```

### Multiple Tunnels

```bash
# Different ports
ngrok http 3000 --subdomain=cynosure-prod
ngrok http 3001 --subdomain=cynosure-dev
```

## 🎯 Best Practices

1. **Keep server running** during GitHub Actions
2. **Save ngrok URL** in environment variable
3. **Test locally first** before GitHub
4. **Monitor usage** to avoid limits
5. **Restart periodically** for stability

---

**Note**: This is a workaround for using Claude MAX subscription with GitHub Actions. For production use, consider using proper API keys or the official Claude GitHub Action.
