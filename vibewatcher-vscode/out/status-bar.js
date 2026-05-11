"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBar = void 0;
const vscode_1 = require("vscode");
class StatusBar {
    constructor() {
        this.currentStatus = 'RUNNING';
        this.item = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 100);
        this.item.command = 'vibewatcher.showTaskList';
        this.item.tooltip = 'VibeWatcher - Click to view tasks';
        this.updateDisplay();
    }
    setStatus(status) {
        this.currentStatus = status;
        this.updateDisplay();
    }
    updateDisplay() {
        const statusConfig = {
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
    show() {
        this.item.show();
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=status-bar.js.map