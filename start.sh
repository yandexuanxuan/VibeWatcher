#!/bin/bash

# VibeWatcher 一键启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}[*] Stopping VibeWatcher Server...${NC}"
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    fi
    exit 0
}

# 捕获 Ctrl+C
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}=== VibeWatcher 一键启动 ===${NC}"

# 1. 构建 Server
echo -e "${YELLOW}[1/4] Building Server...${NC}"
cd "$SCRIPT_DIR/vibewatcher-server"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Server build failed!${NC}"
    exit 1
fi

# 2. 构建 CLI
echo -e "${YELLOW}[2/4] Building CLI...${NC}"
cd "$SCRIPT_DIR/vibewatcher-cli"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}CLI build failed!${NC}"
    exit 1
fi

# 3. 启动 Server
echo -e "${YELLOW}[3/4] Starting Server...${NC}"
cd "$SCRIPT_DIR/vibewatcher-server"
node dist/server.js &
SERVER_PID=$!
sleep 2

# 检查 Server 是否启动成功
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Server failed to start!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Server running on ws://localhost:9234 (PID: $SERVER_PID)${NC}"

# 4. 显示使用说明
echo -e "${YELLOW}[4/4] Ready!${NC}"
echo ""
echo -e "${GREEN}=== 使用方法 ===${NC}"
echo ""
echo "在新的终端窗口中运行:"
echo "  cd $SCRIPT_DIR/vibewatcher-cli"
echo "  ./bin/vibewatch <command>"
echo ""
echo -e "${GREEN}=== 示例 ===${NC}"
echo "  ./bin/vibewatch ls -la"
echo "  ./bin/vibewatch node -e \"console.log('test')\""
echo "  ./bin/vibewatch python your-script.py"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止 Server${NC}"
echo ""

# 等待 Server 进程
wait $SERVER_PID
