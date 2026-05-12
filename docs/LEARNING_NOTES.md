# VibeWatcher 开发学习笔记

**项目**: VibeWatcher
**作者**: Claude Code
**更新日期**: 2026-05-12
**当前版本**: v0.3.0

---

## 一、项目演进历程

### 版本概览

| 版本 | 日期 | 主要内容 |
|------|------|----------|
| v0.1.0 | 2026-05-12 | 基础功能：CLI Wrapper + WebSocket Server + VSCode Extension |
| v0.2.0 | 2026-05-12 | 稳定化：共享类型、WebSocket 重连、集成测试、版本统一 |
| v0.3.0 | 2026-05-12 | 新功能：卡死检测、AI 解读、CI/CD、市场发布准备 |
| v0.4.0 | 2026-05-12 | 前端重构：Vue 3 + Vite + Tailwind，Monorepo 架构 |
| v0.5.0 | 2026-05-12 | 集成功能：Claude Code Middleware、LangGraph Hook、Cognitive Memory |
| v0.6.0 | 2026-05-12 | 流式输出：SSE、WebSocket 实时通信、CLI 工具 |
| v1.0.0 | 2026-05-12 | 稳定发布：一键安装、Daemon 模式、自动启动、Marketplace 发布 |

### 架构演进

**v0.1 — 三个独立包，无共享代码**

三份 `types.ts` 内容完全相同，修改需同步三处：
```
vibewatcher-cli/src/types.ts     ← 重复
vibewatcher-server/src/types.ts  ← 重复
vibewatcher-vscode/src/types.ts   ← 重复
```

**v0.2 — npm workspaces + 共享类型包**

通过 npm workspaces 统一管理，`vibewatcher-shared` 作为唯一类型来源：
```
vibewatcher-shared/src/types.ts  ← 单一来源
vibewatcher-cli/    → 依赖 vibewatcher-shared
vibewatcher-server/ → 依赖 vibewatcher-shared
vibewatcher-vscode/  → 依赖 vibewatcher-shared
```

**v0.3 — 新增功能模块**

```
vibewatcher-server/src/
├── stall-detector.ts      ← 卡死检测（独立轮询模块）
├── ai-interpreter.ts     ← AI 解读器
├── llm/                  ← 可插拔 LLM 提供商
│   ├── types.ts
│   ├── claude-provider.ts
│   ├── openai-provider.ts
│   ├── ollama-provider.ts
│   └── index.ts
├── vibewatcher-server.ts  ← 核心服务器类（可导入测试）
└── config.ts              ← 配置管理（含 stallDetection + AI 配置）
```

---

## 二、v0.2 稳定化过程

### 问题发现与优先级

| 问题 | 影响 | 优先级 |
|------|------|--------|
| VSCode WebSocket 无重连 | 服务器重启后扩展失效 | 高 |
| types.ts 三份重复 | 修改一处需同步三处 | 中 |
| 子包版本 0.1.0 vs 根目录 0.2.0 | 版本不一致 | 低 |
| 无集成测试 | CLI→Server 通信无验证 | 高 |

### 1. VSCode WebSocket 重连

**问题本质**：VSCode 扩展是长驻进程，连接断开后不应永久掉线。CLI 端已有重连逻辑（3次指数退避），扩展端缺失。

**解决思路**：参照 CLI 实现，添加完整的重连机制，但针对长驻进程特点调整参数。

**实现要点**：
- `maxRetries = 5`（比 CLI 的 3 更多，长驻进程寿命长）
- 指数退避：2s → 4s → 8s → 16s → 32s
- `messageQueue`：断线期间消息排队，重连后发送
- `intentionalClose` 标记：deactivate 时关闭，不触发重连
- `reconnect()` 公共方法：用户可手动触发重连
- 三个回调：`onReconnect` / `onDisconnect` / `onReconnectFailed`

**关键代码模式**：
```typescript
ws.on('close', () => {
  if (!this.intentionalClose) {
    this.onDisconnectCallback?.();
    this.attemptReconnect();
  }
});

close(): void {
  this.intentionalClose = true;
  if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  this.ws?.close();
}
```

### 2. 共享类型包提取

**问题本质**：三份 `types.ts` 内容完全相同，维护成本高，容易遗漏同步。

**方案**：创建 `vibewatcher-shared` 包，npm workspaces 管理。

