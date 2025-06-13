/**
 * Claude API Client with fallback support
 * Supports both Claude MAX and direct Anthropic API
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { ClaudeCodeConfig } from '../models/claude.js';
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
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
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
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
      });
    }
  }

  async query(request: ApiQuery): Promise<OpenAIChatCompletionResponse> {
    try {
      if (this.useDirectApi && this.anthropic) {
        return await this.queryDirectApi(request);
      } else {
        return await this.queryClaude(request);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Fallback: if CLI failed, try API (if available)
      if (!this.useDirectApi && this.config.apiKey) {
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey,
        });
        return await this.queryDirectApi(request);
      }

      // Fallback: if API failed, try CLI (if no specific API key error)
      if (this.useDirectApi && !errorMessage.includes('credit')) {
        return await this.queryClaude(request);
      }

      throw error;
    }
  }

  private async queryDirectApi(request: ApiQuery): Promise<OpenAIChatCompletionResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    // Convert messages to Anthropic format with vision support
    const messages = request.messages.map(msg => {
      let content: Anthropic.Messages.MessageParam['content'];

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        // Handle vision content
        content = msg.content.map(item => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text || '' };
          } else if (item.type === 'image_url' && item.image_url) {
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: item.image_url.url.startsWith('data:')
                  ? item.image_url.url.split(',')[1]
                  : item.image_url.url,
              },
            };
          }
          return { type: 'text', text: '' };
        });
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    });

    const response = await this.anthropic.messages.create({
      model: this.mapModel(request.model),
      max_tokens: request.max_tokens || 2048,
      temperature: request.temperature || 0.7,
      messages: messages as Anthropic.Messages.MessageParam[],
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
    // Create prompt from messages with vision support
    const prompt = request.messages
      .map(msg => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        let content: string;

        if (typeof msg.content === 'string') {
          content = msg.content;
        } else {
          // Handle vision content by extracting text parts
          content = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text || '')
            .join(' ');

          // Add note about images (Claude CLI doesn't support images directly)
          const imageCount = msg.content.filter(item => item.type === 'image_url').length;
          if (imageCount > 0) {
            content += ` [Note: ${imageCount} image(s) were included but cannot be processed by Claude CLI]`;
          }
        }

        return `${role}: ${content}`;
      })
      .join('\n\n');

    // Create temporary file to avoid shell escaping issues
    const tempFile = path.join(
      tmpdir(),
      `claude_prompt_${Math.random().toString(36).substring(7)}.txt`
    );
    await writeFile(tempFile, prompt, 'utf8');

    try {
      // Execute Claude CLI with enhanced metadata capture
      const claudePath = process.env.CLAUDE_PATH || '/Users/laptop/.claude/local/claude';
      const command = `${claudePath} -p --output-format json < "${tempFile}" 2>&1`;

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
        throw new Error(`Failed to parse Claude response: ${parseError}`);
      }

      // Check for errors
      if (claudeResult.is_error) {
        throw new Error(`Claude CLI error: ${claudeResult.result}`);
      }

      const content = claudeResult.result || 'No response from Claude';

      // Enhanced metadata parsing from stderr
      const metadata = this.parseClaudeMetadata(stderr || '');
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
          prompt_tokens: metadata.promptTokens || Math.floor(tokenCount * 0.7),
          completion_tokens: metadata.completionTokens || tokenCount,
          total_tokens: metadata.totalTokens || Math.floor(tokenCount * 1.7),
        },
        system_fingerprint: metadata.sessionId || claudeResult.session_id || 'claude-cli',
      };
    } finally {
      // Cleanup temp file
      try {
        await unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  private parseClaudeMetadata(stderr: string): {
    sessionId?: string;
    cost?: number;
    duration?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } {
    const metadata: any = {};

    // Parse session ID
    const sessionMatch = stderr.match(/Session ID:\s*([a-f0-9-]+)/i);
    if (sessionMatch) {
      metadata.sessionId = sessionMatch[1];
    }

    // Parse cost information
    const costMatch = stderr.match(/Cost: \$?([\d.]+)/i);
    if (costMatch) {
      metadata.cost = parseFloat(costMatch[1]);
    }

    // Parse duration
    const durationMatch = stderr.match(/Duration: ([\d.]+)s/i);
    if (durationMatch) {
      metadata.duration = parseFloat(durationMatch[1]);
    }

    // Parse token counts
    const tokenMatch = stderr.match(/(\d+) prompt \+ (\d+) completion = (\d+) tokens/i);
    if (tokenMatch) {
      metadata.promptTokens = parseInt(tokenMatch[1]);
      metadata.completionTokens = parseInt(tokenMatch[2]);
      metadata.totalTokens = parseInt(tokenMatch[3]);
    }

    return metadata;
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
    try {
      if (this.useDirectApi && this.anthropic) {
        yield* this.streamDirectApi(request);
      } else {
        yield* this.streamClaude(request);
      }
    } catch (error) {
      // Fallback to the other method if one fails
      if (this.useDirectApi) {
        yield* this.streamClaude(request);
      } else if (this.config.apiKey) {
        this.anthropic = new Anthropic({ apiKey: this.config.apiKey });
        yield* this.streamDirectApi(request);
      } else {
        throw error;
      }
    }
  }

  private async *streamDirectApi(request: ApiQuery): AsyncGenerator<string, void, unknown> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const messages = request.messages.map(msg => {
      let content: Anthropic.Messages.MessageParam['content'];

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        content = msg.content.map(item => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text || '' };
          } else if (item.type === 'image_url' && item.image_url) {
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: item.image_url.url.startsWith('data:')
                  ? item.image_url.url.split(',')[1]
                  : item.image_url.url,
              },
            };
          }
          return { type: 'text', text: '' };
        });
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    });

    const stream = await this.anthropic.messages.stream({
      model: this.mapModel(request.model),
      max_tokens: request.max_tokens || 2048,
      temperature: request.temperature || 0.7,
      messages: messages as Anthropic.Messages.MessageParam[],
    });

    const id = generateId();
    const created = Math.floor(Date.now() / 1000);

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {
                content: chunk.delta.text,
              },
              finish_reason: null,
            },
          ],
        });
      } else if (chunk.type === 'message_stop') {
        yield JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        });
      }
    }
  }

  private async *streamClaude(request: ApiQuery): AsyncGenerator<string, void, unknown> {
    // Create prompt from messages with vision support
    const prompt = request.messages
      .map(msg => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        let content: string;

        if (typeof msg.content === 'string') {
          content = msg.content;
        } else {
          content = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text || '')
            .join(' ');

          const imageCount = msg.content.filter(item => item.type === 'image_url').length;
          if (imageCount > 0) {
            content += ` [Note: ${imageCount} image(s) were included but cannot be processed by Claude CLI]`;
          }
        }

        return `${role}: ${content}`;
      })
      .join('\n\n');

    const tempFile = path.join(
      tmpdir(),
      `claude_prompt_${Math.random().toString(36).substring(7)}.txt`
    );
    await writeFile(tempFile, prompt, 'utf8');

    try {
      const claudePath = process.env.CLAUDE_PATH || '/Users/laptop/.claude/local/claude';
      const command = `${claudePath} -p --output-format stream-json < "${tempFile}"`;

      const { spawn } = await import('child_process');
      const claudeProcess = spawn('sh', ['-c', command], {
        env: {
          ...process.env,
          ...(this.config.workingDirectory && { PWD: this.config.workingDirectory }),
        },
      });

      const id = generateId();
      const created = Math.floor(Date.now() / 1000);

      let buffer = '';

      for await (const chunk of claudeProcess.stdout) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.is_error) {
                throw new Error(`Claude CLI error: ${data.result}`);
              }

              if (data.result) {
                yield JSON.stringify({
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model: request.model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: data.result,
                      },
                      finish_reason: data.finished ? 'stop' : null,
                    },
                  ],
                });
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              continue;
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (!data.is_error && data.result) {
            yield JSON.stringify({
              id,
              object: 'chat.completion.chunk',
              created,
              model: request.model,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: data.result,
                  },
                  finish_reason: 'stop',
                },
              ],
            });
          }
        } catch (parseError) {
          // Ignore final parse error
        }
      }
    } finally {
      try {
        await unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }
}
