import { createTaskCreated, createTaskStatus, createTaskOutput, createTaskExit } from '../src/emitter';

describe('createTaskCreated', () => {
  it('should create TASK_CREATED message without keyword', () => {
    const event = createTaskCreated('task-123');
    expect(event.type).toBe('TASK_CREATED');
    expect(event.payload).toEqual({ taskId: 'task-123', keyword: undefined });
  });

  it('should create TASK_CREATED message with keyword', () => {
    const event = createTaskCreated('task-123', 'refactor');
    expect(event.type).toBe('TASK_CREATED');
    expect(event.payload).toEqual({ taskId: 'task-123', keyword: 'refactor' });
  });
});

describe('createTaskStatus', () => {
  it('should create TASK_STATUS message', () => {
    const event = createTaskStatus('task-123', 'RUNNING');
    expect(event.type).toBe('TASK_STATUS');
    expect(event.payload).toEqual({ taskId: 'task-123', status: 'RUNNING' });
  });
});

describe('createTaskOutput', () => {
  it('should create TASK_OUTPUT message for stdout', () => {
    const event = createTaskOutput('task-123', 'stdout', 'test output');
    expect(event.type).toBe('TASK_OUTPUT');
    expect(event.payload).toEqual({ taskId: 'task-123', type: 'stdout', data: 'test output' });
  });
});

describe('createTaskExit', () => {
  it('should create TASK_EXIT message', () => {
    const event = createTaskExit('task-123', 0, 5000);
    expect(event.type).toBe('TASK_EXIT');
    expect(event.payload).toEqual({ taskId: 'task-123', exitCode: 0, duration: 5000, keyword: undefined });
  });
});