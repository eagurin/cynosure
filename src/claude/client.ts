/**
 * Claude Code SDK Client
 * Wrapper around @anthropic-ai/claude-code
 */

// Will be initialized lazily in constructor
import {
  ClaudeCodeQuery,
  ClaudeCodeResponse,
  ClaudeCodeMessage,
  ClaudeCodeConfig,
} from '../models/claude.js';
import { generateId, estimateTokenCount } from '../utils/helpers.js';

interface QueryOptions {
  prompt: string;
  stream: boolean;
  options?: {
    maxTurns?: number;
    systemPrompt?: string;
    workingDirectory?: string;
  };
}

interface QueryResult {
  type: string;
  content: string;
  timestamp: number;
  raw?: unknown;
}

export class ClaudeCodeClient {
  private config: ClaudeCodeConfig;
  private query: ((options: QueryOptions) => AsyncGenerator<QueryResult>) | null;

  constructor(config: ClaudeCodeConfig) {
    this.config = config;
    this.query = null;

    // Set environment variable for Claude Code SDK
    if (config.apiKey) {
      process.env.ANTHROPIC_API_KEY = config.apiKey;
    }

    if (config.workingDirectory) {
      process.chdir(config.workingDirectory);
    }
  }

  /**
   * Initialize Claude Code CLI execution
   */
  private async initializeQuery(): Promise<(options: QueryOptions) => AsyncGenerator<QueryResult>> {
    if (this.query) {
      return this.query;
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Claude CLI path - try local first, fallback to global
    const claudeCommand =
      process.env.CLAUDE_CLI_PATH || '/Users/laptop/.claude/local/claude' || 'claude';

    this.query = async function* (options: QueryOptions): AsyncGenerator<QueryResult> {
      try {
        // Executing Claude CLI with prompt

        // Create a temporary file for the prompt to avoid shell escaping issues
        const { writeFile, unlink } = await import('fs/promises');
        const { join } = await import('path');
        const { randomBytes } = await import('crypto');

        const tempFile = join('/tmp', `claude_prompt_${randomBytes(8).toString('hex')}.txt`);
        await writeFile(tempFile, options.prompt);

        // For streaming responses
        if (options.stream) {
          const { stdout, stderr } = await execAsync(
            `${claudeCommand} -p --output-format stream-json --verbose < "${tempFile}"`,
            {
              timeout: 60000,
              maxBuffer: 2 * 1024 * 1024, // 2MB buffer
              cwd: options.options?.workingDirectory || process.cwd(),
            }
          );

          // Clean up temp file
          await unlink(tempFile).catch(() => {});

          if (stderr && stderr.trim()) {
            // Claude CLI stderr output available (streaming)
          }

          if (stdout && stdout.trim()) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.type === 'assistant') {
                    yield {
                      type: 'text',
                      content: parsed.message.content[0]?.text || '',
                      timestamp: Date.now(),
                      raw: parsed,
                    };
                  }
                } catch (parseError) {
                  // Failed to parse line
                }
              }
            }
          }
        } else {
          // For non-streaming responses
          const { stdout, stderr } = await execAsync(
            `${claudeCommand} -p --output-format json < "${tempFile}"`,
            {
              timeout: 60000,
              maxBuffer: 2 * 1024 * 1024,
              cwd: options.options?.workingDirectory || process.cwd(),
            }
          );

          // Clean up temp file
          await unlink(tempFile).catch(() => {});

          if (stderr && stderr.trim()) {
            // Claude CLI stderr output available (non-streaming)
          }

          if (stdout && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout);
              yield {
                type: 'text',
                content: parsed.result || 'No response content',
                timestamp: Date.now(),
                raw: parsed,
              };
            } catch (parseError) {
              // Failed to parse Claude response
              yield {
                type: 'text',
                content: stdout.trim(),
                timestamp: Date.now(),
              };
            }
          } else {
            yield {
              type: 'text',
              content: 'Claude CLI executed but returned no output.',
              timestamp: Date.now(),
            };
          }
        }
      } catch (error: unknown) {
        // Claude CLI execution error occurred

        // Check if we have stdout even with error exit code
        if (
          error &&
          typeof error === 'object' &&
          'stdout' in error &&
          typeof error.stdout === 'string' &&
          error.stdout.trim()
        ) {
          try {
            const parsed = JSON.parse(error.stdout);
            if (parsed.result) {
              yield {
                type: 'text',
                content: parsed.result,
                timestamp: Date.now(),
                raw: parsed,
              };
              return;
            }
          } catch (parseError) {
            // If can't parse, fall through to error handling
          }
        }

        let errorMessage = 'Claude CLI execution failed';
        if (error instanceof Error) {
          errorMessage = error.message;

          if (errorMessage.includes('command not found')) {
            errorMessage = 'Claude CLI not found. Please ensure Claude Code is installed.';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Claude CLI request timed out. Please try again.';
          } else if (errorMessage.includes('Invalid API key')) {
            errorMessage =
              'Claude CLI returned an API key error, but execution completed. This might be expected for local usage.';
          }
        }

        yield {
          type: 'error',
          content: errorMessage,
          timestamp: Date.now(),
        };
      }
    };

    // Claude CLI execution method initialized
    return this.query;
  }

  /**
   * Execute Claude Code query
   */
  async execute(claudeQuery: ClaudeCodeQuery): Promise<ClaudeCodeResponse> {
    const conversationId = generateId('conv');
    const messages: ClaudeCodeMessage[] = [];

    try {
      // Initialize query function (SDK or CLI fallback)
      const queryFn = await this.initializeQuery();

      // Execute Claude Code query with proper error handling
      // const startTime = Date.now();

      const queryOptions = {
        prompt: claudeQuery.prompt,
        stream: false, // Non-streaming execution
        options: {
          maxTurns: claudeQuery.options?.maxTurns || this.config.maxTurns || 5,
          systemPrompt: claudeQuery.options?.systemPrompt,
          workingDirectory: this.config.workingDirectory || process.cwd(),
        },
      };

      for await (const message of queryFn(queryOptions)) {
        // Handle different message types from Claude Code SDK
        const claudeMessage: ClaudeCodeMessage = {
          type: this.determineMessageType(message),
          content: this.extractContent(message),
          timestamp: Date.now(),
        };

        // Extract tool information if present
        if (this.isToolMessage(message)) {
          claudeMessage.tool = this.extractToolInfo(message);
        }

        messages.push(claudeMessage);
      }

      // const endTime = Date.now();
      const totalContent = messages.map(m => m.content).join('\n');

      return {
        messages,
        usage: {
          inputTokens: estimateTokenCount(claudeQuery.prompt),
          outputTokens: estimateTokenCount(totalContent),
          totalTokens: estimateTokenCount(claudeQuery.prompt + totalContent),
        },
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        conversationId,
        finished: true,
      };
    } catch (error) {
      // Enhanced error handling for different types of errors
      let errorContent = 'Unknown error occurred';

      if (error instanceof Error) {
        errorContent = error.message;

        // Provide helpful error messages for common issues
        if (errorContent.includes('API key')) {
          errorContent =
            'Invalid or missing ANTHROPIC_API_KEY. Please check your API key configuration.';
        } else if (errorContent.includes('rate limit')) {
          errorContent = 'Rate limit exceeded. Please try again later.';
        } else if (errorContent.includes('network') || errorContent.includes('fetch')) {
          errorContent = 'Network error occurred. Please check your internet connection.';
        }
      }

      const errorMessage: ClaudeCodeMessage = {
        type: 'error',
        content: errorContent,
        timestamp: Date.now(),
      };

      return {
        messages: [errorMessage],
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        conversationId,
        finished: false,
      };
    }
  }

  /**
   * Execute streaming Claude Code query
   */
  async *executeStreaming(claudeQuery: ClaudeCodeQuery): AsyncGenerator<ClaudeCodeMessage> {
    try {
      // Initialize query function (SDK or CLI fallback)
      const queryFn = await this.initializeQuery();

      const queryOptions = {
        prompt: claudeQuery.prompt,
        stream: true, // Streaming execution
        options: {
          maxTurns: claudeQuery.options?.maxTurns || this.config.maxTurns || 5,
          systemPrompt: claudeQuery.options?.systemPrompt,
          workingDirectory: this.config.workingDirectory || process.cwd(),
        },
      };

      for await (const message of queryFn(queryOptions)) {
        const claudeMessage: ClaudeCodeMessage = {
          type: this.determineMessageType(message),
          content: this.extractContent(message),
          timestamp: Date.now(),
        };

        if (this.isToolMessage(message)) {
          claudeMessage.tool = this.extractToolInfo(message);
        }

        yield claudeMessage;
      }
    } catch (error) {
      let errorContent = 'Unknown error occurred';

      if (error instanceof Error) {
        errorContent = error.message;

        if (errorContent.includes('API key')) {
          errorContent =
            'Invalid or missing ANTHROPIC_API_KEY. Please check your API key configuration.';
        } else if (errorContent.includes('rate limit')) {
          errorContent = 'Rate limit exceeded. Please try again later.';
        } else if (errorContent.includes('network') || errorContent.includes('fetch')) {
          errorContent = 'Network error occurred. Please check your internet connection.';
        }
      }

      yield {
        type: 'error',
        content: errorContent,
        timestamp: Date.now(),
      };
    }
  }

  private determineMessageType(message: unknown): ClaudeCodeMessage['type'] {
    // Handle different message types from Claude Code SDK
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      typeof message.type === 'string'
    ) {
      switch (message.type) {
        case 'error':
        case 'stderr':
          return 'error';
        case 'tool_use':
        case 'tool_call':
          return 'tool_use';
        case 'tool_result':
        case 'tool_response':
          return 'tool_result';
        case 'text':
        case 'message':
        case 'assistant':
        default:
          return 'text';
      }
    }

    // Fallback to legacy detection
    if (message && typeof message === 'object') {
      if (('error' in message && message.error) || ('stderr' in message && message.stderr))
        return 'error';
      if (
        ('tool_use' in message && message.tool_use) ||
        ('tool_call' in message && message.tool_call)
      )
        return 'tool_use';
      if (
        ('tool_result' in message && message.tool_result) ||
        ('tool_response' in message && message.tool_response)
      )
        return 'tool_result';
    }
    return 'text';
  }

  private extractContent(message: unknown): string {
    // Handle different content formats from Claude Code SDK
    if (typeof message === 'string') return message;

    // Try different content fields
    if (message && typeof message === 'object' && 'content' in message) {
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content)) {
        return message.content
          .map((item: unknown) =>
            typeof item === 'string'
              ? item
              : item && typeof item === 'object' && 'text' in item
                ? item.text
                : JSON.stringify(item)
          )
          .join('\n');
      }
      return JSON.stringify(message.content);
    }

    if (message && typeof message === 'object') {
      if ('text' in message && typeof message.text === 'string') return message.text;
      if ('message' in message && typeof message.message === 'string') return message.message;
      if ('response' in message && typeof message.response === 'string') return message.response;
      if ('output' in message && typeof message.output === 'string') return message.output;
      if ('error' in message && typeof message.error === 'string') return message.error;
      if ('stderr' in message && typeof message.stderr === 'string') return message.stderr;

      // For tool messages, extract relevant information
      if ('tool_use' in message && message.tool_use) {
        const tool = message.tool_use;
        if (tool && typeof tool === 'object' && 'name' in tool) {
          return `Tool: ${tool.name}\nInput: ${JSON.stringify('input' in tool ? tool.input : {}, null, 2)}`;
        }
      }
      
      if ('tool_call' in message && message.tool_call) {
        const tool = message.tool_call;
        if (tool && typeof tool === 'object' && 'name' in tool) {
          return `Tool: ${tool.name}\nInput: ${JSON.stringify('arguments' in tool ? tool.arguments : {}, null, 2)}`;
        }
      }

      if ('tool_result' in message && message.tool_result) {
        const result = message.tool_result;
        if (result && typeof result === 'object') {
          if ('content' in result && typeof result.content === 'string') return result.content;
          if ('output' in result && typeof result.output === 'string') return result.output;
          return JSON.stringify(result);
        }
      }
      
      if ('tool_response' in message && message.tool_response) {
        const result = message.tool_response;
        if (result && typeof result === 'object') {
          if ('content' in result && typeof result.content === 'string') return result.content;
          if ('output' in result && typeof result.output === 'string') return result.output;
          return JSON.stringify(result);
        }
      }
    }

    // Default fallback
    return JSON.stringify(message);
  }

  private isToolMessage(message: unknown): boolean {
    if (message && typeof message === 'object') {
      return !!(
        ('tool_use' in message && message.tool_use) ||
        ('tool_call' in message && message.tool_call) ||
        ('tool_result' in message && message.tool_result) ||
        ('tool_response' in message && message.tool_response) ||
        ('type' in message &&
          typeof message.type === 'string' &&
          (message.type === 'tool_use' || message.type === 'tool_result'))
      );
    }
    return false;
  }

  private extractToolInfo(message: unknown): ClaudeCodeMessage['tool'] {
    if (message && typeof message === 'object') {
      // Handle tool_use messages
      if ('tool_use' in message && message.tool_use) {
        const tool = message.tool_use;
        if (tool && typeof tool === 'object' && 'name' in tool) {
          return {
            name: typeof tool.name === 'string' ? tool.name : 'unknown',
            input: ('input' in tool && tool.input) || {},
          };
        }
      }
      
      if ('tool_call' in message && message.tool_call) {
        const tool = message.tool_call;
        if (tool && typeof tool === 'object' && 'name' in tool) {
          return {
            name: typeof tool.name === 'string' ? tool.name : 'unknown',
            input: ('arguments' in tool && tool.arguments) || {},
          };
        }
      }

      // Handle tool_result messages
      if ('tool_result' in message && message.tool_result) {
        const result = message.tool_result;
        if (result && typeof result === 'object') {
          const name =
            'tool_use_id' in result && typeof result.tool_use_id === 'string'
              ? result.tool_use_id
              : 'unknown';
          const output = ('content' in result && result.content) || ('output' in result && result.output);
          return {
            name,
            input: {},
            output,
          };
        }
      }
      
      if ('tool_response' in message && message.tool_response) {
        const result = message.tool_response;
        if (result && typeof result === 'object') {
          const name =
            'call_id' in result && typeof result.call_id === 'string'
              ? result.call_id
              : 'unknown';
          const output = ('content' in result && result.content) || ('output' in result && result.output);
          return {
            name,
            input: {},
            output,
          };
        }
      }
    }

    return undefined;
  }
}
