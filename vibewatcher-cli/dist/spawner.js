"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnProcess = void 0;
const child_process_1 = require("child_process");
function spawnProcess(command, args) {
    return (0, child_process_1.spawn)(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
    });
}
exports.spawnProcess = spawnProcess;
