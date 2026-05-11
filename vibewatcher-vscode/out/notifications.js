"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationManager = void 0;
const vscode_1 = require("vscode");
class NotificationManager {
    constructor() {
        this.states = {
            notified: new Set(),
        };
    }
    notify(status, taskId, message) {
        // WAITING_INPUT can notify multiple times
        if (status !== 'WAITING_INPUT') {
            if (this.states.notified.has(`${taskId}-${status}`)) {
                return;
            }
            this.states.notified.add(`${taskId}-${status}`);
        }
        switch (status) {
            case 'WAITING_INPUT':
                vscode_1.window.showWarningMessage(`[VibeWatcher] ${message}`);
                this.playSound();
                break;
            case 'COMPLETED':
                vscode_1.window.showInformationMessage(`[VibeWatcher] ${message}`);
                break;
            case 'ERROR':
                vscode_1.window.showErrorMessage(`[VibeWatcher] ${message}`);
                break;
        }
    }
    playSound() {
        // VSCode doesn't have a built-in sound API
        // This is a placeholder - users can configure their own notification sounds
    }
    clear() {
        this.states.notified.clear();
    }
}
exports.NotificationManager = NotificationManager;
//# sourceMappingURL=notifications.js.map