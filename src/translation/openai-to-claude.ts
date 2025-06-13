/**
 * Translation layer: OpenAI → Claude Code SDK
 */

import { OpenAIChatCompletionRequest, OpenAIMessage } from '../models/openai.js';
import { ClaudeCodeQuery } from '../models/claude.js';
// import { mapOpenAIModelToClaude } from '../models/claude.js'; // Keeping for future use

export function translateOpenAIRequestToClaudeCode(
  request: OpenAIChatCompletionRequest
): ClaudeCodeQuery {
  // Extract system prompt if present
  const systemMessage = request.messages.find(msg => msg.role === 'system');
  const userMessages = request.messages.filter(msg => msg.role !== 'system');

  // Combine user messages into a single prompt
  const prompt = combineMessagesToPrompt(userMessages);

  // Map model from OpenAI to Claude
  // const claudeModel = mapOpenAIModelToClaude(request.model); // Keeping for future model mapping

  // Calculate maxTurns based on request parameters
  const maxTurns = calculateMaxTurns(request);

  return {
    prompt,
    options: {
      maxTurns,
      systemPrompt: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
      workingDirectory: process.cwd(),
    },
  };
}

function combineMessagesToPrompt(messages: OpenAIMessage[]): string {
  const parts: string[] = [];

  for (const message of messages) {
    const content =
      typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map(item => (item.type === 'text' ? item.text : '[Image]')).join(' ')
          : String(message.content);

    switch (message.role) {
      case 'user':
        parts.push(`Human: ${content}`);
        break;
      case 'assistant':
        parts.push(`Assistant: ${content}`);
        break;
      case 'function':
        parts.push(`Function ${message.name}: ${content}`);
        break;
    }
  }

  return parts.join('\n\n');
}

function calculateMaxTurns(request: OpenAIChatCompletionRequest): number {
  // Base maxTurns on conversation length and complexity
  const baseMaxTurns = 5;
  const messageCount = request.messages.length;

  // More messages = potentially more turns needed
  if (messageCount > 10) return 10;
  if (messageCount > 5) return 7;

  return baseMaxTurns;
}

export function extractStreamingConfig(request: OpenAIChatCompletionRequest): {
  streaming: boolean;
  maxTokens?: number;
  temperature?: number;
} {
  return {
    streaming: request.stream ?? false,
    maxTokens: request.max_tokens,
    temperature: request.temperature,
  };
}
