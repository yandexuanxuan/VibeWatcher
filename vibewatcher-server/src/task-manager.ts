import { StateStore, HistoryEntry } from './state-store';
import { Status } from './types';

type CreatedListener = (taskId: string) => void;
type StatusChangeListener = (taskId: string, status: Status) => void;
type OutputListener = (taskId: string, type: 'stdout' | 'stderr', data: string) => void;
type ExitListener = (taskId: string, exitCode: number, duration: number, keyword?: string) => void;
type PredictionListener = (taskId: string, prediction: { totalEstimate: number; estimatedRemaining: number; basedOn: number } | null) => void;
type UnsubscribeFn = () => void;

interface ListenerRegistry {
  created: CreatedListener[];
  statusChange: StatusChangeListener[];
  output: OutputListener[];
  exit: ExitListener[];
  prediction: PredictionListener[];
}

export class TaskManager {
  private stateStore: StateStore;
  private listeners: ListenerRegistry = {
    created: [],
    statusChange: [],
    output: [],
    exit: [],
    prediction: [],
  };
  private taskKeywords = new Map<string, string>();

  constructor() {
    this.stateStore = new StateStore();
  }

  createTask(taskId: string, keyword = 'general'): void {
    this.taskKeywords.set(taskId, keyword);
    this.stateStore.createTask(taskId);
    this.listeners.created.forEach((cb) => cb(taskId));
  }

  updateStatus(taskId: string, status: Status): void {
    this.stateStore.updateStatus(taskId, status);
    this.listeners.statusChange.forEach((cb) => cb(taskId, status));

    // Emit prediction for RUNNING tasks
    if (status === 'RUNNING') {
      const task = this.stateStore.getTask(taskId);
      if (task) {
        const elapsed = Date.now() - task.startTime;
        const keyword = this.taskKeywords.get(taskId) || 'general';
        const prediction = this.stateStore.predictDuration(keyword, elapsed);
        this.listeners.prediction.forEach((cb) => cb(taskId, prediction));
      }
    }
  }

  appendOutput(taskId: string, type: 'stdout' | 'stderr', data: string): void {
    this.stateStore.appendOutput(taskId, data);
    this.listeners.output.forEach((cb) => cb(taskId, type, data));
  }

  exitTask(taskId: string, exitCode: number, keyword?: string): void {
    this.stateStore.setExitCode(taskId, exitCode);
    const task = this.stateStore.getTask(taskId);
    if (task) {
      const duration = Date.now() - task.startTime;
      const kw = keyword || this.taskKeywords.get(taskId) || 'general';
      const finalStatus: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';

      // Record history
      const entry: HistoryEntry = {
        taskId,
        keyword: kw,
        duration,
        status: finalStatus,
        timestamp: Date.now(),
      };
      this.stateStore.addHistory(entry);

      this.listeners.exit.forEach((cb) => cb(taskId, exitCode, duration, kw));
    }
  }

  setTaskKeyword(taskId: string, keyword: string): void {
    this.taskKeywords.set(taskId, keyword);
  }

  getTask(taskId: string) {
    return this.stateStore.getTask(taskId);
  }

  listTasks() {
    return this.stateStore.listTasks();
  }

  onTaskCreated(cb: CreatedListener): UnsubscribeFn {
    this.listeners.created.push(cb);
    return () => {
      this.listeners.created = this.listeners.created.filter((l) => l !== cb);
    };
  }

  onTaskStatusChange(cb: StatusChangeListener): UnsubscribeFn {
    this.listeners.statusChange.push(cb);
    return () => {
      this.listeners.statusChange = this.listeners.statusChange.filter((l) => l !== cb);
    };
  }

  onTaskOutput(cb: OutputListener): UnsubscribeFn {
    this.listeners.output.push(cb);
    return () => {
      this.listeners.output = this.listeners.output.filter((l) => l !== cb);
    };
  }

  onTaskExit(cb: ExitListener): UnsubscribeFn {
    this.listeners.exit.push(cb);
    return () => {
      this.listeners.exit = this.listeners.exit.filter((l) => l !== cb);
    };
  }

  onTaskPrediction(cb: PredictionListener): UnsubscribeFn {
    this.listeners.prediction.push(cb);
    return () => {
      this.listeners.prediction = this.listeners.prediction.filter((l) => l !== cb);
    };
  }
}
