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
import { ClaudeCodeClient } from '../claude/client.js';
import { translateOpenAIRequestToClaudeCode } from '../translation/openai-to-claude.js';
import {
  translateClaudeResponseToOpenAI,
  // createStreamingChunks - unused, keeping for future streaming support
} from '../translation/claude-to-openai.js';
import { formatSSE, createOpenAIError, sanitizeModelName } from '../utils/helpers.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: 'cynosure-bridge',
      version: process.env.npm_package_version || '1.0.0',
      claude_code_available: true,
    };
  });

  // OpenAI-compatible models endpoint
  fastify.get('/v1/models', async (_request, _reply) => {
    return {
      object: 'list',
      data: [
        {
          id: 'gpt-4',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
        },
        {
          id: 'gpt-4-turbo',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
        },
        {
          id: 'gpt-3.5-turbo',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
        },
        {
          id: 'gpt-4o',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
        },
        {
          id: 'gpt-4o-mini',
          object: 'model',
          created: 1686935002,
          owned_by: 'cynosure',
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

        // Sanitize model name
        const sanitizedModel = sanitizeModelName(body.model);

        // Get Claude Code config from environment
        const claudeConfig = {
          apiKey: process.env.ANTHROPIC_API_KEY!,
          model: sanitizedModel,
          workingDirectory: process.env.WORKING_DIRECTORY || process.cwd(),
          maxTurns: parseInt(process.env.MAX_TURNS || '5'),
          timeout: parseInt(process.env.TIMEOUT || '300000'), // 5 minutes
        };

        // Initialize Claude Code client
        const claudeClient = new ClaudeCodeClient(claudeConfig);

        // Translate OpenAI request to Claude Code format
        const claudeQuery = translateOpenAIRequestToClaudeCode(body);

        // Handle streaming vs non-streaming
        if (body.stream) {
          return handleStreamingRequest(claudeClient, claudeQuery, body.model, reply);
        } else {
          return handleNonStreamingRequest(claudeClient, claudeQuery, body.model, reply);
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

  // Legacy completions endpoint (for compatibility)
  fastify.post('/v1/completions', async (request, reply) => {
    reply.code(400);
    return createOpenAIError(
      'Legacy completions endpoint not supported. Use /v1/chat/completions instead.',
      'deprecated_endpoint'
    );
  });
}

async function handleNonStreamingRequest(
  claudeClient: ClaudeCodeClient,
  claudeQuery: any,
  originalModel: string,
  reply: FastifyReply
): Promise<OpenAIChatCompletionResponse> {
  const claudeResponse = await claudeClient.execute(claudeQuery);

  // Check for errors in Claude response
  const errorMessages = claudeResponse.messages.filter(msg => msg.type === 'error');
  if (errorMessages.length > 0) {
    reply.code(500);
    throw new Error(`Claude Code error: ${errorMessages[0].content}`);
  }

  // Translate back to OpenAI format
  return translateClaudeResponseToOpenAI(claudeResponse, originalModel, false);
}

async function handleStreamingRequest(
  claudeClient: ClaudeCodeClient,
  claudeQuery: any,
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
    // let messageIndex = 0; // Keeping for future streaming enhancements

    for await (const message of claudeClient.executeStreaming(claudeQuery)) {
      if (message.type === 'error') {
        const errorChunk = formatSSE(createOpenAIError(message.content, 'claude_error'));
        reply.raw.write(errorChunk);
        break;
      }

      if (message.type === 'text' && message.content.trim()) {
        const chunk: OpenAIChatCompletionChunk = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: originalModel,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: message.content,
              },
              finish_reason: null,
            },
          ],
        };

        const sseData = formatSSE(chunk);
        reply.raw.write(sseData);
        // messageIndex++; // Keeping for future streaming enhancements
      }
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