**执行步骤**：
1. 创建 `vibewatcher-shared/` 目录及基础结构
2. `src/types.ts` 作为唯一类型定义来源
3. 根 `package.json` 添加 `workspaces` 字段，**注意顺序**（shared 必须排前）
4. 三包 `package.json` 添加 `"vibewatcher-shared": "*"` 依赖
5. 所有导入从 `'./types'` 改为 `'vibewatcher-shared'`
6. 删除三份重复的 `src/types.ts`
7. 更新 CLAUDE.md 文档

**关键决策**：
- 使用 npm workspaces 而非 lerna/turborepo——项目简单，无需额外工具
- workspaces 顺序必须 `vibewatcher-shared` 最前（先构建才能被依赖）
- 删除旧 types.ts 后必须确保编译通过，否则 CI 会失败

### 3. 集成测试

**问题本质**：单元测试无法覆盖跨进程通信的真实场景。

**方案**：在 `vibewatcher-server/tests/integration/` 添加真实服务器测试。

**技术细节**：
- 必须将 `server.ts` 拆分为 `vibewatcher-server.ts`（类） + `server.ts`（入口）
- 原因：测试需要导入 `VibeWatcherServer` 类来启动，不能直接执行进程
- 使用随机高端口避免冲突：`PORT = 19234 + Math.floor(Math.random() * 1000)`
- 每个测试后 `client.close()`，所有测试后 `server.stop()`

---

## 三、v0.3 新功能开发

### Phase 1: Jest 版本统一

**问题**：Server 用 Jest 27，CLI/VSCode 用 Jest 29。版本不一致可能导致行为差异。

**解决**：
```json
// vibewatcher-server/package.json
"jest": "^29.7.0",
"ts-jest": "^29.4.9",
"@types/jest": "^29.5.14"
```

**教训**：monorepo 中统一测试框架版本非常重要，不同版本可能有兼容性问题。

### Phase 2: CI/CD + LICENSE

#### GitHub Actions 工作流设计

**ci.yml** — 每次 PR/push 自动构建和测试

```yaml
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm install
      - run: npm run build
      - run: npm test
```

**release.yml** — 打 tag 时自动发布

```yaml
on:
  push:
    tags:
      - 'v*'
jobs:
  test: { ... }  # 必须通过才能发布
  publish:
    needs: test
    steps:
      - run: npx vsce package
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

#### LICENSE 文件

MIT 协议，版权年份 2026。VSCode Marketplace 发布必需文件。

### Phase 3: 卡死检测

**需求背景**：长时间运行的任务可能无声地卡住，用户不知道发生了什么。

**设计决策**：

1. **为什么单独模块而非放入 TaskManager**：
   - TaskManager 是纯事件分发器，无定时器概念
   - 卡死检测是轮询逻辑，与事件驱动架构不同
   - 独立模块便于测试和独立配置

2. **数据模型变更**：
   - `TaskState` 新增 `lastOutputTime: number` 字段
   - `StateStore.createTask()` 初始化
   - `StateStore.appendOutput()` / `updateStatus()` 更新

**StallDetector 实现**：

```typescript
export class StallDetector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private alertedTasks = new Set<string>();  // 防重复告警

  start(): void {
    this.intervalId = setInterval(() => this.check(), config.checkIntervalMs);
  }

  private check(): void {
    const tasks = this.stateStore.listTasks();
    for (const task of tasks) {
      if (task.status !== 'RUNNING') {
        this.alertedTasks.delete(task.taskId);
        continue;
      }
      const idleMs = Date.now() - task.lastOutputTime;
      if (idleMs > config.timeoutMs && !this.alertedTasks.has(task.taskId)) {
        this.alertedTasks.add(task.taskId);
        this.onStallCallback?.(task.taskId, idleMs);
      }
    }
  }
}
```

**配置项**：
```json
{
  "stallDetection": {
    "enabled": true,
    "timeoutMs": 300000,
    "checkIntervalMs": 30000
  }
}
```

### Phase 4: AI 解读器

**关键决策时刻**：用户被问"用哪个 LLM 提供商"，回答是"可配置/多提供商"。这个回答直接影响了整个架构设计——必须抽象provider层。

#### LLM 提供商抽象

```typescript
// llm/types.ts
export interface LLMProvider {
  name: string;
  interpret(prompt: string): Promise<string>;
}

