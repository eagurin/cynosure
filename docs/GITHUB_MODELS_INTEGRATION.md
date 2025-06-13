# 🤖 GitHub Models Integration Guide for Cynosure Bridge

## Overview

GitHub Models provides free access to AI models directly through GitHub. This guide shows how to integrate GitHub Models with Cynosure Bridge to provide additional AI capabilities.

## 🎯 Integration Benefits

1. **Multi-Model Support**: Access various AI models beyond Claude
2. **Free Tier**: Test and prototype with free model access
3. **GitHub Integration**: Direct integration with your repository
4. **Model Comparison**: Compare outputs from different models

## 📋 Available Models (as of 2025)

GitHub Models typically includes:

- OpenAI GPT models
- Anthropic Claude models
- Google Gemini
- Meta Llama
- Mistral AI models
- Cohere models

## 🔧 Integration Steps

### 1. Enable GitHub Models

```bash
# Check if GitHub Models is available for your account
gh api user

# Access GitHub Models playground
# Visit: https://github.com/marketplace/models
```

### 2. Create Model Configuration

Create `config/github-models.json`:

```json
{
  "models": {
    "github-gpt-4": {
      "provider": "github",
      "model": "gpt-4",
      "endpoint": "https://models.github.com/v1/chat/completions"
    },
    "github-claude-3": {
      "provider": "github", 
      "model": "claude-3-opus",
      "endpoint": "https://models.github.com/v1/chat/completions"
    },
    "github-llama-2": {
      "provider": "github",
      "model": "llama-2-70b",
      "endpoint": "https://models.github.com/v1/chat/completions"
    }
  }
}
```

### 3. Add GitHub Models Provider

Create `src/providers/github-models.ts`:

```typescript
import { FastifyRequest } from 'fastify';

export interface GitHubModelsConfig {
  token: string;
  endpoint: string;
  model: string;
}

export class GitHubModelsProvider {
  private config: GitHubModelsConfig;

  constructor(config: GitHubModelsConfig) {
    this.config = config;
  }

  async chat(messages: any[], options: any = {}) {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2024-12-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub Models API error: ${response.statusText}`);
    }

    return response.json();
  }

  async stream(messages: any[], options: any = {}) {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2024-12-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub Models API error: ${response.statusText}`);
    }

    return response.body;
  }
}
```

### 4. Update Model Mappings

Add to `src/models/mappings.ts`:

```typescript
export const GITHUB_MODEL_MAPPINGS = {
  // Map OpenAI model names to GitHub Models
  'gpt-4-github': 'github/gpt-4',
  'gpt-3.5-turbo-github': 'github/gpt-3.5-turbo',
  'claude-3-github': 'github/claude-3-opus',
  'llama-2-github': 'github/llama-2-70b',
  'mistral-github': 'github/mistral-7b'
};

export function isGitHubModel(model: string): boolean {
  return model.endsWith('-github') || model.startsWith('github/');
}
```

### 5. Environment Configuration

Add to `.env`:

```bash
# GitHub Models Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_MODELS_ENABLED=true
GITHUB_MODELS_ENDPOINT=https://models.github.com/v1

# Model Selection Strategy
# Options: claude-first, github-first, round-robin, cost-optimized
MODEL_STRATEGY=claude-first
```

### 6. Router Enhancement

Update `src/server/routes.ts` to support GitHub Models:

```typescript
// Add model selection logic
const selectProvider = (model: string) => {
  if (isGitHubModel(model)) {
    return 'github';
  }
  // Default to Claude
  return 'claude';
};

// In chat completions endpoint
const provider = selectProvider(body.model);

if (provider === 'github') {
  const githubProvider = new GitHubModelsProvider({
    token: process.env.GITHUB_TOKEN!,
    endpoint: process.env.GITHUB_MODELS_ENDPOINT!,
    model: GITHUB_MODEL_MAPPINGS[body.model] || body.model
  });
  
  if (body.stream) {
    return handleGitHubStreamingRequest(githubProvider, body, reply);
  } else {
    return handleGitHubNonStreamingRequest(githubProvider, body, reply);
  }
}
```

## 🚀 Usage Examples

### 1. Using GitHub GPT-4

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4-github",
    "messages": [{"role": "user", "content": "Hello from GitHub Models!"}]
  }'
```

### 2. Model Comparison

```bash
# Compare Claude vs GitHub GPT-4
./scripts/compare-models.sh "Explain quantum computing" "claude-3-opus" "gpt-4-github"
```

### 3. Cost Optimization

```javascript
// Automatically route to free GitHub Models for simple queries
const routeModel = (prompt) => {
  const complexity = estimateComplexity(prompt);
  
  if (complexity < 0.3) {
    return 'gpt-3.5-turbo-github'; // Free tier
  } else if (complexity < 0.7) {
    return 'gpt-4-github'; // GitHub Models
  } else {
    return 'claude-3-opus'; // Premium for complex tasks
  }
};
```

## 📊 Monitoring and Analytics

### Track Model Usage

```typescript
// Add to your routes
const trackModelUsage = async (model: string, tokens: number) => {
  await db.insert({
    model,
    provider: isGitHubModel(model) ? 'github' : 'claude',
    tokens,
    timestamp: Date.now()
  });
};
```

### Cost Analysis Dashboard

```typescript
// Get usage statistics
const getUsageStats = async () => {
  return {
    githubModels: {
      requests: await db.count({ provider: 'github' }),
      tokens: await db.sum('tokens', { provider: 'github' }),
      cost: 0 // Free!
    },
    claude: {
      requests: await db.count({ provider: 'claude' }),
      tokens: await db.sum('tokens', { provider: 'claude' }),
      cost: calculateClaudeCost(tokens)
    }
  };
};
```

## 🔒 Security Considerations

1. **Token Security**: Store GitHub tokens securely
2. **Rate Limiting**: Implement rate limiting for GitHub Models
3. **Access Control**: Validate API keys before routing to GitHub Models
4. **Audit Logging**: Log all model requests for compliance

## 🎯 Best Practices

1. **Model Selection**:
   - Use GitHub Models for prototyping and testing
   - Use Claude for production workloads requiring consistency
   - Implement intelligent routing based on query complexity

2. **Error Handling**:
   - Fallback from GitHub Models to Claude if unavailable
   - Implement retry logic with exponential backoff
   - Log all errors for debugging

3. **Performance**:
   - Cache common responses
   - Implement request batching where possible
   - Monitor latency for each provider

## 📈 Future Enhancements

1. **A/B Testing**: Compare model outputs automatically
2. **Smart Routing**: ML-based model selection
3. **Cost Optimization**: Automatic routing to minimize costs
4. **Multi-Provider**: Support for more AI providers
5. **Prompt Templates**: GitHub-stored prompt management

## 🔗 Resources

- [GitHub Models Documentation](https://docs.github.com/en/github-models)
- [GitHub Models API Reference](https://docs.github.com/en/rest/models)
- [Model Playground](https://github.com/marketplace/models)
- [Pricing Information](https://github.com/pricing)

---

**Note**: GitHub Models integration is optional and complementary to the core Claude functionality. The bridge works perfectly without it.
