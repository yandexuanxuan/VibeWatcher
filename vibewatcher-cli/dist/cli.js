#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const uuid_1 = require("uuid");
const spawner_1 = require("./spawner");
const parser_1 = require("./parser");
const matcher_1 = require("./matcher");
const websocket_1 = require("./websocket");
const emitter_1 = require("./emitter");
async function runTask(args) {
    const taskId = (0, uuid_1.v4)();
    const context = {
        taskId,
        status: 'RUNNING',
        startTime: Date.now(),
        lastOutput: [],
        wsClient: null,
        process: null,
    };
    // 创建 WebSocket 连接
    try {
        context.wsClient = new websocket_1.WebSocketClient();
        await context.wsClient.connect();
        context.wsClient.send((0, emitter_1.createTaskCreated)(taskId));
        context.wsClient.send((0, emitter_1.createTaskStatus)(taskId, 'RUNNING'));
    }
    catch (error) {
        console.error('[VibeWatcher] Warning: Cannot connect to server, running in standalone mode');
        context.wsClient = null;
    }
    // 解析命令
    const [command, ...commandArgs] = args.command;
    // Spawn 进程
    context.process = (0, spawner_1.spawnProcess)(command, commandArgs);
    context.process.stdout?.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(text);
        context.wsClient?.send((0, emitter_1.createTaskOutput)(taskId, 'stdout', text));
        // 检查是否需要输入
        const lines = (0, parser_1.splitLines)(text);
        for (const line of lines) {
            context.lastOutput.push(line);
            if (context.lastOutput.length > 3) {
                context.lastOutput.shift();
            }
            if ((0, matcher_1.matchPrompt)(line) && context.status !== 'WAITING_INPUT') {
                context.status = 'WAITING_INPUT';
                context.wsClient?.send((0, emitter_1.createTaskStatus)(taskId, 'WAITING_INPUT'));
                console.log('[VibeWatcher] Detected prompt requiring input');
            }
        }
    });
    context.process.stderr?.on('data', (data) => {
        const text = data.toString();
        process.stderr.write(text);
        context.wsClient?.send((0, emitter_1.createTaskOutput)(taskId, 'stderr', text));
    });
    context.process.on('exit', (code) => {
        const duration = Date.now() - context.startTime;
        const finalStatus = code === 0 ? 'COMPLETED' : 'ERROR';
        context.wsClient?.send((0, emitter_1.createTaskStatus)(taskId, finalStatus));
        context.wsClient?.send((0, emitter_1.createTaskExit)(taskId, code ?? 1, duration));
        context.wsClient?.close();
        process.exit(code ?? 1);
    });
}
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .command('$0 <command..>', 'Run a command with VibeWatcher monitoring', {}, runTask)
    .demandCommand(1, 'You need to specify a command to run')
    .parse();
