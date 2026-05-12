import { createProvider, LLMConfig } from '../src/llm';

describe('LLM Provider Factory', () => {
  it('returns null when disabled', () => {
    const config: LLMConfig = { provider: 'claude', enabled: false };
    expect(createProvider(config)).toBeNull();
  });

  it('returns null for unknown provider', () => {
    const config: LLMConfig = { provider: 'claude', enabled: true }; // no apiKey
    expect(createProvider(config)).toBeNull();
  });

  it('returns null for cluade without apiKey', () => {
    const config: LLMConfig = { provider: 'claude', enabled: true };
    expect(createProvider(config)).toBeNull();
  });

  it('returns null for openai without apiKey', () => {
    const config: LLMConfig = { provider: 'openai', enabled: true };
    expect(createProvider(config)).toBeNull();
  });

  it('creates openai provider with apiKey', () => {
    const config: LLMConfig = { provider: 'openai', apiKey: 'test-key', enabled: true };
    const provider = createProvider(config);
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('openai');
  });

  it('creates ollama provider without apiKey', () => {
    const config: LLMConfig = { provider: 'ollama', enabled: true, baseUrl: 'http://localhost:11434' };
    const provider = createProvider(config);
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('ollama');
  });

  it('accepts custom model', () => {
    const config: LLMConfig = { provider: 'ollama', model: 'mistral', enabled: true };
    const provider = createProvider(config);
    expect(provider).not.toBeNull();
  });
});