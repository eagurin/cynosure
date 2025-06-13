/**
 * GitHub Models CLI Provider
 * Uses gh-models extension for AI model access
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitHubModelsCLIConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export class GitHubModelsCLIProvider {
  private config: GitHubModelsCLIConfig;

  constructor(config: GitHubModelsCLIConfig) {
    this.config = config;
  }

  /**
   * Execute prompt using GitHub Models CLI
   */
  async execute(prompt: string): Promise<string> {
    try {
      const command = `gh models run ${this.config.model} "${prompt.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000, // 60 seconds
      });

      if (stderr) {
        // GitHub Models CLI warning available (execute)
      }

      return stdout.trim();
    } catch (error) {
      // GitHub Models CLI error occurred (execute)
      throw new Error(
        `GitHub Models execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute with context from file or stdin
   */
  async executeWithContext(context: string, prompt: string): Promise<string> {
    try {
      // Create temporary file for context
      const { writeFile, unlink } = await import('fs/promises');
      const { randomBytes } = await import('crypto');
      const tempFile = `/tmp/gh_models_context_${randomBytes(8).toString('hex')}.txt`;

      await writeFile(tempFile, context);

      const command = `cat "${tempFile}" | gh models run ${this.config.model} "${prompt.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      });

      // Clean up temp file
      await unlink(tempFile).catch(() => {});

      if (stderr) {
        // GitHub Models CLI warning available (executeWithContext)
      }

      return stdout.trim();
    } catch (error) {
      // GitHub Models CLI error occurred (executeWithContext)
      throw new Error(
        `GitHub Models execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List available models
   */
  static async listModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const { stdout } = await execAsync('gh models list', {
        maxBuffer: 1024 * 1024,
      });

      return stdout
        .trim()
        .split('\n')
        .map(line => {
          const [id, ...nameParts] = line.split('\t');
          return {
            id: id.trim(),
            name: nameParts.join(' ').trim(),
          };
        });
    } catch (error) {
      // Failed to list models
      return [];
    }
  }

  /**
   * Check if GitHub Models CLI is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      await execAsync('gh models --help');
      return true;
    } catch {
      return false;
    }
  }
}

// Available models mapping
export const GITHUB_CLI_MODELS = {
  // OpenAI Models
  'gpt-4.1': 'openai/gpt-4.1',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'gpt-4.1-nano': 'openai/gpt-4.1-nano',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  o1: 'openai/o1',
  'o1-mini': 'openai/o1-mini',
  o3: 'openai/o3',
  'o3-mini': 'openai/o3-mini',

  // Meta Llama Models
  'llama-3-8b': 'meta/meta-llama-3-8b-instruct',
  'llama-3-70b': 'meta/meta-llama-3-70b-instruct',
  'llama-3.1-8b': 'meta/meta-llama-3.1-8b-instruct',
  'llama-3.1-70b': 'meta/meta-llama-3.1-70b-instruct',
  'llama-3.1-405b': 'meta/meta-llama-3.1-405b-instruct',
  'llama-3.3-70b': 'meta/llama-3.3-70b-instruct',

  // Mistral Models
  'mistral-small': 'mistral-ai/mistral-small',
  'mistral-medium': 'mistral-ai/mistral-medium-2505',
  'mistral-large': 'mistral-ai/mistral-large-2411',
  'mistral-nemo': 'mistral-ai/mistral-nemo',
  codestral: 'mistral-ai/codestral-2501',

  // Other Models
  'deepseek-v3': 'deepseek/deepseek-v3',
  'grok-3': 'xai/grok-3',
  'grok-3-mini': 'xai/grok-3-mini',
};
