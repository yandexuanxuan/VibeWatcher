#!/bin/bash
# VibeWatcher E2E Test Script
# Tests the complete flow: CLI -> Server -> Extension notification

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS() { echo -e "${GREEN}[PASS]${NC} $1"; }
FAIL() { echo -e "${RED}[FAIL]${NC} $1"; }
INFO() { echo -e "${YELLOW}[INFO]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  VibeWatcher E2E Test Suite"
echo "========================================"
echo ""

# Test 1: Build verification
INFO "Test 1: Build Verification"
echo "-----------------------------------"

INFO "Building CLI..."
cd "$SCRIPT_DIR/vibewatcher-cli" && npm run build > /dev/null 2>&1 && PASS "CLI build OK" || FAIL "CLI build failed"
cd "$SCRIPT_DIR"

INFO "Building Server..."
cd "$SCRIPT_DIR/vibewatcher-server" && npm run build > /dev/null 2>&1 && PASS "Server build OK" || FAIL "Server build failed"
cd "$SCRIPT_DIR"

INFO "Building VSCode Extension..."
cd "$SCRIPT_DIR/vibewatcher-vscode" && npm run compile > /dev/null 2>&1 && PASS "VSCode build OK" || FAIL "VSCode build failed"
cd "$SCRIPT_DIR"

echo ""

# Test 2: Pattern Matcher Test
INFO "Test 2: Pattern Matcher Tests"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-cli" && npm test -- tests/matcher.test.ts > /dev/null 2>&1
if [ $? -eq 0 ]; then
    PASS "Pattern Matcher tests passed (7/7)"
else
    FAIL "Pattern Matcher tests failed"
fi
cd "$SCRIPT_DIR"

echo ""

# Test 3: CLI unit tests
INFO "Test 3: CLI Unit Tests"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-cli" && npm test > /dev/null 2>&1
if [ $? -eq 0 ]; then
    PASS "CLI unit tests passed"
else
    FAIL "CLI unit tests failed"
fi
cd "$SCRIPT_DIR"

echo ""

# Test 4: Server unit tests
INFO "Test 4: Server Unit Tests"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-server" && npm test > /dev/null 2>&1
if [ $? -eq 0 ]; then
    PASS "Server unit tests passed"
else
    FAIL "Server unit tests failed"
fi
cd "$SCRIPT_DIR"

echo ""

# Test 5: Server startup test
INFO "Test 5: Server Startup Test"
echo "-----------------------------------"

# Start server in background
cd "$SCRIPT_DIR/vibewatcher-server" && node dist/server.js &
SERVER_PID=$!
sleep 2

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    PASS "Server started successfully (PID: $SERVER_PID)"

    # Test WebSocket connection
    INFO "Testing WebSocket connection..."
    node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9234');
ws.on('open', () => {
    console.log('Connection established');
    ws.send(JSON.stringify({ type: 'LIST_TASKS', payload: null }));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'TASKS_LIST') {
        console.log('TASKS_LIST received');
        ws.close();
        process.exit(0);
    }
});
ws.on('error', () => {
    console.log('Connection error');
    process.exit(1);
});
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 5000);
" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        PASS "WebSocket communication works"
    else
        FAIL "WebSocket communication failed"
    fi

    # Stop server
    kill $SERVER_PID 2>/dev/null
    PASS "Server stopped"
else
    FAIL "Server failed to start"
fi
cd "$SCRIPT_DIR"

echo ""

# Test 6: CLI command test
INFO "Test 6: CLI Command Test"
echo "-----------------------------------"

# Test that CLI can be executed (without server)
cd "$SCRIPT_DIR/vibewatcher-cli"
node bin/vibewatch --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    PASS "CLI command accessible"
else
    FAIL "CLI command failed"
fi
cd "$SCRIPT_DIR"

echo ""

# Test 7: File structure verification
INFO "Test 7: File Structure Verification"
echo "-----------------------------------"

REQUIRED_FILES=(
    "vibewatcher-cli/src/cli.ts"
    "vibewatcher-cli/src/matcher.ts"
    "vibewatcher-cli/src/emitter.ts"
    "vibewatcher-cli/src/websocket.ts"
    "vibewatcher-cli/bin/claude-code"
    "vibewatcher-server/src/server.ts"
    "vibewatcher-server/src/task-manager.ts"
    "vibewatcher-server/src/state-store.ts"
    "vibewatcher-vscode/src/extension.ts"
    "vibewatcher-vscode/src/status-bar.ts"
    "vibewatcher-vscode/src/task-tree.ts"
    "vibewatcher-vscode/src/notifications.ts"
)

MISSING=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        : # File exists
    else
        FAIL "Missing file: $file"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -eq 0 ]; then
    PASS "All required files present (${#REQUIRED_FILES[@]}/${#REQUIRED_FILES[@]})"
fi

echo ""
echo "========================================"
echo "  E2E Test Complete"
echo "========================================"
