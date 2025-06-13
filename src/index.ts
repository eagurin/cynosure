/**
 * Cynosure Bridge - Main Entry Point
 * Claude Code MAX Bridge with OpenAI API compatibility
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { registerRoutes } from './server/routes.js';
import { validateEnvironment } from './utils/helpers.js';

async function createServer() {
  // Validate environment variables
  try {
    validateEnvironment();
  } catch (error) {
    process.stderr.write(`❌ Environment validation failed: ${error}\n`);
    process.exit(1);
  }

  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Register Swagger for API documentation
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'Cynosure Bridge API',
          description: 'OpenAI-compatible API for Claude Code SDK',
          version: process.env.npm_package_version || '1.0.0',
        },
        host: `localhost:${process.env.PORT || 3000}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'chat', description: 'Chat completions endpoints' },
          { name: 'models', description: 'Available models' },
          { name: 'health', description: 'Health check' },
        ],
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });
  }

  // Register application routes
  await registerRoutes(fastify);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.statusCode && error.statusCode < 500) {
      reply.status(error.statusCode).send({
        error: {
          message: error.message,
          type: 'invalid_request_error',
          code: error.code,
        },
      });
    } else {
      reply.status(500).send({
        error: {
          message: 'Internal server error',
          type: 'internal_error',
        },
      });
    }
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        message: `Route ${request.method} ${request.url} not found`,
        type: 'not_found_error',
      },
    });
  });

  return fastify;
}

async function start() {
  try {
    const fastify = await createServer();

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    fastify.log.info(`
🚀 Cynosure Bridge is running!

📊 Server Info:
   • Port: ${port}
   • Host: ${host}
   • Environment: ${process.env.NODE_ENV || 'development'}
   • Version: ${process.env.npm_package_version || '1.0.0'}

🔗 Endpoints:
   • OpenAI API: http://${host}:${port}/v1/chat/completions
   • Health Check: http://${host}:${port}/health
   • Models: http://${host}:${port}/v1/models
   ${process.env.NODE_ENV !== 'production' ? `• API Docs: http://${host}:${port}/docs` : ''}

🎯 Usage:
   Set your OpenAI API base URL to: http://${host}:${port}/v1
   Use any OpenAI model name (gpt-4, gpt-3.5-turbo, etc.)
   
🧠 Powered by Claude Code SDK with MAX subscription
`);
  } catch (error) {
    process.stderr.write(`❌ Failed to start server: ${error}\n`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  process.stdout.write('\n🛑 Received SIGINT. Graceful shutdown...\n');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.stdout.write('\n🛑 Received SIGTERM. Graceful shutdown...\n');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  process.stderr.write(`💥 Uncaught Exception: ${error}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`💥 Unhandled Rejection at: ${promise} reason: ${reason}\n`);
  process.exit(1);
});

// Export build function for testing
export { createServer as build };

// Start the server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
