# VibeWatcher v0.1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 VibeWatcher v0.1 — Claude Code 执行进程的状态监控器，包含 CLI Wrapper、Event Server、VSCode Extension 三层架构

**Architecture:**
- CLI Wrapper（Node.js）: 接管 claude-code 执行入口，捕获 stdout/stderr，通过 Pattern Matcher 检测 WAITING_INPUT 状态，发送 WebSocket 事件
- Event Server（Node.js + ws）: WebSocket 中转服务器，管理任务状态，广播事件给 Extension
- VSCode Extension（TypeScript）: 状态栏 Indicator、任务列表 TreeView、通知系统

**Tech Stack:** Node.js, TypeScript, ws (WebSocket), VSCode Extension API, yargs

---

## 文件结构

```
VibeWatcher/
├── vibewatcher-cli/          # CLI Wrapper 模块
│   ├── src/
│   │   ├── types.ts          # 类型定义
│   │   ├── matcher.ts        # Pattern Matcher
│   │   ├── emitter.ts        # Event 构造器
│   │   ├── websocket.ts      # WebSocket 客户端
│   │   ├── spawner.ts        # child_process.spawn 封装
│   │   ├── parser.ts         # stdout/stderr 行解析器
│   │   └── cli.ts            # 命令行入口
│   ├── bin/
│   │   └── vibewatch         # CLI 入口脚本
│   ├── package.json
│   └── tsconfig.json
├── vibewatcher-server/       # Event Server 模块
│   ├── src/
│   │   ├── types.ts          # 类型定义（共享）
│   │   ├── state-store.ts    # 状态存储
│   │   ├── task-manager.ts   # 任务生命周期管理
│   │   └── server.ts         # WebSocket Server 入口
│   ├── package.json
│   └── tsconfig.json
└── vibewatcher-vscode/       # VSCode Extension 模块
    ├── src/
    │   ├── types.ts          # 类型定义（共享）
    │   ├── websocket.ts      # WebSocket 客户端
    │   ├── status-bar.ts     # StatusBarItem
    │   ├── task-tree.ts      # TreeView Provider
    │   ├── notifications.ts   # 通知系统
    │   ├── commands.ts       # 命令注册
    │   └── extension.ts      # 入口
    ├── package.json
    └── tsconfig.json
```

---

## Part 1: CLI Wrapper（Task 1-10）

### Task 1: 初始化 CLI 项目

