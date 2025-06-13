/**
 * Claude API Client with fallback support
 * Supports both Claude MAX and direct Anthropic API
 */

import { Anthropic } from '@anthropic-ai/sdk';
import {
  ClaudeCodeQuery,
  ClaudeCodeResponse,
  ClaudeCodeMessage,
  ClaudeCodeConfig,
} from '../models/claude.js';
import { OpenAIChatCompletionResponse } from '../models/openai.js';
import { generateId, estimateTokenCount } from '../utils/helpers.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

interface ApiQuery {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

export class ClaudeApiClient {
  private config: ClaudeCodeConfig;
  private anthropic?: Anthropic;
  private useDirectApi: boolean;

  constructor(config: ClaudeCodeConfig) {
    this.config = config;
    this.useDirectApi = !!config.apiKey;

    if (this.useDirectApi && config.apiKey) {
      console.log('🔑 Initializing direct Anthropic API client...');
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
      });
    } else {
      console.log('💻 Using Claude CLI for MAX subscription...');
    }
  }

  async query(request: ApiQuery): Promise<OpenAIChatCompletionResponse> {
    console.log(`🤖 Processing query with ${this.useDirectApi ? 'API' : 'CLI'} method...`);

    try {
      if (this.useDirectApi && this.anthropic) {
        return await this.queryDirectApi(request);
      } else {
        return await this.queryClaude(request);
      }
    } catch (error: unknown) {
      console.log('❌ Primary method failed, trying fallback...');
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Fallback: if CLI failed, try API (if available)
      if (!this.useDirectApi && this.config.apiKey) {
        console.log('🔄 Falling back to direct API...');
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey,
        });
        return await this.queryDirectApi(request);
      }
      
      // Fallback: if API failed, try CLI (if no specific API key error)
      if (this.useDirectApi && !errorMessage.includes('credit')) {
        console.log('🔄 Falling back to Claude CLI...');
        return await this.queryClaude(request);
      }

      throw error;
    }
  }

  private async queryDirectApi(request: ApiQuery): Promise<OpenAIChatCompletionResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    console.log('📡 Sending request to Anthropic API...');

    // Convert messages to Anthropic format
    const messages = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));

    const response = await this.anthropic.messages.create({
      model: this.mapModel(request.model),
      max_tokens: request.max_tokens || 2048,
      temperature: request.temperature || 0.7,
      messages: messages as any,
    });

    // Convert back to OpenAI format
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic API');
    }

    return {
      id: generateId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content.text,
          },
          finish_reason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      system_fingerprint: 'anthropic-api',
    };
  }

  private async queryClaude(request: ApiQuery): Promise<OpenAIChatCompletionResponse> {
    console.log('🖥️ Using Claude CLI execution...');

    // Create prompt from messages
    const prompt = request.messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Create temporary file to avoid shell escaping issues
    const tempFile = path.join(tmpdir(), `claude_prompt_${Math.random().toString(36).substring(7)}.txt`);
    await writeFile(tempFile, prompt, 'utf8');

    try {
      // Execute Claude CLI
      const claudePath = process.env.CLAUDE_PATH || '/Users/laptop/.claude/local/claude';
      const command = `${claudePath} -p --output-format json < "${tempFile}"`;

      console.log('🔄 Executing Claude CLI...');
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          // Set working directory if specified
          ...(this.config.workingDirectory && { PWD: this.config.workingDirectory }),
        },
      });

      // Parse Claude response
      let claudeResult;
      try {
        claudeResult = JSON.parse(stdout);
      } catch (parseError) {
        console.log('📄 Raw Claude output:', stdout);
        throw new Error(`Failed to parse Claude response: ${parseError}`);
      }

      // Check for errors
      if (claudeResult.is_error) {
        throw new Error(`Claude CLI error: ${claudeResult.result}`);
      }

      const content = claudeResult.result || 'No response from Claude';
      const tokenCount = estimateTokenCount(content);

      return {
        id: generateId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: Math.floor(tokenCount * 0.7), // Estimate
          completion_tokens: tokenCount,
          total_tokens: Math.floor(tokenCount * 1.7),
        },
        system_fingerprint: claudeResult.session_id || 'claude-cli',
      };
    } finally {
      // Cleanup temp file
      try {
        await unlink(tempFile);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
      }
    }
  }

  private mapModel(openAiModel: string): string {
    const modelMappings: Record<string, string> = {
      'gpt-4': 'claude-3-opus-20240229',
      'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
      'gpt-3.5-turbo': 'claude-3-haiku-20240307',
      'gpt-4o': 'claude-3-5-sonnet-20241022',
      'gpt-4o-mini': 'claude-3-haiku-20240307',
    };

    return modelMappings[openAiModel] || 'claude-3-5-sonnet-20241022';
  }

  async *stream(request: ApiQuery): AsyncGenerator<string, void, unknown> {
    // For streaming, we'll use the regular query and yield the result
    // This is a simplified implementation - full streaming would require different API calls
    const response = await this.query(request);
    const content = response.choices[0]?.message?.content || '';
    
    // Simulate streaming by yielding chunks
    const chunks = content.split(' ');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i] + (i < chunks.length - 1 ? ' ' : '');
      yield JSON.stringify({
        id: response.id,
        object: 'chat.completion.chunk',
        created: response.created,
        model: response.model,
        choices: [
          {
            index: 0,
            delta: {
              content: chunk,
            },
            finish_reason: i === chunks.length - 1 ? 'stop' : null,
          },
        ],
      });
    }
  }
}