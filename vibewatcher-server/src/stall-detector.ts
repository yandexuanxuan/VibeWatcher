import { StateStore } from './state-store';
import { StallDetectionConfig } from './config';

type StallCallback = (taskId: string, idleMs: number) => void;

export class StallDetector {
  private stateStore: StateStore;
  private config: StallDetectionConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private alertedTasks = new Set<string>();
  private onStallCallback: StallCallback | null = null;

  constructor(stateStore: StateStore, config: StallDetectionConfig) {
    this.stateStore = stateStore;
    this.config = config;
  }

  onStall(callback: StallCallback): void {
    this.onStallCallback = callback;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.check(), this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.alertedTasks.clear();
  }

  clearStallAlert(taskId: string): void {
    this.alertedTasks.delete(taskId);
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private check(): void {
    if (!this.config.enabled) return;

    const tasks = this.stateStore.listTasks();
    const now = Date.now();

    for (const task of tasks) {
      if (task.status !== 'RUNNING') {
        this.alertedTasks.delete(task.taskId);
        continue;
      }

      const idleMs = now - task.lastOutputTime;
      if (idleMs > this.config.timeoutMs) {
        if (!this.alertedTasks.has(task.taskId)) {
          this.alertedTasks.add(task.taskId);
          if (this.onStallCallback) {
            this.onStallCallback(task.taskId, idleMs);
          }
        }
      }
    }
  }
}