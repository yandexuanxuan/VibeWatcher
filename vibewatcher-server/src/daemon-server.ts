import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const INSTALL_DIR = process.env.VIBEWATCH_HOME || path.join(os.homedir(), '.vibewatch');
const PID_DIR = path.join(INSTALL_DIR, 'run');
const DEFAULT_PID_FILE = path.join(PID_DIR, 'vibewatcher.pid');

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writePidFile(pidFile: string): void {
  ensureDir(path.dirname(pidFile));
  fs.writeFileSync(pidFile, String(process.pid), { mode: 0o644 });
}

export function removePidFile(pidFile: string): void {
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // Ignore if already removed
  }
}

export function readPidFile(pidFile: string): number | null {
  try {
    const content = fs.readFileSync(pidFile, 'utf8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function setupDaemonHooks(pidFile: string): void {
  const cleanup = () => {
    removePidFile(pidFile);
  };

  process.on('SIGTERM', () => {
    console.log('[VibeWatcher] Received SIGTERM, shutting down...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[VibeWatcher] Received SIGINT, shutting down...');
    cleanup();
    process.exit(0);
  });

  process.on('exit', () => {
    cleanup();
  });

  process.on('uncaughtException', (error) => {
    console.error('[VibeWatcher] Uncaught exception:', error);
    cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[VibeWatcher] Unhandled rejection:', reason);
    cleanup();
    process.exit(1);
  });
}

export function checkDuplicate(pidFile: string): number | null {
  const existingPid = readPidFile(pidFile);
  if (existingPid && isProcessRunning(existingPid)) {
    return existingPid;
  }
  // Clean stale PID file
  if (existingPid) {
    removePidFile(pidFile);
  }
  return null;
}

export function getPidFile(): string {
  return process.env.VIBEWATCH_PID_FILE || DEFAULT_PID_FILE;
}
