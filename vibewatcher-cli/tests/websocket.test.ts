import { WebSocketClient, DEFAULT_PORT, DEFAULT_HOST } from '../src/websocket';

describe('WebSocketClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should use default host and port', () => {
    const client = new WebSocketClient();
    expect(client['url']).toBe(`ws://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });

  it('should allow custom host and port', () => {
    const client = new WebSocketClient('localhost', 9999);
    expect(client['url']).toBe('ws://localhost:9999');
  });

  it('should respect VIBEWATCH_PORT env var', () => {
    process.env.VIBEWATCH_PORT = '9876';
    const client = new WebSocketClient();
    expect(client['url']).toBe(`ws://${DEFAULT_HOST}:9876`);
    delete process.env.VIBEWATCH_PORT;
  });
});
