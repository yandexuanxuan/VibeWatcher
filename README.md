# VibeWatcher v1.0.0

> Claude Code 执行进程的状态监控器 + 事件通知系统

[![GitHub Release](https://img.shields.io/github/v/release/yandexuanxuan/VibeWatcher)](https://github.com/yandexuanxuan/VibeWatcher/releases)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.8-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Marketplace-Install-blue)](https://marketplace.visualstudio.com/items?itemName=vibewatcher-dev.vibewatcher)

通过 CLI Wrapper 接管 Claude Code 执行入口，在 VSCode 中实时展示运行状态、预测耗时，并在任务完成或出错时触发桌面/移动端通知。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **状态栏指示器** | 🟢 运行中 / 🟡 等待输入 / 🔵 完成 / 🔴 错误 |
| **任务列表** | VSCode 侧边栏实时展示所有任务，支持运行时长和最后输出 |
| **卡死检测** | 任务长时间无输出时自动告警（默认 5 分钟，可配置） |
| **一键终止** | 从 VSCode 点击停止正在运行的任务 |
| **Prompt 检测** | 自动识别确认提示 (`proceed?`, `y/n`, `continue?` 等) |
| **桌面通知** | 任务完成、出错、等待输入、卡死时弹出系统通知 |
| **执行摘要** | 任务完成后自动生成 Markdown 摘要（文件变更、TODO、关键输出） |
| **预测耗时** | 基于历史任务预测剩余时间 |
| **迷你输出面板** | 点击状态栏打开实时输出滚动面板 |
| **移动端通知** | 支持 Server酱（微信）/ Telegram / Slack Webhook |
| **AI 解读** | 可选 LLM 分析任务输出，生成人类可读的状态摘要 |

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

### 一键安装（推荐）

```bash
git clone https://github.com/yandexuanxuan/VibeWatcher.git
cd VibeWatcher
bash install.sh
```

安装脚本会自动：
1. 检查 Node.js 版本
2. 安装依赖
3. 构建项目
4. 复制二进制文件到 `~/.vibewatch/bin/`
5. 配置 Shell PATH
6. 启动后台服务

安装完成后，**重启终端**或执行 `source ~/.bashrc`（或 `source ~/.zshrc`）。

### 安装 VSCode 扩展

```bash
# 方式一：从 Marketplace 安装（推荐）
code --install-extension vibewatcher-dev.vibewatcher

# 方式二：手动打包安装
cd vibewatcher-vscode
npm install -g @vscode/vsce
vsce package
code --install-extension vibewatcher-*.vsix --force
```

> 💡 **提示**: 安装后需要重启 VSCode 或执行 `Ctrl+Shift+P` → `Reload Window`

### 扩展使用指南

安装 VibeWatcher 扩展后，你将在 VSCode 中获得以下功能：

#### 1. 活动栏图标
- VSCode 左侧活动栏会出现 **VibeWatcher 图标**（眼睛形态）
- 点击可展开任务列表视图

#### 2. 任务列表（TreeView）
- 显示当前所有 Claude Code 任务
- 每项显示：任务ID（截断）、状态、运行时长
- 状态图标：🟢 运行中 / 🟡 等待输入 / 🔵 完成 / 🔴 错误
- **双击任务**：查看详细输出
- **右键菜单**：停止任务、复制 TaskId

#### 3. 状态栏
- VSCode 底部状态栏显示当前整体状态
- 🟢 = 有任务运行中
- 🟡 = 等待用户输入
- 🔵 = 全部完成
- 🔴 = 有错误

#### 4. 通知提醒
- 任务完成/出错/等待输入时自动弹出系统通知
- 移动端（需配置）：Telegram / Slack / Server酱

#### 5. 迷你输出面板
- 命令面板（`Ctrl+Shift+P`）输入：`VibeWatcher: Toggle Mini Output Panel`
- 可实时查看任务输出流

### 开始使用

```bash
# 查看服务状态
vibe-daemon status

# 使用 Claude Code（自动确保服务运行）
vibe 帮我写一个 hello world 程序

# 或使用别名
vibe 重构 user 模块
```

---

## 命令参考

### Daemon 管理

```bash
vibe-daemon start              # 启动服务（后台运行）
vibe-daemon stop               # 停止服务
vibe-daemon restart            # 重启服务
vibe-daemon status             # 查看服务状态
vibe-daemon log                # 查看服务日志
vibe-daemon tail               # 实时跟踪日志
```

### CLI 使用

```bash
vibe claude-code <命令>         # 使用 Claude Code（推荐）
vibewatch claude-code <命令>    # 直接调用
```

### 构建和测试

```bash
npm run build                   # 构建全部三个包
npm run clean                   # 清理编译产物
npm test                        # 运行全部测试
```

### 服务配置

```bash
VIBEWATCH_PORT=9235 node dist/server.js  # 指定端口
VIBEWATCH_HOME=~/custom/path vibe-daemon start  # 自定义安装目录
```

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
├── bin/                     # 工具脚本
│   ├── vibe-daemon          # 服务管理 (start/stop/status/log)
│   ├── vibe                # 全局 CLI 入口
│   ├── vibe-doctor         # 诊断工具
│   ├── vibe-stress-test    # 压力测试
│   └── vibe-release-checklist  # 发布检查清单
├── install.sh              # 一键安装脚本
├── vibewatcher-shared/     # 共享类型定义 (npm workspace)
│   └── src/types.ts        # Status, TaskState, WSMessage, TaskSummary, etc.
├── vibewatcher-cli/        # CLI Wrapper
│   ├── src/
│   │   ├── cli.ts          # 主入口
│   │   ├── spawner.ts      # 子进程管理
│   │   ├── websocket.ts    # WebSocket 客户端
│   │   ├── matcher.ts      # Prompt 检测 (正则模式匹配)
│   │   ├── emitter.ts      # 事件构造
│   │   ├── parser.ts       # 行解析
│   │   ├── summary.ts      # 执行摘要生成
│   │   └── daemon-client.ts # Daemon 通信
│   └── tests/              # 单元测试
├── vibewatcher-server/     # WebSocket Server
│   ├── src/
│   │   ├── server.ts       # 主入口 (Daemon 支持)
│   │   ├── daemon-server.ts # PID 文件管理
│   │   ├── vibewatcher-server.ts # 服务器核心
│   │   ├── task-manager.ts # 任务生命周期管理
│   │   ├── state-store.ts  # 内存状态 + 历史记录 + 耗时预测
│   │   ├── stall-detector.ts # 卡死检测 (无输出超时告警)
│   │   ├── ai-interpreter.ts # AI 状态解读 (LLM)
│   │   ├── notifier.ts     # 移动端通知 (Telegram/Slack/Server酱)
│   │   ├── config.ts       # 配置管理 (~/.vibewatch/config.json)
│   │   └── llm/            # LLM providers (OpenAI/Ollama)
│   └── tests/              # 单元测试 + 集成测试
├── vibewatcher-vscode/     # VSCode Extension
│   ├── src/
│   │   ├── extension.ts    # 入口 (自动启动服务)
│   │   ├── status-bar.ts   # 状态栏指示器
│   │   ├── task-tree.ts    # 任务树视图
│   │   ├── notifications.ts # 桌面通知
│   │   ├── commands.ts     # 命令注册
│   │   ├── mini-panel.ts   # 迷你输出面板 (Webview)
│   │   ├── utils.ts        # 工具函数
│   │   └── websocket.ts    # WebSocket 客户端
│   ├── media/icon.svg      # 图标
│   └── tests/              # 单元测试
├── .vscode/               # VSCode 配置
│   └── launch.json         # 扩展调试配置
└── docs/                   # 文档
    └── LEARNING_NOTES.md  # 学习笔记
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
| [v0.4.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.4.0) | 2026-05-12 | 一键安装、Daemon 模式、VSCode 自动启动服务、自动 PATH 配置 |
| [v0.3.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.3.0) | 2026-05-12 | 卡死检测、AI 解读、CI/CD、npm workspaces 共享类型、Jest 版本统一 |
| [v0.2.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.2.0) | 2026-05-12 | 执行摘要、预测耗时、移动通知、迷你面板、VSCode WebSocket 重连 |
| [v0.1.0](https://github.com/yandexuanxuan/VibeWatcher/releases/tag/v0.1.0) | 2026-05-12 | 基础功能：CLI + Server + VSCode Extension |

---

## TODO（后续迭代方向）

> 以下为 v1.0 之后的潜在优化方向，按优先级排序。功能性已完整，可按需迭代。

### 高优先级
| 事项 | 说明 | 涉及模块 |
|------|------|----------|
| `vibe init` 配置引导 | 新用户首次使用的配置引导，降低上手成本 | vibewatcher-cli |
| 测试覆盖率提升 | 补充 `cli.ts` 等未覆盖模块的测试 | vibewatcher-cli |

### 中优先级
| 事项 | 说明 | 涉及模块 |
|------|------|----------|
| 配置验证与错误提示 | `config.json` 格式校验、字段类型检查、友好的错误信息 | vibewatcher-server |
| `vibe config validate` 命令 | 验证配置文件合法性 | vibewatcher-cli |

### 低优先级
| 事项 | 说明 | 涉及模块 |
|------|------|----------|
| 日志系统 | DEBUG/INFO/WARN 级别控制，便于问题排查 | 全局 |
| WebSocket 重连策略 | 指数退避重连，提升网络波动时的鲁棒性 | vibewatcher-vscode |
| StateStore 持久化 | 任务状态定期落盘，防止服务崩溃丢失状态 | vibewatcher-server |

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
