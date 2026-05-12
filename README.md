# VibeWatcher v0.2

Claude Code 执行进程的状态监控器 + 事件通知系统。通过 CLI Wrapper 接管执行入口，在 VSCode 中展示运行状态并触发桌面通知。

## 功能特性

- **状态栏指示器** — 🟢 运行中 / 🟡 等待输入 / 🔵 完成 / 🔴 错误，点击切换迷你输出面板
- **任务列表** — VSCode 侧边栏实时展示所有任务，支持运行时长、预计剩余时间和最后输出
- **桌面通知** — 任务完成、出错、等待输入时弹出系统通知
- **一键终止** — 从 VSCode 点击停止正在运行的任务
- **Prompt 检测** — 自动识别 Claude Code 的确认提示 (`proceed?`, `y/n`, `continue?` 等)
- **执行摘要生成** — 任务完成后自动生成 Markdown 摘要（文件变更、TODO、关键步骤）
- **预测耗时** — 基于历史任务预测运行时长和剩余时间
- **迷你输出面板** — 点击状态栏打开实时输出滚动面板
- **移动端通知** — 支持 Server酱（微信）/ Telegram Bot / Slack Webhook 推送

## 系统架构

```
┌──────────────────────────────┐
│       VibeWatcher CLI         │
│  vibewatcher-cli/            │
│                              │
│  spawn claude-code process   │
│  capture stdout/stderr        │
│  emit WebSocket events        │
└─────────────┬────────────────┘
              │ WebSocket (ws://localhost:9234)
              ↓
┌──────────────────────────────┐
│      Event Server             │
│  vibewatcher-server/         │
│                              │
│  TaskManager + StateStore    │
│  broadcast to all clients     │
└─────────────┬────────────────┘
              │
              ↓
┌──────────────────────────────┐
│   VSCode Extension           │
│  vibewatcher-vscode/        │
│                              │
│  StatusBar + TreeView       │
│  Desktop Notifications       │
└──────────────────────────────┘
```

## 快速开始

### 1. 启动服务

```bash
# 切换 Node 20（Node 14+ 也可）
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# 启动 WebSocket Server（后台运行）
cd /home/dev/projects/VibeWatcher/vibewatcher-server
node dist/server.js &
```

### 2. 安装 VSCode 扩展

```bash
cd /home/dev/projects/VibeWatcher/vibewatcher-vscode

# 打包扩展
vsce package

# 安装到 VSCode
code --install-extension vibewatcher-0.1.0.vsix --force
```

安装后重启 VSCode，左侧活动栏出现 VibeWatcher 图标。

### 3. 使用

```bash
# 方式一：PATH 拦截（推荐，透明使用）
export PATH="/home/dev/projects/VibeWatcher/vibewatcher-cli/bin:$PATH"

# 之后直接用 claude-code 就会被监控
claude-code 帮我重构 user 模块

# 方式二：直接使用 vibewatch 命令
vibewatch run "claude-code 你的任务"
```

## 一键构建

```bash
cd /home/dev/projects/VibeWatcher

npm run build   # 构建全部三个包（CLI + Server + VSCode Extension）
npm test        # 运行 CLI + Server 单元测试
npm run clean   # 清理编译产物
```

## 项目结构

```
VibeWatcher/
├── vibewatcher-cli/       # CLI Wrapper — 接管 claude-code 执行入口
│   ├── src/
│   │   ├── cli.ts         # 主入口，yargs CLI
│   │   ├── spawner.ts     # child_process.spawn 封装
│   │   ├── websocket.ts   # WebSocket 客户端（支持消息接收）
│   │   ├── matcher.ts     # Prompt 检测正则
│   │   ├── emitter.ts     # 事件消息构造器
│   │   ├── parser.ts      # 行解析
│   │   ├── summary.ts     # 执行摘要生成
│   │   └── types.ts       # 类型定义
│   └── tests/             # 单元测试（24 tests）
├── vibewatcher-server/     # WebSocket 事件服务器
│   ├── src/
│   │   ├── server.ts      # WebSocket Server 主逻辑
│   │   ├── task-manager.ts # 任务生命周期管理
│   │   ├── state-store.ts  # 内存状态存储 + 历史记录持久化
│   │   ├── notifier.ts     # 移动端通知（Telegram/Slack/Server酱）
│   │   ├── config.ts       # 配置文件读取
│   │   └── types.ts
│   └── tests/             # 单元测试（9 tests）
├── vibewatcher-vscode/     # VSCode 扩展
│   ├── src/
│   │   ├── extension.ts   # 激活入口
│   │   ├── status-bar.ts  # 状态栏
│   │   ├── task-tree.ts   # 任务列表视图
│   │   ├── notifications.ts # 通知系统
│   │   ├── commands.ts    # 命令（停止、复制、查看输出/摘要）
│   │   ├── mini-panel.ts  # 迷你输出面板
│   │   ├── websocket.ts   # WebSocket 客户端
│   │   └── types.ts
│   └── media/icon.svg
│
│       
└── scripts/
    ├── run.sh              # 一键构建+启动+运行
    ├── setup-auto.sh       # 完整安装脚本
    └── *.sh                # 测试和验证脚本
```

## 状态机

```
INIT → RUNNING ⇄ WAITING_INPUT → COMPLETED | ERROR
```

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| 🟢 RUNNING | 进程启动 | 状态栏显示 Running |
| 🟡 WAITING_INPUT | stdout 匹配 prompt 正则 | 桌面通知 + 系统提示音 |
| 🔵 COMPLETED | exit code = 0 | 桌面通知 |
| 🔴 ERROR | exit code ≠ 0 | 错误通知 |

## 版本路线图

| 版本 | 状态 | 功能 |
|------|------|------|
| v0.1 | **已完成** ✅ | CLI Wrapper + WebSocket Server + VSCode Extension |
| v0.2 | **已完成** ✅ | 执行摘要生成、预测耗时、迷你输出面板、移动端通知 |
| v0.3 | 未开始 | 智能阻塞检测、AI 状态解释器、外部硬件联动 |

## 配置文件

### 移动端通知配置

```bash
mkdir -p ~/.vibewatch
# 编辑 ~/.vibewatch/config.json
```

配置格式：
```json
{
  "notifications": {
    "serverchan": {
      "enabled": true,
      "sendkey": "你的SendKey"
    },
    "telegram": {
      "enabled": false,
      "botToken": "你的BotToken",
      "chatId": "你的ChatId"
    },
    "slack": {
      "enabled": false,
      "webhookUrl": "https://hooks.slack.com/..."
    },
    "events": {
      "WAITING_INPUT": true,
      "COMPLETED": true,
      "ERROR": true
    }
  }
}
```

详见 [docs/PRD.md](docs/PRD.md) 和 [docs/PRD1.md](docs/PRD1.md)。

## 技术细节

- **CLI**: Node.js, TypeScript, child_process, yargs, ws
- **Server**: Node.js, TypeScript, ws (WebSocketServer)
- **VSCode Extension**: TypeScript, VSCode Extension API
- **通信**: WebSocket，端口 9234（可通过 `VIBEWATCH_PORT` 环境变量配置）
- **Node 版本**: >= 14.8（推荐 Node 20）
