#!/bin/bash

# VibeWatcher 后台监控启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/vibewatcher-server.log"

echo "启动 VibeWatcher 监控服务..."

# 停止已有的 Server
pkill -f "node.*vibewatcher-server.*dist/server.js" 2>/dev/null
sleep 1

# 启动 Server（后台运行）
cd "$SCRIPT_DIR/vibewatcher-server"
nohup node dist/server.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

sleep 2

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✓ VibeWatcher Server 已启动 (PID: $SERVER_PID)"
    echo "  日志文件: $LOG_FILE"
    echo "  WebSocket: ws://localhost:9234"
else
    echo "✗ Server 启动失败，查看日志: $LOG_FILE"
    exit 1
fi
