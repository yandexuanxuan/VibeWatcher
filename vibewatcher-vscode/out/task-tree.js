"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskTreeProvider = exports.TaskTreeItem = void 0;
const vscode_1 = require("vscode");
class TaskTreeItem extends vscode_1.TreeItem {
    constructor(task) {
        super(task.taskId.substring(0, 8), vscode_1.TreeItemCollapsibleState.None);
        this.task = task;
        this.tooltip = `${task.taskId}\nStatus: ${task.status}\nStarted: ${new Date(task.startTime).toLocaleTimeString()}`;
        this.description = task.status;
        this.contextValue = 'task';
        const iconMap = {
            RUNNING: '🟢',
            WAITING_INPUT: '🟡',
            COMPLETED: '🔵',
            ERROR: '🔴',
        };
        this.label = `${iconMap[task.status] || '⚪'} ${task.taskId.substring(0, 8)}`;
    }
}
exports.TaskTreeItem = TaskTreeItem;
class TaskTreeProvider {
    constructor() {
        this.tasks = [];
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    updateTasks(tasks) {
        this.tasks = tasks;
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return [];
        }
        return this.tasks.map((task) => new TaskTreeItem(task));
    }
}
exports.TaskTreeProvider = TaskTreeProvider;
//# sourceMappingURL=task-tree.js.map