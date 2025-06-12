#!/bin/bash

# Test GitHub Models integration for Cynosure Bridge

echo "🤖 Testing GitHub Models CLI Extension"
echo "======================================"

# List available models
echo -e "\n📋 Available Models:"
gh models list | head -10

# Test different models
echo -e "\n🧪 Testing GPT-4.1-mini:"
gh models run openai/gpt-4.1-mini "What is Cynosure Bridge in one sentence?"

echo -e "\n🧪 Testing Llama 3:"
gh models run meta/meta-llama-3-8b-instruct "Explain API compatibility in simple terms"

echo -e "\n🧪 Testing Mistral:"
gh models run mistral-ai/mistral-small "What are the benefits of OpenAI API compatibility?"

# Test with code context
echo -e "\n📝 Testing with code context:"
cat src/server/routes.ts | head -50 | gh models run openai/gpt-4.1-mini "What endpoints does this API provide?"

# Compare models
echo -e "\n🔄 Model Comparison:"
PROMPT="Explain what an API bridge does"

echo "GPT-4.1-mini:"
gh models run openai/gpt-4.1-mini "$PROMPT"

echo -e "\nLlama 3:"
gh models run meta/meta-llama-3-8b-instruct "$PROMPT"

echo -e "\n✅ GitHub Models test complete!"