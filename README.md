# VibeWatcher v0.2.0

> Claude Code 执行进程的状态监控器 + 事件通知系统

[![GitHub Release](https://img.shields.io/github/v/release/yandexuanxuan/VibeWatcher)](https://github.com/yandexuanxuan/VibeWatcher/releases)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.8-brightgreen)](https://nodejs.org/)

通过 CLI Wrapper 接管 Claude Code 执行入口，在 VSCode 中实时展示运行状态、预测耗时，并在任务完成或出错时触发桌面/移动端通知。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **状态栏指示器** | 🟢 运行中 / 🟡 等待输入 / 🔵 完成 / 🔴 错误 |
| **任务列表** | VSCode 侧边栏实时展示所有任务，支持运行时长和最后输出 |
| **一键终止** | 从 VSCode 点击停止正在运行的任务 |
| **Prompt 检测** | 自动识别确认提示 (`proceed?`, `y/n`, `continue?` 等) |
| **桌面通知** | 任务完成、出错、等待输入时弹出系统通知 |
| **执行摘要** | 任务完成后自动生成 Markdown 摘要（文件变更、TODO、关键输出） |
| **预测耗时** | 基于历史任务预测剩余时间 |
| **迷你输出面板** | 点击状态栏打开实时输出滚动面板 |
| **移动端通知** | 支持 Server酱（微信）/ Telegram / Slack Webhook |

---

## 系统架构

```
┌──────────────────────────────┐
│       VibeWatcher CLI        │
│  vibewatcher-cli/            │
│                              │
│  spawn claude-code process   │
│  capture stdout/stderr       │
│  emit WebSocket events       │
└─────────────┬────────────────┘
              │ WebSocket
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
│  StatusBar + TreeView        │
│  Desktop Notifications       │
└──────────────────────────────┘
```

---

## 快速开始

### 前置要求

- Node.js >= 14.8（推荐 Node 20）
- VSCode >= 1.80
- Git

### 第一步：克隆项目

```bash
git clone https://github.com/yandexuanxuan/VibeWatcher.git
cd VibeWatcher
```

### 第二步：安装依赖

```bash
# 安装所有包的依赖
cd vibewatcher-cli && npm install && cd ..
cd vibewatcher-server && npm install && cd ..
cd vibewatcher-vscode && npm install && cd ..
```

### 第三步：构建

```bash
# Node 20 切换（如果使用 nvm）
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# 构建全部三个包
npm run build
```

### 第四步：安装 VSCode 扩展

```bash
cd vibewatcher-vscode

# 打包扩展（需要先安装 vsce）
npm install -g @vscode/vsce
vsce package

# 安装到 VSCode
code --install-extension vibewatcher-*.vsix --force
```

> 💡 **提示**: 安装后需要重启 VSCode 或执行 `Ctrl+Shift+P` → `Reload Window`

### 第五步：启动服务

```bash
# 终端 1：启动 WebSocket Server
cd vibewatcher-server
node dist/server.js

# 服务将在 ws://localhost:9234 运行
```

### 第六步：使用

```bash
# 方式一：PATH 拦截（推荐，透明使用）
export PATH="/home/dev/projects/VibeWatcher/vibewatcher-cli/bin:$PATH"

# 之后直接用 claude-code 就会被监控
claude-code 帮我重构 user 模块

# 方式二：直接使用 vibewatch
./vibewatcher-cli/bin/vibewatch claude-code 帮我写一个 API
```

---

## 配置

### 移动端通知（可选）

创建配置文件 `~/.vibewatch/config.json`：

```bash
mkdir -p ~/.vibewatch
nano ~/.vibewatch/config.json
```

**Server酱（微信，推荐）**:
1. 访问 https://sct.ftqq.com/ ，扫码绑定微信
2. 点击「获取 SendKey」
3. 填写配置：

```json
{
  "notifications": {
    "serverchan": {
      "enabled": true,
      "sendkey": "你的SendKey"
    },
    "events": {
      "WAITING_INPUT": true,
      "COMPLETED": true,
      "ERROR": true
    }
  }
}
```

**Telegram Bot**:
```json
{
  "notifications": {
    "telegram": {
      "enabled": true,
      "botToken": "你的BotToken",
      "chatId": "你的ChatId"
    }
  }
}
```

---

## 常见问题

### Q: 安装扩展后不生效？

执行 `Ctrl+Shift+P` → `Reload Window`，或重启 VSCode。

### Q: VSCode 扩展图标不显示？

检查是否正确安装了扩展：
```bash
code --list-extensions | grep vibewatcher
```

### Q: Server 无法启动？

检查端口是否被占用：
```bash
lsof -i :9234
```

### Q: CLI 连接不上 Server？

确认 Server 已启动，且在正确的端口运行。可通过环境变量指定端口：
```bash
VIBEWATCH_PORT=9235 node dist/server.js
```

### Q: 如何完全卸载？

```bash
# 删除 VSCode 扩展
code --uninstall-extension vibewatcher

# 删除本地数据
rm -rf ~/.vibewatch

# 清理编译产物
npm run clean
```

---

## 命令参考

```bash
# 构建
npm run build       # 构建全部三个包
npm run clean        # 清理编译产物

# 测试
npm test            # 运行全部测试
cd vibewatcher-cli && npm test      # 只测 CLI
cd vibewatcher-server && npm test   # 只测 Server

# Server
node dist/server.js                 # 默认端口 9234
VIBEWATCH_PORT=9235 node dist/server.js  # 指定端口
```

---

## 状态机

```
INIT → RUNNING ⇄ WAITING_INPUT → COMPLETED | ERROR
```

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| 🟢 RUNNING | 进程启动 | 状态栏显示 Running |
| 🟡 WAITING_INPUT | stdout 匹配 prompt 正则 | 桌面通知 + 系统提示音 |
| 🔵 COMPLETED | exit code = 0 | 桌面通知 + 生成摘要 |
| 🔴 ERROR | exit code ≠ 0 | 错误通知 |

---

## 项目结构

```
VibeWatcher/
├── vibewatcher-cli/       # CLI Wrapper
│   ├── src/
│   │   ├── cli.ts        # 主入口
│   │   ├── spawner.ts    # 子进程管理
│   │   ├── websocket.ts  # WebSocket 客户端
│   │   ├── matcher.ts    # Prompt 检测
│   │   ├── emitter.ts    # 事件构造
│   │   ├── parser.ts     # 行解析
│   │   ├── summary.ts    # 摘要生成
│   │   └── types.ts      # 类型定义
│   └── tests/            # 单元测试（24 tests）
│
├── vibewatcher-server/   # WebSocket Server
│   ├── src/
│   │   ├── server.ts     # 主逻辑
│   │   ├── task-manager.ts
│   │   ├── state-store.ts
│   │   ├── notifier.ts   # 移动通知
│   │   ├── config.ts
│   │   └── types.ts
│   └── tests/            # 单元测试（9 tests）
│
├── vibewatcher-vscode/    # VSCode Extension
│   ├── src/
│   │   ├── extension.ts
│   │   ├── status-bar.ts
│   │   ├── task-tree.ts
│   │   ├── notifications.ts
│   │   ├── commands.ts
│   │   ├── mini-panel.ts
│   │   ├── websocket.ts
│   │   └── types.ts
│   └── media/icon.svg
│
├── CLAUDE.md             # Claude Code 开发指南
└── README.md             # 本文档
```

---

## 技术栈

- **CLI**: Node.js, TypeScript, yargs, ws
- **Server**: Node.js, TypeScript, ws
- **VSCode Extension**: TypeScript, VSCode API
- **通信**: WebSocket (端口 9234)
- **Node 版本**: >= 14.8

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| [v0.2.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.2.0) | 2026-05-12 | 执行摘要、预测耗时、移动通知、迷你面板 |
| [v0.1.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.1.0) | 2026-05-12 | 基础功能：CLI + Server + VSCode Extension |

---

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 许可证

[MIT License](LICENSE)

---

## 反馈

- 🐛 [Bug 报告](https://github.com/yandexuanxuan/VibeWatcher/issues)
- 💡 [功能请求](https://github.com/yandexuanxuan/VibeWatcher/issues)
- 📖 [学习笔记](./docs/LEARNING_NOTES.md)
