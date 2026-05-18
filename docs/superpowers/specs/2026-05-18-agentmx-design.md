# AgentMX 设计文档

**项目名称：** AgentMX (Agent Memory eXchange)  
**版本：** v0.1  
**日期：** 2026-05-18  
**作者：** Claude Code + User

## 1. 项目概述

### 1.1 问题背景

在使用AI编程工具（如Claude Code、Cursor等）时，存在以下核心问题：

1. **认知不对齐（Cognitive Misalignment）**
   - Agent不知道文件已被用户手动修改
   - Agent基于过时的文件状态做出决策
   - 导致错误的代码修改或冲突

2. **缺乏安全网（No Safety Net）**
   - 没有机制防止Agent做出破坏性修改
   - 重要架构文件可能被意外修改
   - 难以回溯和恢复

### 1.2 解决方案

AgentMX 是一个**状态同步系统**，用于维护Agent认知层与操作系统文件系统之间的对齐。

**核心能力：**
- 追踪文件变化（内容hash、修改时间）
- 记录Agent的外化认知状态（读过哪些文件、基于什么版本操作）
- 检测认知冲突（文件已变化但Agent不知道）
- 自动或半自动解决冲突（提醒重新读取、请求用户确认）

**设计原则：**
- 事件驱动架构，组件解耦
- 渐进式实现（v0.1 SQLite → v0.3 图数据库）
- 跨工具共享（不同AI工具可共享同一项目的认知状态）

---

## 2. 整体架构

### 2.1 架构模式

**事件驱动架构（Event-Driven Architecture）**

```
文件系统监控器 → 事件总线 ← Agent适配器
                ↓  ↑
            认知存储（SQLite）
                ↓  ↑
            冲突检测器 → 决策引擎
```

### 2.2 核心组件

| 组件 | 职责 | 依赖 |
|------|------|------|
| **Event Bus** | 事件发布/订阅、持久化 | - |
| **File System Watcher** | 监控文件变化（触发器） | Event Bus |
| **File State Scanner** | 计算文件真实状态（hash/mtime） | Event Bus |
| **Cognitive Store** | 存储认知状态（SQLite） | Event Bus |
| **Agent Adapter** | 与AI工具集成，记录外化认知 | Event Bus, Cognitive Store |
| **Conflict Detector** | 检测认知冲突（G1/G2/G3） | Cognitive Store |
| **Decision Engine** | 执行冲突解决策略 | Event Bus, Agent Adapter |

### 2.3 数据流示例

```
用户手动修改 src/main.ts
  ↓
File System Watcher 检测到变化
  ↓
发布 FileMightChanged 事件（触发器）
  ↓
File State Scanner 重新计算 hash/mtime
  ↓
发布 FileStateChanged 事件（最终事实）
  ↓
Cognitive Store 更新 file_state 表
  ↓
Agent 尝试编辑 src/main.ts
  ↓
Agent Adapter 拦截，记录到 agent_observation
  ↓
发布 AgentOperation 事件
  ↓
Conflict Detector 对比 file_state 和 agent_observation
  ↓
检测到 G1 冲突（Stale Read）
  ↓
发布 CognitiveConflict 事件
  ↓
Decision Engine 执行策略：通知 Agent 重新读取
```

### 2.4 版本规划

- **v0.1**: SQLite + 基础冲突检测（G1/G2/G3）
- **v0.2**: Claude Code adapter + 冲突提示UI
- **v0.3**: 关系图谱（迁移到图数据库）
- **v0.4**: 跨文件依赖推理

---

## 3. 事件模式（Event Schema）

### 3.1 基础事件结构

```typescript
interface BaseEvent {
  event_id: string;        // UUID
  timestamp: number;       // Unix timestamp (ms)
  project_path: string;    // 项目根路径
  event_type: string;      // 事件类型
}
```

### 3.2 文件系统事件

**FileMightChanged** - 文件可能变化（触发器）

```typescript
interface FileMightChanged extends BaseEvent {
  event_type: "file.might_changed";
  file_path: string;       // 相对于项目根的路径
  change_type: "created" | "modified" | "deleted" | "renamed";
  old_path?: string;       // 仅 renamed 时有值
}
```

**FileStateChanged** - 文件状态确认变化（最终事实）

