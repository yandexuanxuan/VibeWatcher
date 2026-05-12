import { StateStore } from '../src/state-store';
import { StallDetector } from '../src/stall-detector';
import { StallDetectionConfig } from '../src/config';

function makeConfig(overrides: Partial<StallDetectionConfig> = {}): StallDetectionConfig {
  return {
    enabled: true,
    timeoutMs: 200,
    checkIntervalMs: 50,
    ...overrides,
  };
}

describe('StallDetector', () => {
  let store: StateStore;
  let stalled: Array<{ taskId: string; idleMs: number }>;

  beforeEach(() => {
    store = new StateStore();
    stalled = [];
  });

  afterEach(() => {
    // noop if not running
  });

  it('does not fire when output is recent', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 3000 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    store.createTask('fresh');
    store.appendOutput('fresh', 'hello');

    setTimeout(() => {
      det.stop();
      expect(stalled).toHaveLength(0);
      done();
    }, 200);
  }, 5000);

  it('fires when task has been idle', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    const t = store.createTask('old');
    t.lastOutputTime = Date.now() - 10000;

    setTimeout(() => {
      det.stop();
      expect(stalled).toHaveLength(1);
      expect(stalled[0].taskId).toBe('old');
      done();
    }, 300);
  }, 5000);

  it('does not fire twice for same task', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    const t = store.createTask('silent');
    t.lastOutputTime = Date.now() - 10000;

    setTimeout(() => {
      det.stop();
      const fires = stalled.filter(s => s.taskId === 'silent');
      expect(fires).toHaveLength(1);
      done();
    }, 500);
  }, 5000);

  it('clears alert and can fire again after clearStallAlert', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    const t = store.createTask('recover');
    t.lastOutputTime = Date.now() - 10000;

    setTimeout(() => {
      expect(stalled.some(s => s.taskId === 'recover')).toBe(true);
      det.clearStallAlert('recover');

      const t2 = store.getTask('recover')!;
      t2.lastOutputTime = Date.now() - 10000;

      setTimeout(() => {
        det.stop();
        const fires = stalled.filter(s => s.taskId === 'recover');
        expect(fires).toHaveLength(2);
        done();
      }, 300);
    }, 300);
  }, 5000);

  it('ignores completed tasks', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    const t = store.createTask('done');
    t.lastOutputTime = Date.now() - 10000;
    store.updateStatus('done', 'COMPLETED');

    setTimeout(() => {
      det.stop();
      expect(stalled).toHaveLength(0);
      done();
    }, 300);
  }, 5000);

  it('ignores error tasks', (done) => {
    const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    const t = store.createTask('errored');
    t.lastOutputTime = Date.now() - 10000;
    store.updateStatus('errored', 'ERROR');

    setTimeout(() => {
      det.stop();
      expect(stalled).toHaveLength(0);
      done();
    }, 300);
  }, 5000);

  it('does nothing when disabled', (done) => {
    store.createTask('disabled');
    const t = store.getTask('disabled')!;
    t.lastOutputTime = Date.now() - 10000;

    const det = new StallDetector(store, makeConfig({ enabled: false }));
    det.onStall((id, ms) => stalled.push({ taskId: id, idleMs: ms }));
    det.start();

    setTimeout(() => {
      det.stop();
      expect(stalled).toHaveLength(0);
      done();
    }, 300);
  }, 5000);

  it('reports isRunning correctly', () => {
    const det = new StallDetector(store, makeConfig());
    expect(det.isRunning()).toBe(false);
    det.start();
    expect(det.isRunning()).toBe(true);
    det.stop();
    expect(det.isRunning()).toBe(false);
  });

  it('prevents double start', () => {
    const det = new StallDetector(store, makeConfig());
    det.start();
    const id = (det as any).intervalId;
    det.start();
    expect((det as any).intervalId).toBe(id);
    det.stop();
  });
});