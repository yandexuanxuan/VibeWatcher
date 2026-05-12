import { commands, window } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { VSCodeWebSocketClient } from './websocket';
import { StatusBar } from './status-bar';
import { TaskTreeProvider, TaskTreeItem } from './task-tree';
import { NotificationManager } from './notifications';
import { registerCommands, showOutput, showSummary } from './commands';
import { MiniPanel } from './mini-panel';
import { TaskState, Status, DEFAULT_HOST, DEFAULT_PORT, TaskSummary, TaskPrediction } from 'vibewatcher-shared';

interface TaskPayload {
  taskId: string;
  status?: Status;
  exitCode?: number;
}

interface PredictionPayload extends TaskPrediction {
  taskId: string;
}

let wsClient: VSCodeWebSocketClient | null = null;
let statusBar: StatusBar | null = null;
let taskTreeProvider: TaskTreeProvider | null = null;
let notifications: NotificationManager | null = null;
let miniPanel: MiniPanel | null = null;
let daemonProcess: ChildProcess | null = null;

function determineTaskStatus(tasks: TaskState[]): Status {
  if (tasks.some((t) => t.status === 'ERROR')) return 'ERROR';
  if (tasks.some((t) => t.status === 'WAITING_INPUT')) return 'WAITING_INPUT';
  if (tasks.some((t) => t.status === 'RUNNING')) return 'RUNNING';
  return 'COMPLETED';
}

// Get daemon binary path
function getDaemonPath(): string {
  const installDir = process.env.VIBEWATCH_HOME || path.join(os.homedir(), '.vibewatch');
  const globalPath = path.join(installDir, 'bin', 'vibe-daemon');

  if (fs.existsSync(globalPath)) {
    return globalPath;
  }

  // Fall back to dev mode (relative to extension root)
  const extRoot = path.join(__dirname, '..', '..', '..', '..', '..');
  const devPath = path.join(extRoot, 'bin', 'vibe-daemon');

  if (fs.existsSync(devPath)) {
    return devPath;
  }

  return globalPath; // Return default even if not found (will fail gracefully)
}

// Check if server is reachable on WebSocket port
function isServerReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://${DEFAULT_HOST}:${DEFAULT_PORT}`);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// Wait for server to become available
async function waitForServer(timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < timeout) {
    if (await isServerReachable()) {
      return true;
    }
    await new Promise(r => setTimeout(r, checkInterval));
  }
  return false;
}

// Try to start the daemon
async function tryStartDaemon(): Promise<void> {
  const daemonPath = getDaemonPath();

  if (!fs.existsSync(daemonPath)) {
    console.log('[VibeWatcher] Daemon binary not found, skipping auto-start');
    return;
  }

  return new Promise((resolve) => {
    try {
      daemonProcess = spawn(daemonPath, ['start', '--if-not-running'], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      });

      daemonProcess.unref();

      // Wait briefly then check if server is available
      setTimeout(async () => {
        if (await waitForServer(5000)) {
          console.log('[VibeWatcher] Server auto-started successfully');
        } else {
          console.log('[VibeWatcher] Server auto-start timed out');
        }
        resolve();
      }, 1000);
    } catch (err) {
      console.log('[VibeWatcher] Failed to auto-start daemon:', err);
      resolve();
    }
  });
}