```typescript
interface FileStateChanged extends BaseEvent {
  event_type: "file.state_changed";
  file_path: string;
  snapshot: {
    hash: string;          // SHA-256
    size: number;          // bytes
    mtime: number;         // Unix timestamp
    exists: boolean;
  };
  previous_snapshot?: {
    hash: string;
    size: number;
    mtime: number;
  };
}
```

### 3.3 Agent操作事件

**AgentFileRead** - Agent读取文件

```typescript
interface AgentFileRead extends BaseEvent {
  event_type: "agent.file_read";
  agent_id: string;
  session_id: string;
  file_path: string;
  file_hash: string;
  read_mode: "full" | "partial";
  line_range?: [number, number];
}
```

**AgentOperation** - Agent准备执行操作

```typescript
interface AgentOperation extends BaseEvent {
  event_type: "agent.operation";
  agent_id: string;
  session_id: string;
  operation: {
    type: "edit" | "write" | "delete" | "move" | "execute";
    target_paths: string[];
    based_on_hash?: Record<string, string>;
    intent?: string;
  };
}
```

**AgentCommandExecuted** - Agent执行了命令

```typescript
interface AgentCommandExecuted extends BaseEvent {
  event_type: "agent.command_executed";
  agent_id: string;
  session_id: string;
  command: string;
  exit_code: number;
  affected_paths?: string[];
}
```

### 3.4 冲突事件

**CognitiveConflict** - 检测到认知冲突

```typescript
interface CognitiveConflict extends BaseEvent {
  event_type: "cognitive.conflict";
  conflict_type: "G1_stale_read" | "G2_external_change" | "G3_failed_residue";
  agent_id: string;
  session_id: string;
  affected_files: Array<{
    path: string;
    agent_last_seen_hash: string;
    current_hash: string;
    change_source: "agent" | "external" | "unknown";
  }>;
  severity: "low" | "medium" | "high";
  context: {
    pending_operation?: AgentOperation;
    recent_commands?: AgentCommandExecuted[];
  };
}
```

### 3.5 决策事件

**RecoveryAction** - 决策引擎发出的恢复动作

```typescript
interface RecoveryAction extends BaseEvent {
  event_type: "recovery.action";
  conflict_id: string;
  action_type: "auto_refresh" | "request_diff_summary" | "block_and_confirm";
  target_agent: string;
  target_session: string;
  payload: {
    files_to_reread?: string[];
    diff_context?: Array<{path: string; old_hash: string; new_hash: string}>;
    block_reason?: string;
  };
}
```

---

## 4. 子系统接口

### 4.1 Event Bus Interface

```typescript
interface IEventBus {
  publish(event: BaseEvent): Promise<void>;
  
  subscribe(
    eventType: string | string[],
    handler: (event: BaseEvent) => Promise<void>,
    options?: {
      filter?: (event: BaseEvent) => boolean;
      priority?: number;
    }
  ): SubscriptionHandle;
  
  unsubscribe(handle: SubscriptionHandle): void;
  
  queryEvents(query: {
    eventTypes?: string[];
    projectPath?: string;
    timeRange?: [number, number];
    limit?: number;
  }): Promise<BaseEvent[]>;
}
```

### 4.2 File System Watcher Interface

```typescript
interface IFileSystemWatcher {
  watch(projectPath: string, options?: {
    ignore?: string[];
    debounce?: number;
  }): Promise<void>;
  
  unwatch(projectPath: string): Promise<void>;
  
  getStatus(projectPath: string): {
    isWatching: boolean;
    ignoredPatterns: string[];
    eventCount: number;
  };
}
```

### 4.3 File State Scanner Interface

```typescript
interface IFileStateScanner {
  scanFile(filePath: string): Promise<FileSnapshot>;
  scanFiles(filePaths: string[]): Promise<Map<string, FileSnapshot>>;
  scanDirectory(dirPath: string, options?: {
    recursive?: boolean;
    ignore?: string[];
  }): Promise<Map<string, FileSnapshot>>;
}

interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  exists: boolean;
}
```

### 4.4 Cognitive Store Interface

