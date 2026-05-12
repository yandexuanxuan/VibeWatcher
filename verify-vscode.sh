#!/bin/bash

# 验证 VSCode Extension 配置

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VSCODE_DIR="$SCRIPT_DIR/vibewatcher-vscode"

echo "=== VSCode Extension 验证 ==="
echo ""

# 检查编译产物
echo "[1/4] 检查编译产物..."
if [ -f "$VSCODE_DIR/out/extension.js" ]; then
    echo "✓ extension.js 已编译"
else
    echo "✗ extension.js 未找到，运行: npm run compile"
    exit 1
fi

# 检查 package.json 配置
echo ""
echo "[2/4] 检查 package.json 配置..."
if grep -q "vibewatcher.taskList" "$VSCODE_DIR/package.json"; then
    echo "✓ 视图配置正确"
else
    echo "✗ 视图配置缺失"
fi

# 检查 commands 配置
echo ""
echo "[3/4] 检查命令注册..."
if grep -q "vibewatcher.showOutput" "$VSCODE_DIR/package.json"; then
    echo "✓ 命令配置正确"
else
    echo "✗ 命令配置缺失"
fi

# 检查类型定义
echo ""
echo "[4/4] 检查类型定义..."
if [ -f "$VSCODE_DIR/src/types.ts" ]; then
    echo "✓ 类型定义存在"
else
    echo "✗ 类型定义缺失"
fi

echo ""
echo "=== 验证完成 ==="
echo ""
echo "下一步:"
echo "1. 在 VSCode 中打开: code $VSCODE_DIR"
echo "2. 按 F5 启动调试"
echo "3. 在新窗口中启动 Server 和运行任务"
