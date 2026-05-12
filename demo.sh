#!/bin/bash

# VibeWatcher 演示脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== VibeWatcher 功能演示 ==="
echo ""

# 构建
echo "[1/3] 构建项目..."
cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1
cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1

# 启动 Server
echo "[2/3] 启动 Server..."
cd "$SCRIPT_DIR/vibewatcher-server"
node dist/server.js &
SERVER_PID=$!
sleep 2

if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server 启动失败!"
    exit 1
fi

echo "[3/3] 运行演示命令..."
echo ""
echo "-------------------------------------------"
echo ""

# 创建测试脚本
cat > /tmp/vibewatcher-demo.js << 'EOF'
console.log("Hello from VibeWatcher!");
console.log("This is a monitored command.");
console.log("Task is running...");
setTimeout(() => {
    console.log("Task completed successfully!");
    process.exit(0);
}, 1500);
EOF

# 运行测试
cd "$SCRIPT_DIR/vibewatcher-cli"
./bin/vibewatch node /tmp/vibewatcher-demo.js

echo ""
echo "-------------------------------------------"
echo ""

# 清理
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "=== 演示完成 ==="
echo ""
echo "使用方法:"
echo "  1. 启动 Server: cd vibewatcher-server && npm start"
echo "  2. 运行命令: cd vibewatcher-cli && ./bin/vibewatch <command>"
