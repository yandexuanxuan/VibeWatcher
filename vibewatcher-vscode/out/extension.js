"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode_1 = require("vscode");
const websocket_1 = require("./websocket");
const status_bar_1 = require("./status-bar");
const task_tree_1 = require("./task-tree");
const notifications_1 = require("./notifications");
const commands_1 = require("./commands");
const types_1 = require("./types");
let wsClient = null;
let statusBar = null;
let taskTreeProvider = null;
let notifications = null;
function activate() {
    // 初始化组件
    statusBar = new status_bar_1.StatusBar();
    taskTreeProvider = new task_tree_1.TaskTreeProvider();
    notifications = new notifications_1.NotificationManager();
    // 注册命令
    (0, commands_1.registerCommands)();
    // 注册 TreeView
    const taskView = vscode_1.window.createTreeView('vibewatcher.taskList', {
        treeDataProvider: taskTreeProvider,
    });
    taskView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
            const item = e.selection[0];
            (0, commands_1.showOutput)(item.task);
        }
    });
    // 连接 WebSocket
    wsClient = new websocket_1.VSCodeWebSocketClient(types_1.DEFAULT_HOST, types_1.DEFAULT_PORT);
    wsClient.on('TASK_CREATED', (payload) => {
        const { taskId } = payload;
        vscode_1.window.showInformationMessage(`[VibeWatcher] Task started: ${taskId.substring(0, 8)}`);
    });
    wsClient.on('TASK_STATUS', (payload) => {
        const { taskId, status } = payload;
        statusBar?.setStatus(status);
        if (status === 'WAITING_INPUT') {
            notifications?.notify(status, taskId, `Claude Code needs input`);
        }
    });
    wsClient.on('TASK_EXIT', (payload) => {
        const { taskId, exitCode } = payload;
        const status = exitCode === 0 ? 'COMPLETED' : 'ERROR';
        if (status === 'COMPLETED') {
            notifications?.notify(status, taskId, `Task completed successfully`);
        }
        else {
            notifications?.notify(status, taskId, `Task failed with code ${exitCode}`);
        }
    });
    wsClient.on('TASKS_LIST', (payload) => {
        const tasks = payload;
        taskTreeProvider?.updateTasks(tasks);
        // 更新状态栏
        const hasError = tasks.some((t) => t.status === 'ERROR');
        const hasWaiting = tasks.some((t) => t.status === 'WAITING_INPUT');
        const hasRunning = tasks.some((t) => t.status === 'RUNNING');
        if (hasError) {
            statusBar?.setStatus('ERROR');
        }
        else if (hasWaiting) {
            statusBar?.setStatus('WAITING_INPUT');
        }
        else if (hasRunning) {
            statusBar?.setStatus('RUNNING');
        }
        else {
            statusBar?.setStatus('COMPLETED');
        }
    });
    // 连接
    wsClient
        .connect()
        .then(() => {
        statusBar?.show();
        vscode_1.window.showInformationMessage('[VibeWatcher] Connected to server');
    })
        .catch(() => {
        vscode_1.window.showWarningMessage('[VibeWatcher] Cannot connect to server. Make sure vibewatcher-server is running.');
    });
    // 注册打开任务列表命令
    vscode_1.commands.registerCommand('vibewatcher.showTaskList', () => {
        vscode_1.commands.executeCommand('vibewatcher.taskList.focus');
    });
}
exports.activate = activate;
function deactivate() {
    wsClient?.close();
    statusBar?.dispose();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map