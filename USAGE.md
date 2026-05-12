# VibeWatcher 使用指南

## 快速开始

### 1️⃣ 启动监控服务

```bash
~/projects/VibeWatcher/start-monitor.sh
```

看到以下输出表示成功：
```
✓ VibeWatcher Server 已启动 (PID: xxxxx)
  日志文件: /tmp/vibewatcher-server.log
  WebSocket: ws://localhost:9234
```

### 2️⃣ 使用 VibeWatcher 监控命令

**方式一：监控任意命令**
```bash
cd ~/projects/VibeWatcher/vibewatcher-cli
./bin/vibewatch <你的命令>

# 示例
./bin/vibewatch ls -la
./bin/vibewatch node your-script.js
./bin/vibewatch python script.py
```

**方式二：监控 Claude Code（需先安装）**
```bash
# 先安装 claude-code（如果还没安装）
npm install -g @anthropic-ai/claude-code

# 然后使用
./bin/vibewatch claude-code "你的任务描述"
```

### 3️⃣ 查看监控状态

**终端方式：**
- 任务开始时 Server 显示 `Client connected`
- 任务结束时 Server 显示 `Client disconnected`

**VSCode Extension（推荐）：**
1. 打开 VSCode：
   ```bash
   code ~/projects/VibeWatcher/vibewatcher-vscode
   ```
2. 按 **F5** 启动调试
3. 在新窗口中可以看到：
   - 状态栏：🟢 Running → 🔵 Idle
   - 任务列表：左侧活动栏 VibeWatcher 图标
   - 通知：任务完成时弹出

---

## 设置别名（推荐日常使用）

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# VibeWatcher 监控
alias vibe-start='~/projects/VibeWatcher/start-monitor.sh'
alias vw='~/projects/VibeWatcher/vibewatcher-cli/bin/vibewatch'

# 如果安装了 claude-code
# alias claude='~/projects/VibeWatcher/vibewatcher-cli/bin/vibewatch claude-code'
```

然后运行：
```bash
source ~/.bashrc
```

之后使用：
```bash
vibe-start                    # 启动监控服务
vw ls -la                     # 监控 ls 命令
vw node script.js             # 监控 node 脚本
# claude "你的任务"           # 监控 Claude Code
```

---

## 完整工作流

### 终端 1：启动监控
```bash
vibe-start
```

### 终端 2：使用命令（带监控）
```bash
vw node -e "console.log('test'); setTimeout(() => console.log('done'), 2000)"
```

### VSCode：查看状态
- 状态栏显示 🟢 Running
- 任务完成后显示 🔵 Idle
- 弹出通知 "Task completed successfully"

---

## 常见问题

### Q: 看不到状态栏？
A: 确保 VSCode Extension 已启动（F5 调试模式）

### Q: Server 启动失败？
A: 检查端口 9234 是否被占用：`lsof -i :9234`

### Q: 如何停止监控？
A: `pkill -f "vibewatcher-server"`

### Q: 查看 Server 日志？
A: `tail -f /tmp/vibewatcher-server.log`

---

## 项目结构

```
~/projects/VibeWatcher/
├── vibewatcher-server/    # WebSocket 服务器
├── vibewatcher-cli/       # CLI 包装器
├── vibewatcher-vscode/    # VSCode Extension
├── start-monitor.sh       # 一键启动脚本
└── USAGE.md              # 本文件
```

---

## 监控原理

```
┌─────────────────────────────────────────────────┐
│  你执行命令                                      │
│  vw ls -la                                       │
└──────────────┬──────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────┐
│  VibeWatcher CLI 包装命令执行                    │
│  - 捕获 stdout/stderr                           │
│  - 检测状态变化                                  │
│  - 上报到 Server                                │
└──────────────┬──────────────────────────────────┘
               │ WebSocket
               ↓
┌─────────────────────────────────────────────────┐
│  VibeWatcher Server 接收事件                     │
│  - 转发给 VSCode Extension                      │
└──────────────┬──────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────┐
│  VSCode Extension 显示状态                       │
│  - 状态栏: 🟢🔵🔴                               │
│  - 任务列表                                     │
│  - 通知                                         │
└─────────────────────────────────────────────────┘
```

---

**现在就试试：**
```bash
~/projects/VibeWatcher/start-monitor.sh
```
