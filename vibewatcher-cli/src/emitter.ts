import { WSMessage, Status } from './types';

export function createTaskEvent(
  taskId: string,
  type: 'stdout' | 'stderr' | 'exit' | 'prompt',
  data: string
): WSMessage {
  return {
    type: 'TASK_OUTPUT',
    payload: {
      taskId,
      type,
      data,
      timestamp: Date.now(),
    },
  };
}

export function createTaskCreated(taskId: string): WSMessage {
  return {
    type: 'TASK_CREATED',
    payload: { taskId },
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
  duration: number
): WSMessage {
  return {
    type: 'TASK_EXIT',
    payload: { taskId, exitCode, duration },
  };
}