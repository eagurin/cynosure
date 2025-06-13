/**
 * Vision Support Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { build } from '../../src/index.js';

describe('Vision Support', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/chat/completions with images', () => {
    it('should accept vision messages with text and image content', async () => {
      const visionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is in this image?',
              },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 100,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: visionRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.object).toBe('chat.completion');
      expect(body.choices).toHaveLength(1);
      expect(body.choices[0].message.content).toBeDefined();
    });

    it('should validate image_url structure', async () => {
      const invalidVisionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  // Missing required 'url' field
                  detail: 'high',
                },
              },
            ],
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: invalidVisionRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle mixed text and image content', async () => {
      const mixedContentRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First question: ' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
                },
              },
              { type: 'text', text: ' What do you see in this image?' },
            ],
          },
        ],
        max_tokens: 150,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: mixedContentRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.choices[0].message.content).toBeDefined();
    });

    it('should handle streaming with vision content', async () => {
      const streamingVisionRequest = {
        model: 'gpt-4',
        stream: true,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image briefly:' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
                },
              },
            ],
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: streamingVisionRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('data:');
    });

    it('should fallback gracefully when CLI cannot process images', async () => {
      const visionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              {
                type: 'image_url',
                image_url: {
                  url: 'https://example.com/image.jpg',
                },
              },
            ],
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        payload: visionRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.choices[0].message.content).toContain('cannot be processed by Claude CLI');
    });
  });
});
