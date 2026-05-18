# Event Bus + Cognitive Store 实现计划

**子系统：** Event Bus + Cognitive Store (基础设施层)  
**日期：** 2026-05-18  
**预计工作量：** 2-3天  
**依赖：** 无（这是第一个子系统）

---

## 1. 目标和范围

### 1.1 目标

实现 AgentMX 的核心基础设施：
- **Event Bus**: 事件发布/订阅机制，支持事件持久化和查询
- **Cognitive Store**: SQLite 数据存储，管理文件状态、Agent观察记录、冲突记录

### 1.2 范围内

✅ 事件总线的发布/订阅机制  
✅ 事件持久化到 SQLite (event_log 表)  
✅ 事件查询接口  
✅ 文件状态存储和查询 (file_state 表)  
✅ Agent观察记录 (agent_observation 表)  
✅ 冲突记录 (conflict_record 表)  
✅ 完整的单元测试（覆盖率 > 80%）

### 1.3 范围外

❌ File System Watcher（下一个子系统）  
❌ Conflict Detector（后续子系统）  
❌ Agent Adapter（后续子系统）  
❌ UI 或 CLI 工具

---

## 2. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **TypeScript** | ^5.0 | 主要开发语言 |
| **Node.js** | ^20.0 | 运行时环境 |
| **better-sqlite3** | ^11.0 | SQLite 数据库驱动 |
| **eventemitter3** | ^5.0 | 事件发布/订阅 |
| **uuid** | ^10.0 | 生成事件ID和冲突ID |
| **vitest** | ^2.0 | 测试框架 |
| **@types/better-sqlite3** | ^7.6 | TypeScript 类型定义 |

---

## 3. 文件结构

```
agentmx/
├── src/
│   ├── core/
│   │   ├── types.ts              # 核心类型定义
│   │   ├── event-bus.ts          # Event Bus 实现
│   │   ├── cognitive-store.ts    # Cognitive Store 实现
│   │   └── index.ts              # 导出接口
│   └── index.ts                  # 主入口
├── tests/
│   ├── event-bus.test.ts         # Event Bus 单元测试
│   ├── cognitive-store.test.ts   # Cognitive Store 单元测试
│   └── integration.test.ts       # 集成测试
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 4. 实现步骤

### Phase 1: 项目初始化（0.5天）

**任务：**
1. 初始化 npm 项目
2. 安装依赖
3. 配置 TypeScript
4. 配置 Vitest
5. 创建基础目录结构

**验收标准：**
- `npm install` 成功
- `npm run build` 成功编译 TypeScript
- `npm test` 可以运行（即使没有测试）

---

### Phase 2: 核心类型定义（0.5天）

**文件：** `src/core/types.ts`

**任务：**
1. 定义 `BaseEvent` 接口
2. 定义所有事件类型（FileStateChanged, AgentOperation, CognitiveConflict 等）
3. 定义 `FileSnapshot` 接口
4. 定义 `IEventBus` 接口
5. 定义 `ICognitiveStore` 接口
6. 定义查询参数类型

**关键类型：**

```typescript
// 基础事件
interface BaseEvent {
  event_id: string;
  event_type: string;
  timestamp: number;
  project_path: string;
  agent_id?: string;
  session_id?: string;
}

// 文件状态变化事件
interface FileStateChanged extends BaseEvent {
  event_type: 'FileStateChanged';
  file_path: string;
  old_hash?: string;
  new_hash: string;
  size: number;
  mtime: number;
  change_source: 'external' | 'agent' | 'unknown';
}

// Agent 操作事件
interface AgentOperation extends BaseEvent {
  event_type: 'AgentOperation';
  operation_type: 'read' | 'write' | 'edit' | 'delete' | 'command';
  target_paths: string[];
  based_on_hash?: Record<string, string>;
  operation_intent?: string;
}

// 认知冲突事件
interface CognitiveConflict extends BaseEvent {
  event_type: 'CognitiveConflict';
  conflict_type: 'G1_StaleRead' | 'G2_ExternalChange' | 'G3_FailedOperation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_files: Array<{
    path: string;
    agent_hash: string;
    current_hash: string;
  }>;
  context?: Record<string, any>;
}