```typescript
interface ICognitiveStore {
  // File State
  updateFileState(snapshot: FileSnapshot): Promise<void>;
  getFileState(filePath: string): Promise<FileSnapshot | null>;
  getFileHistory(filePath: string, limit?: number): Promise<FileSnapshot[]>;
  
  // Agent Observation
  recordAgentRead(observation: {
    agentId: string;
    sessionId: string;
    filePath: string;
    fileHash: string;
    timestamp: number;
    readMode: "full" | "partial";
    lineRange?: [number, number];
  }): Promise<void>;
  
  getAgentLastRead(
    agentId: string,
    sessionId: string,
    filePath: string
  ): Promise<{hash: string; timestamp: number} | null>;
  
  recordAgentOperation(operation: {
    agentId: string;
    sessionId: string;
    operationType: string;
    targetPaths: string[];
    basedOnHash?: Record<string, string>;
    timestamp: number;
  }): Promise<void>;
  
  // Conflict Record
  recordConflict(conflict: {
    conflictType: string;
    agentId: string;
    sessionId: string;
    affectedFiles: Array<{path: string; agentHash: string; currentHash: string}>;
    severity: string;
    timestamp: number;
  }): Promise<string>;
  
  getConflictHistory(options?: {
    agentId?: string;
    sessionId?: string;
    timeRange?: [number, number];
    limit?: number;
  }): Promise<ConflictRecord[]>;
  
  // Event Log
  logEvent(event: BaseEvent): Promise<void>;
  queryEvents(query: EventQuery): Promise<BaseEvent[]>;
}
```

### 4.5 Agent Adapter Interface

```typescript
interface IAgentAdapter {
  registerSession(agentId: string, sessionId: string): Promise<void>;
  
  onFileRead(
    filePath: string,
    content: string,
    readMode: "full" | "partial",
    lineRange?: [number, number]
  ): Promise<void>;
  
  beforeOperation(operation: {
    type: string;
    targetPaths: string[];
    basedOnHash?: Record<string, string>;
  }): Promise<{
    allowed: boolean;
    reason?: string;
    requiredActions?: Array<{
      type: "reread" | "summarize_diff" | "confirm";
      files?: string[];
      context?: any;
    }>;
  }>;
  
  notifyRefresh(notification: {
    files: string[];
    reason: string;
    diffContext?: Array<{path: string; oldHash: string; newHash: string}>;
  }): Promise<void>;
  
  onCommandExecuted(
    command: string,
    exitCode: number,
    affectedPaths?: string[]
  ): Promise<void>;
}
```

### 4.6 Conflict Detector Interface

```typescript
interface IConflictDetector {
  detectConflict(operation: {
    agentId: string;
    sessionId: string;
    targetPaths: string[];
    basedOnHash?: Record<string, string>;
  }): Promise<ConflictDetection>;
  
  detectSessionConflicts(
    agentId: string,
    sessionId: string
  ): Promise<ConflictDetection[]>;
}

interface ConflictDetection {
  hasConflict: boolean;
  conflictType?: "G1_stale_read" | "G2_external_change" | "G3_failed_residue";
  severity?: "low" | "medium" | "high";
  affectedFiles: Array<{
    path: string;
    agentLastSeenHash: string;
    currentHash: string;
    changeSource: "agent" | "external" | "unknown";
  }>;
  recommendation: {
    action: "allow" | "refresh" | "summarize" | "block";
    reason: string;
  };
}
```

### 4.7 Decision Engine Interface

```typescript
interface IDecisionEngine {
  handleConflict(conflict: CognitiveConflict): Promise<RecoveryAction>;
  
  configureStrategy(config: {
    conflictType: string;
    severity: string;
    action: "auto_refresh" | "request_diff_summary" | "block_and_confirm";
  }): Promise<void>;
  
  getStrategy(conflictType: string, severity: string): Promise<string>;
}
```

---

## 5. 数据模型（SQLite Schema）

### 5.1 event_log 表

存储所有事件的完整记录。

```sql
CREATE TABLE event_log (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  project_path TEXT NOT NULL,
  agent_id TEXT,
  session_id TEXT,
  payload TEXT NOT NULL,  -- JSON格式
  
  INDEX idx_event_type ON event_log(event_type),
  INDEX idx_timestamp ON event_log(timestamp),
  INDEX idx_project_path ON event_log(project_path),
  INDEX idx_agent_session ON event_log(agent_id, session_id)
);
```

### 5.2 file_state 表

存储文件的当前状态和历史快照。

```sql
CREATE TABLE file_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  exists INTEGER NOT NULL,
  snapshot_time INTEGER NOT NULL,
  is_current INTEGER NOT NULL,  -- 1 = 最新状态
  
  UNIQUE(project_path, file_path, snapshot_time),
  INDEX idx_current_state ON file_state(project_path, file_path, is_current),
  INDEX idx_file_history ON file_state(project_path, file_path, snapshot_time DESC)
);
```

