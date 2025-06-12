/**
 * Claude Code SDK Types
 * Types for integrating with Claude Code SDK
 */

export interface ClaudeCodeQuery {
  prompt: string;
  options?: {
    maxTurns?: number;
    systemPrompt?: string;
    allowedMcpServers?: string[];
    workingDirectory?: string;
  };
}

export interface ClaudeCodeMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'error';
  content: string;
  tool?: {
    name: string;
    input: any;
    output?: any;
  };
  timestamp: number;
}

export interface ClaudeCodeResponse {
  messages: ClaudeCodeMessage[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  conversationId: string;
  finished: boolean;
}

export interface ClaudeCodeConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  mcpServers?: Record<string, MCPServerConfig>;
  workingDirectory?: string;
  maxTurns?: number;
  timeout?: number;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export const MODEL_MAPPING: Record<string, string> = {
  'gpt-4': 'claude-3-opus-20240229',
  'gpt-4-turbo': 'claude-3-sonnet-20240229',
  'gpt-4-turbo-preview': 'claude-3-sonnet-20240229',
  'gpt-4-0125-preview': 'claude-3-sonnet-20240229',
  'gpt-4-1106-preview': 'claude-3-sonnet-20240229',
  'gpt-3.5-turbo': 'claude-3-haiku-20240307',
  'gpt-3.5-turbo-0125': 'claude-3-haiku-20240307',
  'gpt-3.5-turbo-1106': 'claude-3-haiku-20240307',
  'gpt-4o': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini': 'claude-3-5-haiku-20241022',
  'gpt-4o-2024-05-13': 'claude-3-5-sonnet-20241022',
  'gpt-4o-2024-08-06': 'claude-3-5-sonnet-20241022',
  'gpt-4o-mini-2024-07-18': 'claude-3-5-haiku-20241022',
};

export const REVERSE_MODEL_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_MAPPING).map(([k, v]) => [v, k])
);

export function mapOpenAIModelToClaude(openaiModel: string): string {
  return MODEL_MAPPING[openaiModel] || 'claude-3-sonnet-20240229';
}

export function mapClaudeModelToOpenAI(claudeModel: string): string {
  return REVERSE_MODEL_MAPPING[claudeModel] || 'gpt-4-turbo';
}