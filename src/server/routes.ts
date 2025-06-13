/**
 * Cynosure Bridge API Routes
 * OpenAI-compatible endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
} from '../models/openai.js';
import { ClaudeApiClient } from '../claude/api-client.js';
import {
  formatSSE,
  createOpenAIError,
  sanitizeModelName,
  mapModelToClaud,
  EMBEDDING_MODELS,
} from '../utils/helpers.js';
import { metricsCollector, formatPrometheusMetrics } from '../utils/metrics.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check endpoint with enhanced metrics
  fastify.get('/health', async (_request, _reply) => {
    const healthStatus = metricsCollector.getHealthStatus();

    return {
      status: healthStatus.status,
      service: 'cynosure-bridge',
      version: process.env.npm_package_version || '1.0.0',
      claude_code_available: true,
      checks: healthStatus.checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  });

  // Test endpoint for debugging
  fastify.post('/v1/test', async (request, _reply) => {
    return {
      status: 'ok',
      message: 'Test endpoint working',
      body: request.body,
      timestamp: new Date().toISOString(),
    };
  });

  // OpenAI-compatible models endpoint
  fastify.get('/v1/models', async (_request, _reply) => {
    return {
      object: 'list',
      data: [
        // Chat models (mapped to Claude)
        {
          id: 'gpt-4',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Maps to claude-3-5-sonnet-20241022',
        },
        {
          id: 'gpt-4-turbo',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Maps to claude-3-5-sonnet-20241022',
        },
        {
          id: 'gpt-3.5-turbo',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Maps to claude-3-5-haiku-20241022',
        },
        {
          id: 'gpt-4o',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Maps to claude-3-5-sonnet-20241022',
        },
        {
          id: 'gpt-4o-mini',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Maps to claude-3-5-haiku-20241022',
        },
        // Embedding models (synthetic)
        {
          id: 'text-embedding-3-small',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Synthetic embeddings (1536 dimensions)',
        },
        {
          id: 'text-embedding-3-large',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Synthetic embeddings (3072 dimensions)',
        },
        {
          id: 'text-embedding-ada-002',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
          description: 'Synthetic embeddings (1536 dimensions)',
        },
      ],
    };
  });

  // Main chat completions endpoint
  fastify.post(
    '/v1/chat/completions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['model', 'messages'],
          properties: {
            model: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant', 'function'] },
                  content: {
                    oneOf: [
                      { type: 'string' },
                      {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['text', 'image_url'] },
                            text: { type: 'string' },
                            image_url: {
                              type: 'object',
                              properties: {
                                url: { type: 'string' },
                                detail: { type: 'string', enum: ['low', 'high', 'auto'] },
                              },
                              required: ['url'],
                            },
                          },
                          required: ['type'],
                        },
                      },
                    ],
                  },
                  name: { type: 'string' },
                  function_call: { type: 'object' },
                },
              },
            },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            top_p: { type: 'number', minimum: 0, maximum: 1 },
            n: { type: 'integer', minimum: 1, maximum: 1 },
            stream: { type: 'boolean' },
            stop: {
              oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
            max_tokens: { type: 'integer', minimum: 1 },
            presence_penalty: { type: 'number', minimum: -2, maximum: 2 },
            frequency_penalty: { type: 'number', minimum: -2, maximum: 2 },
            logit_bias: { type: 'object' },
            user: { type: 'string' },
            functions: { type: 'array' },
            function_call: {
              oneOf: [{ type: 'string', enum: ['none', 'auto'] }, { type: 'object' }],
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: OpenAIChatCompletionRequest }>, reply: FastifyReply) => {
      try {
        const { body } = request;

        // Validate request
        if (!body.model || !body.messages || body.messages.length === 0) {
          reply.code(400);
          return createOpenAIError('Missing required fields: model and messages');
        }

        // Sanitize and map model name
        const sanitizedModel = sanitizeModelName(body.model);
        const claudeModel = mapModelToClaud(sanitizedModel);

        // Get Claude Code config from environment
        const claudeConfig = {
          apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-cli',
          model: claudeModel,
          workingDirectory: process.env.WORKING_DIRECTORY || process.cwd(),
          maxTurns: parseInt(process.env.MAX_TURNS || '5'),
          timeout: parseInt(process.env.TIMEOUT || '300000'), // 5 minutes
        };

        // Initialize Claude API client with fallback support
        const claudeClient = new ClaudeApiClient(claudeConfig);

        // Create query for new API client with vision support
        const apiQuery = {
          model: body.model,
          messages: body.messages.map(msg => ({
            role: msg.role,
            content:
              typeof msg.content === 'string'
                ? msg.content
                : Array.isArray(msg.content)
                  ? msg.content
                      .map(item => (item.type === 'text' ? item.text : '[Image]'))
                      .join(' ')
                  : String(msg.content),
          })),
          max_tokens: body.max_tokens,
          temperature: body.temperature,
        };

        // Handle streaming vs non-streaming
        if (body.stream) {
          return handleStreamingRequest(claudeClient, apiQuery, body.model, reply);
        } else {
          return handleNonStreamingRequest(claudeClient, apiQuery, body.model, reply);
        }
      } catch (error) {
        fastify.log.error('Error in chat completions:', error);
        reply.code(500);
        return createOpenAIError(
          error instanceof Error ? error.message : 'Internal server error',
          'internal_error'
        );
      }
    }
  );

  // Embeddings endpoint (synthetic implementation)
  interface EmbeddingsBody {
    input: string | string[];
    model?: string;
  }

  fastify.post(
    '/v1/embeddings',
    async (request: FastifyRequest<{ Body: EmbeddingsBody }>, reply: FastifyReply) => {
      try {
        const { input, model = 'text-embedding-3-small' } = request.body;

        if (!input) {
          reply.code(400);
          return createOpenAIError('Missing required field: input');
        }

        // Get dimensions from configuration
        const dimensions = EMBEDDING_MODELS[model] || 1536;

        // Generate synthetic embeddings (deterministic hash-based)
        const texts = Array.isArray(input) ? input : [input];
        const embeddings = texts.map((text: string, index: number) => {
          // Simple hash-based synthetic embedding
          const vector = new Array(dimensions).fill(0).map((_, i) => {
            const hash = simpleHash(text + i.toString());
            return ((hash % 2000) - 1000) / 1000; // Normalize to [-1, 1]
          });

          return {
            object: 'embedding',
            embedding: vector,
            index: index,
          };
        });

        return {
          object: 'list',
          data: embeddings,
          model: model,
          usage: {
            prompt_tokens: texts.reduce((acc: number, text: string) => acc + text.length / 4, 0),
            total_tokens: texts.reduce((acc: number, text: string) => acc + text.length / 4, 0),
          },
        };
      } catch (error) {
        fastify.log.error('Error in embeddings:', error);
        reply.code(500);
        return createOpenAIError(
          error instanceof Error ? error.message : 'Internal server error',
          'internal_error'
        );
      }
    }
  );

  // GitHub webhook endpoint

  fastify.post(
    '/github/webhook',
    async (request: FastifyRequest<{ Body: GitHubWebhookBody }>, reply: FastifyReply) => {
      try {
        const { body } = request;
        const event = request.headers['x-github-event'] as string;

        // Log GitHub webhook for debugging
        fastify.log.info(`GitHub webhook: ${event}`, body);

        // Handle different GitHub events
        if (event === 'pull_request' && body.action === 'opened') {
          await handlePullRequestOpened(body, fastify);
        } else if (event === 'issue_comment' && body.comment) {
          await handleIssueComment(body, fastify);
        } else if (event === 'pull_request_review_comment' && body.comment) {
          await handlePullRequestComment(body, fastify);
        }

        return { status: 'ok', event, action: body.action };
      } catch (error) {
        fastify.log.error('GitHub webhook error:', error);
        reply.code(500);
        return { error: 'Webhook processing failed' };
      }
    }
  );

  // GitHub analyze endpoint (manual trigger)
  interface GitHubAnalyzeBody {
    repo: string;
    pr_number?: number;
    issue_number?: number;
    content?: string;
  }

  fastify.post(
    '/github/analyze',
    async (request: FastifyRequest<{ Body: GitHubAnalyzeBody }>, reply: FastifyReply) => {
      try {
        const { repo, pr_number, issue_number, content } = request.body;

        if (!repo) {
          reply.code(400);
          return { error: 'Repository name is required' };
        }

        // Analyze content using Claude
        const analysis = await analyzeWithClaude(content || 'Analyze this repository', fastify);

        return {
          status: 'success',
          repo,
          pr_number,
          issue_number,
          analysis,
        };
      } catch (error) {
        fastify.log.error('GitHub analyze error:', error);
        reply.code(500);
        return { error: 'Analysis failed' };
      }
    }
  );

  // Prometheus metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    const accept = request.headers.accept || '';

    if (accept.includes('application/openmetrics-text') || accept.includes('text/plain')) {
      // Return Prometheus format
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return formatPrometheusMetrics(metricsCollector.getMetrics());
    } else {
      // Return JSON format
      return {
        service: 'cynosure-bridge',
        version: process.env.npm_package_version || '1.0.0',
        system: metricsCollector.getSystemMetrics(),
        endpoints: metricsCollector.getMetrics(),
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Debug metrics endpoint
  fastify.get('/debug/metrics', async (_request, _reply) => {
    return {
      service: 'cynosure-bridge',
      system: metricsCollector.getSystemMetrics(),
      health: metricsCollector.getHealthStatus(),
      endpoints: metricsCollector.getMetrics(),
      timestamp: new Date().toISOString(),
    };
  });

  // Legacy completions endpoint (for compatibility)
  fastify.post('/v1/completions', async (_request, reply) => {
    reply.code(400);
    return createOpenAIError(
      'Legacy completions endpoint not supported. Use /v1/chat/completions instead.',
      'deprecated_endpoint'
    );
  });
}

interface ApiQuery {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

interface GitHubWebhookBody {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    body?: string;
    head: { sha: string };
    base: { ref: string };
    html_url: string;
  };
  issue?: {
    number: number;
    title: string;
    body?: string;
    html_url: string;
  };
  comment?: {
    body: string;
    html_url: string;
    user: { login: string };
  };
  repository?: {
    full_name: string;
    html_url: string;
  };
}

async function handleNonStreamingRequest(
  claudeClient: ClaudeApiClient,
  apiQuery: ApiQuery,
  _originalModel: string,
  _reply: FastifyReply
): Promise<OpenAIChatCompletionResponse> {
  const claudeResponse = await claudeClient.query(apiQuery);

  // Return the response (already in OpenAI format from the new client)
  return claudeResponse;
}

async function handleStreamingRequest(
  claudeClient: ClaudeApiClient,
  apiQuery: ApiQuery,
  originalModel: string,
  reply: FastifyReply
): Promise<void> {
  // Set headers for SSE
  reply.raw.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  try {
    for await (const chunkData of claudeClient.stream(apiQuery)) {
      const sseData = formatSSE(chunkData);
      reply.raw.write(sseData);
    }

    // Send final chunk
    const finalChunk: OpenAIChatCompletionChunk = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: originalModel,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };

    reply.raw.write(formatSSE(finalChunk));
    reply.raw.write('data: [DONE]\n\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Streaming error';
    reply.raw.write(formatSSE(createOpenAIError(errorMessage, 'streaming_error')));
  }

  reply.raw.end();
}

// Simple hash function for deterministic embeddings
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// GitHub webhook handlers
async function handlePullRequestOpened(
  body: GitHubWebhookBody,
  fastify: FastifyInstance
): Promise<void> {
  if (!body.pull_request || !body.repository) return;

  const { pull_request: pr, repository: repo } = body;
  fastify.log.info(`PR opened: ${repo.full_name}#${pr.number}`);

  // Auto-analyze PR if it contains certain keywords
  const autoTriggers = ['@claude', '/review', 'please review'];
  const shouldAnalyze = autoTriggers.some(
    trigger =>
      pr.title.toLowerCase().includes(trigger) ||
      (pr.body && pr.body.toLowerCase().includes(trigger))
  );

  if (shouldAnalyze) {
    const analysis = await analyzeWithClaude(
      `Analyze this pull request: ${pr.title}\n\n${pr.body || ''}`,
      fastify
    );
    fastify.log.info(`Auto-analysis completed for PR #${pr.number}:`, analysis);
  }
}

async function handleIssueComment(
  body: GitHubWebhookBody,
  fastify: FastifyInstance
): Promise<void> {
  if (!body.comment || !body.issue) return;

  const comment = body.comment.body;
  const triggers = ['@claude', '/analyze', '/review'];

  if (triggers.some(trigger => comment.includes(trigger))) {
    const analysis = await analyzeWithClaude(comment, fastify);
    fastify.log.info(`Issue comment analysis:`, analysis);
  }
}

async function handlePullRequestComment(
  body: GitHubWebhookBody,
  fastify: FastifyInstance
): Promise<void> {
  if (!body.comment) return;

  const comment = body.comment.body;
  const triggers = ['@claude', '/analyze', '/review'];

  if (triggers.some(trigger => comment.includes(trigger))) {
    const analysis = await analyzeWithClaude(comment, fastify);
    fastify.log.info(`PR comment analysis:`, analysis);
  }
}

async function analyzeWithClaude(content: string, fastify: FastifyInstance): Promise<string> {
  try {
    // Use Claude to analyze the content
    const claudeConfig = {
      apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-cli',
      model: 'claude-3-5-sonnet-20241022',
      workingDirectory: process.env.WORKING_DIRECTORY || process.cwd(),
      maxTurns: 3,
      timeout: 60000,
    };

    const claudeClient = new ClaudeApiClient(claudeConfig);

    const response = await claudeClient.query({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Please analyze this GitHub content:\n\n${content}`,
        },
      ],
      max_tokens: 1000,
    });

    const responseContent = response.choices[0]?.message?.content;
    return typeof responseContent === 'string' ? responseContent : 'Analysis completed';
  } catch (error) {
    fastify.log.error('Claude analysis error:', error);
    return 'Analysis failed';
  }
}
