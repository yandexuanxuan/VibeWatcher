import { StateStore } from './state-store';
import { Status, WSMessage } from './types';

type TaskListener = (taskId: string, ...args: unknown[]) => void;

export class TaskManager {
  private stateStore: StateStore;
  private listeners: {
    created: TaskListener[];
    statusChange: TaskListener[];
    output: TaskListener[];
    exit: TaskListener[];
  } = {
    created: [],
    statusChange: [],
    output: [],
    exit: [],
  };

  constructor() {
    this.stateStore = new StateStore();
  }

  createTask(taskId: string): void {
    this.stateStore.createTask(taskId);
    this.listeners.created.forEach((cb) => cb(taskId));
  }

  updateStatus(taskId: string, status: Status): void {
    this.stateStore.updateStatus(taskId, status);
    this.listeners.statusChange.forEach((cb) => cb(taskId, status));
  }

  appendOutput(taskId: string, type: 'stdout' | 'stderr', data: string): void {
    this.stateStore.appendOutput(taskId, data);
    this.listeners.output.forEach((cb) => cb(taskId, type, data));
  }

  exitTask(taskId: string, exitCode: number): void {
    this.stateStore.setExitCode(taskId, exitCode);
    const task = this.stateStore.getTask(taskId);
    if (task) {
      const duration = Date.now() - task.startTime;
      this.listeners.exit.forEach((cb) => cb(taskId, exitCode, duration));
    }
  }

  getTask(taskId: string) {
    return this.stateStore.getTask(taskId);
  }

  listTasks() {
    return this.stateStore.listTasks();
  }

  onTaskCreated(cb: TaskListener): void {
    this.listeners.created.push(cb);
  }

  onTaskStatusChange(cb: TaskListener): void {
    this.listeners.statusChange.push(cb);
  }

  onTaskOutput(cb: TaskListener): void {
    this.listeners.output.push(cb);
  }

  onTaskExit(cb: TaskListener): void {
    this.listeners.exit.push(cb);
  }
}
