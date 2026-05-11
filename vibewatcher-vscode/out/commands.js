"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = exports.copyTaskId = exports.showOutput = void 0;
const vscode_1 = require("vscode");
let outputChannel = null;
function showOutput(task) {
    if (!outputChannel) {
        outputChannel = vscode_1.window.createOutputChannel('VibeWatcher');
    }
    outputChannel.show();
    outputChannel.appendLine(`=== Task: ${task.taskId} ===`);
    outputChannel.appendLine(`Status: ${task.status}`);
    outputChannel.appendLine(`Started: ${new Date(task.startTime).toLocaleString()}`);
    if (task.exitCode !== undefined) {
        outputChannel.appendLine(`Exit Code: ${task.exitCode}`);
    }
    outputChannel.appendLine('--- Last Output ---');
    task.lastOutput.forEach((line) => outputChannel?.appendLine(line));
    outputChannel.appendLine('');
}
exports.showOutput = showOutput;
function copyTaskId(task) {
    vscode_1.env.clipboard.writeText(task.taskId);
    vscode_1.window.showInformationMessage('TaskId copied to clipboard');
}
exports.copyTaskId = copyTaskId;
function registerCommands() {
    vscode_1.commands.registerCommand('vibewatcher.showOutput', (task) => {
        showOutput(task);
    });
    vscode_1.commands.registerCommand('vibewatcher.stopTask', (task) => {
        vscode_1.window.showInformationMessage(`Stopping task ${task.taskId.substring(0, 8)}...`);
    });
    vscode_1.commands.registerCommand('vibewatcher.copyTaskId', (task) => {
        copyTaskId(task);
    });
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=commands.js.map