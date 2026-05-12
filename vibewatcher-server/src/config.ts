import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface NotificationConfig {
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
  };
  serverchan?: {
    enabled: boolean;
    sendkey: string;
  };
  events?: {
    WAITING_INPUT?: boolean;
    COMPLETED?: boolean;
    ERROR?: boolean;
  };
}

export interface VibeWatchConfig {
  notifications?: NotificationConfig;
}

const CONFIG_PATH = path.join(os.homedir(), '.vibewatch', 'config.json');

export function loadConfig(): VibeWatchConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data) as VibeWatchConfig;
    }
  } catch {
    // ignore parse errors, return empty config
  }
  return {};
}

export function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
