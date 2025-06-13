/**
 * Security and Rate Limiting Utilities
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

interface ClientInfo {
  requests: number[];
  blocked: boolean;
  blockedUntil?: number;
}

class RateLimiter {
  private clients: Map<string, ClientInfo> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  checkLimit(clientId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const client = this.clients.get(clientId) || { requests: [], blocked: false };

    // Check if client is blocked
    if (client.blocked && client.blockedUntil && now < client.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: client.blockedUntil,
      };
    }

    // Reset block status if time has passed
    if (client.blocked && client.blockedUntil && now >= client.blockedUntil) {
      client.blocked = false;
      client.blockedUntil = undefined;
      client.requests = [];
    }

    // Remove old requests outside the window
    const windowStart = now - this.config.windowMs;
    client.requests = client.requests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (client.requests.length >= this.config.maxRequests) {
      client.blocked = true;
      client.blockedUntil = now + this.config.windowMs;
      this.clients.set(clientId, client);

      return {
        allowed: false,
        remaining: 0,
        resetTime: client.blockedUntil,
      };
    }

    // Add current request
    client.requests.push(now);
    this.clients.set(clientId, client);

    return {
      allowed: true,
      remaining: this.config.maxRequests - client.requests.length,
      resetTime: windowStart + this.config.windowMs,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      // Remove clients that haven't made requests recently and aren't blocked
      const lastRequest = Math.max(...client.requests, 0);
      const timeSinceLastRequest = now - lastRequest;

      if (!client.blocked && timeSinceLastRequest > this.config.windowMs * 2) {
        this.clients.delete(clientId);
      }
    }
  }

  getStats(): { totalClients: number; blockedClients: number } {
    let blockedClients = 0;
    for (const client of this.clients.values()) {
      if (client.blocked) blockedClients++;
    }

    return {
      totalClients: this.clients.size,
      blockedClients,
    };
  }
}

// API Key validation
export function validateApiKey(apiKey: string | undefined, allowedKeys?: string[]): boolean {
  if (!apiKey) return false;

  // Remove 'Bearer ' prefix if present
  const cleanKey = apiKey.replace(/^Bearer\s+/i, '');

  // If no specific keys are configured, allow dummy keys for Claude MAX usage
  if (!allowedKeys || allowedKeys.length === 0) {
    return cleanKey.length > 0;
  }

  return allowedKeys.includes(cleanKey);
}

// Get client identifier for rate limiting
export function getClientId(request: any): string {
  // Try to get client IP from various headers
  const forwarded = request.headers['x-forwarded-for'];
  const realIp = request.headers['x-real-ip'];
  const clientIp = request.headers['cf-connecting-ip']; // Cloudflare

  let ip = request.ip;

  if (forwarded) {
    ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
  } else if (realIp) {
    ip = Array.isArray(realIp) ? realIp[0] : realIp;
  } else if (clientIp) {
    ip = Array.isArray(clientIp) ? clientIp[0] : clientIp;
  }

  return ip?.trim() || 'unknown';
}

// Content validation
export function validateRequestContent(content: any): { valid: boolean; reason?: string } {
  if (!content) {
    return { valid: false, reason: 'Empty content' };
  }

  if (typeof content === 'string') {
    // Check for basic content issues
    if (content.length > 50000) {
      return { valid: false, reason: 'Content too long' };
    }

    // Basic malicious content detection
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\.cookie/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { valid: false, reason: 'Potentially malicious content detected' };
      }
    }
  }

  return { valid: true };
}

// CORS configuration helper
export function createCorsConfig(allowedOrigins?: string[]) {
  if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
  }

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
}

// Create rate limiting middleware
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);

  return async (request: any, reply: any) => {
    const clientId = getClientId(request);
    const result = limiter.checkLimit(clientId);

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      reply.code(429);
      throw new Error(config.message || 'Rate limit exceeded');
    }
  };
}

// Create authentication middleware
export function createAuthMiddleware(allowedKeys?: string[]) {
  return async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;

    if (!validateApiKey(authHeader, allowedKeys)) {
      reply.code(401);
      throw new Error('Invalid API key');
    }
  };
}

export { RateLimiter };
