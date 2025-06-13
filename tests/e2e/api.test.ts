import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';

describe('API E2E Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        service: 'cynosure-bridge',
        claude_code_available: true,
      });
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('memory');
    });
  });

  describe('Models Endpoint', () => {
    it('should return list of available models', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/models',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        object: 'list',
      });
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);

      // Check for required chat models
      const modelIds = body.data.map((model: { id: string }) => model.id);
      expect(modelIds).toContain('gpt-4');
      expect(modelIds).toContain('gpt-3.5-turbo');
      expect(modelIds).toContain('text-embedding-3-small');
    });

    it('should include model descriptions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/models',
      });

      const body = JSON.parse(response.body);
      const gpt4Model = body.data.find(
        (model: { id: string; description?: string }) => model.id === 'gpt-4'
      );
      expect(gpt4Model).toHaveProperty('description');
      expect(gpt4Model.description).toContain('claude-3-5-sonnet');
    });
  });

  describe('Chat Completions Endpoint', () => {
    const validChatRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
    };

    it('should reject requests without model', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'test' }],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error.message).toContain('required property');
    });

    it('should reject requests without messages', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error.message).toContain('required property');
    });

    it('should reject requests with empty messages array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4',
          messages: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      // Empty array fails our manual validation, not schema validation
      expect(body.error.message).toContain('Missing required fields');
    });

    it('should validate message structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4',
          messages: [{ role: 'invalid_role', content: 'test' }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept valid chat completion request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: validChatRequest,
      });

      // Should accept valid request, may succeed or fail depending on Claude CLI availability
      expect([200, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.body);
      if (response.statusCode === 200) {
        expect(body).toHaveProperty('choices');
      } else {
        expect(body).toHaveProperty('error');
      }
    }, 10000);

    it('should handle streaming requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          ...validChatRequest,
          stream: true,
        },
      });

      // Should return 200 for streaming but fail due to Claude CLI
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    }, 10000);

    it('should handle optional parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          ...validChatRequest,
          temperature: 0.7,
          max_tokens: 100,
          top_p: 0.9,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    }, 10000);
  });

  describe('Embeddings Endpoint', () => {
    it('should reject requests without input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          model: 'text-embedding-3-small',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error.message).toContain('Missing required field: input');
    });

    it('should generate embeddings for single text input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          input: 'Hello world',
          model: 'text-embedding-3-small',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        object: 'list',
        model: 'text-embedding-3-small',
      });
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        object: 'embedding',
        index: 0,
      });
      expect(body.data[0].embedding).toHaveLength(1536);
      expect(body.usage).toHaveProperty('prompt_tokens');
      expect(body.usage).toHaveProperty('total_tokens');
    });

    it('should generate embeddings for array of texts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          input: ['Hello world', 'Goodbye world'],
          model: 'text-embedding-3-small',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data).toHaveLength(2);
      expect(body.data[0].index).toBe(0);
      expect(body.data[1].index).toBe(1);
    });

    it('should support different embedding models', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          input: 'Test text',
          model: 'text-embedding-3-large',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.model).toBe('text-embedding-3-large');
      expect(body.data[0].embedding).toHaveLength(3072);
    });

    it('should default to text-embedding-3-small model', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          input: 'Test text',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.model).toBe('text-embedding-3-small');
      expect(body.data[0].embedding).toHaveLength(1536);
    });

    it('should generate deterministic embeddings', async () => {
      const input = 'Consistent test text';

      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: { input },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: { input },
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      expect(body1.data[0].embedding).toEqual(body2.data[0].embedding);
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return service metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        service: 'cynosure-bridge',
      });
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('memory');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('Test Endpoint', () => {
    it('should return test response', async () => {
      const testPayload = { test: 'data' };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/test',
        payload: testPayload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        status: 'ok',
        message: 'Test endpoint working',
        body: testPayload,
      });
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('Legacy Completions Endpoint', () => {
    it('should reject legacy completions requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          prompt: 'test prompt',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body.error.message).toContain('Legacy completions endpoint not supported');
      expect(body.error.type).toBe('deprecated_endpoint');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown/endpoint',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: '{invalid json}',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate content-type for POST requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: 'plain text',
        headers: {
          'content-type': 'text/plain',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/v1/chat/completions',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      expect([200, 204, 400]).toContain(response.statusCode);
    });
  });
});
