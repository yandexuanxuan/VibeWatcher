import WebSocket from 'ws';
import { VibeWatcherServer } from '../../src/vibewatcher-server';

const PORT = 19234 + Math.floor(Math.random() * 1000) + 1000;

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

describe('Server state management', () => {
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

  it('should return empty task list initially', async () => {
    client = await createClient();
    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    expect(response.payload).toEqual([]);
  });

  it('should return task after creation', async () => {
    client = await createClient();

    send(client, { type: 'TASK_CREATED', payload: { taskId: 'state-001', keyword: 'build' } });
    await waitForMessage(client, 'TASK_CREATED');

    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    expect(response.payload).toHaveLength(1);
    expect(response.payload[0].taskId).toBe('state-001');
    expect(response.payload[0].status).toBe('RUNNING');
  });

  it('should update task status in state', async () => {
    client = await createClient();

    send(client, { type: 'TASK_CREATED', payload: { taskId: 'state-002', keyword: 'test' } });
    await waitForMessage(client, 'TASK_CREATED');

    send(client, { type: 'TASK_STATUS', payload: { taskId: 'state-002', status: 'WAITING_INPUT' } });
    await waitForMessage(client, 'TASK_STATUS');

    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    const task = response.payload.find((t: any) => t.taskId === 'state-002');
    expect(task.status).toBe('WAITING_INPUT');
  });

  it('should track output lines', async () => {
    client = await createClient();

    send(client, { type: 'TASK_CREATED', payload: { taskId: 'state-003', keyword: 'test' } });
    await waitForMessage(client, 'TASK_CREATED');

    send(client, { type: 'TASK_OUTPUT', payload: { taskId: 'state-003', type: 'stdout', data: 'line1' } });
    await waitForMessage(client, 'TASK_OUTPUT');
    send(client, { type: 'TASK_OUTPUT', payload: { taskId: 'state-003', type: 'stdout', data: 'line2' } });
    await waitForMessage(client, 'TASK_OUTPUT');

    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    const task = response.payload.find((t: any) => t.taskId === 'state-003');
    expect(task.lastOutput).toContain('line2');
  });

  it('should broadcast events to multiple clients', async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    // Both clients listen for TASK_CREATED
    const msg1Promise = waitForMessage(client1, 'TASK_CREATED');
    const msg2Promise = waitForMessage(client2, 'TASK_CREATED');

    send(client1, { type: 'TASK_CREATED', payload: { taskId: 'state-004', keyword: 'deploy' } });

    const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);
    expect(msg1.payload.taskId).toBe('state-004');
    expect(msg2.payload.taskId).toBe('state-004');

    client1.close();
    client2.close();
  });

  it('should reject invalid message types', async () => {
    client = await createClient();

    // Send an invalid message type — should not crash server
    send(client, { type: 'INVALID_TYPE', payload: {} } as any);

    // Server should still respond to valid requests
    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    expect(response.type).toBe('TASKS_LIST');
  });

  it('should include lastOutputTime in task state', async () => {
    client = await createClient();

    send(client, { type: 'TASK_CREATED', payload: { taskId: 'state-005', keyword: 'test' } });
    await waitForMessage(client, 'TASK_CREATED');

    send(client, { type: 'LIST_TASKS', payload: null });
    const response = await waitForMessage(client, 'TASKS_LIST');
    const task = response.payload.find((t: any) => t.taskId === 'state-005');
    expect(task.lastOutputTime).toBeDefined();
    expect(typeof task.lastOutputTime).toBe('number');
  });
});
