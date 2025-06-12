/**
 * Translation layer: Claude Code SDK → OpenAI
 */

import { 
  OpenAIChatCompletionResponse, 
  OpenAIChatCompletionChunk,
  OpenAIChoice,
  OpenAIUsage,
  OpenAIMessage
} from '../models/openai.js';
import { ClaudeCodeResponse, ClaudeCodeMessage, mapClaudeModelToOpenAI } from '../models/claude.js';
import { generateId } from '../utils/helpers.js';

export function translateClaudeResponseToOpenAI(
  claudeResponse: ClaudeCodeResponse,
  originalModel: string,
  streaming: boolean = false
): OpenAIChatCompletionResponse {
  
  const openaiModel = mapClaudeModelToOpenAI(claudeResponse.model) || originalModel;
  const id = generateId();
  const created = Math.floor(Date.now() / 1000);
  
  // Combine all text messages into a single response
  const textMessages = claudeResponse.messages.filter(msg => msg.type === 'text');
  const combinedContent = textMessages.map(msg => msg.content).join('\n\n');
  
  const choice: OpenAIChoice = {
    index: 0,
    message: {
      role: 'assistant',
      content: combinedContent || 'No response generated.'
    },
    finish_reason: claudeResponse.finished ? 'stop' : 'length'
  };
  
  const usage: OpenAIUsage = {
    prompt_tokens: claudeResponse.usage?.inputTokens || 0,
    completion_tokens: claudeResponse.usage?.outputTokens || 0,
    total_tokens: claudeResponse.usage?.totalTokens || 0
  };
  
  return {
    id,
    object: 'chat.completion',
    created,
    model: openaiModel,
    choices: [choice],
    usage,
    system_fingerprint: `cynosure-${process.env.npm_package_version || '1.0.0'}`
  };
}

export function translateClaudeMessageToOpenAIChunk(
  message: ClaudeCodeMessage,
  model: string,
  conversationId: string,
  index: number = 0,
  isLast: boolean = false
): OpenAIChatCompletionChunk {
  
  const id = conversationId;
  const created = Math.floor(message.timestamp / 1000);
  
  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index,
      delta: {
        role: 'assistant',
        content: message.type === 'text' ? message.content : ''
      },
      finish_reason: isLast ? 'stop' : null
    }]
  };
}

export function createStreamingChunks(
  claudeResponse: ClaudeCodeResponse,
  originalModel: string
): OpenAIChatCompletionChunk[] {
  
  const openaiModel = mapClaudeModelToOpenAI(claudeResponse.model) || originalModel;
  const chunks: OpenAIChatCompletionChunk[] = [];
  
  const textMessages = claudeResponse.messages.filter(msg => msg.type === 'text');
  
  textMessages.forEach((message, index) => {
    const isLast = index === textMessages.length - 1;
    const chunk = translateClaudeMessageToOpenAIChunk(
      message,
      openaiModel,
      claudeResponse.conversationId,
      index,
      isLast
    );
    chunks.push(chunk);
  });
  
  // Add final chunk to signal completion
  if (chunks.length > 0) {
    const finalChunk: OpenAIChatCompletionChunk = {
      ...chunks[chunks.length - 1],
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };
    chunks.push(finalChunk);
  }
  
  return chunks;
}

export function formatToolUseMessages(messages: ClaudeCodeMessage[]): string {
  const toolMessages = messages.filter(msg => msg.type === 'tool_use' || msg.type === 'tool_result');
  
  if (toolMessages.length === 0) return '';
  
  const formatted = toolMessages.map(msg => {
    if (msg.type === 'tool_use') {
      return `Tool: ${msg.tool?.name}\nInput: ${JSON.stringify(msg.tool?.input, null, 2)}`;
    } else if (msg.type === 'tool_result') {
      return `Result: ${msg.content}`;
    }
    return '';
  }).filter(Boolean).join('\n\n');
  
  return formatted ? `\n\n--- Tool Usage ---\n${formatted}\n--- End Tool Usage ---\n\n` : '';
}