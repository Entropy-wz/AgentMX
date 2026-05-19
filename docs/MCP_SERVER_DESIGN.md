# AgentMX MCP Server 设计文档

## 概述

AgentMX MCP Server 是一个基于 Model Context Protocol 的服务器，暴露 AgentMX 的认知状态追踪功能给 Claude。通过 MCP，Claude 可以：

1. 自动记录文件读取操作
2. 检测认知冲突（stale read）
3. 查询事件历史和冲突记录
4. 获取文件状态和 Agent 观察

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Claude Agent                          │
│  (通过 MCP 调用 AgentMX 工具)                                │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol (stdio)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   AgentMX MCP Server                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MCP Tools (Claude 可调用的工具)                     │   │
│  │  - record_file_read                                  │   │
│  │  - record_file_write                                 │   │
│  │  - check_conflicts                                   │   │
│  │  - get_event_history                                 │   │
│  │  - get_conflict_history                              │   │
│  │  - get_file_state                                    │   │
│  │  - resolve_conflict                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │         AgentMX Core (EventBus + CognitiveStore)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  SQLite DB   │
                  └──────────────┘
```

## MCP Tools 设计

### 1. record_file_read

**用途：** 记录 Claude 读取文件的操作

**参数：**
```typescript
{
  file_path: string;      // 文件绝对路径
  content_hash: string;   // 文件内容的 SHA-256 hash
  agent_id?: string;      // Agent ID（可选，默认从环境变量获取）
  project_path?: string;  // 项目路径（可选，默认为当前工作目录）
}
```

**返回：**
```typescript
{
  observation_id: string;
  message: string;
  potential_conflicts?: {
    conflict_type: string;
    description: string;
  }[];
}
```

**使用场景：**
- Claude 每次读取文件后调用此工具
- 系统自动检查是否有其他 Agent 修改过该文件

### 2. record_file_write

**用途：** 记录 Claude 写入文件的操作

**参数：**
```typescript
{
  file_path: string;
  old_hash: string | null;
  new_hash: string;
  agent_id?: string;
  project_path?: string;
}
```

**返回：**
```typescript
{
  success: boolean;
  message: string;
  warnings?: string[];
}
```

### 3. check_conflicts

**用途：** 主动检查指定文件是否存在认知冲突

**参数：**
```typescript
{
  file_path: string;
  agent_id?: string;
  project_path?: string;
}
```

**返回：**
```typescript
{
  has_conflict: boolean;
  conflicts: {
    conflict_id: string;
    conflict_type: 'G1_stale_read' | 'G2_concurrent_write' | 'G3_phantom_read';
    severity: 'low' | 'medium' | 'high';
    description: string;
    agent_expected_hash: string | null;
    actual_hash: string | null;
    detected_at: number;
    recommended_action: string;
  }[];
}
```

**使用场景：**
- Claude 在执行写入操作前检查冲突
- 定期检查工作文件的认知状态

### 4. get_event_history

**用途：** 查询事件历史

**参数：**
```typescript
{
  file_path?: string;
  agent_id?: string;
  event_type?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  project_path?: string;
}
```

**返回：**
```typescript
{
  events: Array<{
    event_id: string;
    event_type: string;
    timestamp: number;
    file_path?: string;
    agent_id?: string;
    details: any;
  }>;
  total_count: number;
}
```

### 5. get_conflict_history

**用途：** 查询冲突历史

**参数：**
```typescript
{
  file_path?: string;
  agent_id?: string;
  resolved?: boolean;
  limit?: number;
  project_path?: string;
}
```

**返回：**
```typescript
{
  conflicts: Array<{
    conflict_id: string;
    conflict_type: string;
    severity: string;
    agent_id: string;
    file_path: string;
    description: string;
    detected_at: number;
    resolved_at: number | null;
    resolution_action: string | null;
  }>;
  total_count: number;
}
```

### 6. get_file_state

**用途：** 获取文件的当前状态和历史

**参数：**
```typescript
{
  file_path: string;
  include_history?: boolean;
  history_limit?: number;
  project_path?: string;
}
```

**返回：**
```typescript
{
  current_state: {
    snapshot_id: string;
    content_hash: string;
    mtime: number;
    size: number;
    captured_at: number;
  } | null;
  history?: Array<{
    snapshot_id: string;
    content_hash: string;
    mtime: number;
    size: number;
    captured_at: number;
  }>;
}
```

### 7. resolve_conflict

**用途：** 标记冲突为已解决

**参数：**
```typescript
{
  conflict_id: string;
  resolution_action: 'prompt_reread' | 'abort_and_replan' | 'verify_and_rollback' | 'user_override';
  notes?: string;
}
```

**返回：**
```typescript
{
  success: boolean;
  message: string;
}
```

## 配置与部署

### 1. 安装依赖

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "agentmx": "^0.1.0"
  }
}
```

### 2. MCP Server 配置文件

**位置：** `~/.claude/mcp-servers/agentmx.json`

