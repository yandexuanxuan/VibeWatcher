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
    STALL_DETECTED?: boolean;
  };
}

export interface StallDetectionConfig {
  enabled: boolean;
  timeoutMs: number;
  checkIntervalMs: number;
}

export interface AIConfig {
  provider: 'claude' | 'openai' | 'ollama';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface VibeWatchConfig {
  notifications?: NotificationConfig;
  stallDetection?: StallDetectionConfig;
  ai?: AIConfig;
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

const DEFAULT_STALL_TIMEOUT_MS = 300000; // 5 minutes
const DEFAULT_STALL_CHECK_INTERVAL_MS = 30000; // 30 seconds

export function getStallDetectionConfig(): StallDetectionConfig {
  const config = loadConfig();
  const stallConfig = config.stallDetection;
  return {
    enabled: stallConfig?.enabled ?? true,
    timeoutMs: stallConfig?.timeoutMs ?? DEFAULT_STALL_TIMEOUT_MS,
    checkIntervalMs: stallConfig?.checkIntervalMs ?? DEFAULT_STALL_CHECK_INTERVAL_MS,
  };
}

export function getAIConfig(): AIConfig | null {
  const config = loadConfig();
  const ai = config.ai;
  if (!ai || !ai.enabled) return null;
  return {
    provider: ai.provider ?? 'claude',
    apiKey: ai.apiKey,
    model: ai.model,
    baseUrl: ai.baseUrl,
    enabled: true,
  };
}
