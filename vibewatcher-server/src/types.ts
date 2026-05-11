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
  type: string;
  payload: unknown;
}

export const DEFAULT_PORT = 9234;
export const DEFAULT_HOST = 'localhost';