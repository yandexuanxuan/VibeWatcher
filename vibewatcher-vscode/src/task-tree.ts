import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
import { TaskState } from './types';

export class TaskTreeItem extends TreeItem {
  constructor(public readonly task: TaskState) {
    super(
      task.taskId.substring(0, 8),
      TreeItemCollapsibleState.None
    );

    this.tooltip = `${task.taskId}\nStatus: ${task.status}\nStarted: ${new Date(task.startTime).toLocaleTimeString()}`;
    this.description = task.status;
    this.contextValue = 'task';

    const iconMap: Record<string, string> = {
      RUNNING: '🟢',
      WAITING_INPUT: '🟡',
      COMPLETED: '🔵',
      ERROR: '🔴',
    };
    this.label = `${iconMap[task.status] || '⚪'} ${task.taskId.substring(0, 8)}`;
  }
}

export class TaskTreeProvider implements TreeDataProvider<TaskTreeItem> {
  private tasks: TaskState[] = [];
  private _onDidChangeTreeData = new EventEmitter<TaskTreeItem | undefined>();

  readonly onDidChangeTreeData: Event<TaskTreeItem | undefined> = this._onDidChangeTreeData.event;

  updateTasks(tasks: TaskState[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TaskTreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeItem): TaskTreeItem[] {
    if (element) {
      return [];
    }
    return this.tasks.map((task) => new TaskTreeItem(task));
  }
}
