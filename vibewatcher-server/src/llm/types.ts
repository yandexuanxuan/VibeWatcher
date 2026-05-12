export type LLMProviderType = 'claude' | 'openai' | 'ollama';

export interface LLMConfig {
  provider: LLMProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface LLMProvider {
  name: string;
  interpret(prompt: string): Promise<string>;
}