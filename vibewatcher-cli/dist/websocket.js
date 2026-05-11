"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = exports.DEFAULT_PORT = exports.DEFAULT_HOST = void 0;
const ws_1 = __importDefault(require("ws"));
const types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_HOST", { enumerable: true, get: function () { return types_1.DEFAULT_HOST; } });
Object.defineProperty(exports, "DEFAULT_PORT", { enumerable: true, get: function () { return types_1.DEFAULT_PORT; } });
class WebSocketClient {
    constructor(host = types_1.DEFAULT_HOST, port = types_1.DEFAULT_PORT) {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxRetries = 3;
        this.messageQueue = [];
        const envPort = process.env.VIBEWATCH_PORT;
        this.url = 'ws://' + host + ':' + (envPort || port);
    }
    async connect() {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                _this.ws = new ws_1.default(_this.url);
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    send(message) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        else {
            this.messageQueue.push(message);
        }
    }
    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }
    close() {
        if (this.ws) {
            this.ws.close();
        }
        this.ws = null;
    }
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            var message = this.messageQueue.shift();
            if (message) {
                this.send(message);
            }
        }
    }
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxRetries) {
            this.reconnectAttempts++;
            var delay = Math.pow(2, this.reconnectAttempts) * 1000;
            var _this = this;
            setTimeout(function () {
                _this.connect().catch(function () { });
            }, delay);
        }
    }
}
exports.WebSocketClient = WebSocketClient;
