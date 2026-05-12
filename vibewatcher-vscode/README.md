# VibeWatcher

Monitor Claude Code execution in real-time with status bar indicators, task lists, and desktop notifications.

## Features

- **Status Bar Indicator** - Real-time status: 🟢 Running / 🟡 Waiting / 🔵 Complete / 🔴 Error
- **Task List** - View all tasks with duration and last output in sidebar
- **Desktop Notifications** - Get notified when tasks complete, error, or wait for input
- **One-Click Install** - Automatic server startup, no terminal required
- **Mobile Notifications** - ServerChan (WeChat), Telegram, Slack support
- **AI Interpretation** - Optional LLM analysis of task output

## Requirements

- Node.js >= 14.8 (recommended Node 20)
- VSCode >= 1.80
- Claude Code CLI

## Installation

### From VSCode Marketplace

1. Search for "VibeWatcher" in VSCode Extensions
2. Click Install
3. Reload VSCode window

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/yandexuanxuan/VibeWatcher.git
cd VibeWatcher

# Run the installer
bash install.sh

# Restart terminal or source shell config
source ~/.bashrc  # or source ~/.zshrc
```

## Quick Start

After installation, simply use Claude Code as normal:

```bash
# VibeWatcher monitors automatically
claude-code help me write a function

# Or use the vibe wrapper
vibe帮我写一个 API
```

## Commands

| Command | Description |
|---------|-------------|
| `vibe-daemon status` | Check server status |
| `vibe-daemon start` | Start server |
| `vibe-daemon stop` | Stop server |
| `vibe-daemon log` | View server logs |
| `vibe-doctor` | Run diagnostics |

## Configuration

Create `~/.vibewatch/config.json` for mobile notifications:

```json
{
  "notifications": {
    "serverchan": {
      "enabled": true,
      "sendkey": "your-sendkey"
    }
  }
}
```

## Architecture

```
CLI Wrapper → WebSocket → Event Server → VSCode Extension
```

## License

MIT
