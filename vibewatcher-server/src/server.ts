import { DEFAULT_PORT } from 'vibewatcher-shared';
import { VibeWatcherServer } from './vibewatcher-server';
import { getPidFile, checkDuplicate, writePidFile, setupDaemonHooks } from './daemon-server';

const port = parseInt(process.env.VIBEWATCH_PORT || String(DEFAULT_PORT), 10);
const pidFile = getPidFile();
const daemonMode = process.argv.includes('--daemon');

const server = new VibeWatcherServer(port);

// Check for duplicate instance in daemon mode
if (daemonMode) {
  const existing = checkDuplicate(pidFile);
  if (existing) {
    console.error(`[VibeWatcher Server] Already running (PID: ${existing}). Exiting.`);
    process.exit(1);
  }
  writePidFile(pidFile);
  setupDaemonHooks(pidFile);
}

server.start().catch((error) => {
  console.error('[VibeWatcher Server] Failed to start:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n[VibeWatcher Server] Shutting down...');
  server.stop();
  process.exit(0);
});
