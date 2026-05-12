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

**文档版本**: v4.0
**更新日期**: 2026-05-12
**内容**: v0.2 稳定化、v0.3 新功能开发、测试演进、技术决策回顾