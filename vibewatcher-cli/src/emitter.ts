import { WSMessage, Status, TaskSummary } from './types';

export function createTaskCreated(taskId: string, keyword?: string): WSMessage {
  return {
    type: 'TASK_CREATED',
    payload: { taskId, keyword },
  };
}

export function createTaskStatus(taskId: string, status: Status): WSMessage {
  return {
    type: 'TASK_STATUS',
    payload: { taskId, status },
  };
}

export function createTaskOutput(
  taskId: string,
  outputType: 'stdout' | 'stderr',
  data: string
): WSMessage {
  return {
    type: 'TASK_OUTPUT',
    payload: { taskId, type: outputType, data },
  };
}

export function createTaskExit(
  taskId: string,
  exitCode: number,
  duration: number,
  keyword?: string
): WSMessage {
  return {
    type: 'TASK_EXIT',
    payload: { taskId, exitCode, duration, keyword },
  };
}

export function createTaskSummary(summary: TaskSummary): WSMessage {
  return {
    type: 'TASK_SUMMARY',
    payload: summary,
  };
}