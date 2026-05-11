import { createTaskEvent, createTaskCreated, createTaskStatus, createTaskOutput, createTaskExit } from '../src/emitter';

describe('createTaskEvent', () => {
  it('should create event with correct structure', () => {
    const event = createTaskEvent('task-123', 'stdout', 'Hello');
    expect(event.type).toBe('TASK_OUTPUT');
    expect(event.payload).toHaveProperty('taskId', 'task-123');
    expect(event.payload).toHaveProperty('type', 'stdout');
    expect(event.payload).toHaveProperty('data', 'Hello');
    expect(event.payload).toHaveProperty('timestamp');
    expect(typeof (event.payload as any).timestamp).toBe('number');
  });
});

describe('createTaskCreated', () => {
  it('should create TASK_CREATED message', () => {
    const event = createTaskCreated('task-123');
    expect(event.type).toBe('TASK_CREATED');
    expect(event.payload).toEqual({ taskId: 'task-123' });
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
    expect(event.payload).toEqual({ taskId: 'task-123', exitCode: 0, duration: 5000 });
  });
});