// 文件快照
interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  exists: boolean;
}
```

**验收标准：**
- 所有类型定义完整且符合设计文档
- TypeScript 编译无错误
- 导出所有必要的类型

---

### Phase 3: Cognitive Store 实现（1天）

**文件：** `src/core/cognitive-store.ts`

**任务：**

#### 3.1 数据库初始化
- 创建 SQLite 数据库连接
- 创建 4 个表：event_log, file_state, agent_observation, conflict_record
- 创建所有索引

```typescript
class CognitiveStore implements ICognitiveStore {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  private initSchema() {
    // 创建表和索引
  }
}
```

#### 3.2 File State 管理
- `updateFileState(snapshot: FileSnapshot): Promise<void>`
  - 将旧记录的 `is_current` 设为 0
  - 插入新记录并设 `is_current = 1`
- `getFileState(filePath: string): Promise<FileSnapshot | null>`
  - 查询 `is_current = 1` 的记录
- `getFileHistory(filePath: string, limit?: number): Promise<FileSnapshot[]>`
  - 按时间倒序返回历史快照

#### 3.3 Agent Observation 管理
- `recordAgentRead(observation): Promise<void>`
  - 插入 file_read 类型的观察记录
- `getAgentLastRead(agentId, sessionId, filePath): Promise<{hash, timestamp} | null>`
  - 查询最后一次读取记录
- `recordAgentOperation(operation): Promise<void>`
  - 插入 operation 类型的观察记录

#### 3.4 Conflict Record 管理
- `recordConflict(conflict): Promise<string>`
  - 生成 conflict_id
  - 插入冲突记录
  - 返回 conflict_id
- `getConflictHistory(options): Promise<ConflictRecord[]>`
  - 支持按 agentId, sessionId, timeRange 过滤

#### 3.5 Event Log 管理
- `logEvent(event: BaseEvent): Promise<void>`
  - 将事件序列化为 JSON 存入 payload 字段
- `queryEvents(query: EventQuery): Promise<BaseEvent[]>`
  - 支持按 eventTypes, projectPath, timeRange 过滤
  - 反序列化 payload 为事件对象

**验收标准：**
- 所有方法实现完整
- 数据库操作使用事务保证一致性
- 错误处理完善
- 单元测试覆盖率 > 80%

---

### Phase 4: Event Bus 实现（1天）

**文件：** `src/core/event-bus.ts`

**任务：**

#### 4.1 订阅管理
- 使用 `eventemitter3` 实现发布/订阅
- 支持订阅单个或多个事件类型
- 支持过滤器和优先级

```typescript
class EventBus implements IEventBus {
  private emitter: EventEmitter;
  private store: ICognitiveStore;
  private subscriptions: Map<string, SubscriptionHandle>;
  
  constructor(store: ICognitiveStore) {
    this.emitter = new EventEmitter();
    this.store = store;
    this.subscriptions = new Map();
  }
  
  async publish(event: BaseEvent): Promise<void> {
    // 1. 持久化到 event_log
    await this.store.logEvent(event);
    
    // 2. 发布到订阅者
    const handlers = this.getHandlers(event.event_type);
    await Promise.allSettled(
      handlers.map(h => h(event).catch(err => {
        console.error(`Handler error:`, err);
      }))
    );
  }
  
