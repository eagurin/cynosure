/**
 * Utility functions for Cynosure Bridge
 */

import { randomBytes } from 'crypto';

/**
 * Generate OpenAI-compatible ID
 */
export function generateId(prefix: string = 'chatcmpl'): string {
  const randomSuffix = randomBytes(12).toString('base64')
    .replace(/[+/]/g, '')
    .substring(0, 16);
  return `${prefix}-${randomSuffix}`;
}

/**
 * Create SSE (Server-Sent Events) formatted data
 */
export function formatSSE(data: any, event?: string): string {
  const lines: string[] = [];
  
  if (event) {
    lines.push(`event: ${event}`);
  }
  
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push(''); // Empty line to separate events
  
  return lines.join('\n');
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): void {
  const required = ['ANTHROPIC_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Create error response in OpenAI format
 */
export function createOpenAIError(
  message: string, 
  type: string = 'invalid_request_error',
  param?: string,
  code?: string
) {
  return {
    error: {
      message,
      type,
      param,
      code
    }
  };
}

/**
 * Sanitize and validate model name
 */
export function sanitizeModelName(model: string): string {
  // Remove any potentially dangerous characters
  return model.replace(/[^a-zA-Z0-9\-._]/g, '');
}

/**
 * Check if string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {} as any, source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }
  
  return result;
}