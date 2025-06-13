import { describe, it, expect } from 'vitest';
import { 
  generateId, 
  estimateTokenCount, 
  formatSSE,
  createOpenAIError,
  sanitizeModelName,
  mapModelToClaud,
  MODEL_MAPPINGS,
  EMBEDDING_MODELS,
  safeJsonParse,
  isValidJSON,
  deepMerge,
  throttle,
  debounce
} from '../../src/utils/helpers.js';

describe('Helpers Unit Tests', () => {
  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');

      expect(id1).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id2).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should use default prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^chatcmpl-[a-zA-Z0-9]+$/);
    });

    it('should generate IDs of consistent format', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      
      // IDs should have same format but different values
      expect(id1).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id2).toMatch(/^test-[a-zA-Z0-9]+$/);
      expect(id1.length).toBeGreaterThan(5);
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

    it('should estimate more tokens for longer text', () => {
      const shortCount = estimateTokenCount('Hi');
      const longCount = estimateTokenCount('This is a much longer sentence with many more words');
      
      expect(longCount).toBeGreaterThan(shortCount);
    });
  });

  describe('formatSSE', () => {
    it('should format SSE data correctly', () => {
      const data = { message: 'test' };
      const result = formatSSE(data);
      
      expect(result).toContain('data: {"message":"test"}');
      expect(result).toMatch(/\n$/);
    });

    it('should include event type when provided', () => {
      const data = { message: 'test' };
      const result = formatSSE(data, 'completion');
      
      expect(result).toContain('event: completion');
      expect(result).toContain('data: {"message":"test"}');
    });

    it('should handle null and undefined data', () => {
      expect(() => formatSSE(null)).not.toThrow();
      expect(() => formatSSE(undefined)).not.toThrow();
    });
  });

  describe('createOpenAIError', () => {
    it('should create error object with message', () => {
      const error = createOpenAIError('Test error');
      
      expect(error).toEqual({
        error: {
          message: 'Test error',
          type: 'invalid_request_error',
          param: undefined,
          code: undefined
        }
      });
    });

    it('should include custom type and parameters', () => {
      const error = createOpenAIError('Custom error', 'custom_type', 'param1', 'code1');
      
      expect(error).toEqual({
        error: {
          message: 'Custom error',
          type: 'custom_type',
          param: 'param1',
          code: 'code1'
        }
      });
    });
  });

  describe('sanitizeModelName', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeModelName('gpt-4; rm -rf');
      expect(result).toBe('gpt-4rm-rf'); // Only removes specific dangerous chars, not all special chars
    });

    it('should keep valid characters', () => {
      const result = sanitizeModelName('gpt-4-turbo_v1.0');
      expect(result).toBe('gpt-4-turbo_v1.0');
    });

    it('should handle empty string', () => {
      const result = sanitizeModelName('');
      expect(result).toBe('');
    });
  });

  describe('mapModelToClaud', () => {
    it('should map known OpenAI models to Claude', () => {
      expect(mapModelToClaud('gpt-4')).toBe('claude-3-5-sonnet-20241022');
      expect(mapModelToClaud('gpt-3.5-turbo')).toBe('claude-3-5-haiku-20241022');
      expect(mapModelToClaud('gpt-4o')).toBe('claude-3-5-sonnet-20241022');
    });

    it('should return original model for unknown models', () => {
      expect(mapModelToClaud('unknown-model')).toBe('unknown-model');
    });

    it('should handle empty string', () => {
      expect(mapModelToClaud('')).toBe('');
    });
  });

  describe('MODEL_MAPPINGS', () => {
    it('should contain all documented model mappings', () => {
      expect(MODEL_MAPPINGS).toHaveProperty('gpt-4');
      expect(MODEL_MAPPINGS).toHaveProperty('gpt-4-turbo');
      expect(MODEL_MAPPINGS).toHaveProperty('gpt-3.5-turbo');
      expect(MODEL_MAPPINGS).toHaveProperty('gpt-4o');
      expect(MODEL_MAPPINGS).toHaveProperty('gpt-4o-mini');
    });

    it('should map to valid Claude models', () => {
      Object.values(MODEL_MAPPINGS).forEach(claudeModel => {
        expect(claudeModel).toMatch(/^claude-/);
      });
    });
  });

  describe('EMBEDDING_MODELS', () => {
    it('should contain all embedding models with dimensions', () => {
      expect(EMBEDDING_MODELS).toHaveProperty('text-embedding-3-small');
      expect(EMBEDDING_MODELS).toHaveProperty('text-embedding-3-large');
      expect(EMBEDDING_MODELS).toHaveProperty('text-embedding-ada-002');
    });

    it('should have correct dimensions', () => {
      expect(EMBEDDING_MODELS['text-embedding-3-small']).toBe(1536);
      expect(EMBEDDING_MODELS['text-embedding-3-large']).toBe(3072);
      expect(EMBEDDING_MODELS['text-embedding-ada-002']).toBe(1536);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"test": "value"}', {});
      expect(result).toEqual({ test: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const fallback = { default: true };
      const result = safeJsonParse('invalid json', fallback);
      expect(result).toBe(fallback);
    });

    it('should return fallback for invalid string input', () => {
      const fallback = { default: true };
      expect(safeJsonParse('null' as any, fallback)).toBe(null); // Valid JSON
      expect(safeJsonParse('invalid' as any, fallback)).toBe(fallback);
    });
  });

  describe('isValidJSON', () => {
    it('should return true for valid JSON', () => {
      expect(isValidJSON('{"test": "value"}')).toBe(true);
      expect(isValidJSON('[]')).toBe(true);
      expect(isValidJSON('null')).toBe(true);
      expect(isValidJSON('42')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(isValidJSON('invalid json')).toBe(false);
      expect(isValidJSON('{"incomplete":')).toBe(false);
      expect(isValidJSON('{trailing comma,}')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isValidJSON('')).toBe(false);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = { a: { x: 1, y: 2 }, b: 1 };
      const source = { a: { y: 3, z: 4 }, c: 2 };
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ 
        a: { x: 1, y: 3, z: 4 }, 
        b: 1, 
        c: 2 
      });
    });

    it('should handle arrays by replacement', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ arr: [4, 5] });
    });

    it('should not mutate original objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = deepMerge(target, source);
      
      expect(target).toEqual({ a: 1 });
      expect(source).toEqual({ b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', (done) => {
      let callCount = 0;
      const throttled = throttle(() => callCount++, 100);
      
      throttled();
      throttled();
      throttled();
      
      expect(callCount).toBe(1);
      
      setTimeout(() => {
        throttled();
        expect(callCount).toBe(2);
        done();
      }, 150);
    });

    it('should preserve function context', () => {
      let result: number;
      const obj = {
        value: 42,
        getValue: throttle(function(this: any) { 
          result = this.value; 
          return this.value; 
        }, 50)
      };
      
      obj.getValue();
      expect(result!).toBe(42);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const debounced = debounce(() => callCount++, 100);
      
      debounced();
      debounced();
      debounced();
      
      expect(callCount).toBe(0);
      
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 150);
    });

    it('should reset timer on subsequent calls', (done) => {
      let callCount = 0;
      const debounced = debounce(() => callCount++, 100);
      
      debounced();
      
      setTimeout(() => {
        debounced(); // This should reset the timer
        expect(callCount).toBe(0);
      }, 50);
      
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 200);
    });
  });
});
