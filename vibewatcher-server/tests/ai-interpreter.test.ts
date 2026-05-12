import { AIInterpreter } from '../src/ai-interpreter';

// Mock LLM provider
function makeMockProvider(response: string) {
  return {
    name: 'mock',
    async interpret(_prompt: string) {
      return response;
    },
  };
}

describe('AIInterpreter', () => {
  it('returns fallback when not enabled', async () => {
    const interpreter = new AIInterpreter(null);
    const result = await interpreter.interpret('task-1', 'RUNNING', ['output line'], 'build');
    expect(result).toBe('[AI Interpreter not configured]');
  });

  it('calls provider with prompt', async () => {
    const mock = makeMockProvider('Task is building successfully');
    const interpreter = new AIInterpreter(mock);
    const result = await interpreter.interpret('task-1', 'RUNNING', ['installing...', 'done!'], 'build');
    expect(result).toBe('Task is building successfully');
  });

  it('reports isEnabled correctly', () => {
    const off = new AIInterpreter(null);
    expect(off.isEnabled()).toBe(false);

    const on = new AIInterpreter(makeMockProvider('hi'));
    expect(on.isEnabled()).toBe(true);
  });

  it('can swap provider at runtime', async () => {
    const interpreter = new AIInterpreter(null);
    expect(interpreter.isEnabled()).toBe(false);

    interpreter.setProvider(makeMockProvider('hello'));
    expect(interpreter.isEnabled()).toBe(true);

    interpreter.setProvider(null);
    expect(interpreter.isEnabled()).toBe(false);
  });

  it('handles provider errors gracefully', async () => {
    const bad = {
      name: 'bad',
      async interpret(_p: string) {
        throw new Error('Network error');
      },
    };
    const interpreter = new AIInterpreter(bad);
    await expect(interpreter.interpret('t1', 'RUNNING', [], 'test')).rejects.toThrow('Network error');
  });
});