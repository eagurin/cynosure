/**
 * GitHub Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { build } from '../../src/index.js';

describe('GitHub Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /github/webhook', () => {
    it('should handle pull request opened event', async () => {
      const webhookData = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR @claude please review',
          body: 'This is a test PR body',
          head: { sha: 'abc123' },
          base: { ref: 'main' },
          html_url: 'https://github.com/test/repo/pull/123',
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/webhook',
        headers: {
          'x-github-event': 'pull_request',
          'content-type': 'application/json',
        },
        payload: webhookData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.event).toBe('pull_request');
      expect(body.action).toBe('opened');
    });

    it('should handle issue comment event', async () => {
      const webhookData = {
        action: 'created',
        issue: {
          number: 456,
          title: 'Test Issue',
          body: 'Issue body',
          html_url: 'https://github.com/test/repo/issues/456',
        },
        comment: {
          body: '@claude analyze this issue',
          html_url: 'https://github.com/test/repo/issues/456#comment',
          user: { login: 'testuser' },
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/webhook',
        headers: {
          'x-github-event': 'issue_comment',
          'content-type': 'application/json',
        },
        payload: webhookData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.event).toBe('issue_comment');
    });

    it('should handle unknown events gracefully', async () => {
      const webhookData = {
        action: 'unknown',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/webhook',
        headers: {
          'x-github-event': 'unknown_event',
          'content-type': 'application/json',
        },
        payload: webhookData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.event).toBe('unknown_event');
    });
  });

  describe('POST /github/analyze', () => {
    it('should analyze repository content', async () => {
      const analyzeData = {
        repo: 'test/repo',
        pr_number: 123,
        content: 'Analyze this code snippet: console.log("hello");',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/analyze',
        payload: analyzeData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('success');
      expect(body.repo).toBe('test/repo');
      expect(body.pr_number).toBe(123);
      expect(body.analysis).toBeDefined();
    });

    it('should require repo parameter', async () => {
      const analyzeData = {
        content: 'Some content to analyze',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/analyze',
        payload: analyzeData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Repository name is required');
    });

    it('should handle missing content with default', async () => {
      const analyzeData = {
        repo: 'test/repo',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/github/analyze',
        payload: analyzeData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('success');
      expect(body.analysis).toBeDefined();
    });
  });
});
