"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibeWatcherServer = void 0;
const ws_1 = __importStar(require("ws"));
const task_manager_1 = require("./task-manager");
const types_1 = require("./types");
class VibeWatcherServer {
    constructor(port = types_1.DEFAULT_PORT) {
        this.wss = null;
        this.clients = new Set();
        this.port = port;
        this.taskManager = new task_manager_1.TaskManager();
        this.setupTaskListeners();
    }
    setupTaskListeners() {
        this.taskManager.onTaskCreated((taskId) => {
            this.broadcast({ type: 'TASK_CREATED', payload: { taskId } });
        });
        this.taskManager.onTaskStatusChange((taskId, status) => {
            this.broadcast({ type: 'TASK_STATUS', payload: { taskId, status } });
        });
        this.taskManager.onTaskOutput((taskId, type, data) => {
            this.broadcast({ type: 'TASK_OUTPUT', payload: { taskId, type, data } });
        });
        this.taskManager.onTaskExit((taskId, exitCode, duration) => {
            this.broadcast({ type: 'TASK_EXIT', payload: { taskId, exitCode, duration } });
        });
    }
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new ws_1.WebSocketServer({ port: this.port });
                this.wss.on('listening', () => {
                    console.log(`[VibeWatcher Server] Running on ws://localhost:${this.port}`);
                    resolve();
                });
                this.wss.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        this.tryNextPort(resolve, reject);
                    }
                    else {
                        reject(error);
                    }
                });
                this.wss.on('connection', (ws) => {
                    this.clients.add(ws);
                    console.log(`[VibeWatcher Server] Client connected (${this.clients.size} total)`);
                    ws.on('message', (data) => {
                        this.handleMessage(ws, data.toString());
                    });
                    ws.on('close', () => {
                        this.clients.delete(ws);
                        console.log(`[VibeWatcher Server] Client disconnected (${this.clients.size} total)`);
                    });
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    tryNextPort(resolve, reject) {
        const nextPort = this.port + 1;
        if (nextPort > this.port + 3) {
            reject(new Error('Failed to find available port'));
            return;
        }
        console.log(`[VibeWatcher Server] Port ${this.port} in use, trying ${nextPort}`);
        this.wss?.close();
        this.wss = new ws_1.WebSocketServer({ port: nextPort });
        this.port = nextPort;
        this.wss.on('listening', resolve);
        this.wss.on('error', () => this.tryNextPort(resolve, reject));
    }
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'TASK_CREATED': {
                    const { taskId } = message.payload;
                    this.taskManager.createTask(taskId);
                    break;
                }
                case 'TASK_STATUS': {
                    const { taskId, status } = message.payload;
                    this.taskManager.updateStatus(taskId, status);
                    break;
                }
                case 'TASK_OUTPUT': {
                    const { taskId, type, data } = message.payload;
                    this.taskManager.appendOutput(taskId, type, data);
                    break;
                }
                case 'TASK_EXIT': {
                    const { taskId, exitCode } = message.payload;
                    this.taskManager.exitTask(taskId, exitCode);
                    break;
                }
                case 'LIST_TASKS': {
                    const tasks = this.taskManager.listTasks();
                    ws.send(JSON.stringify({ type: 'TASKS_LIST', payload: tasks }));
                    break;
                }
                case 'STOP_TASK': {
                    break;
                }
            }
        }
        catch (error) {
            console.error('[VibeWatcher Server] Failed to parse message:', error);
        }
    }
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(data);
            }
        });
    }
    stop() {
        this.wss?.close();
        this.wss = null;
    }
}
exports.VibeWatcherServer = VibeWatcherServer;
const port = parseInt(process.env.VIBEWATCH_PORT || String(types_1.DEFAULT_PORT), 10);
const server = new VibeWatcherServer(port);
server.start().catch((error) => {
    console.error('[VibeWatcher Server] Failed to start:', error);
    process.exit(1);
});
process.on('SIGINT', () => {
    console.log('\n[VibeWatcher Server] Shutting down...');
    server.stop();
    process.exit(0);
});
