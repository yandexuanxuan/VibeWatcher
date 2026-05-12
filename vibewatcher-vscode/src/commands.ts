import { window, commands, env, OutputChannel, workspace } from 'vscode';
import { TaskState, TaskSummary } from './types';
import { VSCodeWebSocketClient } from './websocket';

let outputChannel: OutputChannel | null = null;
let wsClientRef: VSCodeWebSocketClient | null = null;

export function showOutput(task: TaskState): void {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel('VibeWatcher');
  }
  outputChannel.show();
  outputChannel.appendLine(`=== Task: ${task.taskId} ===`);
  outputChannel.appendLine(`Status: ${task.status}`);
  outputChannel.appendLine(`Started: ${new Date(task.startTime).toLocaleString()}`);
  if (task.exitCode !== undefined) {
    outputChannel.appendLine(`Exit Code: ${task.exitCode}`);
  }
  outputChannel.appendLine('--- Last Output ---');
  task.lastOutput.forEach((line) => outputChannel?.appendLine(line));
  outputChannel.appendLine('');
}

export function copyTaskId(task: TaskState): void {
  env.clipboard.writeText(task.taskId);
  window.showInformationMessage('TaskId copied to clipboard');
}

export async function showSummary(summary: TaskSummary): Promise<void> {
  try {
    const doc = await workspace.openTextDocument(summary.summaryPath);
    await window.showTextDocument(doc);
  } catch {
    window.showErrorMessage(`Cannot open summary: ${summary.summaryPath}`);
  }
}

export function registerCommands(wsClient: VSCodeWebSocketClient): void {
  wsClientRef = wsClient;

  commands.registerCommand('vibewatcher.showOutput', (task: TaskState) => {
    showOutput(task);
  });

  commands.registerCommand('vibewatcher.stopTask', (task: TaskState) => {
    if (wsClientRef) {
      wsClientRef.send({ type: 'STOP_TASK', payload: { taskId: task.taskId } });
      window.showInformationMessage(`Stop signal sent to task ${task.taskId.substring(0, 8)}`);
    } else {
      window.showWarningMessage('[VibeWatcher] Not connected to server');
    }
  });

  commands.registerCommand('vibewatcher.copyTaskId', (task: TaskState) => {
    copyTaskId(task);
  });
}