  subscribe(
    eventType: string | string[],
    handler: (event: BaseEvent) => Promise<void>,
    options?: { filter?, priority? }
  ): SubscriptionHandle {
    // 实现订阅逻辑
  }
}
```

#### 4.2 事件发布
- 先持久化到 event_log
- 再发布到所有订阅者
- 使用 `Promise.allSettled` 确保一个处理器失败不影响其他

#### 4.3 事件查询
- 委托给 `CognitiveStore.queryEvents()`

#### 4.4 错误处理
- 处理器错误不应中断事件发布
- 记录错误日志

**验收标准：**
- 发布/订阅机制正常工作
- 事件持久化成功
- 多个订阅者可以接收同一事件
- 错误处理完善
- 单元测试覆盖率 > 80%

---

### Phase 5: 集成测试（0.5天）

**文件：** `tests/integration.test.ts`

**测试场景：**

1. **完整事件流测试**
   ```typescript
   test('complete event flow', async () => {
     const store = new CognitiveStore(':memory:');
     const bus = new EventBus(store);
     
     // 订阅事件
     const received: BaseEvent[] = [];
     bus.subscribe('FileStateChanged', async (event) => {
       received.push(event);
     });
     
     // 发布事件
     await bus.publish({
       event_id: 'test-1',
       event_type: 'FileStateChanged',
       timestamp: Date.now(),
       project_path: '/test',
       file_path: '/test/main.ts',
       new_hash: 'abc123',
       size: 1024,
       mtime: Date.now(),
       change_source: 'external'
     });
     
     // 验证
     expect(received).toHaveLength(1);
     
     // 查询事件日志
     const events = await bus.queryEvents({
       eventTypes: ['FileStateChanged']
     });
     expect(events).toHaveLength(1);
   });
   ```

2. **文件状态追踪测试**
   - 更新文件状态
   - 查询当前状态
   - 查询历史快照

3. **Agent 观察记录测试**
   - 记录 Agent 读取文件
   - 记录 Agent 操作
   - 查询最后读取记录

4. **冲突记录测试**
   - 记录冲突
   - 查询冲突历史

**验收标准：**
- 所有集成测试通过
- 测试覆盖主要使用场景

---

## 5. 测试策略

### 5.1 单元测试

**CognitiveStore 测试：**
- 数据库初始化
- 每个方法的正常流程
- 边界条件（空数据、不存在的记录）
- 错误处理

**EventBus 测试：**
- 订阅/取消订阅
- 事件发布
- 多订阅者
- 过滤器和优先级
- 错误处理

### 5.2 集成测试

- Event Bus + Cognitive Store 协同工作
- 完整的事件流
- 数据持久化和查询

### 5.3 测试覆盖率目标

- 总体覆盖率 > 80%
- 核心逻辑覆盖率 > 90%

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 可以发布和订阅事件
- [ ] 事件持久化到 SQLite
- [ ] 可以查询历史事件（按类型、时间范围、项目路径）
- [ ] 可以存储和查询 file_state（当前状态 + 历史快照）
- [ ] 可以记录 agent_observation（file_read + operation）
- [ ] 可以记录 conflict_record
- [ ] 单元测试覆盖率 > 80%
- [ ] 所有集成测试通过

### 6.2 代码质量

- [ ] TypeScript 编译无错误
- [ ] 无 ESLint 警告
- [ ] 代码符合项目规范
- [ ] 所有公共接口有 JSDoc 注释

### 6.3 文档

- [ ] README.md 包含使用示例
- [ ] API 文档完整
- [ ] 测试文档说明测试场景

---

## 7. 风险和缓解

### 7.1 风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| SQLite 并发写入问题 | 高 | 中 | 使用 WAL 模式，添加重试机制 |
| 事件处理器死锁 | 高 | 低 | 使用 Promise.allSettled，超时机制 |
| 内存泄漏（订阅未清理） | 中 | 中 | 实现 unsubscribe，添加测试 |
| 数据库文件损坏 | 高 | 低 | 定期备份，添加完整性检查 |

### 7.2 性能考虑

- 使用索引优化查询
- 批量操作使用事务
- 考虑事件日志的归档策略（未来版本）

---

## 8. 下一步

完成此子系统后，下一个实现目标是：

**File System Watcher + File State Scanner**
- 监控文件系统变化
- 计算文件 hash/mtime
- 发布 FileStateChanged 事件

这将使 AgentMX 能够感知文件系统的变化。

---

## 9. 参考资料

- 设计文档：`docs/superpowers/specs/2026-05-18-agentmx-design.md`
- better-sqlite3 文档：https://github.com/WiseLibs/better-sqlite3
- eventemitter3 文档：https://github.com/primus/eventemitter3
