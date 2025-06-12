// Простой тест Claude CLI клиента
import { ClaudeCodeClient } from './dist/claude/client.js';

const config = {
  apiKey: 'dummy-key-for-testing',
  workingDirectory: process.cwd()
};

const client = new ClaudeCodeClient(config);

const query = {
  prompt: 'Write a simple Python hello world function'
};

console.log('Testing Claude CLI client...');

try {
  const result = await client.execute(query);
  console.log('✅ Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('❌ Error:', error);
}