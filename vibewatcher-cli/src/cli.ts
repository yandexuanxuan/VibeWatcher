#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import { v4 as uuidv4 } from 'uuid';
import { spawnProcess } from './spawner';
import { splitLines } from './parser';
import { matchPrompt } from './matcher';
import { WebSocketClient } from './websocket';
import { ensureDaemonRunning } from './daemon-client';
import {
  createTaskCreated,
  createTaskStatus,
  createTaskOutput,
  createTaskExit,
  createTaskSummary,
} from './emitter';
import { generateSummary, extractKeyword } from './summary';
import { Status } from 'vibewatcher-shared';

interface TaskContext {
  taskId: string;
  status: Status;
  startTime: number;
  lastOutput: string[];
  allOutputLines: string[];
  wsClient: WebSocketClient | null;
  child: ReturnType<typeof spawnProcess> | null;
  commandArgs: string[];
}

async function runTask(args: { command: string[] }): Promise<void> {
  const taskId = uuidv4();
  const context: TaskContext = {
    taskId,
    status: 'RUNNING',
    startTime: Date.now(),
    lastOutput: [],
    allOutputLines: [],
    wsClient: null,
    child: null,
    commandArgs: args.command,
  };

  const keyword = extractKeyword(args.command.join(' '));

  // Ensure daemon is running before connecting
  const daemonStatus = await ensureDaemonRunning();
  if (!daemonStatus.running) {
    console.warn('[VibeWatcher] Warning: Server not running, running in standalone mode');
  }

  try {
    context.wsClient = new WebSocketClient();
    await context.wsClient.connect();
    context.wsClient.send(createTaskCreated(taskId, keyword));
    context.wsClient.send(createTaskStatus(taskId, 'RUNNING'));

    context.wsClient.onMessage('STOP_TASK', (payload) => {
      const { taskId: stopTaskId } = payload as { taskId: string };
      if (stopTaskId === taskId && context.child) {
        console.log('[VibeWatcher] Received stop signal, terminating process...');
        context.child.kill('SIGTERM');
      }
    });
  } catch {
    console.warn('[VibeWatcher] Warning: Cannot connect to server, running in standalone mode');
    context.wsClient = null;
  }

  const [command, ...commandArgs] = args.command;
  const child = spawnProcess(command, commandArgs);
  context.child = child;

  if (child.stdout) {
    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);
      if (context.wsClient) {
        context.wsClient.send(createTaskOutput(taskId, 'stdout', text));
      }

      for (const line of splitLines(text)) {
        context.lastOutput.push(line);
        context.allOutputLines.push(line);
        if (context.lastOutput.length > 3) {
          context.lastOutput.shift();
        }

        if (matchPrompt(line) && context.status !== 'WAITING_INPUT') {
          context.status = 'WAITING_INPUT';
          if (context.wsClient) {
            context.wsClient.send(createTaskStatus(taskId, 'WAITING_INPUT'));
          }
          console.log('[VibeWatcher] Detected prompt requiring input');
        }
      }
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(text);
      if (context.wsClient) {
        context.wsClient.send(createTaskOutput(taskId, 'stderr', text));
      }
      for (const line of splitLines(text)) {
        context.allOutputLines.push(line);
      }
    });
  }

  child.on('exit', (code) => {
    const duration = Date.now() - context.startTime;
    const exitCode = code !== null ? code : 1;
    const finalStatus: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';

    if (context.wsClient) {
      context.wsClient.send(createTaskStatus(taskId, finalStatus));
      context.wsClient.send(createTaskExit(taskId, exitCode, duration, keyword));

      // Generate and send summary
      try {
        const summary = generateSummary({
          taskId,
          commandArgs: context.commandArgs,
          outputLines: context.allOutputLines,
          duration,
          exitCode,
        });
        context.wsClient.send(createTaskSummary(summary));
        console.log(`[VibeWatcher] Summary saved: ${summary.summaryPath}`);
      } catch (err) {
        console.error('[VibeWatcher] Failed to generate summary:', err);
      }

      context.wsClient.close();
    }

    process.exit(exitCode);
  });
}

// Parse arguments directly from process.argv to capture all tokens including options
const args = hideBin(process.argv);
if (args.length === 0) {
  console.error('Error: You need to specify a command to run');
  process.exit(1);
}
runTask({ command: args });
