import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const INSTALL_DIR = process.env.VIBEWATCH_HOME || path.join(os.homedir(), '.vibewatch');
const PID_FILE = path.join(INSTALL_DIR, 'run', 'vibewatcher.pid');
const DAEMON_BIN = path.join(INSTALL_DIR, 'bin', 'vibe-daemon');

export interface DaemonStatus {
  running: boolean;
  pid?: number;
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return { running: false };
    }

    const content = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(content, 10);

    if (isNaN(pid)) {
      return { running: false };
    }

    if (isProcessRunning(pid)) {
      return { running: true, pid };
    }

    // Clean stale PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      // Ignore
    }
  } catch {
    // Ignore errors
  }

  return { running: false };
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDaemonRunning(): Promise<DaemonStatus> {
  const status = await getDaemonStatus();

  if (status.running) {
    return status;
  }

  // Try to start daemon
  if (fs.existsSync(DAEMON_BIN)) {
    return new Promise((resolve) => {
      try {
        const daemon = spawn(DAEMON_BIN, ['start'], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });

        daemon.unref();

        // Wait for daemon to start (max 10 seconds)
        const maxWait = 10000;
        const checkInterval = 500;
        const startTime = Date.now();

        const check = async () => {
          const currentStatus = await getDaemonStatus();
          if (currentStatus.running) {
            resolve(currentStatus);
          } else if (Date.now() - startTime > maxWait) {
            console.warn('[VibeWatcher] Daemon failed to start within timeout');
            resolve({ running: false });
          } else {
            setTimeout(check, checkInterval);
          }
        };

        setTimeout(check, checkInterval);
      } catch (err) {
        console.warn('[VibeWatcher] Failed to start daemon:', err);
        resolve({ running: false });
      }
    });
  }

  return status;
}

export async function isServerReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const WebSocket = require('ws');
      const DEFAULT_PORT = 9234;
      const ws = new WebSocket(`ws://localhost:${DEFAULT_PORT}`);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
