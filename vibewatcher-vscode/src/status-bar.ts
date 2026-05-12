import { StatusBarItem, StatusBarAlignment, window } from 'vscode';
import { Status } from 'vibewatcher-shared';
import { STATUS_EMOJI } from './utils';

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
    const statusConfig: Record<Status, { text: string; color?: string }> = {
      RUNNING: { text: 'Running' },
      WAITING_INPUT: { text: 'Waiting' },
      COMPLETED: { text: 'Idle' },
      ERROR: { text: 'Error' },
    };

    const config = statusConfig[this.currentStatus];
    this.item.text = `${STATUS_EMOJI[this.currentStatus]} ${config.text}`;
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