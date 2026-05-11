import WebSocket, { WebSocketServer } from 'ws';
import { TaskManager } from './task-manager';
import { WSMessage, DEFAULT_PORT, Status } from './types';

export class VibeWatcherServer {
  private wss: WebSocketServer | null = null;
  private taskManager: TaskManager;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.taskManager = new TaskManager();
    this.setupTaskListeners();
  }

  private setupTaskListeners(): void {
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

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('listening', () => {
          console.log(`[VibeWatcher Server] Running on ws://localhost:${this.port}`);
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
          console.log(`[VibeWatcher Server] Client connected (${this.clients.size} total)`);

          ws.on('message', (data) => {
            this.handleMessage(ws, data.toString());
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`[VibeWatcher Server] Client disconnected (${this.clients.size} total)`);
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
    this.wss?.close();
    this.wss = new WebSocketServer({ port: nextPort });
    this.port = nextPort;
    this.wss.on('listening', resolve);
    this.wss.on('error', () => this.tryNextPort(resolve, reject));
  }

  private handleMessage(ws: WebSocket, data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'TASK_CREATED': {
          const { taskId } = message.payload as { taskId: string };
          this.taskManager.createTask(taskId);
          break;
        }
        case 'TASK_STATUS': {
          const { taskId, status } = message.payload as { taskId: string; status: Status };
          this.taskManager.updateStatus(taskId, status);
          break;
        }
        case 'TASK_OUTPUT': {
          const { taskId, type, data } = message.payload as {
            taskId: string;
            type: 'stdout' | 'stderr';
            data: string;
          };
          this.taskManager.appendOutput(taskId, type, data);
          break;
        }
        case 'TASK_EXIT': {
          const { taskId, exitCode } = message.payload as { taskId: string; exitCode: number };
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
    } catch (error) {
      console.error('[VibeWatcher Server] Failed to parse message:', error);
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
    this.wss?.close();
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