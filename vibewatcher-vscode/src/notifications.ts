import { window, env } from 'vscode';
import { Status } from './types';

interface TaskNotificationState {
  notified: Set<string>;
}

export class NotificationManager {
  private states: TaskNotificationState = {
    notified: new Set(),
  };

  notify(status: Status, taskId: string, message: string): void {
    // WAITING_INPUT can notify multiple times
    if (status !== 'WAITING_INPUT') {
      if (this.states.notified.has(`${taskId}-${status}`)) {
        return;
      }
      this.states.notified.add(`${taskId}-${status}`);
    }

    switch (status) {
      case 'WAITING_INPUT':
        window.showWarningMessage(`[VibeWatcher] ${message}`);
        this.playSound();
        break;
      case 'COMPLETED':
        window.showInformationMessage(`[VibeWatcher] ${message}`);
        break;
      case 'ERROR':
        window.showErrorMessage(`[VibeWatcher] ${message}`);
        break;
    }
  }

  private playSound(): void {
    // VSCode doesn't have a built-in sound API
    // This is a placeholder - users can configure their own notification sounds
  }

  clear(): void {
    this.states.notified.clear();
  }
}