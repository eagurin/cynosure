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
import { formatSSE, createOpenAIError, sanitizeModelName, mapModelToClaud, EMBEDDING_MODELS } from '../utils/helpers.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: 'cynosure-bridge',
      version: process.env.npm_package_version || '1.0.0',
      claude_code_available: true,
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
                  content: { type: 'string' },
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

        // Create query for new API client
        const apiQuery = {
          model: body.model,
          messages: body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
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
  fastify.post('/v1/embeddings', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const { input, model = 'text-embedding-3-small' } = request.body as any;
      
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
          return (hash % 2000 - 1000) / 1000; // Normalize to [-1, 1]
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
  });

  // Metrics endpoint for monitoring
  fastify.get('/metrics', async (_request, _reply) => {
    return {
      service: 'cynosure-bridge',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      requests_total: 'N/A', // TODO: implement proper metrics
      errors_total: 'N/A',
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
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