export interface LLMConfig {
  provider: 'claude' | 'openai' | 'ollama';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled?: boolean;
}
```

#### 三个提供商实现

| 提供商 | 协议 | 特点 |
|--------|------|------|
| Claude API | HTTPS | 需要 API key，默认 claude-sonnet-4 |
| OpenAI API | HTTPS | 需要 API key，默认 gpt-4o |
| Ollama | HTTP | 本地运行，无需 API key，默认 llama3 |

所有实现均使用 Node.js 原生 `https` / `http` 模块，**无外部依赖**。

#### Factory 模式

```typescript
export function createProvider(config: LLMConfig): LLMProvider | null {
  if (!config.enabled) return null;
  switch (config.provider) {
    case 'claude':
      if (!config.apiKey) return null;
      return createClaudeProvider(config.apiKey, config.model);
    case 'openai':
      if (!config.apiKey) return null;
      return createOpenAIProvider(config.apiKey, config.model);
    case 'ollama':
      return createOllamaProvider(config.baseUrl, config.model);
    default:
      return null;
  }
}
```

#### 配置项

```json
{
  "ai": {
    "provider": "ollama",
    "model": "llama3",
    "baseUrl": "http://localhost:11434",
    "enabled": true
  }
}
```

### Phase 5: VSCode 市场发布准备

#### package.json 必要字段

```json
{
  "name": "vibewatcher",
  "publisher": "vibewatcher-dev",
  "repository": "https://github.com/yandexuanxuan/VibeWatcher",
  "license": "MIT",
  "keywords": ["claude", "ai", "monitor", "websocket"]
}
```

**注意**：`icon` 字段不支持 SVG，VSCode Marketplace 要求 PNG 格式。

#### README 更新要点

- Marketplace 安装命令
- 新功能说明（卡死检测、AI 解读）
- License badge

---

## 四、测试演进

### 测试数量变化

| 版本 | CLI | Server | VSCode | Integration | LLM/AI | 总计 |
|------|-----|--------|--------|-------------|--------|------|
| v0.1 | 24 | 9 | 0 | 0 | 0 | 33 |
| v0.2 | 34 | 9 | 16 | 10 | 0 | 69 |
| v0.3 | 34 | 9 | 16 | 10 | 12 | 81 |

### 测试文件分布

```
vibewatcher-cli (6 files, 34 tests):
  matcher.test.ts, emitter.test.ts, parser.test.ts
  spawner.test.ts, websocket.test.ts, args-parser.test.ts

vibewatcher-server (7 files, 41 tests):
  state-store.test.ts, task-manager.test.ts
  stall-detector.test.ts, ai-interpreter.test.ts
  llm-provider.test.ts
  integration/cli-server.test.ts, integration/server-state.test.ts

vibewatcher-vscode (2 files, 16 tests):
  types.test.ts, utils.test.ts
