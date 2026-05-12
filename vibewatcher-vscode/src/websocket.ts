import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from 'vibewatcher-shared';

export class VSCodeWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private listeners: Map<string, ((payload: unknown) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private readonly maxRetries = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private messageQueue: WSMessage[] = [];
  private onReconnectCallback: (() => void) | undefined;
  private onDisconnectCallback: (() => void) | undefined;
  private onReconnectFailedCallback: (() => void) | undefined;

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    const envPort = process.env.VIBEWATCH_PORT;
    this.url = `ws://${host}:${envPort || port}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('[VibeWatcher] Connected to server');
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          this.send({ type: 'LIST_TASKS', payload: null });
          resolve();
        });

        this.ws.on('error', (error) => {
          if (this.reconnectAttempts === 0 && !this.intentionalClose) {
            console.error('[VibeWatcher] WebSocket error:', error);
            reject(error);
          }
        });

        this.ws.on('close', () => {
          console.log('[VibeWatcher] Disconnected from server');
          if (!this.intentionalClose) {
            this.onDisconnectCallback?.();
            this.attemptReconnect();
          }
        });

        this.ws.on('message', (data) => {
          try {
            const message: WSMessage = JSON.parse(data.toString());
            this.emit(message.type, message.payload);
          } catch (error) {
            console.error('[VibeWatcher] Failed to parse message:', error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  on(type: string, callback: (payload: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onReconnect(callback: () => void): void {
    this.onReconnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  onReconnectFailed(callback: () => void): void {
    this.onReconnectFailedCallback = callback;
  }

  reconnect(): void {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect().then(() => {
      this.onReconnectCallback?.();
    }).catch(() => {
      this.onReconnectFailedCallback?.();
    });
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private emit(type: string, payload: unknown): void {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach((cb) => cb(payload));
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
      console.log(`[VibeWatcher] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxRetries})`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect()
          .then(() => {
            this.onReconnectCallback?.();
          })
          .catch(() => {
            // If we've exhausted retries, notify
            if (this.reconnectAttempts >= this.maxRetries) {
              this.onReconnectFailedCallback?.();
            }
          });
      }, delay);
    } else if (this.reconnectAttempts >= this.maxRetries) {
      this.onReconnectFailedCallback?.();
    }
  }
}
