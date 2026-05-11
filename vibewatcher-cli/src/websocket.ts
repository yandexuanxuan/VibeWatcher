import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from './types';

export { DEFAULT_HOST, DEFAULT_PORT };

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private readonly maxRetries = 3;
  private messageQueue: WSMessage[] = [];
  private onDisconnectCallback: (() => void) | undefined;

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    const envPort = process.env.VIBEWATCH_PORT;
    this.url = 'ws://' + host + ':' + (envPort || port);
  }

  async connect(): Promise<void> {
    var _this = this;
    return new Promise(function (resolve, reject) {
      try {
        _this.ws = new WebSocket(_this.url);

        _this.ws.on('open', function () {
          _this.reconnectAttempts = 0;
          _this.flushMessageQueue();
          resolve();
        });

        _this.ws.on('error', function (error) {
          if (_this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        _this.ws.on('close', function () {
          if (_this.onDisconnectCallback) {
            _this.onDisconnectCallback();
          }
          _this.attemptReconnect();
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

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      var message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxRetries) {
      this.reconnectAttempts++;
      var delay = Math.pow(2, this.reconnectAttempts) * 1000;
      var _this = this;
      setTimeout(function () {
        _this.connect().catch(function () {});
      }, delay);
    }
  }
}
