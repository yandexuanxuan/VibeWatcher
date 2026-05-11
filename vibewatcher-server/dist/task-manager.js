"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskManager = void 0;
const state_store_1 = require("./state-store");
class TaskManager {
    constructor() {
        this.listeners = {
            created: [],
            statusChange: [],
            output: [],
            exit: [],
        };
        this.stateStore = new state_store_1.StateStore();
    }
    createTask(taskId) {
        this.stateStore.createTask(taskId);
        this.listeners.created.forEach((cb) => cb(taskId));
    }
    updateStatus(taskId, status) {
        this.stateStore.updateStatus(taskId, status);
        this.listeners.statusChange.forEach((cb) => cb(taskId, status));
    }
    appendOutput(taskId, type, data) {
        this.stateStore.appendOutput(taskId, data);
        this.listeners.output.forEach((cb) => cb(taskId, type, data));
    }
    exitTask(taskId, exitCode) {
        this.stateStore.setExitCode(taskId, exitCode);
        const task = this.stateStore.getTask(taskId);
        if (task) {
            const duration = Date.now() - task.startTime;
            this.listeners.exit.forEach((cb) => cb(taskId, exitCode, duration));
        }
    }
    getTask(taskId) {
        return this.stateStore.getTask(taskId);
    }
    listTasks() {
        return this.stateStore.listTasks();
    }
    onTaskCreated(cb) {
        this.listeners.created.push(cb);
    }
    onTaskStatusChange(cb) {
        this.listeners.statusChange.push(cb);
    }
    onTaskOutput(cb) {
        this.listeners.output.push(cb);
    }
    onTaskExit(cb) {
        this.listeners.exit.push(cb);
    }
}
exports.TaskManager = TaskManager;
