import WebSocket, { WebSocketServer } from 'ws';
import { TaskManager } from './task-manager';
import { Notifier } from './notifier';
import { WSMessage, DEFAULT_PORT, Status, TaskSummary } from './types';

interface TaskCreatedPayload {
  taskId: string;
  keyword?: string;
}

interface TaskStatusPayload {
  taskId: string;
  status: Status;
}

interface TaskOutputPayload {
  taskId: string;
  type: 'stdout' | 'stderr';
  data: string;
}

interface TaskExitPayload {
  taskId: string;
  exitCode: number;
  keyword?: string;
}

interface StopTaskPayload {
  taskId: string;
}

export class VibeWatcherServer {
  private wss: WebSocketServer | null = null;
  private taskManager: TaskManager;
  private notifier: Notifier;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.taskManager = new TaskManager();
    this.notifier = new Notifier();
    this.setupTaskListeners();
  }

  private setupTaskListeners(): void {
    this.taskManager.onTaskCreated((taskId: string) => {
      this.broadcast({ type: 'TASK_CREATED', payload: { taskId } });
    });

    this.taskManager.onTaskStatusChange((taskId: string, status: Status) => {
      this.broadcast({ type: 'TASK_STATUS', payload: { taskId, status } });
      if (status === 'WAITING_INPUT') {
        this.notifier.notify({ taskId, status });
      }
    });

    this.taskManager.onTaskOutput((taskId: string, type: string, data: string) => {
      this.broadcast({ type: 'TASK_OUTPUT', payload: { taskId, type, data } });
    });

    this.taskManager.onTaskExit((taskId: string, exitCode: number, duration: number, keyword?: string) => {
      const status: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';
      this.broadcast({ type: 'TASK_EXIT', payload: { taskId, exitCode, duration } });
      this.notifier.notify({ taskId, status, keyword, duration });
    });

    this.taskManager.onTaskPrediction((taskId: string, prediction) => {
      if (prediction) {
        this.broadcast({ type: 'TASK_PREDICTION', payload: { taskId, ...prediction } });
      }
    });
  }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ port: this.port });

                this.wss.on('listening', () => {
                    console.log('[VibeWatcher Server] Running on ws://localhost:' + this.port);
                    resolve();
                });

                this.wss.on('error', (error) => {
                    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
                        this.tryNextPort(resolve, reject);
                    } else {
                        reject(error);
                    }
                });

                this.wss.on('connection', (ws) => {
                    this.clients.add(ws);
                    console.log('[VibeWatcher Server] Client connected (' + this.clients.size + ' total)');

                    ws.on('message', (data) => {
                        this.handleMessage(ws, data.toString());
                    });

                    ws.on('close', () => {
                        this.clients.delete(ws);
                        console.log('[VibeWatcher Server] Client disconnected (' + this.clients.size + ' total)');
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    private tryNextPort(resolve: () => void, reject: (err: Error) => void): void {
        const nextPort = this.port + 1;
        if (nextPort > this.port + 3) {
            reject(new Error('Failed to find available port'));
            return;
        }
        console.log(`[VibeWatcher Server] Port ${this.port} in use, trying ${nextPort}`);
        if (this.wss) {
            this.wss.close();
        }
        this.wss = new WebSocketServer({ port: nextPort });
        this.port = nextPort;
        this.wss.on('listening', resolve);
        this.wss.on('error', () => this.tryNextPort(resolve, reject));
    }

    private handleMessage(ws: WebSocket, data: string): void {
        let message: WSMessage;
        try {
            message = JSON.parse(data);
        } catch {
            console.error('[VibeWatcher Server] Failed to parse message');
            return;
        }

        // Validate message structure
        if (!message || typeof message.type !== 'string' || message.payload === undefined) {
            return;
        }

        const validTypes = ['TASK_CREATED', 'TASK_STATUS', 'TASK_OUTPUT', 'TASK_EXIT', 'LIST_TASKS', 'STOP_TASK', 'TASK_SUMMARY'];
        if (!validTypes.includes(message.type)) {
            return;
        }

        switch (message.type) {
            case 'TASK_CREATED': {
                const payload = message.payload as TaskCreatedPayload;
                const keyword = payload.keyword || 'general';
                this.taskManager.createTask(payload.taskId, keyword);
                break;
            }
            case 'TASK_STATUS': {
                const payload = message.payload as TaskStatusPayload;
                this.taskManager.updateStatus(payload.taskId, payload.status);
                break;
            }
            case 'TASK_OUTPUT': {
                const payload = message.payload as TaskOutputPayload;
                this.taskManager.appendOutput(payload.taskId, payload.type, payload.data);
                break;
            }
            case 'TASK_EXIT': {
                const payload = message.payload as TaskExitPayload;
                this.taskManager.exitTask(payload.taskId, payload.exitCode, payload.keyword);
                break;
            }
            case 'TASK_SUMMARY': {
                this.broadcast(message);
                break;
            }
            case 'LIST_TASKS': {
                const tasks = this.taskManager.listTasks();
                ws.send(JSON.stringify({ type: 'TASKS_LIST', payload: tasks }));
                break;
            }
            case 'STOP_TASK': {
                this.broadcast(message);
                break;
            }
        }
    }

    private broadcast(message: WSMessage): void {
        const data = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    stop(): void {
        if (this.wss) {
            this.wss.close();
        }
        this.wss = null;
    }
}

const port = parseInt(process.env.VIBEWATCH_PORT || String(DEFAULT_PORT), 10);
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
