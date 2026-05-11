import { TaskManager } from '../src/task-manager';
import { Status } from '../src/types';

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  it('should create task and notify listeners', (done) => {
    manager.onTaskCreated((taskId) => {
      expect(taskId).toBe('task-123');
      done();
    });
    manager.createTask('task-123');
  });

  it('should update status and notify listeners', (done) => {
    manager.createTask('task-123');
    manager.onTaskStatusChange((taskId, status) => {
      expect(taskId).toBe('task-123');
      expect(status).toBe('WAITING_INPUT');
      done();
    });
    manager.updateStatus('task-123', 'WAITING_INPUT');
  });

  it('should append output and notify listeners', (done) => {
    manager.createTask('task-123');
    manager.onTaskOutput((taskId, type, data) => {
      expect(taskId).toBe('task-123');
      expect(type).toBe('stdout');
      expect(data).toBe('test output');
      done();
    });
    manager.appendOutput('task-123', 'stdout', 'test output');
  });

  it('should handle task exit', (done) => {
    manager.createTask('task-123');
    manager.onTaskExit((taskId, exitCode, duration) => {
      expect(taskId).toBe('task-123');
      expect(exitCode).toBe(0);
      expect(duration).toBeGreaterThanOrEqual(0);
      done();
    });
    manager.exitTask('task-123', 0);
  });
});
