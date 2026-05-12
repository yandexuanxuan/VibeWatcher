import {
  Status,
  TaskState,
  WSMessage,
  TaskSummary,
  TaskPrediction,
  DEFAULT_PORT,
  DEFAULT_HOST,
} from 'vibewatcher-shared';

describe('types', () => {
  describe('Status', () => {
    it('should be a valid union type', () => {
      const statuses: Status[] = ['RUNNING', 'WAITING_INPUT', 'COMPLETED', 'ERROR'];
      statuses.forEach(status => {
        expect(['RUNNING', 'WAITING_INPUT', 'COMPLETED', 'ERROR']).toContain(status);
      });
    });
  });

  describe('TaskState', () => {
    it('should require taskId, status, and startTime', () => {
      const task: TaskState = {
        taskId: 'test-123',
        status: 'RUNNING',
        startTime: Date.now(),
        lastOutput: [],
        lastOutputTime: Date.now(),
      };
      expect(task.taskId).toBe('test-123');
      expect(task.status).toBe('RUNNING');
      expect(task.startTime).toBeDefined();
      expect(task.lastOutput).toEqual([]);
      expect(task.lastOutputTime).toBeDefined();
    });

    it('should allow optional exitCode', () => {
      const task: TaskState = {
        taskId: 'test-123',
        status: 'COMPLETED',
        startTime: Date.now(),
        lastOutput: [],
        lastOutputTime: Date.now(),
        exitCode: 0,
      };
      expect(task.exitCode).toBe(0);
    });

    it('should track lastOutput as array of strings', () => {
      const task: TaskState = {
        taskId: 'test-123',
        status: 'RUNNING',
        startTime: Date.now(),
        lastOutput: ['line 1', 'line 2', 'line 3'],
        lastOutputTime: Date.now(),
      };
      expect(task.lastOutput).toHaveLength(3);
      expect(task.lastOutput[0]).toBe('line 1');
    });
  });

  describe('WSMessage', () => {
    it('should support all message types', () => {
      const types = [
        'TASK_CREATED',
        'TASK_STATUS',
        'TASK_OUTPUT',
        'TASK_EXIT',
        'LIST_TASKS',
        'TASKS_LIST',
        'STOP_TASK',
        'TASK_SUMMARY',
        'TASK_PREDICTION',
      ] as const;

      types.forEach(type => {
        const msg: WSMessage = { type, payload: {} };
        expect(msg.type).toBe(type);
      });
    });

    it('should allow null payload', () => {
      const msg: WSMessage = { type: 'LIST_TASKS', payload: null };
      expect(msg.payload).toBeNull();
    });
  });

  describe('TaskSummary', () => {
    it('should contain required fields', () => {
      const summary: TaskSummary = {
        taskId: 'test-123',
        summaryPath: '/home/user/.vibewatch/summaries/test-123.md',
        duration: 5000,
        keyword: 'refactor',
        status: 'COMPLETED',
      };
      expect(summary.taskId).toBe('test-123');
      expect(summary.duration).toBe(5000);
      expect(summary.keyword).toBe('refactor');
    });
  });

  describe('TaskPrediction', () => {
    it('should contain prediction fields', () => {
      const prediction: TaskPrediction = {
        taskId: 'test-123',
        estimatedRemaining: 30000,
        totalEstimate: 60000,
        basedOn: 5,
      };
      expect(prediction.estimatedRemaining).toBe(30000);
      expect(prediction.totalEstimate).toBe(60000);
      expect(prediction.basedOn).toBe(5);
    });
  });

  describe('constants', () => {
    it('should have correct DEFAULT_PORT', () => {
      expect(DEFAULT_PORT).toBe(9234);
    });

    it('should have correct DEFAULT_HOST', () => {
      expect(DEFAULT_HOST).toBe('localhost');
    });
  });
});
