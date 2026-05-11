import { TaskState, Status } from './types';

export class StateStore {
  private tasks = new Map<string, TaskState>();
  private maxOutputLines = 3;

  createTask(taskId: string): TaskState {
    const task: TaskState = {
      taskId,
      status: 'RUNNING',
      startTime: Date.now(),
      lastOutput: [],
    };
    this.tasks.set(taskId, task);
    return task;
  }

  updateStatus(taskId: string, status: Status): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      return task;
    }
    return undefined;
  }

  appendOutput(taskId: string, line: string): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.lastOutput.push(line);
      if (task.lastOutput.length > this.maxOutputLines) {
        task.lastOutput.shift();
      }
      return task;
    }
    return undefined;
  }

  setExitCode(taskId: string, exitCode: number): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.exitCode = exitCode;
      return task;
    }
    return undefined;
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): TaskState[] {
    return Array.from(this.tasks.values());
  }
}