**设计说明：**
- `is_current = 1` 表示该记录是文件的最新状态
- 每次文件变化时，旧记录的 `is_current` 设为 0，插入新记录并设为 1
- 保留历史快照用于时间序列分析

### 5.3 agent_observation 表

存储Agent的外化认知状态。

```sql
CREATE TABLE agent_observation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  observation_type TEXT NOT NULL,  -- 'file_read' | 'operation' | 'command'
  timestamp INTEGER NOT NULL,
  
  -- File Read 相关
  file_path TEXT,
  file_hash TEXT,
  read_mode TEXT,
  line_range_start INTEGER,
  line_range_end INTEGER,
  
  -- Operation 相关
  operation_type TEXT,
  target_paths TEXT,      -- JSON array
  based_on_hash TEXT,     -- JSON object
  operation_intent TEXT,
  
  -- Command 相关
  command TEXT,
  exit_code INTEGER,
  affected_paths TEXT,    -- JSON array
  
  INDEX idx_agent_session ON agent_observation(agent_id, session_id, timestamp DESC),
  INDEX idx_file_reads ON agent_observation(agent_id, session_id, file_path, observation_type)
    WHERE observation_type = 'file_read'
);
```

### 5.4 conflict_record 表

存储检测到的冲突及其解决过程。

```sql
CREATE TABLE conflict_record (
  conflict_id TEXT PRIMARY KEY,
  conflict_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  
  affected_files TEXT NOT NULL,  -- JSON array
  context TEXT,                  -- JSON object
  
  resolution_status TEXT NOT NULL DEFAULT 'pending',
  resolution_action TEXT,
  resolution_time INTEGER,
  resolution_details TEXT,       -- JSON object
  
  INDEX idx_agent_conflicts ON conflict_record(agent_id, session_id, timestamp DESC),
  INDEX idx_conflict_type ON conflict_record(conflict_type, severity),
  INDEX idx_resolution_status ON conflict_record(resolution_status)
);
```

### 5.5 关键查询

**获取文件当前状态：**
```sql
SELECT * FROM file_state
WHERE project_path = ? AND file_path = ? AND is_current = 1;
```

**获取Agent最后一次读取文件的hash：**
```sql
SELECT file_hash, timestamp FROM agent_observation
WHERE agent_id = ? AND session_id = ? AND file_path = ?
  AND observation_type = 'file_read'
ORDER BY timestamp DESC
LIMIT 1;
```

**检测G1冲突（Stale Read）：**
```sql
SELECT 
  ao.file_path,
  ao.file_hash as agent_hash,
  fs.hash as current_hash,
  ao.timestamp as agent_read_time,
  fs.snapshot_time as file_change_time
FROM agent_observation ao
JOIN file_state fs ON ao.file_path = fs.file_path AND fs.is_current = 1
WHERE ao.agent_id = ? AND ao.session_id = ?
  AND ao.observation_type = 'file_read'
  AND ao.file_hash != fs.hash
  AND ao.timestamp < fs.snapshot_time;
```

---

## 6. 冲突检测规则

### 6.1 G1: Stale Read（认知过期）

**触发条件：**
- Agent上次读取文件时 hash = H1
- 当前文件 hash = H2 (H1 ≠ H2)
- Agent准备继续操作该文件

**严重程度：** Low

**响应策略：** 自动提醒Agent重新读取文件

### 6.2 G2: Unexpected External Change（外部变化冲突）

**触发条件：**
- 文件变化不是由当前Agent操作造成
- Agent仍然准备基于旧计划继续

**严重程度：** Medium

**响应策略：** 要求Agent先summarize diff，理解变化后再继续

### 6.3 G3: Failed Operation Residue（失败副作用冲突）

**触发条件：**
- Agent命令失败（exit_code ≠ 0）
- 但文件发生了变化
- Agent准备继续执行后续任务

**严重程度：** High

**响应策略：** 阻止后续危险操作，要求处理recovery context

---

## 7. 实现考虑

### 7.1 技术栈

**推荐：TypeScript/Node.js**

**核心依赖：**
```json
{
  "chokidar": "^3.x",           // 文件系统监控
  "better-sqlite3": "^9.x",     // SQLite
  "eventemitter3": "^5.x",      // 事件总线
  "crypto": "built-in",         // 文件hash计算
  "glob": "^10.x"               // 文件扫描
}
```

### 7.2 关键实现细节