```json
{
  "name": "agentmx",
  "description": "AgentMX cognitive state tracking for Claude",
  "command": "node",
  "args": ["/path/to/agentmx/mcp-server/dist/index.js"],
  "env": {
    "AGENTMX_DB_PATH": "~/.agentmx/db",
    "AGENTMX_AGENT_ID": "claude-main",
    "AGENTMX_AUTO_TRACK": "true"
  }
}
```

### 3. Claude Code 配置

**位置：** `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["/path/to/agentmx/mcp-server/dist/index.js"],
      "env": {
        "AGENTMX_DB_PATH": "${workspaceFolder}/.agentmx/db",
        "AGENTMX_AGENT_ID": "claude-${sessionId}",
        "AGENTMX_AUTO_TRACK": "true"
      }
    }
  }
}
```

## 自动追踪模式

当 `AGENTMX_AUTO_TRACK=true` 时，MCP Server 可以提供自动追踪功能：

### 方式1：通过 MCP Resources

暴露一个 resource：`agentmx://auto-track-instructions`

内容：
```
When you read a file, immediately call the record_file_read tool with the file path and content hash.
When you write a file, immediately call the record_file_write tool.
Before writing to a file, call check_conflicts to ensure your understanding is current.
If a conflict is detected, re-read the file before proceeding.
```

Claude 会自动将这个 resource 加载到 context 中，从而知道要调用这些工具。

### 方式2：通过 MCP Prompts

提供一个 prompt template：`agentmx-workflow`

```
You are working with AgentMX cognitive state tracking. Follow this workflow:

1. After reading any file:
   - Call record_file_read with file_path and content_hash
   - Note any potential conflicts returned

2. Before writing to any file:
   - Call check_conflicts for that file
   - If conflicts exist, re-read the file first

3. After writing to any file:
   - Call record_file_write with old_hash and new_hash

4. If you encounter unexpected file content:
   - Call get_event_history to see what changed
   - Call get_conflict_history to check for past issues

This ensures your understanding of the codebase stays aligned with reality.
```

## 工作流示例

### 场景：Claude 修改一个文件

```typescript
// 1. Claude 读取文件
const content = await Read('/path/to/file.ts');
const hash = computeHash(content);

// 2. 调用 MCP tool 记录读取
await mcp.call('record_file_read', {
  file_path: '/path/to/file.ts',
  content_hash: hash
});

// 3. Claude 分析并准备修改

// 4. 在写入前检查冲突
const conflictCheck = await mcp.call('check_conflicts', {
  file_path: '/path/to/file.ts'
});

if (conflictCheck.has_conflict) {
  // 5a. 发现冲突，重新读取
  console.log('⚠️ File was modified, re-reading...');
  const newContent = await Read('/path/to/file.ts');
  const newHash = computeHash(newContent);
  
  await mcp.call('record_file_read', {
    file_path: '/path/to/file.ts',
    content_hash: newHash
  });
  
  // 重新分析...
} else {
  // 5b. 无冲突，执行写入
  await Write('/path/to/file.ts', modifiedContent);
  const newHash = computeHash(modifiedContent);
  
  await mcp.call('record_file_write', {
    file_path: '/path/to/file.ts',
    old_hash: hash,
    new_hash: newHash
  });
}
```

## 性能考虑

1. **异步操作**：所有 MCP tool 调用都是异步的，不阻塞 Claude 的主要工作流
2. **批量操作**：支持批量记录多个文件操作
3. **缓存**：MCP Server 内部缓存常用查询结果
4. **数据库优化**：使用索引加速查询

## 安全考虑

1. **路径验证**：所有文件路径必须在项目目录内
2. **权限检查**：MCP Server 只能访问 Claude 有权限的文件
3. **数据隔离**：不同项目使用不同的数据库文件
4. **敏感信息**：不记录文件内容，只记录 hash

## 错误处理

所有 MCP tools 都返回结构化的错误信息：

```typescript
{
  success: false,
  error: {
    code: 'CONFLICT_DETECTED' | 'FILE_NOT_FOUND' | 'INVALID_HASH' | 'DB_ERROR',
    message: string,
    details?: any
  }
}
```

## 监控与调试

### 日志级别

- `ERROR`: 严重错误
- `WARN`: 冲突检测、潜在问题
- `INFO`: 正常操作记录
- `DEBUG`: 详细调试信息

### 日志输出

```bash
# 启用调试日志
AGENTMX_LOG_LEVEL=DEBUG node mcp-server/dist/index.js

# 日志输出到文件
AGENTMX_LOG_FILE=~/.agentmx/server.log node mcp-server/dist/index.js
```

## 下一步实现

1. **Phase 1**: 实现基础 MCP Server 框架
2. **Phase 2**: 实现 7 个核心 tools
3. **Phase 3**: 添加 auto-track resources 和 prompts
4. **Phase 4**: 集成测试与 Claude Code
5. **Phase 5**: 性能优化与监控

## 参考资料

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Code MCP Integration](https://docs.anthropic.com/claude-code/mcp)
