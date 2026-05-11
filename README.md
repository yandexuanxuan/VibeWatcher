🧩 VibeWatcher v0.1（可开发版本 PRD）
1. 产品定义（收敛后）
产品名称
VibeWatcher
产品本质（重新定义）
一个“Claude Code 执行进程的状态监控器 + 事件通知系统”，通过 CLI Wrapper 接管执行入口，在 VSCode 中展示运行状态并触发提醒。

2. 核心前提（关键约束）
必须接受一个现实：
❗ 不能监听 VSCode terminal，只能控制 Claude Code 执行入口
因此系统形态变为：
🟢 CLI Wrapper + VSCode Extension（双层结构）

3. 系统架构（可实现）
┌──────────────────────────────┐
│        VibeWatcher CLI       │
│  (Claude Code Execution)     │
│                              │
│  spawn claude-code process   │
│  capture stdout/stderr       │
│  emit structured events      │
└─────────────┬────────────────┘
              │ WebSocket / IPC
              ↓
┌──────────────────────────────┐
│   VSCode Extension Client    │
│                              │
│  状态栏 UI                   │
│  任务列表                   │
│  通知系统                   │
└──────────────────────────────┘

4. MVP功能范围（严格收敛）
4.1 CLI Wrapper（核心能力）
功能
● 启动 Claude Code 任务
● 捕获 stdout / stderr
● 转换为标准事件流
● 上报状态
命令形式
vibewatch run "claude-code task"

输出事件（核心协议）
{
  "taskId": "uuid",
  "type": "stdout | stderr | exit | prompt",
  "data": "raw text",
  "timestamp": 123456789
}

状态判定规则（必须实现）
状态	触发条件
RUNNING	process started
WAITING_INPUT	stdout 匹配 prompt pattern
COMPLETED	exit code = 0
ERROR	exit code ≠ 0

4.2 VSCode Extension（UI层）
必须功能
① 状态栏 Indicator
● 🟢 RUNNING
● 🟡 WAITING_INPUT
● 🔵 COMPLETED
● 🔴 ERROR

② 任务列表 View
显示：
● taskId
● 状态
● 运行时间
● 当前输出摘要（最后 3 行）

③ 通知系统
触发条件：
事件	行为
WAITING_INPUT	桌面通知 + 声音
COMPLETED	成功通知
ERROR	红色警告通知

④ 一键回跳 CLI 输出
点击任务 → 打开输出面板（log viewer）

5. 状态机（工程版本）
INIT
 ↓
RUNNING
 ↓
WAITING_INPUT ↔ RUNNING
 ↓
COMPLETED
 ↓
ERROR

6. 技术选型（可落地）
CLI Wrapper
● Node.js
● child_process.spawn
● readline / stream parser

VSCode Extension
● TypeScript
● VSCode Extension API
● TreeView + StatusBarItem
● window.showInformationMessage

通信方式
● WebSocket（推荐）
或
● localhost HTTP + polling（MVP可用）

7. 关键实现模块拆解

7.1 CLI Wrapper（核心）
spawn("claude-code", args)

stdout.on("data", parseOutput)
stderr.on("data", parseError)

if (matchPrompt(data)) emit WAITING_INPUT
if (exit 0) emit COMPLETED
if (exit != 0) emit ERROR

7.2 Pattern Matcher（必须简单）
const promptPatterns = [
  /proceed\?/i,
  /y\/n/i,
  /continue\?/i,
  /press enter/i,
]

7.3 Event Bus
● task manager
● state store
● websocket broadcaster

7.4 VSCode UI
● StatusBarItem
● TreeView Provider
● Notification API

8. MVP不做的东西（必须严格删除）
以下全部禁止进入 v0.1：
❌ AI生成任务摘要
❌ 预测耗时
❌ 浮窗终端
❌ 移动端通知
❌ 硬件联动
❌ LLM判断状态
❌ 多模型分析

9. 成功标准（可验证）
功能正确性
● Claude Code 启动可被捕获
● 状态能正确切换
● WAITING_INPUT 可100%触发通知
● COMPLETED 可即时通知

用户体验
● 用户无需频繁切回 VSCode
● 至少减少 70% “检查终端行为”

10. 真实开发路径（建议顺序）
Step 1（关键）
👉 CLI Wrapper（必须先做）
Step 2
👉 Event Parser + State Machine
Step 3
👉 VSCode Extension 状态栏
Step 4
👉 Notification system

11. 一句话总结（工程版）
VibeWatcher v0.1 是一个“Claude Code 执行进程的 wrapper + 状态机 + VSCode UI通知插件”，不依赖 VSCode terminal 监听，而是通过控制执行入口实现可观测性。

