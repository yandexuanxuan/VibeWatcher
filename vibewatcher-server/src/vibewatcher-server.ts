import WebSocket, { WebSocketServer } from 'ws';
import { TaskManager } from './task-manager';
import { Notifier } from './notifier';
import { StallDetector } from './stall-detector';
import { AIInterpreter } from './ai-interpreter';
import { createProvider } from './llm';
import { getStallDetectionConfig, getAIConfig } from './config';
import { WSMessage, DEFAULT_PORT, Status } from 'vibewatcher-shared';

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

export class VibeWatcherServer {
  private wss: WebSocketServer | null = null;
  private taskManager: TaskManager;
  private notifier: Notifier;
  private stallDetector: StallDetector | null = null;
  private aiInterpreter: AIInterpreter;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.taskManager = new TaskManager();
    this.notifier = new Notifier();
    this.aiInterpreter = new AIInterpreter(null);
    this.setupTaskListeners();
    this.setupStallDetector();
    this.setupAIInterpreter();
  }

  private setupAIInterpreter(): void {
    const config = getAIConfig();
    if (config) {
      const provider = createProvider(config);
      if (provider) {
        this.aiInterpreter.setProvider(provider);
        console.log(`[VibeWatcher] AI Interpreter enabled (${config.provider})`);
      }
    }
  }

  private setupStallDetector(): void {
    const config = getStallDetectionConfig();
    if (!config.enabled) return;

    const stateStore = this.taskManager.getStateStore();
    this.stallDetector = new StallDetector(stateStore, config);
    this.stallDetector.onStall((taskId, idleMs) => {
      this.broadcast({ type: 'TASK_STALL', payload: { taskId, idleMs } });
      this.notifier.notify({ taskId, status: 'RUNNING' });
    });
    this.stallDetector.start();
  }

  clearStallAlert(taskId: string): void {
    this.stallDetector?.clearStallAlert(taskId);
  }

  getPort(): number {
    return this.port;
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
      // Clear stall alert when task produces output
      this.clearStallAlert(taskId);
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

    if (!message || typeof message.type !== 'string' || message.payload === undefined) {
      return;
    }

    const validTypes = ['TASK_CREATED', 'TASK_STATUS', 'TASK_OUTPUT', 'TASK_EXIT', 'LIST_TASKS', 'STOP_TASK', 'TASK_SUMMARY', 'TASK_STALL', 'INTERPRET_TASK', 'TASK_INTERPRETATION'];
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
      case 'INTERPRET_TASK': {
        const payload = message.payload as { taskId: string };
        this.interpretTask(ws, payload.taskId);
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

  private async interpretTask(ws: WebSocket, taskId: string): Promise<void> {
    if (!this.aiInterpreter.isEnabled()) {
      ws.send(JSON.stringify({ type: 'TASK_INTERPRETATION', payload: { taskId, interpretation: '[AI Interpreter not configured]' } }));
      return;
    }

    const task = this.taskManager.getTask(taskId);
    if (!task) {
      ws.send(JSON.stringify({ type: 'TASK_INTERPRETATION', payload: { taskId, interpretation: '[Task not found]' } }));
      return;
    }

    try {
      const keyword = 'general'; // Would need to track this in TaskManager
      const interpretation = await this.aiInterpreter.interpret(
        taskId,
        task.status,
        task.lastOutput,
        keyword
      );
      ws.send(JSON.stringify({ type: 'TASK_INTERPRETATION', payload: { taskId, interpretation } }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'TASK_INTERPRETATION', payload: { taskId, interpretation: `[Error: ${(err as Error).message}]` } }));
    }
  }

  stop(): void {
    this.stallDetector?.stop();
    if (this.wss) {
      this.wss.close();
    }
    this.wss = null;
  }
}
