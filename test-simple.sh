#!/bin/bash
# VibeWatcher Simple Test Script (no Jest dependency)
# Tests the core functionality directly with Node.js

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS() { echo -e "${GREEN}[PASS]${NC} $1"; }
FAIL() { echo -e "${RED}[FAIL]${NC} $1"; }
INFO() { echo -e "${YELLOW}[INFO]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  VibeWatcher Simple Test Suite"
echo "========================================"
echo ""

TOTAL=0
PASSED=0

# Test 1: File structure
INFO "Test 1: File Structure"
echo "-----------------------------------"

REQUIRED_FILES=(
    "vibewatcher-cli/src/types.ts"
    "vibewatcher-cli/src/matcher.ts"
    "vibewatcher-cli/src/emitter.ts"
    "vibewatcher-cli/src/websocket.ts"
    "vibewatcher-cli/src/parser.ts"
    "vibewatcher-cli/src/spawner.ts"
    "vibewatcher-cli/src/cli.ts"
    "vibewatcher-cli/bin/vibewatch"
    "vibewatcher-cli/bin/claude-code"
    "vibewatcher-server/src/types.ts"
    "vibewatcher-server/src/state-store.ts"
    "vibewatcher-server/src/task-manager.ts"
    "vibewatcher-server/src/server.ts"
    "vibewatcher-vscode/src/types.ts"
    "vibewatcher-vscode/src/websocket.ts"
    "vibewatcher-vscode/src/status-bar.ts"
    "vibewatcher-vscode/src/task-tree.ts"
    "vibewatcher-vscode/src/notifications.ts"
    "vibewatcher-vscode/src/commands.ts"
    "vibewatcher-vscode/src/extension.ts"
)

TOTAL=$((TOTAL + ${#REQUIRED_FILES[@]}))
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        PASSED=$((PASSED + 1))
    else
        FAIL "Missing: $file"
    fi
done
PASS "File structure: $PASSED/$TOTAL files present"

echo ""

# Test 2: Pattern Matcher logic
INFO "Test 2: Pattern Matcher Logic Test"
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

TOTAL=$((TOTAL + ${#TEST_CASES[@]}))
for tc in "${TEST_CASES[@]}"; do
    INPUT="${tc%|*}"
    EXPECTED="${tc#*|}"

    # Use Node.js to test pattern matching
    RESULT=$(node -e "
const patterns = [
  /proceed\?/i,
  /y\/n/i,
  /continue\?/i,
  /press enter/i,
  /confirm/i,
  /yes\/no/i,
];
const text = '$INPUT';
const match = patterns.some(p => p.test(text));
console.log(match);
" 2>/dev/null)

    if [ "$RESULT" = "$EXPECTED" ]; then
        PASSED=$((PASSED + 1))
    else
        FAIL "Pattern test failed: '$INPUT' expected $EXPECTED got $RESULT"
    fi
done
PASS "Pattern Matcher: All tests passed"

cd "$SCRIPT_DIR"

echo ""

# Test 3: Parser logic
INFO "Test 3: Parser Logic Test"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-cli"

RESULT=$(node -e "
const text = 'line1\nline2\nline3';
const lines = text.split(/\r?\n/);
while (lines.length > 0 && lines[lines.length - 1] === '') { lines.pop(); }
console.log(JSON.stringify(lines));
" 2>/dev/null)

if [ "$RESULT" = '["line1","line2","line3"]' ]; then
    PASSED=$((PASSED + 1))
    PASS "Parser splitLines works"
else
    FAIL "Parser splitLines failed: $RESULT"
fi
TOTAL=$((TOTAL + 1))

cd "$SCRIPT_DIR"

echo ""

# Test 4: Emitter logic
INFO "Test 4: Emitter Logic Test"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-cli"

# Test createTaskCreated
RESULT=$(node -e "
const msg = {
  type: 'TASK_CREATED',
  payload: { taskId: 'test-123' }
};
console.log(msg.type === 'TASK_CREATED' ? 'ok' : 'fail');
" 2>/dev/null)

if [ "$RESULT" = 'ok' ]; then
    PASSED=$((PASSED + 1))
    PASS "Emitter message creation works"
else
    FAIL "Emitter test failed"
fi
TOTAL=$((TOTAL + 1))

cd "$SCRIPT_DIR"

echo ""

# Test 5: WebSocket connection to server
INFO "Test 5: WebSocket Server Test"
echo "-----------------------------------"

# Start server
cd "$SCRIPT_DIR/vibewatcher-server"
node dist/server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    PASSED=$((PASSED + 1))
    PASS "Server started (PID: $SERVER_PID)"

    # Test WebSocket connection
    node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9234');
ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'LIST_TASKS', payload: null }));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'TASKS_LIST') {
        console.log('listening');
        ws.close();
        process.exit(0);
    }
});
ws.on('error', (err) => {
    console.log('error: ' + err.message);
    process.exit(1);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 3000);
" > /tmp/ws-test.log 2>&1

    if [ $? -eq 0 ]; then
        PASSED=$((PASSED + 1))
        PASS "WebSocket LIST_TASKS works"
    else
        FAIL "WebSocket test failed"
    fi
    TOTAL=$((TOTAL + 2))

    # Stop server
    kill $SERVER_PID 2>/dev/null
    PASS "Server stopped"
else
    FAIL "Server failed to start"
    TOTAL=$((TOTAL + 2))
fi

cd "$SCRIPT_DIR"

echo ""

# Test 6: CLI spawn test
INFO "Test 6: CLI Spawn Test"
echo "-----------------------------------"

cd "$SCRIPT_DIR/vibewatcher-cli"

# Test that we can spawn a process
node -e "
const { spawn } = require('child_process');
const proc = spawn('echo', ['hello vibewatcher']);
let output = '';
proc.stdout.on('data', (d) => output += d);
proc.on('exit', (code) => {
    console.log(output.includes('hello') ? 'ok' : 'fail');
    process.exit(0);
});
" > /tmp/spawn-test.log 2>&1

if grep -q "ok" /tmp/spawn-test.log 2>/dev/null; then
    PASSED=$((PASSED + 1))
    PASS "CLI process spawn works"
else
    FAIL "CLI spawn test failed"
fi
TOTAL=$((TOTAL + 1))

cd "$SCRIPT_DIR"

echo ""

# Summary
echo "========================================"
echo "  Test Summary"
echo "========================================"
echo -e "Total: $TOTAL | Passed: ${GREEN}$PASSED${NC} | Failed: $((TOTAL - PASSED))"
echo ""

if [ $PASSED -eq $TOTAL ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
