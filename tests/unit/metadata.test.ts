/**
 * Metadata Parsing Tests
 */

import { describe, it, expect } from 'vitest';
import { ClaudeApiClient } from '../../src/claude/api-client.js';

describe('Claude Metadata Parsing', () => {
  describe('parseClaudeMetadata', () => {
    const client = new ClaudeApiClient({
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      workingDirectory: '/tmp',
      maxTurns: 5,
      timeout: 60000,
    });

    // Access private method for testing
    const parseMetadata = (client as any).parseClaudeMetadata.bind(client);

    it('should parse session ID from stderr', () => {
      const stderr = 'Session ID: abc123-def456-ghi789\nOther output';
      const metadata = parseMetadata(stderr);

      expect(metadata.sessionId).toBe('abc123-def456-ghi789');
    });

    it('should parse cost information', () => {
      const stderr = 'Cost: $0.025\nSession completed';
      const metadata = parseMetadata(stderr);

      expect(metadata.cost).toBe(0.025);
    });

    it('should parse duration', () => {
      const stderr = 'Duration: 2.5s\nResponse generated';
      const metadata = parseMetadata(stderr);

      expect(metadata.duration).toBe(2.5);
    });

    it('should parse token counts', () => {
      const stderr = '150 prompt + 75 completion = 225 tokens\nDone';
      const metadata = parseMetadata(stderr);

      expect(metadata.promptTokens).toBe(150);
      expect(metadata.completionTokens).toBe(75);
      expect(metadata.totalTokens).toBe(225);
    });

    it('should parse all metadata from complex stderr', () => {
      const stderr = `
Claude Code response generated successfully.

Session ID: session-123-abc
Duration: 3.2s
Cost: $0.015
Token usage: 200 prompt + 100 completion = 300 tokens

Response completed.
      `;

      const metadata = parseMetadata(stderr);

      expect(metadata.sessionId).toBe('session-123-abc');
      expect(metadata.duration).toBe(3.2);
      expect(metadata.cost).toBe(0.015);
      expect(metadata.promptTokens).toBe(200);
      expect(metadata.completionTokens).toBe(100);
      expect(metadata.totalTokens).toBe(300);
    });

    it('should handle missing metadata gracefully', () => {
      const stderr = 'Some unrelated output\nNo metadata here';
      const metadata = parseMetadata(stderr);

      expect(metadata.sessionId).toBeUndefined();
      expect(metadata.cost).toBeUndefined();
      expect(metadata.duration).toBeUndefined();
      expect(metadata.promptTokens).toBeUndefined();
      expect(metadata.completionTokens).toBeUndefined();
      expect(metadata.totalTokens).toBeUndefined();
    });

    it('should handle empty stderr', () => {
      const stderr = '';
      const metadata = parseMetadata(stderr);

      expect(metadata).toEqual({});
    });

    it('should parse case-insensitive patterns', () => {
      const stderr = `
session id: SESSION-456-DEF
COST: $0.05
duration: 1.8S
      `;

      const metadata = parseMetadata(stderr);

      expect(metadata.sessionId).toBe('SESSION-456-DEF');
      expect(metadata.cost).toBe(0.05);
      expect(metadata.duration).toBe(1.8);
    });

    it('should handle malformed token counts', () => {
      const stderr = 'Invalid token format: abc prompt + def completion = xyz tokens';
      const metadata = parseMetadata(stderr);

      expect(metadata.promptTokens).toBeUndefined();
      expect(metadata.completionTokens).toBeUndefined();
      expect(metadata.totalTokens).toBeUndefined();
    });

    it('should parse decimal costs correctly', () => {
      const stderr = 'Cost: $0.0025\nVery small cost';
      const metadata = parseMetadata(stderr);

      expect(metadata.cost).toBe(0.0025);
    });

    it('should parse costs without dollar sign', () => {
      const stderr = 'Cost: 0.15\nNo currency symbol';
      const metadata = parseMetadata(stderr);

      expect(metadata.cost).toBe(0.15);
    });
  });
});