export function activate(): void {
  statusBar = new StatusBar();
  taskTreeProvider = new TaskTreeProvider();
  notifications = new NotificationManager();
  miniPanel = new MiniPanel();

  wsClient = new VSCodeWebSocketClient(DEFAULT_HOST, DEFAULT_PORT);

  registerCommands(wsClient);

  const taskView = window.createTreeView('vibewatcher.taskList', {
    treeDataProvider: taskTreeProvider,
  });

  taskView.onDidChangeSelection((e) => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as TaskTreeItem;
      showOutput(item.task);
    }
  });

  wsClient.on('TASK_CREATED', (payload) => {
    const { taskId } = payload as TaskPayload;
    window.showInformationMessage(`[VibeWatcher] Task started: ${taskId.substring(0, 8)}`);
    wsClient?.send({ type: 'LIST_TASKS', payload: null });
  });

  wsClient.on('TASK_STATUS', (payload) => {
    const { taskId, status } = payload as TaskPayload;
    if (status) {
      statusBar?.setStatus(status);
      if (status === 'WAITING_INPUT') {
        notifications?.notify(status, taskId, 'Claude Code needs input');
      }
    }
    wsClient?.send({ type: 'LIST_TASKS', payload: null });
  });

  wsClient.on('TASK_OUTPUT', (payload) => {
    wsClient?.send({ type: 'LIST_TASKS', payload: null });
    const { data } = payload as { taskId: string; type: string; data: string };
    miniPanel?.appendOutput(data);
  });

  wsClient.on('TASK_EXIT', (payload) => {
    const { taskId, exitCode } = payload as TaskPayload;
    const status: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';
    const message = status === 'COMPLETED'
      ? 'Task completed successfully'
      : `Task failed with code ${exitCode}`;
    notifications?.notify(status, taskId, message);
    wsClient?.send({ type: 'LIST_TASKS', payload: null });
  });

  wsClient.on('TASK_SUMMARY', (payload) => {
    const summary = payload as TaskSummary;
    const label = summary.status === 'COMPLETED' ? 'View Summary' : 'View Error Summary';
    window.showInformationMessage(
      `[VibeWatcher] ${summary.status} in ${formatDuration(summary.duration)}`,
      label
    ).then((choice) => {
      if (choice === label) {
        showSummary(summary);
      }
    });
  });

  wsClient.on('TASK_PREDICTION', (payload) => {
    const pred = payload as PredictionPayload;
    taskTreeProvider?.updatePrediction(pred.taskId, pred);
    wsClient?.send({ type: 'LIST_TASKS', payload: null });
  });

  wsClient.on('TASKS_LIST', (payload) => {
    const tasks = payload as TaskState[];
    taskTreeProvider?.updateTasks(tasks);
    statusBar?.setStatus(determineTaskStatus(tasks));
  });

  wsClient.onDisconnect(() => {
    statusBar?.setStatus('ERROR');
  });

  wsClient.onReconnect(() => {
    statusBar?.setStatus('RUNNING');
    window.showInformationMessage('[VibeWatcher] Reconnected to server');
  });

  wsClient.onReconnectFailed(() => {
    window.showWarningMessage(
      '[VibeWatcher] Lost connection to server',
      'Reconnect'
    ).then((choice) => {
      if (choice === 'Reconnect') {
        wsClient?.reconnect();
      }
    });
  });

  // Try to start daemon if not running, then connect
  isServerReachable().then(async (reachable) => {
    if (!reachable) {
      console.log('[VibeWatcher] Server not running, attempting auto-start...');
      await tryStartDaemon();
    }

    if (wsClient) {
      wsClient
        .connect()
        .then(() => {
          statusBar?.show();
          window.showInformationMessage('[VibeWatcher] Connected to server');
        })
        .catch(() => {
          window.showWarningMessage(
            '[VibeWatcher] Cannot connect to server. Server may not be started.',
            'Start Server',
            'View Instructions'
          ).then((choice) => {
            if (choice === 'Start Server') {
              const terminal = window.createTerminal({ name: 'VibeWatcher' });
              terminal.sendText('vibe-daemon start');
              terminal.show();
            }
          });
        });
    }
  });

  commands.registerCommand('vibewatcher.showTaskList', () => {
    commands.executeCommand('vibewatcher.taskList.focus');
  });

  commands.registerCommand('vibewatcher.toggleMiniPanel', () => {
    miniPanel?.toggle();
  });
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export function deactivate(): void {
  wsClient?.close();
  statusBar?.dispose();
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
}