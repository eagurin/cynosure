/**
 * Security and Rate Limiting Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateApiKey,
  getClientId,
  validateRequestContent,
  RateLimiter,
} from '../../src/utils/security.js';

describe('Security Utils', () => {
  describe('validateApiKey', () => {
    it('should accept valid API key without Bearer prefix', () => {
      expect(validateApiKey('test-key-123')).toBe(true);
    });

    it('should accept valid API key with Bearer prefix', () => {
      expect(validateApiKey('Bearer test-key-123')).toBe(true);
    });

    it('should reject empty API key', () => {
      expect(validateApiKey('')).toBe(false);
      expect(validateApiKey(undefined)).toBe(false);
    });

    it('should validate against allowed keys list', () => {
      const allowedKeys = ['key1', 'key2', 'key3'];

      expect(validateApiKey('key1', allowedKeys)).toBe(true);
      expect(validateApiKey('Bearer key2', allowedKeys)).toBe(true);
      expect(validateApiKey('invalid-key', allowedKeys)).toBe(false);
    });

    it('should accept any key when no allowed list provided', () => {
      expect(validateApiKey('any-key')).toBe(true);
      expect(validateApiKey('random-string')).toBe(true);
    });
  });

  describe('getClientId', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
        ip: '127.0.0.1',
      };

      expect(getClientId(request)).toBe('192.168.1.100');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = {
        headers: {
          'x-real-ip': '192.168.1.200',
        },
        ip: '127.0.0.1',
      };

      expect(getClientId(request)).toBe('192.168.1.200');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const request = {
        headers: {
          'cf-connecting-ip': '192.168.1.300',
        },
        ip: '127.0.0.1',
      };

      expect(getClientId(request)).toBe('192.168.1.300');
    });

    it('should fall back to request.ip', () => {
      const request = {
        headers: {},
        ip: '127.0.0.1',
      };

      expect(getClientId(request)).toBe('127.0.0.1');
    });

    it('should handle missing IP gracefully', () => {
      const request = {
        headers: {},
        ip: undefined,
      };

      expect(getClientId(request)).toBe('unknown');
    });
  });

  describe('validateRequestContent', () => {
    it('should accept valid text content', () => {
      const result = validateRequestContent('Hello, this is a normal message');
      expect(result.valid).toBe(true);
    });

    it('should reject empty content', () => {
      const result = validateRequestContent('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Empty content');
    });

    it('should reject null/undefined content', () => {
      expect(validateRequestContent(null).valid).toBe(false);
      expect(validateRequestContent(undefined).valid).toBe(false);
    });

    it('should reject content that is too long', () => {
      const longContent = 'A'.repeat(60000);
      const result = validateRequestContent(longContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Content too long');
    });

    it('should reject malicious script content', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      const result = validateRequestContent(maliciousContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Potentially malicious content detected');
    });

    it('should reject javascript: urls', () => {
      const maliciousContent = 'Click here: javascript:alert("xss")';
      const result = validateRequestContent(maliciousContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Potentially malicious content detected');
    });

    it('should reject content with event handlers', () => {
      const maliciousContent = '<div onclick="alert()">Click me</div>';
      const result = validateRequestContent(maliciousContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Potentially malicious content detected');
    });

    it('should reject eval calls', () => {
      const maliciousContent = 'eval("malicious code")';
      const result = validateRequestContent(maliciousContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Potentially malicious content detected');
    });

    it('should reject document.cookie access', () => {
      const maliciousContent = 'document.cookie = "evil"';
      const result = validateRequestContent(maliciousContent);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Potentially malicious content detected');
    });
  });
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      message: 'Rate limit exceeded',
    });
  });

  it('should allow requests within limit', () => {
    const clientId = 'test-client-1';

    // First 5 requests should be allowed
    for (let i = 0; i < 5; i++) {
      const result = rateLimiter.checkLimit(clientId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it('should block requests exceeding limit', () => {
    const clientId = 'test-client-2';

    // Use up the allowed requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(clientId);
    }

    // Next request should be blocked
    const result = rateLimiter.checkLimit(clientId);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track different clients separately', () => {
    const client1 = 'test-client-3';
    const client2 = 'test-client-4';

    // Use up client1's requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(client1);
    }

    // Client1 should be blocked
    expect(rateLimiter.checkLimit(client1).allowed).toBe(false);

    // Client2 should still be allowed
    expect(rateLimiter.checkLimit(client2).allowed).toBe(true);
  });

  it('should reset after time window', async () => {
    // Use shorter window for testing
    const shortRateLimiter = new RateLimiter({
      windowMs: 100, // 100ms
      maxRequests: 2,
      message: 'Rate limit exceeded',
    });

    const clientId = 'test-client-5';

    // Use up the requests
    shortRateLimiter.checkLimit(clientId);
    shortRateLimiter.checkLimit(clientId);

    // Should be blocked
    expect(shortRateLimiter.checkLimit(clientId).allowed).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be allowed again
    expect(shortRateLimiter.checkLimit(clientId).allowed).toBe(true);
  });

  it('should provide correct stats', () => {
    const client1 = 'client-1';
    const client2 = 'client-2';

    // Make some requests
    rateLimiter.checkLimit(client1);
    rateLimiter.checkLimit(client2);

    // Block client1
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(client1);
    }

    const stats = rateLimiter.getStats();
    expect(stats.totalClients).toBe(2);
    expect(stats.blockedClients).toBe(1);
  });
});
