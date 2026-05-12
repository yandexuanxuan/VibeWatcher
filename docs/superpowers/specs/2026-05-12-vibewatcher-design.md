# VibeWatcher v0.1 设计文档

**日期：** 2026-05-12
**版本：** v0.1 MVP

---

## 1. 产品定义

**产品名称：** VibeWatcher
**产品本质：** Claude Code 执行进程的状态监控器 + 事件通知系统

通过 CLI Wrapper 接管 Claude Code 执行入口，在 VSCode 中展示运行状态并触发提醒，实现"安装后自动生效"的无感监控。

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户终端                              │
│  $ claude-code "task"  ──→  [PATH wrapper]  ──→  CLI      │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 │ spawn + stdout/stderr capture
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    VibeWatcher CLI                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Process     │→ │ Pattern    │→ │ Event Emitter       │  │
│  │ Spawner     │  │ Matcher    │  │ (stdout/stderr/exit)│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬──────────────────────────────┘
                              │ WebSocket (ws://localhost:9234)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  VibeWatcher Event Server                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ WS Server   │→ │ Task        │→ │ State               │  │
│  │ (9234)     │  │ Manager     │  │ Store               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬──────────────────────────────┘
                              │ TreeView + StatusBarItem
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  VSCode Extension                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ StatusBar   │  │ TaskList    │  │ Notification        │  │
│  │ Indicator   │  │ View        │  │ Manager            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**核心流程：**
1. `claude-code` 命令被 PATH wrapper 拦截
2. Wrapper 启动真正的 `claude-code` 可执行文件，捕获输出
3. CLI 解析输出，匹配 Pattern，发送事件到 WebSocket Server
4. VSCode Extension 连接 WebSocket，接收事件并更新 UI

---

## 3. CLI Wrapper

### 3.1 文件结构

```
vibewatcher-cli/
├── src/
│   ├── cli.ts           # 命令行入口 (yargs)
│   ├── spawner.ts       # child_process.spawn 封装
│   ├── parser.ts        # stdout/stderr 行解析器
│   ├── matcher.ts       # Pattern Matcher (固定模式)
│   ├── emitter.ts       # Event 构造器
│   ├── websocket.ts     # WebSocket 客户端
│   └── types.ts         # 类型定义
├── bin/
│   └── vibewatch        # CLI 入口脚本
└── package.json
```

### 3.2 类型定义

```typescript
type Status = 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'ERROR';

interface TaskEvent {
  taskId: string;           // UUID v4
  type: 'stdout' | 'stderr' | 'exit' | 'prompt';
  data: string;
  timestamp: number;       // Unix ms
}

interface TaskState {
  taskId: string;
  status: Status;
  exitCode?: number;
  startTime: number;
  lastOutput: string[];     // 最后 3 行
}
```

### 3.3 Pattern Matcher（固定模式）

```typescript
const PROMPT_PATTERNS = [
  /proceed\?/i,
  /y\/n/i,
  /continue\?/i,
  /press enter/i,
  /confirm/i,
  /yes\/no/i,
];
```

### 3.4 WebSocket 配置

- 默认：`ws://localhost:9234`
- 连接失败时自动重试（3次，指数退避）
- 超时后输出警告但不阻塞任务执行
- 环境变量 `VIBEWATCH_PORT` 可覆盖端口

---

## 4. Event Server

### 4.1 文件结构

```
vibewatcher-server/
├── src/
│   ├── server.ts          # WebSocket Server 入口
│   ├── task-manager.ts    # 任务生命周期管理
│   ├── state-store.ts     # 状态存储
│   └── types.ts
└── package.json
```

### 4.2 Task Manager

```typescript
class TaskManager {
  private tasks = new Map<string, TaskState>();

  createTask(taskId: string): TaskState;
  updateStatus(taskId: string, status: Status): void;
  appendOutput(taskId: string, line: string): void;
  getTask(taskId: string): TaskState | undefined;
  listTasks(): TaskState[];
}
```

### 4.3 端口配置

- 默认 `9234`
- 环境变量 `VIBEWATCH_PORT` 可覆盖
- 端口冲突时自动尝试 `9235`, `9236`...（最多 3 个）

---

## 5. VSCode Extension

### 5.1 文件结构

```
vibewatcher-vscode/
├── src/
│   ├── extension.ts        # 入口
│   ├── commands.ts         # 命令注册
│   ├── websocket.ts        # WebSocket 客户端
│   ├── status-bar.ts       # StatusBarItem
│   ├── task-tree.ts        # TreeView Provider
│   ├── notifications.ts    # 通知系统
│   └── types.ts
├── package.json
└── README.md
```

### 5.2 状态栏 Indicator

**位置：** VSCode 状态栏左侧（`StatusBarAlignment.Left`）

**显示内容：**
- `🟢 Running` - 至少有一个 RUNNING 任务
- `🟡 Waiting` - 有 WAITING_INPUT 任务
- `🔵 Idle` - 无活动任务
- `🔴 Error` - 有 ERROR 状态任务

**点击行为：** 打开任务列表 View

### 5.3 任务列表 View

**显示内容：**
- 状态图标 + taskId（前8位）
- 状态文字
- 运行时间
- 最后输出摘要

**右键菜单：**
- `查看输出` - 打开 Output Channel
- `停止任务` - 发送停止命令到 CLI
- `复制 TaskId` - 便于调试

### 5.4 通知系统

| 状态 | 通知类型 | 内容 |
|------|---------|------|
| WAITING_INPUT | 桌面通知 + 声音 | "Claude Code 需要输入" |
| COMPLETED | 桌面通知 | "任务完成 ✓" |
| ERROR | 红色警告通知 | "任务失败 ✗" |

**通知频率限制：**
- WAITING_INPUT: 无限制
- COMPLETED: 每任务最多 1 次
- ERROR: 每任务最多 1 次

### 5.5 Output Channel

点击任务时打开 `VibeWatcher` Output Channel，显示该任务捕获的完整 stdout/stderr。

---

## 6. 状态机

```
                    ┌────────────────────────────────────────┐
                    │                                        │
                    ▼                                        │
  INIT ──→ RUNNING ──────────────────────────────→ COMPLETED│
                    │                      ▲                 │
                    │                      │                 │
                    ▼                      │                 │
              WAITING_INPUT ◀────────────────┘                │
                    │                                       │
                    │（用户输入后继续）                        │
                    ▼                                       │
               RUNNING ───────────────────────────────────────┘
                                                             
                              （错误时）
                                │
                                ▼
                            ERROR
```

**状态转换规则：**

| 当前状态 | 事件 | 下一状态 | 动作 |
|---------|------|---------|------|
| INIT | process started | RUNNING | 记录 startTime |
| RUNNING | Pattern 匹配 | WAITING_INPUT | 触发通知 |
| WAITING_INPUT | 用户继续输入 | RUNNING | 清除等待标记 |
| RUNNING | exit code = 0 | COMPLETED | 触发成功通知 |
| RUNNING | exit code ≠ 0 | ERROR | 触发错误通知 |
| WAITING_INPUT | exit code = 0 | COMPLETED | 触发成功通知 |
| WAITING_INPUT | exit code ≠ 0 | ERROR | 触发错误通知 |

**状态持久化：** 内存存储（重启后清空），Extension 重连时发送 `LIST_TASKS` 获取最新状态

---

## 7. 通信协议

### 7.1 消息格式

```typescript
interface WSMessage {
  type: string;
  payload: unknown;
}
```

### 7.2 CLI → Server（上报）

```typescript
// 创建任务
{ type: 'TASK_CREATED', payload: { taskId: string } }

// 任务状态更新
{ type: 'TASK_STATUS', payload: { taskId: string, status: Status } }

// 输出行
{ type: 'TASK_OUTPUT', payload: { taskId: string, type: 'stdout'|'stderr', data: string } }

// 任务结束
{ type: 'TASK_EXIT', payload: { taskId: string, exitCode: number, duration: number } }
```

### 7.3 Server → Extension（广播）

同 CLI → Server 格式，Extension 接收并更新 UI。

### 7.4 Extension → Server（控制）

```typescript
// 停止任务
{ type: 'STOP_TASK', payload: { taskId: string } }

// 拉取任务列表
{ type: 'LIST_TASKS' }
```

### 7.5 Server → Extension（响应）

```typescript
// LIST_TASKS 响应
{ type: 'TASKS_LIST', payload: TaskState[] }
```

---

## 8. 项目拆分

| 模块 | 技术栈 | 说明 |
|------|--------|------|
| CLI Wrapper | Node.js, TypeScript | 接管 claude-code 执行 |
| Event Server | Node.js, TypeScript, ws | WebSocket 中转 |
| VSCode Extension | TypeScript, VSCode API | UI 层 |

---

## 9. MVP 不做的东西

- AI 生成任务摘要
- 预测耗时
- 浮窗终端
- 移动端通知
- 硬件联动
- LLM 判断状态
- 多模型分析
- 自定义 Pattern 配置

---

## 10. 成功标准

**功能正确性：**
- Claude Code 启动可被捕获
- 状态能正确切换
- WAITING_INPUT 可 100% 触发通知
- COMPLETED 可即时通知

**用户体验：**
- 用户无需频繁切回 VSCode
- 至少减少 70% "检查终端行为"

---

## 11. 开发顺序

1. **CLI Wrapper**（核心，必须先做）
2. **Event Server**（通信桥梁）
3. **VSCode Extension 状态栏**
4. **Notification system**
