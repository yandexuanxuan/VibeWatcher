"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const types_1 = require("./types");
class VSCodeWebSocketClient {
    constructor(host = types_1.DEFAULT_HOST, port = types_1.DEFAULT_PORT) {
        this.ws = null;
        this.listeners = new Map();
        const envPort = process.env.VIBEWATCH_PORT;
        this.url = `ws://${host}:${envPort || port}`;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(this.url);
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
                        const message = JSON.parse(data.toString());
                        this.emit(message.type, message.payload);
                    }
                    catch (error) {
                        console.error('[VibeWatcher] Failed to parse message:', error);
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    send(message) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }
    emit(type, payload) {
        const callbacks = this.listeners.get(type) || [];
        callbacks.forEach((cb) => cb(payload));
    }
    close() {
        this.ws?.close();
        this.ws = null;
    }
}
exports.VSCodeWebSocketClient = VSCodeWebSocketClient;
//# sourceMappingURL=websocket.js.map