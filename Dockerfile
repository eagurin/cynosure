# Cynosure Bridge Dockerfile
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --omit=dev

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
COPY . .
RUN npm ci
RUN npm run build

# Create a dummy Claude CLI for container
RUN mkdir -p /usr/local/bin && \
    echo -e '#!/bin/bash\necho "Claude CLI fallback in container"\necho "{\"result\": \"Hello from containerized Cynosure Bridge! Your request: $*\"}"' > /usr/local/bin/claude && \
    chmod +x /usr/local/bin/claude

# Production stage
FROM node:20-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cynosure -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=build --chown=cynosure:nodejs /app/dist ./dist
COPY --from=build --chown=cynosure:nodejs /app/package.json ./package.json

# Copy Claude CLI fallback and set permissions
COPY --from=build /usr/local/bin/claude /usr/local/bin/claude
RUN chmod +x /usr/local/bin/claude

# Create necessary directories with proper permissions
RUN mkdir -p /tmp && chown -R cynosure:nodejs /tmp
RUN chown -R cynosure:nodejs /app

# Set environment variables for container
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CLAUDE_CLI_PATH=/usr/local/bin/claude

# Switch to non-root user
USER cynosure

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]