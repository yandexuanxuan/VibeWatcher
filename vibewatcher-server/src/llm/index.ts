import { LLMProvider, LLMConfig } from './types';
import { createClaudeProvider } from './claude-provider';
import { createOpenAIProvider } from './openai-provider';
import { createOllamaProvider } from './ollama-provider';

export function createProvider(config: LLMConfig): LLMProvider | null {
  if (!config.enabled) return null;

  switch (config.provider) {
    case 'claude':
      if (!config.apiKey) return null;
      return createClaudeProvider(config.apiKey, config.model);
    case 'openai':
      if (!config.apiKey) return null;
      return createOpenAIProvider(config.apiKey, config.model);
    case 'ollama':
      return createOllamaProvider(config.baseUrl, config.model);
    default:
      return null;
  }
}

export { LLMProvider, LLMConfig } from './types';