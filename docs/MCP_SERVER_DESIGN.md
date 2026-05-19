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
  content_hash?: string;  // 文件内容的 SHA-256 hash（可选，会自动计算）
  agent_id?: string;      // Agent ID（可选，默认从环境变量获取）
  project_path?: string;  // 项目路径（可选，默认为当前工作目录）
}
```

**实现细节：**
- 如果未提供 `content_hash`，工具会自动读取文件并计算 SHA-256 hash
- 这使得 Claude Code Hooks 可以只传递 `file_path` 参数
- 记录到 `agent_observation` 表（类型：`file_read`）
- 发布 `agent_file_read` 事件到 `event_log` 表

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
  old_hash?: string | null;  // 写入前的 hash（可选）
  new_hash?: string;         // 写入后的 hash（可选，会自动计算）
  agent_id?: string;
  project_path?: string;
}
```

**实现细节：**
- 如果未提供 `new_hash`，工具会自动读取文件并计算 SHA-256 hash
- 这使得 Claude Code Hooks 可以只传递 `file_path` 参数
- 记录文件状态到 `file_state` 表
- 记录操作到 `agent_observation` 表（类型：`operation`）
- 发布 `agent_file_write` 事件到 `event_log` 表（标识 agent 写入）
- 发布 `file_state_changed` 事件到 `event_log` 表（通用文件变化）

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

### 1. 构建 MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Claude Desktop 配置

**位置：** `%APPDATA%\Claude\claude_desktop_config.json` (Windows) 或 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:\\exp_all\\AgentMX\\mcp-server\\dist\\index.js"],
      "env": {
        "AGENTMX_AGENT_ID": "claude-desktop"
      }
    }
  }
}
```

**说明：**
- `AGENTMX_AGENT_ID`: Agent 标识符，用于区分不同的 Claude 实例
- 数据库路径会自动设置为项目根目录下的 `.agentmx/agentmx.db`

### 3. Claude Code 配置（可选）

如果要在 Claude Code CLI 中使用，可以在项目的 `.claude/settings.json` 中配置：

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:\\exp_all\\AgentMX\\mcp-server\\dist\\index.js"],
      "env": {
        "AGENTMX_AGENT_ID": "claude-code"
      }
    }
  }
}
```

## 自动追踪模式

AgentMX 通过 **Claude Code Hooks** 实现自动追踪，无需手动调用 MCP 工具。

### Claude Code Hooks 配置

**位置：** 项目根目录的 `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "agentmx",
            "tool": "check_conflicts",
            "input": {
              "file_path": "${tool_input.file_path}"
            }
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "agentmx",
            "tool": "record_file_read",
            "input": {
              "file_path": "${tool_input.file_path}"
            }
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "agentmx",
            "tool": "record_file_write",
            "input": {
              "file_path": "${tool_input.file_path}"
            }
          }
        ]
      }
    ]
  }
}
```

**工作原理：**
1. **PostToolUse + Read**: Claude 每次读取文件后，自动调用 `record_file_read`
2. **PreToolUse + Write/Edit**: Claude 写入文件前，自动调用 `check_conflicts` 检查冲突
3. **PostToolUse + Write/Edit**: Claude 写入文件后，自动调用 `record_file_write`

**优势：**
- 完全自动化，Claude 无需手动调用工具
- 零侵入性，不影响 Claude 的正常工作流
- 实时追踪，所有文件操作都被记录

**配置示例：**
参考 `examples/claude-code-hooks/` 目录中的完整配置示例。

## 工作流示例

### 场景：Claude 通过 Hooks 自动追踪文件操作

```typescript
// 1. Claude 执行 Read 工具读取文件
const content = await Read('/path/to/file.ts');

// 2. PostToolUse Hook 自动触发，调用 record_file_read
// （Claude 无需手动调用，Hooks 系统自动执行）
// MCP Server 自动计算文件 hash 并记录到数据库

// 3. Claude 分析并准备修改

// 4. Claude 执行 Write 工具前，PreToolUse Hook 自动触发
// 自动调用 check_conflicts 检查冲突
// 如果发现冲突，Hook 会返回警告信息给 Claude

// 5a. 如果有冲突，Claude 会看到警告并重新读取
if (conflictDetected) {
  console.log('⚠️ Conflict detected, re-reading file...');
  const newContent = await Read('/path/to/file.ts');
  // PostToolUse Hook 再次自动记录新的读取
}

// 5b. Claude 执行写入
await Write('/path/to/file.ts', modifiedContent);

// 6. PostToolUse Hook 自动触发，调用 record_file_write
// MCP Server 自动计算新的 hash 并记录变更
```

**关键点：**
- Claude 只需正常使用 Read/Write/Edit 工具
- 所有追踪操作由 Hooks 系统自动完成
- 冲突检测在写入前自动执行
- 完全透明，不影响 Claude 的工作流

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

## 项目状态

### 已完成功能

✅ **Phase 1**: MCP Server 基础框架
- 基于 @modelcontextprotocol/sdk 实现
- 支持 stdio 通信协议
- 集成 AgentMX Core (EventBus + CognitiveStore)

✅ **Phase 2**: 7 个核心 MCP 工具
- `record_file_read`: 记录文件读取操作
- `record_file_write`: 记录文件写入操作
- `check_conflicts`: 检查认知冲突
- `get_event_history`: 查询事件历史
- `get_conflict_history`: 查询冲突历史
- `get_file_state`: 获取文件状态
- `resolve_conflict`: 解决冲突

✅ **Phase 3**: Claude Code Hooks 集成
- 通过 Hooks 实现自动追踪
- 提供配置示例和文档
- 零侵入性设计

### 待完成功能

🔄 **Phase 4**: 测试与优化
- 集成测试覆盖
- 性能基准测试
- 错误处理完善

🔄 **Phase 5**: 高级功能
- 批量操作支持
- 查询结果缓存
- 监控与可观测性

## 参考资料

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Code MCP Integration](https://docs.anthropic.com/claude-code/mcp)
