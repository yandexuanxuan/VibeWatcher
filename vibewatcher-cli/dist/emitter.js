"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskExit = exports.createTaskOutput = exports.createTaskStatus = exports.createTaskCreated = exports.createTaskEvent = void 0;
function createTaskEvent(taskId, type, data) {
    return {
        type: 'TASK_OUTPUT',
        payload: {
            taskId,
            type,
            data,
            timestamp: Date.now(),
        },
    };
}
exports.createTaskEvent = createTaskEvent;
function createTaskCreated(taskId) {
    return {
        type: 'TASK_CREATED',
        payload: { taskId },
    };
}
exports.createTaskCreated = createTaskCreated;
function createTaskStatus(taskId, status) {
    return {
        type: 'TASK_STATUS',
        payload: { taskId, status },
    };
}
exports.createTaskStatus = createTaskStatus;
function createTaskOutput(taskId, outputType, data) {
    return {
        type: 'TASK_OUTPUT',
        payload: { taskId, type: outputType, data },
    };
}
exports.createTaskOutput = createTaskOutput;
function createTaskExit(taskId, exitCode, duration) {
    return {
        type: 'TASK_EXIT',
        payload: { taskId, exitCode, duration },
    };
}
exports.createTaskExit = createTaskExit;
