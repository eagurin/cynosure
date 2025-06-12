/**
 * Claude Code SDK Client
 * Wrapper around @anthropic-ai/claude-code
 */

// Will be initialized lazily in constructor
import { 
  ClaudeCodeQuery, 
  ClaudeCodeResponse, 
  ClaudeCodeMessage, 
  ClaudeCodeConfig 
} from '../models/claude.js';
import { generateId, estimateTokenCount } from '../utils/helpers.js';

export class ClaudeCodeClient {
  private config: ClaudeCodeConfig;
  private query: any;
  
  constructor(config: ClaudeCodeConfig) {
    this.config = config;
    
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
  private async initializeQuery(): Promise<any> {
    if (this.query) {
      return this.query;
    }
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Claude CLI path
    const claudeCommand = '/Users/laptop/.claude/local/claude';
    
    this.query = async function* (options: any) {
      try {
        console.log('🔄 Executing Claude CLI with prompt:', options.prompt.substring(0, 100) + '...');
        
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
              cwd: options.options?.workingDirectory || process.cwd()
            }
          );
          
          // Clean up temp file
          await unlink(tempFile).catch(() => {});
          
          if (stderr && stderr.trim()) {
            console.log('⚠️ Claude CLI stderr:', stderr);
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
                      raw: parsed
                    };
                  }
                } catch (parseError) {
                  console.log('Failed to parse line:', line);
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
              cwd: options.options?.workingDirectory || process.cwd()
            }
          );
          
          // Clean up temp file
          await unlink(tempFile).catch(() => {});
          
          if (stderr && stderr.trim()) {
            console.log('⚠️ Claude CLI stderr:', stderr);
          }
          
          if (stdout && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout);
              yield { 
                type: 'text', 
                content: parsed.result || 'No response content',
                timestamp: Date.now(),
                raw: parsed
              };
            } catch (parseError) {
              console.error('Failed to parse Claude response:', parseError);
              yield { 
                type: 'text', 
                content: stdout.trim(),
                timestamp: Date.now()
              };
            }
          } else {
            yield { 
              type: 'text', 
              content: 'Claude CLI executed but returned no output.',
              timestamp: Date.now() 
            };
          }
        }
        
      } catch (error: any) {
        console.error('❌ Claude CLI execution error:', error);
        
        // Check if we have stdout even with error exit code
        if (error.stdout && error.stdout.trim()) {
          try {
            const parsed = JSON.parse(error.stdout);
            if (parsed.result) {
              yield { 
                type: 'text', 
                content: parsed.result,
                timestamp: Date.now(),
                raw: parsed
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
            errorMessage = 'Claude CLI returned an API key error, but execution completed. This might be expected for local usage.';
          }
        }
        
        yield { 
          type: 'error', 
          content: errorMessage,
          timestamp: Date.now() 
        };
      }
    };
    
    console.log('✅ Claude CLI execution method initialized');
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
        }
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
          errorContent = 'Invalid or missing ANTHROPIC_API_KEY. Please check your API key configuration.';
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
  async* executeStreaming(claudeQuery: ClaudeCodeQuery): AsyncGenerator<ClaudeCodeMessage> {
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
        }
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
          errorContent = 'Invalid or missing ANTHROPIC_API_KEY. Please check your API key configuration.';
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
  
  private determineMessageType(message: any): ClaudeCodeMessage['type'] {
    // Handle different message types from Claude Code SDK
    if (message.type) {
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
    if (message.error || message.stderr) return 'error';
    if (message.tool_use || message.tool_call) return 'tool_use';
    if (message.tool_result || message.tool_response) return 'tool_result';
    return 'text';
  }
  
  private extractContent(message: any): string {
    // Handle different content formats from Claude Code SDK
    if (typeof message === 'string') return message;
    
    // Try different content fields
    if (message.content) {
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content)) {
        return message.content
          .map((item: any) => typeof item === 'string' ? item : item.text || JSON.stringify(item))
          .join('\n');
      }
      return JSON.stringify(message.content);
    }
    
    if (message.text) return message.text;
    if (message.message) return message.message;
    if (message.response) return message.response;
    if (message.output) return message.output;
    if (message.error) return message.error;
    if (message.stderr) return message.stderr;
    
    // For tool messages, extract relevant information
    if (message.tool_use || message.tool_call) {
      const tool = message.tool_use || message.tool_call;
      return `Tool: ${tool.name}\nInput: ${JSON.stringify(tool.input || tool.arguments, null, 2)}`;
    }
    
    if (message.tool_result || message.tool_response) {
      const result = message.tool_result || message.tool_response;
      return result.content || result.output || JSON.stringify(result);
    }
    
    // Default fallback
    return JSON.stringify(message);
  }
  
  private isToolMessage(message: any): boolean {
    return !!(
      message.tool_use || 
      message.tool_call || 
      message.tool_result || 
      message.tool_response ||
      (message.type && (message.type === 'tool_use' || message.type === 'tool_result'))
    );
  }
  
  private extractToolInfo(message: any): ClaudeCodeMessage['tool'] {
    // Handle tool_use messages
    if (message.tool_use || message.tool_call) {
      const tool = message.tool_use || message.tool_call;
      return {
        name: tool.name,
        input: tool.input || tool.arguments || {},
      };
    }
    
    // Handle tool_result messages
    if (message.tool_result || message.tool_response) {
      const result = message.tool_result || message.tool_response;
      return {
        name: result.tool_use_id || result.call_id || 'unknown',
        input: {},
        output: result.content || result.output,
      };
    }
    
    return undefined;
  }
}