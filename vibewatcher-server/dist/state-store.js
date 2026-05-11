"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateStore = void 0;
class StateStore {
    constructor() {
        this.tasks = new Map();
        this.maxOutputLines = 3;
    }
    createTask(taskId) {
        const task = {
            taskId,
            status: 'RUNNING',
            startTime: Date.now(),
            lastOutput: [],
        };
        this.tasks.set(taskId, task);
        return task;
    }
    updateStatus(taskId, status) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = status;
            return task;
        }
        return undefined;
    }
    appendOutput(taskId, line) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.lastOutput.push(line);
            if (task.lastOutput.length > this.maxOutputLines) {
                task.lastOutput.shift();
            }
            return task;
        }
        return undefined;
    }
    setExitCode(taskId, exitCode) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.exitCode = exitCode;
            return task;
        }
        return undefined;
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    listTasks() {
        return Array.from(this.tasks.values());
    }
}
exports.StateStore = StateStore;
