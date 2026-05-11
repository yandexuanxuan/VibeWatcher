import { commands, window, TreeView } from 'vscode';
import { VSCodeWebSocketClient } from './websocket';
import { StatusBar } from './status-bar';
import { TaskTreeProvider, TaskTreeItem } from './task-tree';
import { NotificationManager } from './notifications';
import { registerCommands, showOutput } from './commands';
import { TaskState, Status, DEFAULT_HOST, DEFAULT_PORT } from './types';

let wsClient: VSCodeWebSocketClient | null = null;
let statusBar: StatusBar | null = null;
let taskTreeProvider: TaskTreeProvider | null = null;
let notifications: NotificationManager | null = null;

export function activate() {
  // 初始化组件
  statusBar = new StatusBar();
  taskTreeProvider = new TaskTreeProvider();
  notifications = new NotificationManager();

  // 注册命令
  registerCommands();

  // 注册 TreeView
  const taskView = window.createTreeView('vibewatcher.taskList', {
    treeDataProvider: taskTreeProvider,
  });

  taskView.onDidChangeSelection((e) => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as TaskTreeItem;
      showOutput(item.task);
    }
  });

  // 连接 WebSocket
  wsClient = new VSCodeWebSocketClient(DEFAULT_HOST, DEFAULT_PORT);

  wsClient.on('TASK_CREATED', (payload) => {
    const { taskId } = payload as { taskId: string };
    window.showInformationMessage(`[VibeWatcher] Task started: ${taskId.substring(0, 8)}`);
  });

  wsClient.on('TASK_STATUS', (payload) => {
    const { taskId, status } = payload as { taskId: string; status: Status };
    statusBar?.setStatus(status);

    if (status === 'WAITING_INPUT') {
      notifications?.notify(status, taskId, `Claude Code needs input`);
    }
  });

  wsClient.on('TASK_EXIT', (payload) => {
    const { taskId, exitCode } = payload as { taskId: string; exitCode: number };
    const status: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';

    if (status === 'COMPLETED') {
      notifications?.notify(status, taskId, `Task completed successfully`);
    } else {
      notifications?.notify(status, taskId, `Task failed with code ${exitCode}`);
    }
  });

  wsClient.on('TASKS_LIST', (payload) => {
    const tasks = payload as TaskState[];
    taskTreeProvider?.updateTasks(tasks);

    // 更新状态栏
    const hasError = tasks.some((t) => t.status === 'ERROR');
    const hasWaiting = tasks.some((t) => t.status === 'WAITING_INPUT');
    const hasRunning = tasks.some((t) => t.status === 'RUNNING');

    if (hasError) {
      statusBar?.setStatus('ERROR');
    } else if (hasWaiting) {
      statusBar?.setStatus('WAITING_INPUT');
    } else if (hasRunning) {
      statusBar?.setStatus('RUNNING');
    } else {
      statusBar?.setStatus('COMPLETED');
    }
  });

  // 连接
  wsClient
    .connect()
    .then(() => {
      statusBar?.show();
      window.showInformationMessage('[VibeWatcher] Connected to server');
    })
    .catch(() => {
      window.showWarningMessage('[VibeWatcher] Cannot connect to server. Make sure vibewatcher-server is running.');
    });

  // 注册打开任务列表命令
  commands.registerCommand('vibewatcher.showTaskList', () => {
    commands.executeCommand('vibewatcher.taskList.focus');
  });
}

export function deactivate() {
  wsClient?.close();
  statusBar?.dispose();
}