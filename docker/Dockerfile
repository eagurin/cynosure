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
RUN npm ci --only=production

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

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
RUN npm ci --only=production && npm cache clean --force

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy built application
COPY --from=build --chown=cynosure:nodejs /app/dist ./dist
COPY --from=build --chown=cynosure:nodejs /app/package.json ./package.json

# Switch to non-root user
USER cynosure

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]