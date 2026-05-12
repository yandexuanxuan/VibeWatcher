export type Status = 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'ERROR';

export interface TaskEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'prompt';
  data: string;
  timestamp: number;
}

export interface TaskState {
  taskId: string;
  status: Status;
  exitCode?: number;
  startTime: number;
  lastOutput: string[];
}

export interface WSMessage {
  type: 'TASK_CREATED' | 'TASK_STATUS' | 'TASK_OUTPUT' | 'TASK_EXIT' | 'LIST_TASKS' | 'TASKS_LIST' | 'STOP_TASK' | 'TASK_SUMMARY' | 'TASK_PREDICTION';
  payload: unknown;
}

export interface TaskSummary {
  taskId: string;
  summaryPath: string;
  duration: number;
  keyword: string;
  status: Status;
}

export interface TaskPrediction {
  taskId: string;
  estimatedRemaining: number;
  totalEstimate: number;
  basedOn: number;
}

export const DEFAULT_PORT = 9234;
export const DEFAULT_HOST = 'localhost';