import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaskState, Status } from 'vibewatcher-shared';

const HISTORY_PATH = path.join(os.homedir(), '.vibewatch', 'history.json');

export interface HistoryEntry {
  taskId: string;
  keyword: string;
  duration: number;
  status: Status;
  timestamp: number;
}

interface HistoryData {
  tasks: HistoryEntry[];
}

export class StateStore {
  private tasks = new Map<string, TaskState>();
  private readonly maxOutputLines = 3;

  createTask(taskId: string): TaskState {
    const task: TaskState = {
      taskId,
      status: 'RUNNING' as Status,
      startTime: Date.now(),
      lastOutput: [],
      lastOutputTime: Date.now(),
    };
    this.tasks.set(taskId, task);
    return task;
  }

  updateStatus(taskId: string, status: Status): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    task.status = status;
    if (status === 'RUNNING') {
      task.lastOutputTime = Date.now();
    }
    return task;
  }

  appendOutput(taskId: string, line: string): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    task.lastOutput.push(line);
    task.lastOutputTime = Date.now();
    if (task.lastOutput.length > this.maxOutputLines) {
      task.lastOutput.shift();
    }
    return task;
  }

  setExitCode(taskId: string, exitCode: number): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    task.exitCode = exitCode;
    return task;
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): TaskState[] {
    return Array.from(this.tasks.values());
  }

  // --- History & Prediction ---

  addHistory(entry: HistoryEntry): void {
    const data = this.loadHistory();
    data.tasks.push(entry);
    // keep last 500 entries
    if (data.tasks.length > 500) {
      data.tasks = data.tasks.slice(-500);
    }
    this.saveHistory(data);
  }

  getHistory(keyword: string, limit = 5): HistoryEntry[] {
    const data = this.loadHistory();
    const matches = data.tasks
      .filter((t) => t.keyword === keyword && t.status === 'COMPLETED')
      .slice(-50)
      .reverse();
    return matches.slice(0, limit);
  }

  predictDuration(keyword: string, currentDuration: number): { totalEstimate: number; estimatedRemaining: number; basedOn: number } | null {
    const history = this.getHistory(keyword, 5);
    if (history.length < 1) return null;

    // Weighted average: more recent = higher weight
    let totalWeight = 0;
    let weightedSum = 0;
    const now = Date.now();
    history.forEach((entry) => {
      const age = (now - entry.timestamp) / 1000; // seconds
      const weight = 1 / (1 + age / 86400); // decay over 24h
      weightedSum += entry.duration * weight;
      totalWeight += weight;
    });

    const avgDuration = Math.round(weightedSum / totalWeight);
    const basedOn = history.length;
    const elapsed = currentDuration;
    const remaining = Math.max(0, avgDuration - elapsed);

    return {
      totalEstimate: avgDuration,
      estimatedRemaining: remaining,
      basedOn,
    };
  }

  private loadHistory(): HistoryData {
    try {
      if (fs.existsSync(HISTORY_PATH)) {
        const data = fs.readFileSync(HISTORY_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        // Handle legacy array format or proper object format
        if (Array.isArray(parsed)) {
          return { tasks: parsed };
        }
        if (parsed && Array.isArray(parsed.tasks)) {
          return parsed as HistoryData;
        }
      }
    } catch {
      // ignore
    }
    return { tasks: [] };
  }

  private saveHistory(data: HistoryData): void {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }
}
