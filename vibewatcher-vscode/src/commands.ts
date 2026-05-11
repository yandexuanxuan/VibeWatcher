import { window, commands, env, OutputChannel } from 'vscode';
import { TaskState } from './types';

let outputChannel: OutputChannel | null = null;

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

export function registerCommands(): void {
  commands.registerCommand('vibewatcher.showOutput', (task: TaskState) => {
    showOutput(task);
  });

  commands.registerCommand('vibewatcher.stopTask', (task: TaskState) => {
    window.showInformationMessage(`Stopping task ${task.taskId.substring(0, 8)}...`);
  });

  commands.registerCommand('vibewatcher.copyTaskId', (task: TaskState) => {
    copyTaskId(task);
  });
}