# AgentMX 工具 API 参考

本文档详细说明 AgentMX MCP Server 提供的 7 个工具的完整 API。

## 目录

- [record_file_read](#record_file_read) - 记录文件读取
- [record_file_write](#record_file_write) - 记录文件写入
- [check_conflicts](#check_conflicts) - 检查认知冲突
- [get_event_history](#get_event_history) - 查询事件历史
- [get_conflict_history](#get_conflict_history) - 查询冲突历史
- [get_file_state](#get_file_state) - 获取文件状态
- [resolve_conflict](#resolve_conflict) - 解决冲突

---

## record_file_read

记录 agent 读取文件的操作，用于追踪认知状态。

### 用途

- 在读取文件后调用，记录 agent 对文件内容的理解
- 建立 agent 观察的时间戳和内容快照
- 为后续的冲突检测提供基准

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ✅ | 文件的绝对路径 |
| `content_hash` | string | ❌ | 文件内容的 SHA-256 哈希值（可选，会自动计算） |
| `agent_id` | string | ❌ | Agent 标识符（默认使用环境变量 `AGENTMX_AGENT_ID`） |
| `project_path` | string | ❌ | 项目根目录路径（默认使用当前工作目录） |

### 返回值

```json
{
  "observation_id": "uuid-string",
  "message": "File read recorded successfully",
  "potential_conflicts": [
    {
      "conflict_type": "G1_stale_read",
      "description": "File state has changed since last observation..."
    }
  ]
}
```

**字段说明：**
- `observation_id`: 本次观察的唯一标识符
- `message`: 操作结果消息
- `potential_conflicts`: 可选，如果检测到潜在冲突会返回此字段

### 使用示例

```javascript
// 通过 Claude Code Hooks 自动调用（推荐）
// PostToolUse Hook 会在 Read 操作后自动触发
const content = await Read('/path/to/file.ts');
// record_file_read 自动被调用，无需手动操作

// 或手动调用（如果不使用 Hooks）
await record_file_read({
  file_path: '/path/to/file.ts'
  // content_hash 会自动计算
});
```

### 注意事项

- **推荐使用 Claude Code Hooks 自动调用**，无需手动操作
- 如果未提供 `content_hash`，工具会自动读取文件并计算 SHA-256 哈希值
- 必须在项目根目录有 `.agentmx-enabled` 文件，否则返回错误
- 如果文件状态已改变，会在返回中提示潜在冲突

---

## record_file_write

记录 agent 写入文件的操作。

### 用途

- 在写入文件后调用，更新文件状态快照
- 记录文件内容的变化（旧哈希 → 新哈希）
- 触发 `file_state_changed` 事件，通知其他 agent

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ✅ | 文件的绝对路径 |
| `new_hash` | string | ❌ | 写入后文件内容的 SHA-256 哈希值（可选，会自动计算） |
| `old_hash` | string | ❌ | 写入前文件内容的哈希值（新文件时为 null） |
| `agent_id` | string | ❌ | Agent 标识符 |
| `project_path` | string | ❌ | 项目根目录路径 |

### 返回值

```json
{
  "success": true,
  "message": "File write recorded successfully"
}
```

### 使用示例

```javascript
// 通过 Claude Code Hooks 自动调用（推荐）
// PostToolUse Hook 会在 Write/Edit 操作后自动触发
await Write('/path/to/file.ts', newContent);
// record_file_write 自动被调用，无需手动操作

// 或手动调用（如果不使用 Hooks）
await record_file_write({
  file_path: '/path/to/file.ts'
  // new_hash 会自动计算
  // old_hash 可选
});
```

### 注意事项

- **推荐使用 Claude Code Hooks 自动调用**，无需手动操作
- 如果未提供 `new_hash`，工具会自动读取文件并计算 SHA-256 哈希值
- 如果是新建文件，`old_hash` 可以省略或传 `null`
- 写入操作会更新数据库中的 `file_state` 表
- 会发布 `agent_file_write` 和 `file_state_changed` 事件到事件总线

---

## check_conflicts

检查文件是否存在认知冲突（agent 的理解是否过时）。

### 用途

- 在写入文件前调用，确保 agent 的理解是最新的
- 检测 G1 冲突（Stale Read - agent 读取的内容已过时）
- 避免基于过时信息进行修改

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ✅ | 文件的绝对路径 |
| `agent_id` | string | ❌ | Agent 标识符 |
| `project_path` | string | ❌ | 项目根目录路径 |

### 返回值

**无冲突：**
```json
{
  "has_conflict": false,
  "conflicts": []
}
```

**有冲突：**
```json
{
  "has_conflict": true,
  "conflicts": [
    {
      "conflict_id": "uuid-string",
      "conflict_type": "G1_stale_read",
      "severity": "medium",
      "description": "Your understanding of this file is outdated. The file has been modified since you last read it.",
      "agent_expected_hash": "abc123...",
      "actual_hash": "def456...",
      "detected_at": 1234567890,
      "recommended_action": "Re-read the file before making changes to ensure you have the latest content."
    }
  ]
}
```

### 使用示例

```javascript
// 通过 Claude Code Hooks 自动调用（推荐）
// PreToolUse Hook 会在 Write/Edit 操作前自动触发
await Write('/path/to/file.ts', newContent);
// check_conflicts 在写入前自动被调用

// 如果检测到冲突，Hook 会返回警告信息
// Claude 会看到警告并决定是否重新读取文件

// 或手动调用（如果不使用 Hooks）
const check = await check_conflicts({
  file_path: '/path/to/file.ts'
});

if (check.has_conflict) {
  // 重新读取文件
  const newContent = await Read('/path/to/file.ts');
  // 基于最新内容进行修改
}
```

### 冲突类型

| 类型 | 说明 | 严重性 |
|------|------|--------|
| `G1_stale_read` | Agent 读取的内容已过时，文件已被修改 | medium |

### 注意事项

- **推荐使用 Claude Code Hooks 自动调用**，在写入前自动检查
- 如果检测到冲突，会自动记录到 `conflict_record` 表
- 冲突检测基于 agent 最后一次 `record_file_read` 的时间戳

---

## get_event_history

查询事件历史，了解文件或 agent 的操作时间线。

### 用途

- 查看文件的修改历史
- 追踪 agent 的操作记录
- 调试和审计

### 参数

所有参数都是可选的，用于过滤查询结果。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ❌ | 按文件路径过滤 |
| `agent_id` | string | ❌ | 按 agent ID 过滤 |
| `event_type` | string | ❌ | 按事件类型过滤（如 `file_state_changed`, `agent_file_read`） |
| `start_time` | number | ❌ | 起始时间戳（毫秒） |
| `end_time` | number | ❌ | 结束时间戳（毫秒） |
| `limit` | number | ❌ | 返回的最大事件数（默认 50） |
| `project_path` | string | ❌ | 按项目路径过滤 |

### 返回值

```json
{
  "events": [
    {
      "event_id": "uuid-1",
      "event_type": "file_state_changed",
      "timestamp": 1234567890,
      "file_path": "/path/to/file.ts",
      "agent_id": null,
      "details": {
        "event_id": "uuid-1",
        "timestamp": 1234567890,
        "project_path": "/path/to/project",
        "event_type": "file_state_changed",
        "file_path": "/path/to/file.ts",
        "old_hash": "abc123...",
        "new_hash": "def456...",
        "change_type": "modified"
      }
    },
    {
      "event_id": "uuid-2",
      "event_type": "agent_file_read",
      "timestamp": 1234567800,
      "file_path": "/path/to/file.ts",
      "agent_id": "claude-main",
      "details": {
        "event_id": "uuid-2",
        "timestamp": 1234567800,
        "project_path": "/path/to/project",
        "event_type": "agent_file_read",
        "agent_id": "claude-main",
        "file_path": "/path/to/file.ts",
        "content_hash": "abc123...",
        "read_timestamp": 1234567800
      }
    }
  ],
  "total_count": 2
}
```

### 事件类型

| 类型 | 说明 | 触发时机 |
|------|------|----------|
| `file_state_changed` | 文件状态改变 | 调用 `record_file_write` 时 |
| `agent_file_read` | Agent 读取文件 | 调用 `record_file_read` 时 |
| `agent_file_write` | Agent 写入文件 | 调用 `record_file_write` 时 |

### 使用示例

```javascript
// 查询特定文件的所有事件
const history = await get_event_history({
  file_path: '/path/to/file.ts',
  limit: 100
});

console.log(`Found ${history.total_count} events`);
history.events.forEach(event => {
  console.log(`${event.event_type} at ${new Date(event.timestamp)}`);
});
```

```javascript
// 查询特定 agent 的操作
const agentHistory = await get_event_history({
  agent_id: 'claude-main',
  event_type: 'agent_file_read',
  limit: 50
});
```

```javascript
// 查询时间范围内的事件
const recentEvents = await get_event_history({
  start_time: Date.now() - 3600000, // 最近 1 小时
  end_time: Date.now(),
  limit: 100
});
```

---

## get_conflict_history

查询冲突历史，了解过去的认知不一致问题。

### 用途

- 查看文件的冲突记录
- 分析频繁冲突的文件
- 审计冲突解决情况

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ❌ | 按文件路径过滤 |
| `agent_id` | string | ❌ | 按 agent ID 过滤 |
| `limit` | number | ❌ | 返回的最大冲突数（默认 50） |

### 返回值

```json
{
  "conflicts": [
    {
      "conflict_id": "uuid-string",
      "conflict_type": "G1_stale_read",
      "severity": "medium",
      "agent_id": "claude-main",
      "file_path": "/path/to/file.ts",
      "description": "Agent has stale file state - file was modified after agent read it",
      "agent_expected_hash": "abc123...",
      "actual_hash": "def456...",
      "detected_at": 1234567890,
      "resolved_at": 1234567900,
      "resolution_action": "prompt_reread",
      "resolution_notes": "Re-read file to get latest content"
    }
  ],
  "total_count": 1
}
```

### 使用示例

```javascript
// 查询特定文件的冲突历史
const conflicts = await get_conflict_history({
  file_path: '/path/to/file.ts'
});

console.log(`Found ${conflicts.total_count} conflicts`);
conflicts.conflicts.forEach(conflict => {
  console.log(`${conflict.conflict_type} detected at ${new Date(conflict.detected_at)}`);
  if (conflict.resolved_at) {
    console.log(`  Resolved with: ${conflict.resolution_action}`);
  } else {
    console.log(`  Status: UNRESOLVED`);
  }
});
```

---

## get_file_state

获取文件的当前状态和历史快照。

### 用途

- 查看文件的当前哈希值和修改时间
- 获取文件的历史版本快照
- 了解文件状态的演变

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | string | ✅ | 文件的绝对路径 |
| `include_history` | boolean | ❌ | 是否包含历史快照（默认 false） |
| `history_limit` | number | ❌ | 历史快照的最大数量（默认 10） |

### 返回值

**不包含历史：**
```json
{
  "current_state": {
    "file_path": "/path/to/file.ts",
    "content_hash": "abc123...",
    "mtime": 1234567890,
    "size": 1024,
    "is_current": true,
    "snapshot_id": 1
  },
  "history": null
}
```

**包含历史：**
```json
{
  "current_state": {
    "file_path": "/path/to/file.ts",
    "content_hash": "def456...",
    "mtime": 1234567890,
    "size": 1024,
    "is_current": true,
    "snapshot_id": 3
  },
  "history": [
    {
      "snapshot_id": 2,
      "file_path": "/path/to/file.ts",
      "content_hash": "abc123...",
      "mtime": 1234567800,
      "size": 1000,
      "is_current": false
    },
    {
      "snapshot_id": 1,
      "file_path": "/path/to/file.ts",
      "content_hash": "xyz789...",
      "mtime": 1234567700,
      "size": 900,
      "is_current": false
    }
  ]
}
```

### 使用示例

```javascript
// 获取当前状态
const state = await get_file_state({
  file_path: '/path/to/file.ts'
});

console.log(`Current hash: ${state.current_state.content_hash}`);
console.log(`Last modified: ${new Date(state.current_state.mtime)}`);
```

```javascript
// 获取历史快照
const stateWithHistory = await get_file_state({
  file_path: '/path/to/file.ts',
  include_history: true,
  history_limit: 5
});

console.log(`Current: ${stateWithHistory.current_state.content_hash}`);
console.log(`History: ${stateWithHistory.history.length} snapshots`);
```

---

## resolve_conflict

标记冲突为已解决，并记录解决方式。

### 用途

- 在解决冲突后调用，更新冲突状态
- 记录解决动作，用于审计和分析
- 关闭冲突记录

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `conflict_id` | string | ✅ | 冲突的唯一标识符（从 `check_conflicts` 获取） |
| `resolution_action` | string | ✅ | 解决动作（见下表） |
| `notes` | string | ❌ | 解决说明（可选） |

### 解决动作

| 动作 | 说明 | 使用场景 |
|------|------|----------|
| `prompt_reread` | 重新读取文件 | 检测到文件已修改，重新读取最新内容 |
| `abort_and_replan` | 中止并重新规划 | 冲突严重，需要重新思考方案 |
| `verify_and_rollback` | 验证并回滚 | 发现错误修改，需要回滚 |
| `user_override` | 用户手动处理 | 用户介入解决冲突 |

### 返回值

```json
{
  "success": true,
  "message": "Conflict uuid-string resolved with action: prompt_reread"
}
```

### 使用示例

```javascript
// 检查冲突
const check = await check_conflicts({
  file_path: '/path/to/file.ts'
});

if (check.has_conflict) {
  const conflict = check.conflicts[0];
  
  // 重新读取文件
  const newContent = await Read('/path/to/file.ts');
  const newHash = computeHash(newContent);
  
  await record_file_read({
    file_path: '/path/to/file.ts',
    content_hash: newHash
  });
  
  // 标记冲突已解决
  await resolve_conflict({
    conflict_id: conflict.conflict_id,
    resolution_action: 'prompt_reread',
    notes: 'Re-read file and updated understanding'
  });
}
```

---

## 完整工作流示例

### 使用 Claude Code Hooks（推荐）

```javascript
// 1. 读取文件（PostToolUse Hook 自动记录）
const content = await Read('/path/to/file.ts');
// → record_file_read 自动被调用

// 2. 分析并准备修改
const modifiedContent = analyzeAndModify(content);

// 3. 写入文件（PreToolUse Hook 自动检查冲突）
await Write('/path/to/file.ts', modifiedContent);
// → check_conflicts 在写入前自动被调用
// → 如果有冲突，会收到警告
// → record_file_write 在写入后自动被调用

// 完全自动化，无需手动调用任何 MCP 工具
```

### 手动调用工具（不使用 Hooks）

```javascript
// 1. 读取文件
const content = await Read('/path/to/file.ts');

// 2. 手动记录读取
await record_file_read({
  file_path: '/path/to/file.ts'
});

// 3. 在修改前手动检查冲突
const check = await check_conflicts({
  file_path: '/path/to/file.ts'
});

if (check.has_conflict) {
  // 3a. 如果有冲突，重新读取
  const newContent = await Read('/path/to/file.ts');
  
  await record_file_read({
    file_path: '/path/to/file.ts'
  });
  
  // 3b. 解决冲突
  await resolve_conflict({
    conflict_id: check.conflicts[0].conflict_id,
    resolution_action: 'prompt_reread'
  });
  
  // 使用最新内容
  content = newContent;
}

// 4. 修改文件
const modifiedContent = modifyContent(content);
await Write('/path/to/file.ts', modifiedContent);

// 5. 手动记录写入
await record_file_write({
  file_path: '/path/to/file.ts'
});
```

**推荐使用 Hooks 方式**，可以完全自动化追踪，无需手动调用工具。

---

## 错误处理

### 项目未启用

如果项目没有 `.agentmx-enabled` 文件，所有工具都会返回：

```json
{
  "success": false,
  "error": {
    "code": "AGENTMX_NOT_ENABLED",
    "message": "AgentMX is not enabled for this project",
    "project_path": "/path/to/project",
    "how_to_enable": [
      "Create a marker file: touch /path/to/project/.agentmx-enabled",
      "Or run: echo \"\" > .agentmx-enabled",
      "Then AgentMX will automatically work in this project"
    ],
    "why": "AgentMX uses opt-in per-project to avoid polluting unrelated projects"
  }
}
```

**解决方法：**
```bash
cd /path/to/project
touch .agentmx-enabled
```

### 工具执行失败

如果工具执行过程中出错：

```json
{
  "success": false,
  "error": {
    "code": "TOOL_EXECUTION_ERROR",
    "message": "Error message here",
    "details": "Stack trace here"
  }
}
```

---

## Token 成本参考

基于实际测试（2026-05-19）：

| 操作 | Token 消耗 | 说明 |
|------|-----------|------|
| 5 个工具调用 | ~1,897 tokens | 包含请求和响应 |
| 2 个工具调用 | ~896 tokens | 包含请求和响应 |
| 平均每个工具 | ~300-400 tokens | 估算值 |
| System Prompt（首次） | ~150 tokens | 仅在启用 AUTO_TRACK 时 |

**AUTO_TRACK 的 Token 成本：**
- 启用 `AGENTMX_AUTO_TRACK=true` 会在系统提示中增加约 150 tokens
- 这是一次性成本（每个会话开始时）
- 相比手动提示 Claude 使用工具，长期来看更节省 tokens

**优化建议：**
- 批量操作时尽量合并查询
- 使用 `limit` 参数限制返回数据量
- 只在必要时包含历史数据
- 如果项目不需要自动追踪，设置 `AGENTMX_AUTO_TRACK=false` 节省系统提示成本

---

## 最佳实践

### 1. 始终在写入前检查冲突

```javascript
// ✅ 推荐
const check = await check_conflicts({ file_path });
if (check.has_conflict) {
  // 处理冲突
}
await Write(file_path, content);
```

```javascript
// ❌ 不推荐
await Write(file_path, content); // 可能基于过时信息
```

### 2. 记录所有文件操作

```javascript
// ✅ 推荐
await Read(file_path);
await record_file_read({ file_path, content_hash });

await Write(file_path, content);
await record_file_write({ file_path, old_hash, new_hash });
```

### 3. 解决冲突后标记

```javascript
// ✅ 推荐
if (check.has_conflict) {
  // 重新读取
  await record_file_read({ file_path, content_hash });
  
  // 标记已解决
  await resolve_conflict({
    conflict_id: check.conflicts[0].conflict_id,
    resolution_action: 'prompt_reread'
  });
}
```

### 4. 使用查询工具调试

```javascript
// 查看文件的完整历史
const history = await get_event_history({ file_path });
const conflicts = await get_conflict_history({ file_path });
const state = await get_file_state({ file_path, include_history: true });
```

---

## 常见问题

### Q: 自动追踪是如何工作的？

A: 当 `AGENTMX_AUTO_TRACK=true` 时，MCP Server 会在初始化时注入系统级提示，要求 Claude 自动在文件操作后调用 AgentMX 工具。

**实现方式：** System Prompt 注入（MCP 协议的 `systemPrompt` 字段）

**可靠性：** 约 80%。这依赖 Claude 遵守系统提示，不是强制拦截。

**行为：**
- 读取文件后 → 自动调用 `record_file_read`
- 写入文件前 → 自动调用 `check_conflicts`
- 写入文件后 → 自动调用 `record_file_write`

**如果 Claude 没有自动调用：** 你可以手动提示，例如"请使用 AgentMX 记录这次文件读取"。

### Q: 为什么不是 100% 自动？

A: MCP 协议不支持拦截其他工具的调用。我们无法在 Read/Write 工具执行时自动触发 AgentMX 工具。System Prompt 注入是目前最实用的方案，在可靠性和实现复杂度之间取得平衡。

### Q: 如何计算文件的 SHA-256 哈希？

A: 使用 Node.js 的 `crypto` 模块：

```javascript
import { createHash } from 'crypto';

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
```

### Q: 工具在 `/tools` 中看不到？

A: AgentMX 工具显示在 `/mcp` 命令中，而不是 `/tools` 命令。这是 MCP Server 的标准行为。

### Q: 可以在多个项目中使用同一个数据库吗？

A: 可以，但不推荐。建议每个项目使用独立的数据库（项目目录下的 `.agentmx/agentmx.db`），这样数据更清晰，不会混淆。

### Q: 如何清理旧数据？

A: 直接删除 `.agentmx/` 目录：

```bash
rm -rf .agentmx/
```

下次使用时会自动创建新数据库。

---

## 相关文档

- [QUICKSTART.md](../QUICKSTART.md) - 快速开始指南
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - 故障排查
- [MCP_SERVER_DESIGN.md](MCP_SERVER_DESIGN.md) - MCP Server 设计文档
- [AUTO_TRACK_ANALYSIS.md](AUTO_TRACK_ANALYSIS.md) - 自动追踪分析

---

**最后更新：** 2026-05-19  
**版本：** 0.1.0