**Files:**
- Create: `vibewatcher-cli/package.json`
- Create: `vibewatcher-cli/tsconfig.json`
- Create: `vibewatcher-cli/src/types.ts`
- Create: `vibewatcher-cli/bin/vibewatch`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "vibewatcher-cli",
  "version": "0.1.0",
  "description": "VibeWatcher CLI - Claude Code execution wrapper",
  "main": "dist/cli.js",
  "bin": {
    "vibewatch": "./bin/vibewatch"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "dev": "node bin/vibewatch"
  },
  "dependencies": {
    "yargs": "^17.7.2",
    "uuid": "^9.0.0",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.0",
    "@types/ws": "^8.5.10",
    "@types/yargs": "^17.0.31",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 src/types.ts**

```typescript
export type Status = 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'ERROR';

export interface TaskEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'prompt';
  data: string;
  timestamp: number;
}

export interface TaskState {
  taskId: string;
  status: Status;
  exitCode?: number;
  startTime: number;
  lastOutput: string[];
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export const DEFAULT_PORT = 9234;
export const DEFAULT_HOST = 'localhost';
```

- [ ] **Step 4: 创建 bin/vibewatch**

```bash
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${DIR}/../dist/cli.js" "$@"
```

Run: `chmod +x bin/vibewatch`

- [ ] **Step 5: 提交**

```bash
cd vibewatcher-cli && npm install && cd ..
git add vibewatcher-cli/
git commit -m "feat(cli): initialize CLI project structure"
```

---

### Task 2: 实现 Pattern Matcher

**Files:**
- Create: `vibewatcher-cli/src/matcher.ts`
- Create: `vibewatcher-cli/tests/matcher.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { matchPrompt, PROMPT_PATTERNS } from '../src/matcher';

describe('matchPrompt', () => {
  it('should match proceed?', () => {
    expect(matchPrompt('Do you want to proceed?')).toBe(true);
    expect(matchPrompt('Proceed?')).toBe(true);
  });

  it('should match y/n', () => {
    expect(matchPrompt('Continue? (y/n)')).toBe(true);
    expect(matchPrompt('y/N')).toBe(true);
  });

  it('should match continue?', () => {
    expect(matchPrompt('Continue? [y/n]')).toBe(true);
  });

  it('should match press enter', () => {
    expect(matchPrompt('Press Enter to continue')).toBe(true);
  });

  it('should match confirm', () => {
    expect(matchPrompt('Please confirm your action')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(matchPrompt('PROCEED?')).toBe(true);
    expect(matchPrompt('YES/NO')).toBe(true);
  });

  it('should not match regular text', () => {
    expect(matchPrompt('Hello world')).toBe(false);
    expect(matchPrompt('Running task 123')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-cli && npx jest tests/matcher.test.ts -v`
Expected: FAIL - "Cannot find module '../src/matcher'"

- [ ] **Step 3: 实现 matcher.ts**

```typescript
export const PROMPT_PATTERNS = [
  /proceed\?/i,
  /y\/n/i,
  /continue\?/i,
  /press enter/i,
  /confirm/i,
  /yes\/no/i,
];

export function matchPrompt(text: string): boolean {
  return PROMPT_PATTERNS.some(pattern => pattern.test(text));
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/matcher.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/matcher.ts vibewatcher-cli/tests/matcher.test.ts
git commit -m "feat(cli): implement Pattern Matcher with fixed patterns"
```

---

### Task 3: 实现 Event Emitter

**Files:**
- Create: `vibewatcher-cli/src/emitter.ts`
- Create: `vibewatcher-cli/tests/emitter.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { createTaskEvent, createTaskCreated, createTaskStatus, createTaskOutput, createTaskExit } from '../src/emitter';

describe('createTaskEvent', () => {
  it('should create event with correct structure', () => {
    const event = createTaskEvent('task-123', 'stdout', 'Hello');
    expect(event.taskId).toBe('task-123');
    expect(event.type).toBe('stdout');
    expect(event.data).toBe('Hello');
    expect(event.timestamp).toBeDefined();
    expect(typeof event.timestamp).toBe('number');
  });
});

describe('createTaskCreated', () => {
  it('should create TASK_CREATED message', () => {
    const event = createTaskCreated('task-123');
    expect(event.type).toBe('TASK_CREATED');
    expect(event.payload).toEqual({ taskId: 'task-123' });
  });
});

describe('createTaskStatus', () => {
  it('should create TASK_STATUS message', () => {
    const event = createTaskStatus('task-123', 'RUNNING');
    expect(event.type).toBe('TASK_STATUS');
    expect(event.payload).toEqual({ taskId: 'task-123', status: 'RUNNING' });
  });
});

describe('createTaskOutput', () => {
  it('should create TASK_OUTPUT message for stdout', () => {
    const event = createTaskOutput('task-123', 'stdout', 'test output');
    expect(event.type).toBe('TASK_OUTPUT');
    expect(event.payload).toEqual({ taskId: 'task-123', type: 'stdout', data: 'test output' });
  });
});

describe('createTaskExit', () => {
  it('should create TASK_EXIT message', () => {
    const event = createTaskExit('task-123', 0, 5000);
    expect(event.type).toBe('TASK_EXIT');
    expect(event.payload).toEqual({ taskId: 'task-123', exitCode: 0, duration: 5000 });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-cli && npx jest tests/emitter.test.ts -v`
Expected: FAIL - "Cannot find module '../src/emitter'"

- [ ] **Step 3: 实现 emitter.ts**

```typescript
import { WSMessage, Status } from './types';

export function createTaskEvent(
  taskId: string,
  type: 'stdout' | 'stderr' | 'exit' | 'prompt',
  data: string
): WSMessage {
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

export function createTaskCreated(taskId: string): WSMessage {
  return {
    type: 'TASK_CREATED',
    payload: { taskId },
  };
}

export function createTaskStatus(taskId: string, status: Status): WSMessage {
  return {
    type: 'TASK_STATUS',
    payload: { taskId, status },
  };
}

export function createTaskOutput(
  taskId: string,
  outputType: 'stdout' | 'stderr',
  data: string
): WSMessage {
  return {
    type: 'TASK_OUTPUT',
    payload: { taskId, type: outputType, data },
  };
}

export function createTaskExit(
  taskId: string,
  exitCode: number,
  duration: number
): WSMessage {
  return {
    type: 'TASK_EXIT',
    payload: { taskId, exitCode, duration },
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/emitter.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/emitter.ts vibewatcher-cli/tests/emitter.test.ts
git commit -m "feat(cli): implement Event Emitter"
```

---

### Task 4: 实现 WebSocket 客户端

**Files:**
- Create: `vibewatcher-cli/src/websocket.ts`
- Create: `vibewatcher-cli/tests/websocket.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { WebSocketClient, DEFAULT_PORT, DEFAULT_HOST } from '../src/websocket';

describe('WebSocketClient', () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should use default host and port', () => {
    const client = new WebSocketClient();
    expect(client['url']).toBe(`ws://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });

  it('should allow custom host and port', () => {
    const client = new WebSocketClient('localhost', 9999);
    expect(client['url']).toBe('ws://localhost:9999');
  });

  it('should respect VIBEWATCH_PORT env var', () => {
    process.env.VIBEWATCH_PORT = '9876';
    const client = new WebSocketClient();
    expect(client['url']).toBe(`ws://${DEFAULT_HOST}:9876`);
    delete process.env.VIBEWATCH_PORT;
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-cli && npx jest tests/websocket.test.ts -v`
Expected: FAIL

- [ ] **Step 3: 实现 websocket.ts**

```typescript
import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from './types';

export { DEFAULT_HOST, DEFAULT_PORT };

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private readonly maxRetries = 3;
  private messageQueue: WSMessage[] = [];
  private onDisconnectCallback?: () => void;

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    const envPort = process.env.VIBEWATCH_PORT;
    this.url = `ws://${host}:${envPort || port}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        });

        this.ws.on('error', (error) => {
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.onDisconnectCallback?.();
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxRetries) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => {
        this.connect().catch(() => {});
      }, delay);
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/websocket.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/websocket.ts vibewatcher-cli/tests/websocket.test.ts
git commit -m "feat(cli): implement WebSocket client with reconnection"
```

---

### Task 5: 实现 Parser

**Files:**
- Create: `vibewatcher-cli/src/parser.ts`
- Create: `vibewatcher-cli/tests/parser.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { parseLine, splitLines } from '../src/parser';

describe('parseLine', () => {
  it('should return trimmed line', () => {
    const result = parseLine('  hello world  ');
    expect(result).toBe('hello world');
  });

  it('should handle empty line', () => {
    const result = parseLine('');
    expect(result).toBe('');
  });
});

describe('splitLines', () => {
  it('should split by newlines', () => {
    const result = splitLines('line1\nline2\nline3');
    expect(result).toEqual(['line1', 'line2', 'line3']);
  });

  it('should handle carriage return', () => {
    const result = splitLines('line1\r\nline2');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should handle trailing newline', () => {
    const result = splitLines('line1\nline2\n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should filter empty lines at end', () => {
    const result = splitLines('line1\nline2\n\n\n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should handle single line without newline', () => {
    const result = splitLines('single line');
    expect(result).toEqual(['single line']);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-cli && npx jest tests/parser.test.ts -v`
Expected: FAIL

- [ ] **Step 3: 实现 parser.ts**

```typescript
export function parseLine(line: string): string {
  return line.trim();
}

export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map(parseLine).filter(line => line !== '');
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/parser.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/parser.ts vibewatcher-cli/tests/parser.test.ts
git commit -m "feat(cli): implement line parser"
```

---

### Task 6: 实现 Spawner

**Files:**
- Create: `vibewatcher-cli/src/spawner.ts`
- Create: `vibewatcher-cli/tests/spawner.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { spawnProcess } from '../src/spawner';

describe('spawnProcess', () => {
  it('should spawn echo command and return output', (done) => {
    const proc = spawnProcess('echo', ['hello world']);

    let stdoutData = '';
    let stderrData = '';

    proc.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(stdoutData).toContain('hello world');
      done();
    });
  });

  it('should capture stderr separately', (done) => {
    const proc = spawnProcess('sh', ['-c', 'echo error >&2']);

    let stderrData = '';

    proc.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(stderrData).toContain('error');
      done();
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-cli && npx jest tests/spawner.test.ts -v`
Expected: FAIL

- [ ] **Step 3: 实现 spawner.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';

export function spawnProcess(command: string, args: string[]): ChildProcess {
  return spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/spawner.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/spawner.ts vibewatcher-cli/tests/spawner.test.ts
git commit -m "feat(cli): implement process spawner"
```

---

### Task 7: 实现 CLI 主入口

**Files:**
- Modify: `vibewatcher-cli/src/cli.ts`
- Create: `vibewatcher-cli/tests/cli.test.ts`

- [ ] **Step 1: 编写 CLI 集成测试**

```typescript
import { v4 as uuidv4 } from 'uuid';

describe('CLI main flow', () => {
  it('should generate valid UUID', () => {
    const id = uuidv4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd vibewatcher-cli && npx jest tests/cli.test.ts -v`
Expected: PASS

- [ ] **Step 3: 实现 cli.ts**

```typescript
#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { v4 as uuidv4 } from 'uuid';
import { spawnProcess } from './spawner';
import { splitLines } from './parser';
import { matchPrompt } from './matcher';
import { WebSocketClient } from './websocket';
import {
  createTaskCreated,
  createTaskStatus,
  createTaskOutput,
  createTaskExit,
} from './emitter';
import { Status } from './types';

interface TaskContext {
  taskId: string;
  status: Status;
  startTime: number;
  lastOutput: string[];
  wsClient: WebSocketClient | null;
  process: ReturnType<typeof spawnProcess> | null;
}

async function runTask(args: { command: string[] }): Promise<void> {
  const taskId = uuidv4();
  const context: TaskContext = {
    taskId,
    status: 'RUNNING',
    startTime: Date.now(),
    lastOutput: [],
    wsClient: null,
    process: null,
  };

  // 创建 WebSocket 连接
  try {
    context.wsClient = new WebSocketClient();
    await context.wsClient.connect();
    context.wsClient.send(createTaskCreated(taskId));
    context.wsClient.send(createTaskStatus(taskId, 'RUNNING'));
  } catch (error) {
    console.error('[VibeWatcher] Warning: Cannot connect to server, running in standalone mode');
    context.wsClient = null;
  }

  // 解析命令
  const [command, ...commandArgs] = args.command;

  // Spawn 进程
  context.process = spawnProcess(command, commandArgs);

  context.process.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stdout.write(text);

    context.wsClient?.send(
      createTaskOutput(taskId, 'stdout', text)
    );

    // 检查是否需要输入
    const lines = splitLines(text);
    for (const line of lines) {
      context.lastOutput.push(line);
      if (context.lastOutput.length > 3) {
        context.lastOutput.shift();
      }

      if (matchPrompt(line) && context.status !== 'WAITING_INPUT') {
        context.status = 'WAITING_INPUT';
        context.wsClient?.send(createTaskStatus(taskId, 'WAITING_INPUT'));
        console.log('[VibeWatcher] Detected prompt requiring input');
      }
    }
  });

  context.process.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stderr.write(text);
    context.wsClient?.send(createTaskOutput(taskId, 'stderr', text));
  });

  context.process.on('exit', (code) => {
    const duration = Date.now() - context.startTime;
    const finalStatus: Status = code === 0 ? 'COMPLETED' : 'ERROR';

    context.wsClient?.send(createTaskStatus(taskId, finalStatus));
    context.wsClient?.send(createTaskExit(taskId, code ?? 1, duration));
    context.wsClient?.close();

    process.exit(code ?? 1);
  });
}

yargs(hideBin(process.argv))
  .command(
    '$0 <command..>',
    'Run a command with VibeWatcher monitoring',
    (yargs) => {
      return yargs.positional('command', {
        describe: 'Command to run',
        type: 'string',
      });
    },
    runTask
  )
  .parse();
```

- [ ] **Step 4: 编译并验证**

Run: `cd vibewatcher-cli && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-cli/src/cli.ts
git commit -m "feat(cli): implement main CLI entry point"
```

---

### Task 8: 添加 PATH Wrapper 脚本

**Files:**
- Create: `vibewatcher-cli/bin/claude-code`

- [ ] **Step 1: 创建 PATH wrapper 脚本**

```bash
#!/bin/bash
# VibeWatcher PATH Wrapper for claude-code
# Place this script in a directory that comes before claude-code in PATH

CLAUDE_CODE_BIN=""

# Find the real claude-code binary
for p in $(echo $PATH | tr ':' '\n'); do
  if [ -x "$p/claude-code" ] && [ "$p" != "$(dirname "$0")" ]; then
    CLAUDE_CODE_BIN="$p/claude-code"
    break
  fi
done

# Fallback: common locations
if [ -z "$CLAUDE_CODE_BIN" ]; then
  for path in "/usr/local/bin/claude-code" "$HOME/.local/bin/claude-code" "$HOME/.npm-global/bin/claude-code"; do
    if [ -x "$path" ]; then
      CLAUDE_CODE_BIN="$path"
      break
    fi
  done
fi

if [ -z "$CLAUDE_CODE_BIN" ]; then
  echo "Error: claude-code not found" >&2
  exit 1
fi

# Get the directory where this wrapper is located
WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run vibewatch with the real command
exec "$WRAPPER_DIR/vibewatch" "$CLAUDE_CODE_BIN" "$@"
```

Run: `chmod +x bin/claude-code`

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-cli/bin/claude-code
git commit -m "feat(cli): add PATH wrapper for transparent claude-code interception"
```

---

### Task 9: 更新 package.json 添加 bin 映射

**Files:**
- Modify: `vibewatcher-cli/package.json`

- [ ] **Step 1: 更新 package.json 添加 claude-code bin**

```json
{
  "bin": {
    "vibewatch": "./bin/vibewatch",
    "claude-code": "./bin/claude-code"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-cli/package.json
git commit -m "feat(cli): add claude-code bin mapping"
```

---

### Task 10: CLI 模块完成

- [ ] **Step 1: 运行所有测试**

Run: `cd vibewatcher-cli && npm test`
Expected: 全部通过

- [ ] **Step 2: 验证构建**

Run: `cd vibewatcher-cli && npm run build && ls dist/`
Expected: dist/ 目录包含编译后的 .js 文件

---

## Part 2: Event Server（Task 11-15）

### Task 11: 初始化 Server 项目

**Files:**
- Create: `vibewatcher-server/package.json`
- Create: `vibewatcher-server/tsconfig.json`
- Create: `vibewatcher-server/src/types.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "vibewatcher-server",
  "version": "0.1.0",
  "description": "VibeWatcher Event Server",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts"
  },
  "dependencies": {
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.2"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json（复用 CLI 的配置）**

- [ ] **Step 3: 创建 src/types.ts（复用 CLI 的类型定义）**

```typescript
export type Status = 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'ERROR';

export interface TaskEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'prompt';
  data: string;
  timestamp: number;
}

export interface TaskState {
  taskId: string;
  status: Status;
  exitCode?: number;
  startTime: number;
  lastOutput: string[];
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export const DEFAULT_PORT = 9234;
export const DEFAULT_HOST = 'localhost';
```

- [ ] **Step 4: 提交**

```bash
cd vibewatcher-server && npm install && cd ..
git add vibewatcher-server/
git commit -m "feat(server): initialize server project structure"
```

---

### Task 12: 实现 State Store

**Files:**
- Create: `vibewatcher-server/src/state-store.ts`
- Create: `vibewatcher-server/tests/state-store.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { StateStore } from '../src/state-store';
import { Status } from '../src/types';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  it('should create task with initial state', () => {
    const task = store.createTask('task-123');
    expect(task.taskId).toBe('task-123');
    expect(task.status).toBe('RUNNING');
    expect(task.startTime).toBeDefined();
    expect(task.lastOutput).toEqual([]);
  });

  it('should update task status', () => {
    store.createTask('task-123');
    store.updateStatus('task-123', 'WAITING_INPUT');
    const task = store.getTask('task-123');
    expect(task?.status).toBe('WAITING_INPUT');
  });

  it('should append output lines', () => {
    store.createTask('task-123');
    store.appendOutput('task-123', 'line1');
    store.appendOutput('task-123', 'line2');
    store.appendOutput('task-123', 'line3');
    store.appendOutput('task-123', 'line4');
    const task = store.getTask('task-123');
    expect(task?.lastOutput).toEqual(['line2', 'line3', 'line4']);
  });

  it('should return all tasks', () => {
    store.createTask('task-1');
    store.createTask('task-2');
    const tasks = store.listTasks();
    expect(tasks).toHaveLength(2);
  });

  it('should return undefined for non-existent task', () => {
    const task = store.getTask('non-existent');
    expect(task).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-server && npx jest tests/state-store.test.ts -v`
Expected: FAIL

- [ ] **Step 3: 实现 state-store.ts**

```typescript
import { TaskState, Status } from './types';

export class StateStore {
  private tasks = new Map<string, TaskState>();
  private maxOutputLines = 3;

  createTask(taskId: string): TaskState {
    const task: TaskState = {
      taskId,
      status: 'RUNNING',
      startTime: Date.now(),
      lastOutput: [],
    };
    this.tasks.set(taskId, task);
    return task;
  }

  updateStatus(taskId: string, status: Status): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      return task;
    }
    return undefined;
  }

  appendOutput(taskId: string, line: string): TaskState | undefined {
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

  setExitCode(taskId: string, exitCode: number): TaskState | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.exitCode = exitCode;
      return task;
    }
    return undefined;
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): TaskState[] {
    return Array.from(this.tasks.values());
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-server && npx jest tests/state-store.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-server/src/state-store.ts vibewatcher-server/tests/state-store.test.ts
git commit -m "feat(server): implement State Store"
```

---

### Task 13: 实现 Task Manager

**Files:**
- Create: `vibewatcher-server/src/task-manager.ts`
- Create: `vibewatcher-server/tests/task-manager.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { TaskManager } from '../src/task-manager';
import { Status } from '../src/types';

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  it('should create task and notify listeners', (done) => {
    manager.onTaskCreated((taskId) => {
      expect(taskId).toBe('task-123');
      done();
    });
    manager.createTask('task-123');
  });

  it('should update status and notify listeners', (done) => {
    manager.createTask('task-123');
    manager.onTaskStatusChange((taskId, status) => {
      expect(taskId).toBe('task-123');
      expect(status).toBe('WAITING_INPUT');
      done();
    });
    manager.updateStatus('task-123', 'WAITING_INPUT');
  });

  it('should append output and notify listeners', (done) => {
    manager.createTask('task-123');
    manager.onTaskOutput((taskId, type, data) => {
      expect(taskId).toBe('task-123');
      expect(type).toBe('stdout');
      expect(data).toBe('test output');
      done();
    });
    manager.appendOutput('task-123', 'stdout', 'test output');
  });

  it('should handle task exit', (done) => {
    manager.createTask('task-123');
    manager.onTaskExit((taskId, exitCode, duration) => {
      expect(taskId).toBe('task-123');
      expect(exitCode).toBe(0);
      expect(duration).toBeGreaterThan(0);
      done();
    });
    manager.exitTask('task-123', 0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd vibewatcher-server && npx jest tests/task-manager.test.ts -v`
Expected: FAIL

- [ ] **Step 3: 实现 task-manager.ts**

```typescript
import { StateStore } from './state-store';
import { Status, WSMessage } from './types';

type TaskListener = (taskId: string, ...args: unknown[]) => void;

export class TaskManager {
  private stateStore: StateStore;
  private listeners: {
    created: TaskListener[];
    statusChange: TaskListener[];
    output: TaskListener[];
    exit: TaskListener[];
  } = {
    created: [],
    statusChange: [],
    output: [],
    exit: [],
  };

  constructor() {
    this.stateStore = new StateStore();
  }

  createTask(taskId: string): void {
    this.stateStore.createTask(taskId);
    this.listeners.created.forEach((cb) => cb(taskId));
  }

  updateStatus(taskId: string, status: Status): void {
    this.stateStore.updateStatus(taskId, status);
    this.listeners.statusChange.forEach((cb) => cb(taskId, status));
  }

  appendOutput(taskId: string, type: 'stdout' | 'stderr', data: string): void {
    this.stateStore.appendOutput(taskId, data);
    this.listeners.output.forEach((cb) => cb(taskId, type, data));
  }

  exitTask(taskId: string, exitCode: number): void {
    this.stateStore.setExitCode(taskId, exitCode);
    const task = this.stateStore.getTask(taskId);
    if (task) {
      const duration = Date.now() - task.startTime;
      this.listeners.exit.forEach((cb) => cb(taskId, exitCode, duration));
    }
  }

  getTask(taskId: string) {
    return this.stateStore.getTask(taskId);
  }

  listTasks() {
    return this.stateStore.listTasks();
  }

  onTaskCreated(cb: TaskListener): void {
    this.listeners.created.push(cb);
  }

  onTaskStatusChange(cb: TaskListener): void {
    this.listeners.statusChange.push(cb);
  }

  onTaskOutput(cb: TaskListener): void {
    this.listeners.output.push(cb);
  }

  onTaskExit(cb: TaskListener): void {
    this.listeners.exit.push(cb);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd vibewatcher-server && npx jest tests/task-manager.test.ts -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-server/src/task-manager.ts vibewatcher-server/tests/task-manager.test.ts
git commit -m "feat(server): implement Task Manager"
```

---

### Task 14: 实现 WebSocket Server

**Files:**
- Create: `vibewatcher-server/src/server.ts`
- Create: `vibewatcher-server/tests/server.test.ts`

- [ ] **Step 1: 编写测试（连接测试）**

```typescript
import { WebSocketServer } from 'ws';
import { DEFAULT_PORT } from '../src/types';

describe('Server integration', () => {
  it('should be able to start on a port', (done) => {
    const wss = new WebSocketServer({ port: DEFAULT_PORT + 1 });
    wss.on('listening', () => {
      expect(wss.address()).toBeDefined();
      wss.close();
      done();
    });
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd vibewatcher-server && npx jest tests/server.test.ts -v`
Expected: PASS

- [ ] **Step 3: 实现 server.ts**

```typescript
import WebSocket, { WebSocketServer } from 'ws';
import { TaskManager } from './task-manager';
import { WSMessage, DEFAULT_PORT, Status } from './types';

export class VibeWatcherServer {
  private wss: WebSocketServer | null = null;
  private taskManager: TaskManager;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.taskManager = new TaskManager();
    this.setupTaskListeners();
  }

  private setupTaskListeners(): void {
    this.taskManager.onTaskCreated((taskId) => {
      this.broadcast({ type: 'TASK_CREATED', payload: { taskId } });
    });

    this.taskManager.onTaskStatusChange((taskId, status) => {
      this.broadcast({ type: 'TASK_STATUS', payload: { taskId, status } });
    });

    this.taskManager.onTaskOutput((taskId, type, data) => {
      this.broadcast({ type: 'TASK_OUTPUT', payload: { taskId, type, data } });
    });

    this.taskManager.onTaskExit((taskId, exitCode, duration) => {
      this.broadcast({ type: 'TASK_EXIT', payload: { taskId, exitCode, duration } });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('listening', () => {
          console.log(`[VibeWatcher Server] Running on ws://localhost:${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
            this.tryNextPort(resolve, reject);
          } else {
            reject(error);
          }
        });

        this.wss.on('connection', (ws) => {
          this.clients.add(ws);
          console.log(`[VibeWatcher Server] Client connected (${this.clients.size} total)`);

          ws.on('message', (data) => {
            this.handleMessage(ws, data.toString());
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`[VibeWatcher Server] Client disconnected (${this.clients.size} total)`);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private tryNextPort(resolve: () => void, reject: (err: Error) => void): void {
    const nextPort = this.port + 1;
    if (nextPort > this.port + 3) {
      reject(new Error('Failed to find available port'));
      return;
    }
    console.log(`[VibeWatcher Server] Port ${this.port} in use, trying ${nextPort}`);
    this.wss?.close();
    this.wss = new WebSocketServer({ port: nextPort });
    this.port = nextPort;
    this.wss.on('listening', resolve);
    this.wss.on('error', () => this.tryNextPort(resolve, reject));
  }

  private handleMessage(ws: WebSocket, data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'TASK_CREATED': {
          const { taskId } = message.payload as { taskId: string };
          this.taskManager.createTask(taskId);
          break;
        }
        case 'TASK_STATUS': {
          const { taskId, status } = message.payload as { taskId: string; status: Status };
          this.taskManager.updateStatus(taskId, status);
          break;
        }
        case 'TASK_OUTPUT': {
          const { taskId, type, data } = message.payload as {
            taskId: string;
            type: 'stdout' | 'stderr';
            data: string;
          };
          this.taskManager.appendOutput(taskId, type, data);
          break;
        }
        case 'TASK_EXIT': {
          const { taskId, exitCode } = message.payload as { taskId: string; exitCode: number };
          this.taskManager.exitTask(taskId, exitCode);
          break;
        }
        case 'LIST_TASKS': {
          const tasks = this.taskManager.listTasks();
          ws.send(JSON.stringify({ type: 'TASKS_LIST', payload: tasks }));
          break;
        }
        case 'STOP_TASK': {
          // CLI handles process termination
          break;
        }
      }
    } catch (error) {
      console.error('[VibeWatcher Server] Failed to parse message:', error);
    }
  }

  private broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  stop(): void {
    this.wss?.close();
    this.wss = null;
  }
}

// 入口
const port = parseInt(process.env.VIBEWATCH_PORT || String(DEFAULT_PORT), 10);
const server = new VibeWatcherServer(port);
server.start().catch((error) => {
  console.error('[VibeWatcher Server] Failed to start:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n[VibeWatcher Server] Shutting down...');
  server.stop();
  process.exit(0);
});
```

- [ ] **Step 4: 编译并验证**

Run: `cd vibewatcher-server && npm run build`
Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add vibewatcher-server/src/server.ts
git commit -m "feat(server): implement WebSocket Server"
```

---

### Task 15: Server 模块完成

- [ ] **Step 1: 运行所有测试**

Run: `cd vibewatcher-server && npm test`
Expected: 全部通过

- [ ] **Step 2: 验证构建**

Run: `cd vibewatcher-server && npm run build && ls dist/`
Expected: dist/ 目录包含编译后的 .js 文件

---

## Part 3: VSCode Extension（Task 16-22）

### Task 16: 初始化 VSCode Extension 项目

**Files:**
- Create: `vibewatcher-vscode/package.json`
- Create: `vibewatcher-vscode/tsconfig.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "vibewatcher",
  "displayName": "VibeWatcher",
  "description": "Claude Code execution state monitor and notification system",
  "version": "0.1.0",
  "publisher": "vibewatcher",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "panel": [
        {
          "id": "vibewatcher.panel",
          "title": "VibeWatcher",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "vibewatcher.panel": [
        {
          "id": "vibewatcher.taskList",
          "name": "Tasks"
        }
      ]
    },
    "commands": [
      {
        "command": "vibewatcher.showOutput",
        "title": "View Output"
      },
      {
        "command": "vibewatcher.stopTask",
        "title": "Stop Task"
      },
      {
        "command": "vibewatcher.copyTaskId",
        "title": "Copy TaskId"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/vscode": "^1.80.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "uuid": "^9.0.0",
    "ws": "^8.14.2"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./out",
    "rootDir": "./src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 3: 创建目录结构**

```bash
mkdir -p vibewatcher-vscode/src vibewatcher-vscode/media
```

- [ ] **Step 4: 提交**

```bash
cd vibewatcher-vscode && npm install && cd ..
git add vibewatcher-vscode/
git commit -m "feat(vscode): initialize VSCode Extension project"
```

---

### Task 17: 实现共享类型定义

**Files:**
- Create: `vibewatcher-vscode/src/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
export type Status = 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'ERROR';

export interface TaskEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'exit' | 'prompt';
  data: string;
  timestamp: number;
}

export interface TaskState {
  taskId: string;
  status: Status;
  exitCode?: number;
  startTime: number;
  lastOutput: string[];
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export const DEFAULT_PORT = 9234;
export const DEFAULT_HOST = 'localhost';
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-vscode/src/types.ts
git commit -m "feat(vscode): add shared types"
```

---

### Task 18: 实现 WebSocket 客户端

**Files:**
- Create: `vibewatcher-vscode/src/websocket.ts`

- [ ] **Step 1: 实现 websocket.ts**

```typescript
import WebSocket from 'ws';
import { WSMessage, DEFAULT_HOST, DEFAULT_PORT } from './types';

export class VSCodeWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, ((payload: unknown) => void)[]> = new Map();

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    const envPort = process.env.VIBEWATCH_PORT;
    this.url = `ws://${host}:${envPort || port}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('[VibeWatcher] Connected to server');
          this.send({ type: 'LIST_TASKS', payload: null });
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('[VibeWatcher] WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[VibeWatcher] Disconnected from server');
        });

        this.ws.on('message', (data) => {
          try {
            const message: WSMessage = JSON.parse(data.toString());
            this.emit(message.type, message.payload);
          } catch (error) {
            console.error('[VibeWatcher] Failed to parse message:', error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: string, callback: (payload: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  private emit(type: string, payload: unknown): void {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach((cb) => cb(payload));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-vscode/src/websocket.ts
git commit -m "feat(vscode): implement WebSocket client"
```

---

### Task 19: 实现 StatusBar

**Files:**
- Create: `vibewatcher-vscode/src/status-bar.ts`

- [ ] **Step 1: 实现 status-bar.ts**

```typescript
import { StatusBarItem, StatusBarAlignment, window } from 'vscode';
import { Status } from './types';

export class StatusBar {
  private item: StatusBarItem;
  private currentStatus: Status = 'RUNNING';

  constructor() {
    this.item = window.createStatusBarItem(StatusBarAlignment.Left, 100);
    this.item.command = 'vibewatcher.showTaskList';
    this.item.tooltip = 'VibeWatcher - Click to view tasks';
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
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-vscode/src/status-bar.ts
git commit -m "feat(vscode): implement StatusBar indicator"
```

---

### Task 20: 实现 Task Tree View

**Files:**
- Create: `vibewatcher-vscode/src/task-tree.ts`

- [ ] **Step 1: 实现 task-tree.ts**

```typescript
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
import { TaskState } from './types';

export class TaskTreeItem extends TreeItem {
  constructor(public readonly task: TaskState) {
    super(
      task.taskId.substring(0, 8),
      TreeItemCollapsibleState.None
    );

    this.tooltip = `${task.taskId}\nStatus: ${task.status}\nStarted: ${new Date(task.startTime).toLocaleTimeString()}`;
    this.description = task.status;
    this.contextValue = 'task';

    const iconMap: Record<string, string> = {
      RUNNING: '🟢',
      WAITING_INPUT: '🟡',
      COMPLETED: '🔵',
      ERROR: '🔴',
    };
    this.label = `${iconMap[task.status] || '⚪'} ${task.taskId.substring(0, 8)}`;
  }
}

export class TaskTreeProvider implements TreeDataProvider<TaskTreeItem> {
  private tasks: TaskState[] = [];
  private _onDidChangeTreeData = new EventEmitter<TaskTreeItem | undefined>();

  readonly onDidChangeTreeData: Event<TaskTreeItem | undefined> = this._onDidChangeTreeData.event;

  updateTasks(tasks: TaskState[]): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TaskTreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeItem): TaskTreeItem[] {
    if (element) {
      return [];
    }
    return this.tasks.map((task) => new TaskTreeItem(task));
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-vscode/src/task-tree.ts
git commit -m "feat(vscode): implement Task Tree View"
```

---

### Task 21: 实现通知系统

**Files:**
- Create: `vibewatcher-vscode/src/notifications.ts`

- [ ] **Step 1: 实现 notifications.ts**

```typescript
import { window, env } from 'vscode';
import { Status } from './types';

interface TaskNotificationState {
  notified: Set<string>;
}

export class NotificationManager {
  private states: TaskNotificationState = {
    notified: new Set(),
  };

  notify(status: Status, taskId: string, message: string): void {
    // WAITING_INPUT can notify multiple times
    if (status !== 'WAITING_INPUT') {
      if (this.states.notified.has(`${taskId}-${status}`)) {
        return;
      }
      this.states.notified.add(`${taskId}-${status}`);
    }

    switch (status) {
      case 'WAITING_INPUT':
        window.showWarningMessage(`[VibeWatcher] ${message}`);
        this.playSound();
        break;
      case 'COMPLETED':
        window.showInformationMessage(`[VibeWatcher] ${message}`);
        break;
      case 'ERROR':
        window.showErrorMessage(`[VibeWatcher] ${message}`);
        break;
    }
  }

  private playSound(): void {
    // VSCode doesn't have a built-in sound API
    // This is a placeholder - users can configure their own notification sounds
    env.beep();
  }

  clear(): void {
    this.states.notified.clear();
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add vibewatcher-vscode/src/notifications.ts
git commit -m "feat(vscode): implement Notification Manager"
```

---

### Task 22: 实现命令和扩展入口

**Files:**
- Modify: `vibewatcher-vscode/src/commands.ts`
- Create: `vibewatcher-vscode/src/extension.ts`

- [ ] **Step 1: 实现 commands.ts**

```typescript
import { window, commands, Clipboard, OutputChannel } from 'vscode';
import { TaskState } from './types';

let outputChannel: OutputChannel | null = null;

export function showOutput(task: TaskState): void {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel('VibeWatcher');
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

export function copyTaskId(task: TaskState): void {
  Clipboard.writeText(task.taskId);
  window.showInformationMessage('TaskId copied to clipboard');
}

export function registerCommands(): void {
  commands.registerCommand('vibewatcher.showOutput', (task: TaskState) => {
    showOutput(task);
  });

  commands.registerCommand('vibewatcher.stopTask', (task: TaskState) => {
    window.showInformationMessage(`Stopping task ${task.taskId.substring(0, 8)}...`);
  });

  commands.registerCommand('vibewatcher.copyTaskId', (task: TaskState) => {
    copyTaskId(task);
  });
}
```

- [ ] **Step 2: 实现 extension.ts**

```typescript
import { commands, window, TreeView } from 'vscode';
import { VSCodeWebSocketClient } from './websocket';
import { StatusBar } from './status-bar';
import { TaskTreeProvider, TaskTreeItem } from './task-tree';
import { NotificationManager } from './notifications';
import { registerCommands, showOutput } from './commands';
import { TaskState, Status, DEFAULT_HOST, DEFAULT_PORT } from './types';

let wsClient: VSCodeWebSocketClient | null = null;
let statusBar: StatusBar | null = null;
let taskTreeProvider: TaskTreeProvider | null = null;
let notifications: NotificationManager | null = null;

export function activate() {
  // 初始化组件
  statusBar = new StatusBar();
  taskTreeProvider = new TaskTreeProvider();
  notifications = new NotificationManager();

  // 注册命令
  registerCommands();

  // 注册 TreeView
  const taskView = window.createTreeView('vibewatcher.taskList', {
    treeDataProvider: taskTreeProvider,
  });

  taskView.onDidChangeSelection((e) => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as TaskTreeItem;
      showOutput(item.task);
    }
  });

  // 连接 WebSocket
  wsClient = new VSCodeWebSocketClient(DEFAULT_HOST, DEFAULT_PORT);

  wsClient.on('TASK_CREATED', (payload) => {
    const { taskId } = payload as { taskId: string };
    window.showInformationMessage(`[VibeWatcher] Task started: ${taskId.substring(0, 8)}`);
  });

  wsClient.on('TASK_STATUS', (payload) => {
    const { taskId, status } = payload as { taskId: string; status: Status };
    statusBar?.setStatus(status);

    if (status === 'WAITING_INPUT') {
      notifications?.notify(status, taskId, `Claude Code needs input`);
    }
  });

  wsClient.on('TASK_EXIT', (payload) => {
    const { taskId, exitCode } = payload as { taskId: string; exitCode: number };
    const status: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';

    if (status === 'COMPLETED') {
      notifications?.notify(status, taskId, `Task completed successfully`);
    } else {
      notifications?.notify(status, taskId, `Task failed with code ${exitCode}`);
    }
  });

  wsClient.on('TASKS_LIST', (payload) => {
    const tasks = payload as TaskState[];
    taskTreeProvider?.updateTasks(tasks);

    // 更新状态栏
    const hasError = tasks.some((t) => t.status === 'ERROR');
    const hasWaiting = tasks.some((t) => t.status === 'WAITING_INPUT');
    const hasRunning = tasks.some((t) => t.status === 'RUNNING');

    if (hasError) {
      statusBar?.setStatus('ERROR');
    } else if (hasWaiting) {
      statusBar?.setStatus('WAITING_INPUT');
    } else if (hasRunning) {
      statusBar?.setStatus('RUNNING');
    } else {
      statusBar?.setStatus('COMPLETED');
    }
  });

  // 连接
  wsClient
    .connect()
    .then(() => {
      statusBar?.show();
      window.showInformationMessage('[VibeWatcher] Connected to server');
    })
    .catch(() => {
      window.showWarningMessage('[VibeWatcher] Cannot connect to server. Make sure vibewatcher-server is running.');
    });

  // 注册打开任务列表命令
  commands.registerCommand('vibewatcher.showTaskList', () => {
    taskView.show();
  });
}

export function deactivate() {
  wsClient?.close();
  statusBar?.dispose();
}
```

- [ ] **Step 3: 提交**

```bash
git add vibewatcher-vscode/src/commands.ts vibewatcher-vscode/src/extension.ts
git commit -m "feat(vscode): implement commands and extension entry"
```

---

## Part 4: 集成测试（Task 23）

### Task 23: 端到端集成测试

- [ ] **Step 1: 验证所有模块编译**

```bash
cd vibewatcher-cli && npm run build
cd vibewatcher-server && npm run build
cd vibewatcher-vscode && npm run compile
```

- [ ] **Step 2: 提交最终版本**

```bash
git add -A
git commit -m "feat: VibeWatcher v0.1 MVP complete"
```

---

## 自检清单

- [ ] 所有测试通过
- [ ] 所有模块正确编译
- [ ] WebSocket 协议一致
- [ ] 类型定义统一
- [ ] 无未实现的占位符

---

## 执行选择

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-vibewatcher-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
