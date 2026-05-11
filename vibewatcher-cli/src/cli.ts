#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { v4 as uuidv4 } from 'uuid';
import { spawnProcess } from './spawner';
import { splitLines } from './parser';
import { matchPrompt } from './matcher';
import { WebSocketClient } from './websocket';
import {
  createTaskCreated,
  createTaskStatus,
  createTaskOutput,
  createTaskExit,
} from './emitter';
import { Status } from './types';

interface TaskContext {
  taskId: string;
  status: Status;
  startTime: number;
  lastOutput: string[];
  wsClient: WebSocketClient | null;
  process: ReturnType<typeof spawnProcess> | null;
}

async function runTask(args: { command: string[] }): Promise<void> {
  const taskId = uuidv4();
  const context: TaskContext = {
    taskId,
    status: 'RUNNING',
    startTime: Date.now(),
    lastOutput: [],
    wsClient: null,
    process: null,
  };

  // 创建 WebSocket 连接
  try {
    context.wsClient = new WebSocketClient();
    await context.wsClient.connect();
    context.wsClient.send(createTaskCreated(taskId));
    context.wsClient.send(createTaskStatus(taskId, 'RUNNING'));
  } catch (error) {
    console.error('[VibeWatcher] Warning: Cannot connect to server, running in standalone mode');
    context.wsClient = null;
  }

  // 解析命令
  const [command, ...commandArgs] = args.command;

  // Spawn 进程
  context.process = spawnProcess(command, commandArgs);

  context.process.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stdout.write(text);

    context.wsClient?.send(
      createTaskOutput(taskId, 'stdout', text)
    );

    // 检查是否需要输入
    const lines = splitLines(text);
    for (const line of lines) {
      context.lastOutput.push(line);
      if (context.lastOutput.length > 3) {
        context.lastOutput.shift();
      }

      if (matchPrompt(line) && context.status !== 'WAITING_INPUT') {
        context.status = 'WAITING_INPUT';
        context.wsClient?.send(createTaskStatus(taskId, 'WAITING_INPUT'));
        console.log('[VibeWatcher] Detected prompt requiring input');
      }
    }
  });

  context.process.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stderr.write(text);
    context.wsClient?.send(createTaskOutput(taskId, 'stderr', text));
  });

  context.process.on('exit', (code) => {
    const duration = Date.now() - context.startTime;
    const finalStatus: Status = code === 0 ? 'COMPLETED' : 'ERROR';

    context.wsClient?.send(createTaskStatus(taskId, finalStatus));
    context.wsClient?.send(createTaskExit(taskId, code ?? 1, duration));
    context.wsClient?.close();

    process.exit(code ?? 1);
  });
}

yargs(hideBin(process.argv))
  .command(
    '$0 <command..>',
    'Run a command with VibeWatcher monitoring',
    {},
    runTask as (args: Record<string, unknown>) => void | Promise<void>
  )
  .demandCommand(1, 'You need to specify a command to run')
  .parse();
