import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
import { TaskState, TaskPrediction } from 'vibewatcher-shared';
import { STATUS_EMOJI, formatDuration } from './utils';

export class TaskTreeItem extends TreeItem {
  public readonly task: TaskState;
  public readonly prediction?: TaskPrediction;

  constructor(task: TaskState, prediction?: TaskPrediction) {
    super(
      task.taskId.substring(0, 8),
      TreeItemCollapsibleState.None
    );
    this.task = task;
    this.prediction = prediction;

    const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
    const elapsedStr = formatDuration(elapsed * 1000);

    const outputLines = task.lastOutput.length > 0
      ? `\n--- Output ---\n${task.lastOutput.join('\n')}`
      : '';

    let progressBar = '';
    if (task.status === 'RUNNING' && prediction && prediction.totalEstimate > 0) {
      const pct = Math.min(100, Math.floor(((elapsed * 1000) / prediction.totalEstimate) * 100));
      const filled = Math.floor(pct / 10);
      const empty = 10 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const remaining = formatDuration(prediction.estimatedRemaining);
      progressBar = `\nPrediction: [${bar}] ${pct}% 预计剩余 ${remaining} (基于${prediction.basedOn}个历史任务)`;
    }

    this.tooltip = `${task.taskId}\nStatus: ${task.status}\nRuntime: ${elapsedStr}\nStarted: ${new Date(task.startTime).toLocaleTimeString()}${outputLines}${progressBar}`;
    this.description = prediction && task.status === 'RUNNING'
      ? `${task.status} · ${formatDuration(prediction.estimatedRemaining)}`
      : `${task.status} · ${elapsedStr}`;
    this.contextValue = 'task';
    this.label = `${STATUS_EMOJI[task.status] || '⚪'} ${task.taskId.substring(0, 8)}`;
  }
}

export class TaskTreeProvider implements TreeDataProvider<TaskTreeItem> {
  private tasks: TaskState[] = [];
  private predictions = new Map<string, TaskPrediction>();
  private _onDidChangeTreeData = new EventEmitter<TaskTreeItem | undefined>();

  readonly onDidChangeTreeData: Event<TaskTreeItem | undefined> = this._onDidChangeTreeData.event;

  updateTasks(tasks: TaskState[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire(undefined);
  }

  updatePrediction(taskId: string, prediction: TaskPrediction): void {
    this.predictions.set(taskId, prediction);
  }

  getTreeItem(element: TaskTreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeItem): TaskTreeItem[] {
    if (element) {
      return [];
    }
    return this.tasks.map((task) => {
      const prediction = this.predictions.get(task.taskId);
      return new TaskTreeItem(task, prediction);
    });
  }
}
