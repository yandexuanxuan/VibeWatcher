#!/bin/bash
#
# VibeWatcher 一键安装脚本
# 自动完成依赖安装、构建、配置和启动
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${VIBEWATCH_HOME:-$HOME/.vibewatch}"
BIN_DIR="$INSTALL_DIR/bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_step() {
    echo -e "${CYAN}[${BOLD}Step $1${CYAN}]${NC} $2"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

# Check Node.js version
check_node() {
    log_step "1/6" "检查环境"

    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        echo "请先安装 Node.js >= 14.8 (推荐 Node 20)"
        echo "https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 14 ]; then
        log_error "Node.js 版本过低: $(node -v)"
        echo "请升级到 Node.js >= 14.8 (推荐 Node 20)"
        exit 1
    fi

    log_info "Node.js $(node -v) ✓"
}

# Install dependencies
install_deps() {
    log_step "2/6" "安装依赖"

    cd "$SCRIPT_DIR"

    if [ ! -f "package.json" ]; then
        log_error "package.json 未找到"
        exit 1
    fi

    npm install 2>&1 | tail -5
    log_info "依赖安装完成"
}

# Build project
build_project() {
    log_step "3/6" "构建项目"

    cd "$SCRIPT_DIR"

    npm run build 2>&1 | tail -10

    # Verify build success
    if [ ! -f "vibewatcher-cli/dist/cli.js" ]; then
        log_error "CLI 构建失败"
        exit 1
    fi
    if [ ! -f "vibewatcher-server/dist/server.js" ]; then
        log_error "Server 构建失败"
        exit 1
    fi

    log_info "项目构建完成"
}

# Copy binaries to install directory
copy_binaries() {
    log_step "4/6" "安装二进制文件"

    mkdir -p "$BIN_DIR"

    # Create a package.json for the server
    cat > "$BIN_DIR/package.json" << 'EOF'
{
  "name": "vibewatcher-server",
  "version": "0.4.0",
  "main": "server.js"
}
EOF

    # Copy server binary
    cp "$SCRIPT_DIR/vibewatcher-server/dist/server.js" "$BIN_DIR/server.js"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/vibewatcher-server.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/task-manager.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/state-store.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/notifier.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/stall-detector.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/ai-interpreter.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/config.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/daemon-server.js" "$BIN_DIR/"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/types.js" "$BIN_DIR/"

    # Copy llm directory
    mkdir -p "$BIN_DIR/llm"
    cp "$SCRIPT_DIR/vibewatcher-server/dist/llm/"* "$BIN_DIR/llm/"

    # Create symlink to node_modules from the original project
    ln -sf "$SCRIPT_DIR/node_modules" "$BIN_DIR/node_modules"

    # Copy CLI wrapper scripts
    cp "$SCRIPT_DIR/vibewatcher-cli/bin/vibewatch" "$BIN_DIR/vibewatch"
    cp "$SCRIPT_DIR/vibewatcher-cli/bin/claude-code" "$BIN_DIR/claude-code"

    # Copy daemon manager
    cp "$SCRIPT_DIR/bin/vibe-daemon" "$BIN_DIR/vibe-daemon"
    cp "$SCRIPT_DIR/bin/vibe" "$BIN_DIR/vibe"
    cp "$SCRIPT_DIR/bin/vibe-doctor" "$BIN_DIR/vibe-doctor"
    cp "$SCRIPT_DIR/bin/vibe-stress-test" "$BIN_DIR/vibe-stress-test"
    cp "$SCRIPT_DIR/bin/vibe-release-checklist" "$BIN_DIR/vibe-release-checklist"

    # Make executables
    chmod +x "$BIN_DIR"/*.sh "$BIN_DIR/vibewatch" "$BIN_DIR/claude-code" 2>/dev/null || true

    log_info "二进制文件安装到 $BIN_DIR"
}

# Configure shell PATH
configure_shell() {
    log_step "5/6" "配置环境"

    # Determine shell config file
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        if [ -f "$HOME/.bashrc" ]; then
            SHELL_RC="$HOME/.bashrc"
        else
            SHELL_RC="$HOME/.bash_profile"
        fi
    else
        SHELL_RC="$HOME/.profile"
    fi

    # Add PATH line
    PATH_LINE="export PATH=\"\$HOME/.vibewatch/bin:\$PATH\""
    MARKER="# VibeWatcher"

    if [ ! -f "$SHELL_RC" ]; then
        touch "$SHELL_RC"
    fi

    if ! grep -q "$MARKER" "$SHELL_RC" 2>/dev/null; then
        cat >> "$SHELL_RC" << EOF

$MARKER - Claude Code execution monitor
$PATH_LINE
EOF
        log_info "已添加 PATH 配置到 $SHELL_RC"
    else
        log_info "PATH 配置已存在"
    fi

    # Create alias for convenience
    ALIAS_LINE="alias vibe='vibewatch claude-code'"
    if ! grep -q "alias vibe=" "$SHELL_RC" 2>/dev/null; then
        echo "$ALIAS_LINE" >> "$SHELL_RC"
        log_info "已添加别名: vibe"
    fi
}

# Start daemon
start_daemon() {
    log_step "6/6" "启动服务"

    if "$BIN_DIR/vibe-daemon" status &>/dev/null; then
        log_info "Server 已在运行"
    else
        "$BIN_DIR/vibe-daemon" start
    fi
}

# Show success message
show_success() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  VibeWatcher 安装完成!${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}使用方式:${NC}"
    echo "  1. 重启终端 或 执行: source $SHELL_RC"
    echo "  2. 使用命令:"
    echo ""
    echo -e "    ${CYAN}vibe-daemon status${NC}  查看服务状态"
    echo -e "    ${CYAN}vibe-daemon start${NC}  启动服务"
    echo -e "    ${CYAN}vibe-daemon stop${NC}   停止服务"
    echo -e "    ${CYAN}vibe-daemon log${NC}    查看日志"
    echo ""
    echo -e "    ${CYAN}vibe${NC} <命令>       使用 Claude Code"
    echo ""
    echo -e "${BOLD}示例:${NC}"
    echo "  vibe 帮我写一个 hello world 程序"
    echo "  vibe 重构 user 模块"
    echo ""
    echo -e "${YELLOW}提示: ${NC}VSCode 扩展会在激活时自动启动服务"
    echo ""
}

# Main
main() {
    echo ""
    echo -e "${BOLD}VibeWatcher v0.4 安装程序${NC}"
    echo ""
    echo "安装目录: $INSTALL_DIR"
    echo ""

    check_node
    install_deps
    build_project
    copy_binaries
    configure_shell
    start_daemon
    show_success
}

main "$@"
