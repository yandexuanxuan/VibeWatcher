import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from 'vibewatcher-shared';

export { DEFAULT_HOST, DEFAULT_PORT };

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private reconnectAttempts = 0;
  private readonly maxRetries = 3;
  private messageQueue: WSMessage[] = [];
  private onDisconnectCallback: (() => void) | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageListeners: Map<string, ((payload: unknown) => void)[]> = new Map();

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    const envPort = process.env.VIBEWATCH_PORT;
    this.url = `ws://${host}:${envPort || port}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        resolve();
      });

      this.ws.on('error', (error) => {
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.ws.on('message', (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.emitMessage(message.type, message.payload);
        } catch {
          // ignore malformed messages
        }
      });

      this.ws.on('close', () => {
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
        this.attemptReconnect();
      });
    });
  }

  onMessage(type: string, callback: (payload: unknown) => void): void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, []);
    }
    this.messageListeners.get(type)!.push(callback);
  }

  private emitMessage(type: string, payload: unknown): void {
    const callbacks = this.messageListeners.get(type) || [];
    callbacks.forEach((cb) => cb(payload));
  }

  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxRetries && !this.reconnectTimer) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(() => {});
      }, delay);
    }
  }
}
