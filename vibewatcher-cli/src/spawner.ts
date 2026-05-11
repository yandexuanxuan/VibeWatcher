import { spawn, ChildProcess } from 'child_process';

export function spawnProcess(command: string, args: string[]): ChildProcess {
  return spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
}