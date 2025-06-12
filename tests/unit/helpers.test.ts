import { describe, it, expect } from 'vitest';
import { generateId, estimateTokenCount } from '../../src/utils/helpers.js';

describe('helpers', () => {
  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');

      expect(id1).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id2).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for text', () => {
      const count = estimateTokenCount('Hello world');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should handle empty text', () => {
      const count = estimateTokenCount('');
      expect(count).toBe(0);
    });
  });
});
