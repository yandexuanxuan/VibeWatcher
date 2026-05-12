#!/bin/bash

# VibeWatcher 快速测试脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== VibeWatcher 快速测试 ==="
echo ""

# 构建
echo "[1/2] Building..."
cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1
cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1

# 启动 Server 并运行测试
echo "[2/2] Starting Server and running test..."
cd "$SCRIPT_DIR/vibewatcher-server"

# 使用 timeout 确保脚本不会挂起
timeout 10 bash -c '
node dist/server.js &
SERVER_PID=$!
sleep 2

cd ../vibewatcher-cli
echo ""
echo "=== Running Test Command ==="
./bin/vibewatch node -e "console.log(\"Hello VibeWatcher!\"); console.log(\"Test output line 2\"); setTimeout(() => { console.log(\"Done!\"); process.exit(0); }, 2000)"
EXIT_CODE=$?

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

exit $EXIT_CODE
'

echo ""
echo "=== 测试完成 ==="
