import WebSocket from 'ws';
import { VibeWatcherServer } from '../../src/vibewatcher-server';

const PORT = 19234 + Math.floor(Math.random() * 1000);

function createClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, type: string, timeout = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    const handler = (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch { /* ignore */ }
    };
    ws.on('message', handler);
  });
}

function send(ws: WebSocket, message: { type: string; payload: unknown }): void {
  ws.send(JSON.stringify(message));
}

describe('CLI → Server integration', () => {
  let server: VibeWatcherServer;
  let client: WebSocket;

  beforeAll(async () => {
    server = new VibeWatcherServer(PORT);
    await server.start();
  });

  afterAll(() => {
    server.stop();
  });

  afterEach(() => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  it('should handle full task lifecycle', async () => {
    client = await createClient();

    // Task created
    send(client, { type: 'TASK_CREATED', payload: { taskId: 'task-001', keyword: 'test' } });
    const created = await waitForMessage(client, 'TASK_CREATED');
    expect(created.payload.taskId).toBe('task-001');

    // Task status update
    send(client, { type: 'TASK_STATUS', payload: { taskId: 'task-001', status: 'RUNNING' } });
    const status = await waitForMessage(client, 'TASK_STATUS');
    expect(status.payload.taskId).toBe('task-001');
    expect(status.payload.status).toBe('RUNNING');

    // Task output
    send(client, { type: 'TASK_OUTPUT', payload: { taskId: 'task-001', type: 'stdout', data: 'hello world' } });
    const output = await waitForMessage(client, 'TASK_OUTPUT');
    expect(output.payload.data).toBe('hello world');

    // Task exit
    send(client, { type: 'TASK_EXIT', payload: { taskId: 'task-001', exitCode: 0 } });
    const exit = await waitForMessage(client, 'TASK_EXIT');
    expect(exit.payload.taskId).toBe('task-001');
    expect(exit.payload.exitCode).toBe(0);
  });

  it('should handle WAITING_INPUT status', async () => {
    client = await createClient();

    send(client, { type: 'TASK_CREATED', payload: { taskId: 'task-002', keyword: 'test' } });
    await waitForMessage(client, 'TASK_CREATED');

    send(client, { type: 'TASK_STATUS', payload: { taskId: 'task-002', status: 'WAITING_INPUT' } });
    const status = await waitForMessage(client, 'TASK_STATUS');
    expect(status.payload.status).toBe('WAITING_INPUT');
  });

  it('should broadcast STOP_TASK to all clients', async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    // Register a task first
    send(client1, { type: 'TASK_CREATED', payload: { taskId: 'task-003', keyword: 'test' } });
    await waitForMessage(client1, 'TASK_CREATED');

    // Send STOP_TASK from client2
    send(client2, { type: 'STOP_TASK', payload: { taskId: 'task-003' } });

    // Both clients should receive the broadcast
    const [stop1, stop2] = await Promise.all([
      waitForMessage(client1, 'STOP_TASK'),
      waitForMessage(client2, 'STOP_TASK'),
    ]);
    expect(stop1.payload.taskId).toBe('task-003');
    expect(stop2.payload.taskId).toBe('task-003');

    client1.close();
    client2.close();
  });

  it('should handle TASK_SUMMARY broadcast', async () => {
    client = await createClient();

    const summary = {
      taskId: 'task-004',
      summaryPath: '/tmp/test.md',
      duration: 5000,
      keyword: 'test',
      status: 'COMPLETED',
    };
    send(client, { type: 'TASK_SUMMARY', payload: summary });

    const msg = await waitForMessage(client, 'TASK_SUMMARY');
    expect(msg.payload.taskId).toBe('task-004');
    expect(msg.payload.duration).toBe(5000);
  });
});
