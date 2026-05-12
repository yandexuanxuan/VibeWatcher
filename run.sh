#!/bin/bash

# VibeWatcher 一键运行脚本 - 自动启动 Server 并运行命令

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}[*] Stopping VibeWatcher Server...${NC}"
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${GREEN}=== VibeWatcher 一键运行 ===${NC}"
    echo ""
    echo "用法: ./run.sh <command>"
    echo ""
    echo "示例:"
    echo "  ./run.sh ls -la"
    echo "  ./run.sh node -e \"console.log('test')\""
    echo "  ./run.sh python script.py"
    echo ""
    exit 0
fi

echo -e "${GREEN}=== VibeWatcher 启动中... ===${NC}"

# 1. 构建
echo -e "${YELLOW}[1/3] Building...${NC}"
cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1
cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1

# 2. 启动 Server
echo -e "${YELLOW}[2/3] Starting Server...${NC}"
cd "$SCRIPT_DIR/vibewatcher-server"
node dist/server.js &
SERVER_PID=$!
sleep 2

if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Server failed to start!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Server running${NC}"

# 3. 运行命令
echo -e "${YELLOW}[3/3] Running: $@${NC}"
echo ""
cd "$SCRIPT_DIR/vibewatcher-cli"
./bin/vibewatch "$@"
EXIT_CODE=$?

# 清理
cleanup

exit $EXIT_CODE