**文件Hash计算优化：**
```typescript
async function computeFileHash(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  
  return hash.digest('hex');
}
```

**Watcher防抖策略：**
```typescript
const debouncedScan = debounce((filePath: string) => {
  fileStateScanner.scanFile(filePath);
}, 100, { maxWait: 500 });
```

**默认忽略模式：**
```typescript
const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/venv/**',
  '**/.venv/**'
];
```

**事件总线错误处理：**
```typescript
async publish(event: BaseEvent) {
  const handlers = this.getHandlers(event.event_type);
  
  await Promise.allSettled(
    handlers.map(h => h(event).catch(err => {
      console.error(`Handler error for ${event.event_type}:`, err);
      this.publishError(event, err);
    }))
  );
}
```

### 7.3 目录结构

```
agentmx/
├── src/
│   ├── core/
│   │   ├── event-bus.ts
│   │   ├── cognitive-store.ts
│   │   └── types.ts
│   ├── watcher/
│   │   ├── file-watcher.ts
│   │   └── file-scanner.ts
│   ├── detector/
│   │   └── conflict-detector.ts
│   ├── decision/
│   │   └── decision-engine.ts
│   └── adapter/
│       └── agent-adapter.ts
├── tests/
├── docs/
└── package.json
```

---

## 8. 实现路线图

### 8.1 第一个子系统：Event Bus + Cognitive Store

**为什么组合实现：**
- 紧密耦合：Event Bus需要持久化到event_log表
- 可以一起测试：发布事件 → 查询事件日志
- 提供完整的基础设施

**验收标准：**
- [ ] 可以发布和订阅事件
- [ ] 事件持久化到SQLite
- [ ] 可以查询历史事件
- [ ] 可以存储和查询file_state
- [ ] 可以记录agent_observation
- [ ] 可以记录conflict_record
- [ ] 单元测试覆盖率 > 80%

**预计工作量：** 2-3天

### 8.2 后续子系统顺序

1. **Event Bus + Cognitive Store**（基础设施层）- 2-3天
2. **File System Watcher + File State Scanner**（感知层）- 2-3天
3. **Conflict Detector**（检测层）- 3-4天
4. **Decision Engine**（决策层）- 1-2天
5. **Agent Adapter**（集成层）- 5-7天（每个工具）

---

## 9. 关键设计决策

### 9.1 为什么选择事件驱动架构？

- 组件高度解耦，可独立开发和测试
- 易于扩展新的AI工具或监控源
- 事件日志天然支持时间序列分析和审计
- 支持跨工具共享状态

### 9.2 为什么v0.1不用图数据库？

- 第一版的核心冲突检测不需要复杂图推理
- 只需要维护：文件hash、Agent读取记录、冲突检测
- SQLite足够轻量且易于部署
- v0.3/v0.4再迁移到图数据库支持依赖推理

### 9.3 为什么需要File State Scanner？

- File System Watcher会有事件丢失、重复、噪声等问题
- Watcher只作为"触发器"，Scanner计算最终事实
- 分离关注点：检测变化 vs 确认状态

### 9.4 什么是"外化认知"（Externalized Cognition）？

- AgentMX不能访问AI模型的内部hidden state
- 只能管理Agent暴露出来的认知：
  - 读过哪些文件
  - 看到的文件hash
  - 执行的命令
  - 准备操作的路径
- 通过这些外化状态检测认知偏差

---

## 10. 未来扩展

### v0.2: Claude Code Adapter
- 实现Claude Code的Agent Adapter
- 冲突提示UI
- 用户确认流程

### v0.3: 关系图谱
- 迁移到图数据库（Neo4j或类似）
- 存储文件依赖关系
- 支持复杂关系查询

### v0.4: 跨文件依赖推理
- 分析import/require关系
- 检测跨文件影响
- 提供依赖可视化

### v0.5: 多Agent协作
- 支持多个Agent同时工作
- 检测Agent间的操作冲突
- 协调并发修改

---

## 11. 参考资料

### 相关概念
- **Cognitive Alignment**: Agent认知与环境状态的一致性
- **Externalized Cognition**: 可观察的认知状态
- **Event Sourcing**: 通过事件序列重建状态

### 类似工具
- Git: 版本控制和冲突检测
- File System Watchers: chokidar, watchman
- Event Stores: EventStoreDB

---

**文档状态：** 待审核  
**下一步：** 用户审核 → 实现计划编写
