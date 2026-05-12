import https from 'https';
import { loadConfig } from './config';
import { Status } from 'vibewatcher-shared';

interface TaskEvent {
  taskId: string;
  status: Status;
  keyword?: string;
  duration?: number;
  exitCode?: number;
}

interface NotificationPayload {
  hostname: string;
  path: string;
  body: Record<string, unknown>;
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
      this.send({
        hostname: 'api.telegram.org',
        path: `/bot${notifications.telegram.botToken}/sendMessage`,
        body: { chat_id: notifications.telegram.chatId, text, parse_mode: 'Markdown' },
      }, 'Telegram');
    }

    if (notifications.slack?.enabled) {
      try {
        const urlObj = new URL(notifications.slack.webhookUrl);
        this.send({
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          body: { text },
        }, 'Slack');
      } catch {
        console.error('[VibeWatcher] Slack: invalid webhook URL');
      }
    }

    if (notifications.serverchan?.enabled) {
      this.send({
        hostname: 'sctapi.ftqq.com',
        path: `/push/${notifications.serverchan.sendkey}`,
        body: { title: 'VibeWatcher', desp: text },
      }, 'ServerChan');
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

  private send(payload: NotificationPayload, channel: string): void {
    const body = JSON.stringify(payload.body);
    const options = {
      hostname: payload.hostname,
      path: payload.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });
    req.on('error', () => console.error(`[VibeWatcher] ${channel} notification failed`));
    req.write(body);
    req.end();
  }
}
