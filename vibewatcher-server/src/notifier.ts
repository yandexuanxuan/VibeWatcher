import https from 'https';
import { loadConfig } from './config';
import { Status } from './types';

const log = (channel: string) => (err: Error) =>
  console.error(`[VibeWatcher] ${channel} notification failed`);

interface TaskEvent {
  taskId: string;
  status: Status;
  keyword?: string;
  duration?: number;
  exitCode?: number;
}

export class Notifier {
  private recentNotifications = new Map<string, number>();

  notify(event: TaskEvent): void {
    const config = loadConfig();
    const notifications = config.notifications;
    if (!notifications) return;

    const eventEnabled = (notifications.events as Record<string, boolean | undefined>)?.[event.status];
    if (eventEnabled === false) return;

    if (!this.shouldNotify(event.taskId, event.status)) return;

    const duration = event.duration
      ? `耗时 ${Math.floor(event.duration / 1000)}s`
      : '';

    const statusText: Record<Status, string> = {
      RUNNING: '运行中',
      WAITING_INPUT: '等待输入',
      COMPLETED: '已完成',
      ERROR: '出错',
    };

    const text = `[VibeWatcher] ${statusText[event.status]}`
      + ` ${event.taskId.substring(0, 8)}`
      + (event.keyword ? ` (${event.keyword})` : '')
      + (duration ? ` · ${duration}` : '');

    if (notifications.telegram?.enabled) {
      this.sendTelegram(notifications.telegram.botToken, notifications.telegram.chatId, text);
    }

    if (notifications.slack?.enabled) {
      this.sendSlack(notifications.slack.webhookUrl, text);
    }

    if (notifications.serverchan?.enabled) {
      this.sendServerChan(notifications.serverchan.sendkey, text);
    }
  }

  private shouldNotify(taskId: string, status: Status): boolean {
    if (status === 'RUNNING') return false;
    const key = `${taskId}-${status}`;
    const now = Date.now();
    const last = this.recentNotifications.get(key);
    if (last && now - last < 3000) return false;
    this.recentNotifications.set(key, now);
    return true;
  }

  private sendTelegram(botToken: string, chatId: string, text: string): void {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });
    req.on('error', log('Telegram'));
    req.write(body);
    req.end();
  }

  private sendSlack(webhookUrl: string, text: string): void {
    let urlObj: URL;
    try {
      urlObj = new URL(webhookUrl);
    } catch {
      console.error('[VibeWatcher] Slack: invalid webhook URL');
      return;
    }

    const body = JSON.stringify({ text });
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });
    req.on('error', log('Slack'));
    req.write(body);
    req.end();
  }

  private sendServerChan(sendkey: string, text: string): void {
    const body = JSON.stringify({
      title: 'VibeWatcher',
      desp: text,
    });

    const options = {
      hostname: 'sctapi.ftqq.com',
      path: `/push/${sendkey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });
    req.on('error', log('ServerChan'));
    req.write(body);
    req.end();
  }
}