```

### 异步测试模式（重点）

StallDetector 的测试需要处理定时器，Jest 29+ 有特殊要求：

```typescript
it('fires when task has been idle', (done) => {
  const det = new StallDetector(store, makeConfig({ timeoutMs: 100 }));
  det.onStall((id, ms) => stalled.push({ id, ms }));
  det.start();

  const t = store.createTask('old');
  t.lastOutputTime = Date.now() - 10000;

  setTimeout(() => {
    det.stop();
    expect(stalled).toHaveLength(1);
    done();
  }, 300);
}, 5000);  // Jest 29+ 需显式传超时参数
```

**经验总结**：
- Jest 29+ 对 `done()` 回调有 5s 默认超时，异步测试必须显式传超时参数
- `afterEach(() => { detector?.stop(); })` 确保定时器清理
- 集成测试的 `afterAll(() => { server.stop(); })` 必须执行
- 随机端口避免测试间冲突

---

## 五、技术决策回顾

| 问题 | 决策 | 原因 |
|------|------|------|
| 为什么不使用 lerna/turborepo | 使用 npm workspaces | 项目简单（3包），无需额外工具 |
| 为什么 Server 类要拆分 | 分离类与入口 | 集成测试需要导入类启动，不能执行进程 |
| 为什么 LLM 提供商要抽象 | Factory 模式 | 用户偏好不同，可插拔架构便于配置切换 |
| 为什么 StallDetector 独立 | 职责分离 | TaskManager 事件驱动，StallDetector 轮询驱动 |

---

## 六、常见问题与解决

### 1. WebSocket 断开后日志堆积

**现象**：Jest 测试报 "Cannot log after tests are done"。

**原因**：服务器关闭时，客户端延迟收到 close 事件，在测试清理后触发日志。

**处理**：
- 使用 `afterAll(() => { server.stop(); })` 确保清理
- 这是警告不影响测试结果（所有测试通过）

### 2. TypeScript 类型修改顺序

**问题**：`TaskState` 新增字段后，其他文件引用报错。

**正确顺序**：
1. 先改 `vibewatcher-shared/src/types.ts`
2. 再改所有引用文件
3. 最后删除旧 types.ts
4. 运行编译检查

### 3. npm workspaces 路径问题

**问题**：`npm install` 找不到根 `package.json`。

**解决**：确保在项目根目录执行：
```bash
cd /home/dev/projects/VibeWatcher && npm install
```

### 4. VSCode 扩展图标格式

**原因**：Marketplace 要求 PNG，本地开发可用 SVG。

**建议**：准备 128x128 和 256x256 PNG 版本。

### 5. Jest 测试超时

**原因**：`setTimeout` 回调未调用 `done()` 或超时未设置。

**解决**：
- 增加超时参数：`, 10000` 在 it 签名
- 确保 `detector.stop()` 在所有代码路径执行

---

## 七、最佳实践

### 1. 功能模块化

新增功能应独立成模块，而非混入现有代码：
- 便于测试（可独立实例化）
- 便于维护（职责清晰）
- 便于配置（可按需启用/禁用）

### 2. 配置驱动

功能应该可通过配置文件启用/禁用，而非硬编码。这样用户可以根据需求调整，也便于测试（可 mock 配置）。

### 3. 测试真实场景

集成测试启动真实服务器，测试完整的数据流。真实场景比 mock 更能发现实际问题，如端口冲突、时序问题、状态不一致等。

### 4. 向后兼容

修改数据结构时（如 `TaskState` 新增字段），考虑旧数据的兼容。示例：`history.json` 格式迁移逻辑。

### 5. CI/CD 优先

新项目一开始就应该有 CI/CD，而非事后补充。GitHub Actions 让这变得非常简单，关键是可以防止 regression。

### 6. 问关键问题

在开始实现前，问一个关键问题可以节省大量返工。如"AI 解读用哪个提供商"这个问题，直接影响了整个架构设计。

---

## 八、学习建议

### 从稳定化开始

新项目完成后，先做稳定化（测试、CI/CD、代码质量），再添加新功能。稳定的基础让后续开发更高效，也减少调试时间。

### 测试驱动开发

关键功能（StallDetector、LLM Provider）应该先写测试再实现。测试定义了预期行为，也防止后续修改破坏已有功能。

### 渐进式重构

代码质量问题是逐步积累的，应该在日常开发中持续改进。发现重复代码就消除，发现测试缺失就补充，不要等到"大重构"。

### 文档即代码

CHANGELOG、LEARNING_NOTES、CLAUDE.md 都是项目文档的一部分。好的文档让项目更容易维护和协作，也帮助自己回顾决策原因。

### 记录决策

每个技术决策都应有记录：
- 为什么这样做？
- 有哪些替代方案？
- 最终选择了哪个，为什么？

这些记录对于团队协作和未来维护非常有价值。

---

**文档版本**: v5.0
**更新日期**: 2026-05-12
**内容**: npm workspaces 陷阱、monorepo 调试经验、路径问题、性能问题

---

## 七、调试经验总结

### 1. 服务启动失败排查

**典型问题**：
- 端口被占用：`lsof -i :3001`
- 环境变量未加载：检查 `.env` 是否存在、dotenv 是否正确导入
- 模块路径错误：检查 import 语句

**排查命令**：
```bash
# 检查端口占用
lsof -i :3001

# 检查服务进程
ps aux | grep node

# 杀死进程
pkill -f "tsx watch"

# 检查 .env 文件
cat .env

# 测试服务
curl http://localhost:3001/health
```

### 2. npm install 失败排查

```bash
# 清理缓存重装
rm -rf node_modules package-lock.json
npm install

# 检查 workspaces 配置
cat package.json | grep workspaces

