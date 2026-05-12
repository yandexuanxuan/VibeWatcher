#!/bin/bash

# VibeWatcher Server 启动脚本
# 用法:
#   ./start.sh              # 交互式：启动 Server，显示使用说明
#   ./start.sh --run <cmd> # 启动 Server，执行命令后退出
#   ./start.sh --daemon    # 后台启动 Server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/vibewatcher-server.log"
SERVER_PID=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

die() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

build_all() {
    echo -e "${YELLOW}[*] Building...${NC}"
    cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1 || die "Server build failed"
    cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1 || die "CLI build failed"
    echo -e "${GREEN}✓ Build complete${NC}"
}

start_server() {
    cd "$SCRIPT_DIR/vibewatcher-server"
    node dist/server.js &
    SERVER_PID=$!
    sleep 2

    if ! kill -0 $SERVER_PID 2>/dev/null; then
        die "Server failed to start"
    fi
    echo -e "${GREEN}✓ Server running (PID: $SERVER_PID, ws://localhost:9234)${NC}"
}

start_daemon() {
    echo -e "${YELLOW}[*] Starting daemon...${NC}"

    # 停止已有 Server
    pkill -f "node.*vibewatcher-server.*dist/server.js" 2>/dev/null || true
    sleep 1

    cd "$SCRIPT_DIR/vibewatcher-server"
    nohup node dist/server.js > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    sleep 2

    if kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
        echo -e "  Log: $LOG_FILE"
    else
        die "Server failed to start. Check: $LOG_FILE"
    fi
    SERVER_PID=""
}

show_help() {
    echo ""
    echo -e "${GREEN}=== VibeWatcher Server ===${NC}"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --run <cmd>    启动 Server，执行命令后退出"
    echo "  --daemon       后台启动 Server"
    echo "  --help         显示帮助"
    echo ""
    echo "无参数时: 交互式启动，显示使用说明"
    echo ""
}

show_usage() {
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
}

# 解析参数
MODE="interactive"

while [ $# -gt 0 ]; do
    case "$1" in
        --run)
            MODE="run"
            shift
            break
            ;;
        --daemon)
            MODE="daemon"
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# 保留剩余参数用于 run 模式
REST_ARGS="$@"

case "$MODE" in
    daemon)
        build_all
        start_daemon
        ;;

    run)
        build_all
        start_server
        echo -e "${YELLOW}[*] Running: $REST_ARGS${NC}"
        echo ""
        cd "$SCRIPT_DIR/vibewatcher-cli"
        ./bin/vibewatch $REST_ARGS
        ;;

    interactive)
        build_all
        start_server
        show_usage
        wait $SERVER_PID
        ;;
esac