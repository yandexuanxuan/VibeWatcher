import { StatusBarItem, StatusBarAlignment, window } from 'vscode';
import { Status } from './types';

export class StatusBar {
  private item: StatusBarItem;
  private currentStatus: Status = 'RUNNING';

  constructor() {
    this.item = window.createStatusBarItem(StatusBarAlignment.Left, 100);
    this.item.command = 'vibewatcher.toggleMiniPanel';
    this.item.tooltip = 'VibeWatcher - Click to toggle mini output panel';
    this.updateDisplay();
  }

  setStatus(status: Status): void {
    this.currentStatus = status;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const statusConfig: Record<Status, { icon: string; text: string; color?: string }> = {
      RUNNING: { icon: '🟢', text: 'Running' },
      WAITING_INPUT: { icon: '🟡', text: 'Waiting' },
      COMPLETED: { icon: '🔵', text: 'Idle' },
      ERROR: { icon: '🔴', text: 'Error' },
    };

    const config = statusConfig[this.currentStatus];
    this.item.text = `${config.icon} ${config.text}`;
    if (config.color) {
      this.item.color = config.color;
    }
  }

  show(): void {
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}