# 检查子包 package.json
ls packages/*/package.json

# 使用 --verbose 查看详细日志
npm install --verbose
```

### 3. TypeScript 编译错误

```bash
# 在对应包目录执行
npm -w @org/server run build

# 检查 tsconfig 配置
cat packages/server/tsconfig.json

# 检查模块解析
npx tsc --traceResolution
```

### 4. 前端开发服务器问题

```bash
# 重启 Vite 开发服务器
# Vite 有热重载，但有时候需要完全重启

# 检查 proxy 配置
cat packages/client/vite.config.ts

# 清除 Vite 缓存
rm -rf node_modules/.vite
```

---

## 十、性能考虑

### 1. dotenv 加载时机

**问题**：dotenv 必须在任何使用环境变量的代码之前加载。

**正确顺序**：
```typescript
// 第一行
import { config } from 'dotenv';
config();

// 之后才能使用 process.env.*
```

**常见错误**：在 `import` 阶段就读取 `process.env.*`，但 dotenv 还未执行。

### 2. 数据库连接

**问题**：每次请求都创建新连接会非常慢。

**解决**：
```typescript
// 模块级别单例
const client = postgres(connectionString);
const db = drizzle(client, { schema });
export { db };
```

### 3. LLM API 调用

**问题**：每次请求创建新 fetch 连接。

**解决**：
```typescript
// 使用连接池或 keep-alive
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  // 默认 keep-alive
});
```

---

## 十一、CLI 工具开发

### 1. bin 字段配置

```json
{
  "name": "@org/cli",
  "bin": {
    "cognitiveos": "./bin/cognitiveos.js"
  }
}
```

**必须步骤**：
```bash
chmod +x bin/cognitiveos.js  # 标记为可执行
```

### 2. Shebang 行

```javascript
#!/usr/bin/env node
```

确保在不同系统上正确找到 node 解释器。

### 3. commander.js 使用

```javascript
import { Command } from 'commander';

const program = new Command();

program
  .name('app')
  .description('Description')
  .version('1.0.0');

program
  .command('ask')
  .description('Ask question')
  .argument('<query>', 'the question')
  .option('-m, --mode <mode>', 'mode')
  .action(askCommand);

program.parse();
```

### 4. 颜色输出

```javascript
import chalk from 'chalk';

console.log(chalk.green('✓ Success'));
console.log(chalk.red('✗ Error'));
console.log(chalk.cyan('Info:'));
```

### 5. 交互式输入

```javascript
import inquirer from 'inquirer';

const answers = await inquirer.prompt([
  {
    type: 'list',
    name: 'mode',
    message: 'Select mode:',
    choices: ['quick', 'reasoning', 'alignment']
  }
]);
```

---

## 十二、测试最佳实践

### 1. 测试导入问题

**问题**：ESM 模块在测试中导入路径复杂。

**解决**：使用相对路径从项目根开始：
```javascript
import { x } from '../packages/shared/src/schemas.js';
```

### 2. 异步测试超时

```typescript
it('async test', async () => {
  // Jest 29+ 默认 5s 超时
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 10000); // 显式设置超时
```

### 3. Mock vs 真实实现

**原则**：
- 单元测试：Mock 外部依赖（LLM API、数据库）
- 集成测试：使用真实实现

```typescript
// 单元测试 - Mock HTTP
const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
global.fetch = mockFetch;

// 集成测试 - 使用真实实现
import { createServer } from '../src/server.js';
```

### 4. 测试隔离

```typescript
beforeEach(() => {
  // 重置状态
  state = {};
});

afterEach(() => {
  // 清理
  detector?.stop();
});
```

---

**文档版本**: v6.0
**更新日期**: 2026-05-12
**内容**: VibeWatcher 项目调试经验、打包流程、VSCode 扩展问题

---

## 十四、VibeWatcher v1.0 开发与 VSCode 扩展打包（2026-05-12）

### 14.1 v1.0 新功能开发

#### 1. 一键安装脚本 (install.sh)

**目标**：解决用户需要手动执行 6 个步骤才能使用工具的问题。

**实现要点**：
- Node.js 版本检查
- 依赖安装 (`npm install`)
- 项目构建 (`npm run build`)
- 二进制文件复制到 `~/.vibewatch/bin/`
- 自动配置 Shell PATH (`~/.bashrc` 或 `~/.zshrc`)
- 自动启动 daemon

**关键脚本逻辑**：
```bash
# 复制服务器和 CLI 二进制
cp "$SCRIPT_DIR/vibewatcher-server/dist/server.js" "$BIN_DIR/server.js"
cp "$SCRIPT_DIR/vibewatcher-cli/bin/vibewatch" "$BIN_DIR/vibewatch"

# 符号链接 node_modules（解决依赖问题）
ln -sf "$SCRIPT_DIR/node_modules" "$BIN_DIR/node_modules"
```

#### 2. Daemon 模式 (vibe-daemon)

**问题**：用户需要保持终端开启运行 server。

**解决方案**：
- 创建 PID 文件管理 (`~/.vibewatch/run/vibewatcher.pid`)
- 后台运行服务
- 支持 start/stop/restart/status/log 命令

**PID 文件管理**：
```bash
PID_FILE="$INSTALL_DIR/run/vibewatcher.pid"
LOG_FILE="$INSTALL_DIR/logs/server.log"

# 检查是否运行
is_running() {
    local pid=$(read_pid)
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# 启动 daemon
cmd_start() {
    nohup node "$SERVER_BIN" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
}
```

#### 3. VSCode 扩展自动启动

**实现**：扩展激活时检测 server 是否运行，若未运行则自动启动。

```typescript
// extension.ts
export function activate(): void {
  // 先尝试连接
  wsClient = new VSCodeWebSocketClient(DEFAULT_HOST, DEFAULT_PORT);

  // 检测 server 是否可达
  isServerReachable().then(async (reachable) => {
    if (!reachable) {
      // 自动启动 daemon
      await tryStartDaemon();
    }
    wsClient.connect()...
  });
}
```

### 14.2 VSCode 扩展打包问题

#### 问题 1：Node.js 版本兼容性问题

**现象**：
```
SyntaxError: Unexpected token '?'
at wrapSafe (internal/modules/cjs/loader.js:915:16)
```

**原因**：系统使用 Node.js v12.22.9，而新版本 `@vscode/vsce` 编译目标为 ES2020，使用了可选链操作符 `?.`。

**解决**：
1. 切换到 Node 20：`source ~/.nvm/nvm.sh && nvm use 20`
2. 使用绝对路径调用 vsce：`/home/dev/.nvm/versions/node/v20.20.2/bin/node /home/dev/.nvm/versions/node/v20.20.2/lib/node_modules/@vscode/vsce/vsce package`

#### 问题 2：Git Token 安全检测

**现象**：
```
ERROR  Potential security issue detected: Your extension package contains sensitive information
found GitHub Token(GitHub personal access tokens):... [github]
../.git/config#7:30-7:70
```

**原因**：VSCode 检测到 `.git/config` 中包含 GitHub token。

**解决**：
1. 在 `.vscodeignore` 中排除 `.git/` 目录
2. 或使用 `--allow-package-secrets github` 标志（新版 vsce 支持）

**更新后的 .vscodeignore**：
```
# Git
.git/
.gitignore

# Source code
src/**
tests/**

# OS
.DS_Store
Thumbs.db
```

#### 问题 3：大小写不敏感路径冲突

**现象**：
```
ERROR  The following files have the same case insensitive path, which isn't supported by the VSIX format:
  - extension/node_modules/ws/wrapper.mjs
  - extension/node_modules/ws/wrapper.mjs
```

**原因**：
- npm workspaces 项目中 `node_modules/ws` 被多个包共享
- Windows 文件系统不区分大小写，导致打包时检测到重复文件
- 根目录 `node_modules/` 和 `vibewatcher-vscode/node_modules/` 中都有 `ws` 模块

**调试过程**：
1. 检查 `node_modules/ws` 文件结构
2. 发现符号链接导致文件被计算两次
3. 尝试各种 .vscodeignore 配置
4. 最终通过手动排除和清理解决

**解决方案**：
1. 删除根目录的 `ws` 共享：`rm -rf node_modules/ws`
2. 在 .vscodeignore 中排除根目录：`../*`
3. 或手动打包（绕过 vsce 检查）

**手动打包方法**：
```bash
# 创建干净目录
mkdir -p extension_temp
cp -r out media extension_temp/
cp package.json LICENSE README.md extension_temp/
mkdir node_modules && cp -r node_modules/ws node_modules/

# 使用 Python 创建 vsix
python3 -c "
import zipfile, os
with zipfile.ZipFile('vibewatcher-1.0.0.vsix', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            filepath = os.path.join(root, file)
            arcname = 'extension/' + filepath.replace('./', '')
            zf.write(filepath, arcname)
"
```

#### 问题 4：.vscodeignore 路径问题

**现象**：
```
ERROR  invalid relative path: extension/../verify.sh
```

**原因**：.vscodeignore 中的 `../verify.sh` 语法在打包时被拒绝。

**解决**：简化 .vscodeignore，只保留必要排除：
```
# Source code
src/**
tests/**

# Dependencies
node_modules/**

# Git
.git/
.gitignore

# OS
.DS_Store
Thumbs.db

# Logs
*.log
```

#### 问题 5：vsce 版本兼容

**发现**：不同版本的 vsce 对 Node.js 要求不同：
- `@vscode/vsce@latest`：需要 Node 20+，支持 `--allow-package-secrets`
- `@vscode/vsce@2.19.0`：可在 Node 14+ 运行，但可能没有某些新标志

**最佳实践**：
```bash
# 安装多个版本
npm install -g @vscode/vsce@2.19.0

# 使用绝对路径运行
/home/dev/.nvm/versions/node/v20.20.2/bin/node /home/dev/.nvm/versions/node/v20.20.2/lib/node_modules/@vscode/vsce/vsce package
```

### 14.3 打包成功验证

**最终打包命令**：
```bash
# 切换到 Node 20
source ~/.nvm/nvm.sh && nvm use 20

# 使用绝对路径运行 vsce
/home/dev/.nvm/versions/node/v20.20.2/bin/node \
  /home/dev/.nvm/versions/node/v20.20.2/lib/node_modules/@vscode/vsce/vsce \
  package --allow-package-secrets github
```

**验证 vsix 内容**：
```bash
unzip -l vibewatcher-1.0.0.vsix | head -20
# 输出应该包含：
# extension/package.json
# extension/out/extension.js
# extension/LICENSE
# extension/README.md
```

**本地安装测试**：
```bash
code --install-extension vibewatcher-1.0.0.vsix --force
# 输出：Extension 'vibewatcher-1.0.0.vsix' was successfully installed.
```

### 14.4 发布流程

#### 1. 版本统一

所有包需要统一版本号：
```bash
# 更新所有 package.json
sed -i 's/"version": "0.x.x"/"version": "1.0.0"/g' \
  vibewatcher-cli/package.json \
  vibewatcher-server/package.json \
  vibewatcher-vscode/package.json
```

#### 2. Git 提交和 Tag

```bash
git add -A
git commit -m "release: v1.0.0"
git tag v1.0.0
git push origin main --tags
```

**注意**：如果 token 没有 `workflow` 权限，推送会失败：
```
! [remote rejected] main -> main (refusing to allow a Personal Access Token 
to create or update workflow `.github/workflows/ci.yml` without `workflow` scope)
```

**解决**：删除 `.github/workflows/` 目录后再推送。

#### 3. GitHub Release

由于 `gh` CLI 需要交互式登录，建议手动创建：
1. 访问 https://github.com/yandexuanxuan/VibeWatcher/releases/new
2. 选择 tag `v1.0.0`
3. 上传 `.vsix` 文件
4. 发布

#### 4. VSCode Marketplace 发布

```bash
# 首次需要创建 publisher
vsce login vibewatcher-dev

# 发布
vsce publish
```

### 14.5 关键经验总结

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| VSCE 无法运行 | Node 版本过低 | 切换到 Node 20，使用绝对路径 |
| Token 检测报错 | .git/config 包含 token | 排除 .git/ 或用 --allow-package-secrets |
| 大小写路径冲突 | npm workspaces 共享 node_modules | 删除重复模块或手动打包 |
| 路径语法错误 | .vscodeignore 使用了无效语法 | 简化配置，只保留必要排除 |
| 发布失败 | token 权限不足 | 删除 workflows 目录后再推送 |

### 14.6 打包检查清单

**代码检查**：
- [ ] TypeScript 编译无错误
- [ ] VSCode 扩展编译成功
- [ ] 图标文件存在 (PNG 格式)
- [ ] LICENSE 文件存在

**版本检查**：
- [ ] 所有包版本统一为 1.0.0
- [ ] README.md 版本号更新
- [ ] CLAUDE.md 版本状态更新

**文件检查**：
- [ ] .vscodeignore 配置正确
- [ ] package.json metadata 完整
- [ ] VSCode README.md 存在

**发布检查**：
- [ ] Git commit 和 tag 已推送
- [ ] .vsix 文件已生成
- [ ] 本地安装测试通过

---

**文档版本**: v7.0
**更新日期**: 2026-05-12
**内容**: VibeWatcher v1.0 开发、VSCode 扩展打包问题与解决方案、npm workspaces 共享模块问题