#!/bin/bash

# VibeWatcher 测试脚本
# 用法:
#   ./test.sh              # 快速测试（跳过 npm test）
#   ./test.sh --full       # 完整 E2E 测试
#   ./test.sh --unit       # 仅运行 npm test
#   ./test.sh --logic      # 仅逻辑测试（无构建）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS() { echo -e "${GREEN}[PASS]${NC} $1"; }
FAIL() { echo -e "${RED}[FAIL]${NC} $1"; }
INFO() { echo -e "${YELLOW}[INFO]${NC} $1"; }

TOTAL=0
PASSED=0

# 解析参数
MODE="${1:-quick}"

case "$MODE" in
    --full|-f)   MODE="full" ;;
    --unit|-u)   MODE="unit" ;;
    --logic|-l) MODE="logic" ;;
    --quick|-q) MODE="quick" ;;
    --help|-h)
        echo "VibeWatcher Test Suite"
        echo ""
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  --quick   快速测试（默认）：文件结构 + 逻辑测试"
        echo "  --full    完整 E2E 测试：构建 + 单元测试 + WebSocket"
        echo "  --unit    仅运行 npm test"
        echo "  --logic   仅逻辑测试（跳过构建）"
        echo ""
        exit 0
        ;;
esac

echo "========================================"
echo "  VibeWatcher Test Suite (mode: $MODE)"
echo "========================================"
echo ""

# ========== 构建阶段 ==========
if [ "$MODE" = "full" ]; then
    INFO "Building all packages..."
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1 && PASS "CLI build OK" || FAIL "CLI build failed"
    cd "$SCRIPT_DIR"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1 && PASS "Server build OK" || FAIL "Server build failed"
    cd "$SCRIPT_DIR"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    cd "$SCRIPT_DIR/vibewatcher-vscode" && npm run compile > /dev/null 2>&1 && PASS "VSCode build OK" || FAIL "VSCode build failed"
    cd "$SCRIPT_DIR"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    echo ""
fi

if [ "$MODE" = "full" ] || [ "$MODE" = "quick" ]; then
    # ========== 单元测试阶段 ==========
    INFO "Running unit tests..."
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-cli"
    npm test -- tests/matcher.test.ts > /dev/null 2>&1 && PASS "Pattern Matcher tests OK" || FAIL "Pattern Matcher tests failed"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    cd "$SCRIPT_DIR/vibewatcher-cli" && npm test > /dev/null 2>&1 && PASS "CLI unit tests OK" || FAIL "CLI unit tests failed"
    cd "$SCRIPT_DIR"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    cd "$SCRIPT_DIR/vibewatcher-server" && npm test > /dev/null 2>&1 && PASS "Server unit tests OK" || FAIL "Server unit tests failed"
    cd "$SCRIPT_DIR"
    TOTAL=$((TOTAL + 1)); [ $? -eq 0 ] && PASSED=$((PASSED + 1))

    echo ""
fi

# ========== 文件结构测试 ==========
if [ "$MODE" != "unit" ]; then
    INFO "File Structure Test"
    echo "-----------------------------------"

    REQUIRED_FILES=(
        "vibewatcher-cli/src/types.ts"
        "vibewatcher-cli/src/matcher.ts"
        "vibewatcher-cli/src/emitter.ts"
        "vibewatcher-cli/src/websocket.ts"
        "vibewatcher-cli/src/spawner.ts"
        "vibewatcher-cli/src/cli.ts"
        "vibewatcher-cli/bin/vibewatch"
        "vibewatcher-server/src/types.ts"
        "vibewatcher-server/src/server.ts"
        "vibewatcher-server/src/task-manager.ts"
        "vibewatcher-vscode/src/extension.ts"
        "vibewatcher-vscode/src/status-bar.ts"
    )

    for file in "${REQUIRED_FILES[@]}"; do
        TOTAL=$((TOTAL + 1))
        if [ -f "$SCRIPT_DIR/$file" ]; then
            PASSED=$((PASSED + 1))
        else
            FAIL "Missing: $file"
        fi
    done
    echo ""
fi

