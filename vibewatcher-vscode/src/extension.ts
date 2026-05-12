import { commands, window } from 'vscode';
import { VSCodeWebSocketClient } from './websocket';
import { StatusBar } from './status-bar';
import { TaskTreeProvider, TaskTreeItem } from './task-tree';
import { NotificationManager } from './notifications';
import { registerCommands, showOutput, showSummary } from './commands';
import { MiniPanel } from './mini-panel';
import { TaskState, Status, DEFAULT_HOST, DEFAULT_PORT, TaskSummary, TaskPrediction } from './types';

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

function determineTaskStatus(tasks: TaskState[]): Status {
  if (tasks.some((t) => t.status === 'ERROR')) return 'ERROR';
  if (tasks.some((t) => t.status === 'WAITING_INPUT')) return 'WAITING_INPUT';
  if (tasks.some((t) => t.status === 'RUNNING')) return 'RUNNING';
  return 'COMPLETED';
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

  wsClient
    .connect()
    .then(() => {
      statusBar?.show();
      window.showInformationMessage('[VibeWatcher] Connected to server');
    })
    .catch(() => {
      window.showWarningMessage('[VibeWatcher] Cannot connect to server. Make sure vibewatcher-server is running.');
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
}