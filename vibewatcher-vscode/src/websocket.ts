import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from './types';

export class VSCodeWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, ((payload: unknown) => void)[]> = new Map();

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
          this.send({ type: 'LIST_TASKS', payload: null });
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('[VibeWatcher] WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[VibeWatcher] Disconnected from server');
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: string, callback: (payload: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  private emit(type: string, payload: unknown): void {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach((cb) => cb(payload));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}