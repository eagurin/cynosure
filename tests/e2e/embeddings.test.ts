/**
 * Embeddings API End-to-End Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { build } from '../../src/index.js';

describe('Embeddings API E2E', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/embeddings', () => {
    it('should generate embeddings for single text input', async () => {
      const request = {
        model: 'text-embedding-3-small',
        input: 'Hello, world!',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.object).toBe('list');
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.data).toHaveLength(1);
      expect(body.data[0].object).toBe('embedding');
      expect(body.data[0].index).toBe(0);
      expect(body.data[0].embedding).toHaveLength(1536); // Default dimensions
      expect(Array.isArray(body.data[0].embedding)).toBe(true);
      expect(body.usage.prompt_tokens).toBeGreaterThan(0);
    });

    it('should generate embeddings for multiple text inputs', async () => {
      const request = {
        model: 'text-embedding-3-large',
        input: ['First text', 'Second text', 'Third text'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data).toHaveLength(3);
      expect(body.data[0].embedding).toHaveLength(3072); // Large model dimensions
      expect(body.data[1].embedding).toHaveLength(3072);
      expect(body.data[2].embedding).toHaveLength(3072);

      // Check indices are correct
      expect(body.data[0].index).toBe(0);
      expect(body.data[1].index).toBe(1);
      expect(body.data[2].index).toBe(2);
    });

    it('should handle ada-002 model (legacy)', async () => {
      const request = {
        model: 'text-embedding-ada-002',
        input: 'Legacy model test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.model).toBe('text-embedding-ada-002');
      expect(body.data[0].embedding).toHaveLength(1536);
    });

    it('should generate deterministic embeddings for same input', async () => {
      const input = 'This is a test for deterministic embeddings';
      const request = {
        model: 'text-embedding-3-small',
        input,
      };

      // Make first request
      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      // Make second request with same input
      const response2 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // Embeddings should be identical for same input
      expect(body1.data[0].embedding).toEqual(body2.data[0].embedding);
    });

    it('should generate different embeddings for different inputs', async () => {
      const request1 = {
        model: 'text-embedding-3-small',
        input: 'First unique text',
      };

      const request2 = {
        model: 'text-embedding-3-small',
        input: 'Second unique text',
      };

      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request1,
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request2,
      });

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // Embeddings should be different for different inputs
      expect(body1.data[0].embedding).not.toEqual(body2.data[0].embedding);
    });

    it('should validate required input field', async () => {
      const request = {
        model: 'text-embedding-3-small',
        // Missing required 'input' field
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Missing required field: input');
    });

    it('should handle empty string input', async () => {
      const request = {
        model: 'text-embedding-3-small',
        input: '',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data[0].embedding).toHaveLength(1536);
    });

    it('should handle very long text input', async () => {
      const longText = 'A'.repeat(10000); // 10k characters
      const request = {
        model: 'text-embedding-3-small',
        input: longText,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data[0].embedding).toHaveLength(1536);
      expect(body.usage.prompt_tokens).toBeGreaterThan(1000);
    });

    it('should handle unknown model with fallback', async () => {
      const request = {
        model: 'unknown-embedding-model',
        input: 'Test with unknown model',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data[0].embedding).toHaveLength(1536); // Default fallback
    });

    it('should normalize vector values to [-1, 1] range', async () => {
      const request = {
        model: 'text-embedding-3-small',
        input: 'Check vector value range',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: request,
      });

      const body = JSON.parse(response.body);
      const embedding = body.data[0].embedding;

      // All values should be in [-1, 1] range
      for (const value of embedding) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(typeof value).toBe('number');
      }
    });
  });
});