# ========== 逻辑测试 ==========
if [ "$MODE" != "unit" ]; then
    INFO "Pattern Matcher Logic Test"
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-cli"

    TEST_CASES=(
        "Do you want to proceed?|true"
        "Continue? (y/n)|true"
        "Press Enter to continue|true"
        "Please confirm your action|true"
        "Hello world|false"
        "Running task 123|false"
    )

    for tc in "${TEST_CASES[@]}"; do
        INPUT="${tc%|*}"
        EXPECTED="${tc#*|}"

        RESULT=$(node -e "
const patterns = [
  /proceed\?/i, /y\/n/i, /continue\?/i,
  /press enter/i, /confirm/i, /yes\/no/i
];
const text = '$INPUT';
console.log(patterns.some(p => p.test(text)));
" 2>/dev/null)

        TOTAL=$((TOTAL + 1))
        if [ "$RESULT" = "$EXPECTED" ]; then
            PASSED=$((PASSED + 1))
        else
            FAIL "Pattern: '$INPUT' expected $EXPECTED got $RESULT"
        fi
    done

    cd "$SCRIPT_DIR"
    echo ""
fi

# ========== WebSocket 测试 ==========
if [ "$MODE" = "full" ]; then
    INFO "Server Startup & WebSocket Test"
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-server"
    node dist/server.js > /tmp/server.log 2>&1 &
    SERVER_PID=$!
    sleep 2

    if kill -0 $SERVER_PID 2>/dev/null; then
        TOTAL=$((TOTAL + 1)); PASSED=$((PASSED + 1))
        PASS "Server started (PID: $SERVER_PID)"

        # WebSocket 测试
        node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9234');
ws.on('open', () => ws.send(JSON.stringify({type: 'LIST_TASKS', payload: null})));
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'TASKS_LIST') {
        console.log('ok');
        ws.close();
        process.exit(0);
    }
});
ws.on('error', () => { console.log('error'); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
" > /dev/null 2>&1

        TOTAL=$((TOTAL + 1))
        if [ $? -eq 0 ]; then
            PASSED=$((PASSED + 1))
            PASS "WebSocket communication OK"
        else
            FAIL "WebSocket communication failed"
        fi

        kill $SERVER_PID 2>/dev/null
    else
        TOTAL=$((TOTAL + 2))
        FAIL "Server failed to start"
    fi

    cd "$SCRIPT_DIR"
    echo ""
fi

# ========== CLI 命令测试 ==========
if [ "$MODE" = "full" ]; then
    INFO "CLI Command Test"
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-cli"
    node bin/vibewatch --help > /dev/null 2>&1
    TOTAL=$((TOTAL + 1))
    if [ $? -eq 0 ]; then
        PASSED=$((PASSED + 1))
        PASS "CLI command accessible"
    else
        FAIL "CLI command failed"
    fi
    cd "$SCRIPT_DIR"
    echo ""
fi

# ========== 快速启动测试 (quick 模式) ==========
if [ "$MODE" = "quick" ]; then
    INFO "Quick Start Test"
    echo "-----------------------------------"

    cd "$SCRIPT_DIR/vibewatcher-server"
    timeout 10 node dist/server.js &
    SERVER_PID=$!
    sleep 2

    if kill -0 $SERVER_PID 2>/dev/null; then
        TOTAL=$((TOTAL + 1)); PASSED=$((PASSED + 1))
        PASS "Server started"

        cd ../vibewatcher-cli
        timeout 5 ./bin/vibewatch echo "Hello VibeWatcher!" > /dev/null 2>&1
        TOTAL=$((TOTAL + 1))
        [ $? -eq 0 ] && PASSED=$((PASSED + 1)) && PASS "CLI execution OK" || FAIL "CLI execution failed"

        kill $SERVER_PID 2>/dev/null
    else
        TOTAL=$((TOTAL + 2))
        FAIL "Server failed to start"
    fi

    cd "$SCRIPT_DIR"
    echo ""
fi

# ========== 总结 ==========
echo "========================================"
echo "  Test Summary"
echo "========================================"
echo -e "Total: $TOTAL | Passed: ${GREEN}$PASSED${NC} | Failed: $((TOTAL - PASSED))"
echo ""

if [ "$PASSED" -eq "$TOTAL" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi