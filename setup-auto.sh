#!/bin/bash

# VibeWatcher 自动监听配置脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== VibeWatcher 自动监听配置 ==="
echo ""

# 1. 构建项目
echo "[1/3] 构建项目..."
cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1
cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1
echo "✓ 构建完成"

# 2. 创建启动脚本
echo ""
echo "[2/3] 创建启动脚本..."

cat > "$SCRIPT_DIR/start-monitor.sh" << 'EOF'
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
EOF

chmod +x "$SCRIPT_DIR/start-monitor.sh"
echo "✓ 启动脚本已创建: start-monitor.sh"

# 3. 创建使用说明
echo ""
echo "[3/3] 配置完成！"
echo ""
echo "=========================================="
echo "使用方法（二选一）："
echo "=========================================="
echo ""
echo "方案 A: 每次手动启动（推荐测试）"
echo "------------------------------------------"
echo "1. 启动 Server:"
echo "   ~/projects/VibeWatcher/start-monitor.sh"
echo ""
echo "2. 使用 Claude Code（带监控）:"
echo "   cd ~/projects/VibeWatcher/vibewatcher-cli"
echo "   ./bin/vibewatch claude-code \"你的任务\""
echo ""
echo "方案 B: 设置别名（推荐日常使用）"
echo "------------------------------------------"
echo "在 ~/.bashrc 或 ~/.zshrc 中添加:"
echo ""
echo "   # VibeWatcher 监控"
echo "   alias vibe-start='~/projects/VibeWatcher/start-monitor.sh'"
echo "   alias claude='~/projects/VibeWatcher/vibewatcher-cli/bin/vibewatch claude-code'"
echo ""
echo "然后运行: source ~/.bashrc"
echo ""
echo "之后使用:"
echo "   vibe-start          # 启动监控"
echo "   claude \"你的任务\"    # 自动带监控运行"
echo ""
echo "=========================================="
echo ""
echo "VSCode Extension（UI 监控）:"
echo "------------------------------------------"
echo "1. 在 VSCode 中打开:"
echo "   code ~/projects/VibeWatcher/vibewatcher-vscode"
echo ""
echo "2. 按 F5 启动调试"
echo ""
echo "3. 在新窗口中可以看到:"
echo "   - 状态栏: 🟢 Running → 🔵 Idle"
echo "   - 任务列表: 左侧活动栏"
echo "   - 通知: 任务完成时弹出"
echo ""
