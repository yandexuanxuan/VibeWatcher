import { StateStore } from '../src/state-store';
import { Status } from '../src/types';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  it('should create task with initial state', () => {
    const task = store.createTask('task-123');
    expect(task.taskId).toBe('task-123');
    expect(task.status).toBe('RUNNING');
    expect(task.startTime).toBeDefined();
    expect(task.lastOutput).toEqual([]);
  });

  it('should update task status', () => {
    store.createTask('task-123');
    store.updateStatus('task-123', 'WAITING_INPUT');
    const task = store.getTask('task-123');
    expect(task && task.status).toBe('WAITING_INPUT');
  });

  it('should append output lines', () => {
    store.createTask('task-123');
    store.appendOutput('task-123', 'line1');
    store.appendOutput('task-123', 'line2');
    store.appendOutput('task-123', 'line3');
    store.appendOutput('task-123', 'line4');
    const task = store.getTask('task-123');
    expect(task && task.lastOutput).toEqual(['line2', 'line3', 'line4']);
  });

  it('should return all tasks', () => {
    store.createTask('task-1');
    store.createTask('task-2');
    const tasks = store.listTasks();
    expect(tasks).toHaveLength(2);
  });

  it('should return undefined for non-existent task', () => {
    const task = store.getTask('non-existent');
    expect(task).toBeUndefined();
  });
});