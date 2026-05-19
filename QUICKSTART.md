# AgentMX MCP Server 快速开始指南

## 🎯 目标

让 Claude 能够自动追踪自己的认知状态，检测并避免基于过时信息的错误操作。

**重要**：AgentMX 采用**项目级别 opt-in 机制**，只在你需要的项目中生效，不会污染其他项目。

## 📦 安装步骤

### 1. 构建 AgentMX

```bash
cd /path/to/AgentMX
npm install
npm run build
```

### 2. 构建 MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 3. 配置 Claude Code（项目级别配置）

**重要：** Claude Code 的 MCP 配置是项目级别的，需要在每个使用 AgentMX 的项目中单独配置。

在你的项目目录中运行：

```bash
cd /path/to/your/project
claude mcp add agentmx -e AGENTMX_AUTO_TRACK=true -e AGENTMX_LOG_LEVEL=INFO -- node /path/to/AgentMX/mcp-server/dist/index.js
```

**示例（Windows）：**
```bash
cd D:/exp_all/my_project
claude mcp add agentmx -e AGENTMX_AUTO_TRACK=true -e AGENTMX_LOG_LEVEL=INFO -- node D:/exp_all/AgentMX/mcp-server/dist/index.js
```

**示例（Mac/Linux）：**
```bash
cd ~/projects/my_project
claude mcp add agentmx -e AGENTMX_AUTO_TRACK=true -e AGENTMX_LOG_LEVEL=INFO -- node ~/AgentMX/mcp-server/dist/index.js
```

**验证配置：**
```bash
claude mcp list
```

应该看到：
```
agentmx: node /path/to/AgentMX/mcp-server/dist/index.js - ✓ Connected
```

**注意：** MCP Server 会自动检测项目目录。如果项目有 `.agentmx-enabled` 文件，数据库会保存在项目的 `.agentmx/` 目录下；否则使用全局目录 `~/.agentmx/db/`。

### 4. 为项目启用 AgentMX

**关键步骤**：在需要使用 AgentMX 的项目根目录创建标记文件：

```bash
# 进入你的项目目录
cd /path/to/your/project

# 创建启用标记
touch .agentmx-enabled
```

**Windows 用户：**
```cmd
cd C:\path\to\your\project
type nul > .agentmx-enabled
```

### 5. 配置 Claude Code Hooks（可选但推荐）

**Hooks 可以实现完全自动化的文件追踪**，无需手动调用工具或依赖 Claude 遵守系统提示。

复制示例配置到你的项目：

```bash
# 进入你的项目目录
cd /path/to/your/project

# 创建 .claude 目录（如果不存在）
mkdir -p .claude

# 复制 hooks 配置
cp /path/to/AgentMX/examples/claude-code-hooks/settings.json .claude/settings.json
```

**配置说明**：
- **PreToolUse Hook**：在 Write/Edit 前自动调用 `check_conflicts` 检查冲突
- **PostToolUse Hook**：在 Read 后自动调用 `record_file_read`，在 Write/Edit 后自动调用 `record_file_write`

详细配置说明请参考：[examples/claude-code-hooks/README.md](examples/claude-code-hooks/README.md)

### 6. 重启 Claude Code

配置修改后需要重启 Claude Code 才能生效。

## 🧪 验证安装

### 方法1：检查可用工具

在**已启用 AgentMX 的项目**中，在 Claude Code 中运行：

```
/mcp
```

**重要：** AgentMX 工具显示在 `/mcp` 命令中，而不是 `/tools` 命令。

你应该看到：
```
agentmx · ✔ connected · 7 tools
```

点击展开后可以看到 7 个工具：
- `record_file_read` - 记录文件读取操作
- `record_file_write` - 记录文件写入操作
- `check_conflicts` - 检查认知冲突
- `get_event_history` - 查询事件历史
- `get_conflict_history` - 查询冲突历史
- `get_file_state` - 获取文件状态
- `resolve_conflict` - 解决冲突

**或者**，你也可以询问 Claude：

```
请列出你可用的 AgentMX 工具
```

Claude 会列出所有可用的工具及其说明。

### 方法2：测试项目级别控制

**在已启用的项目中：**
```
你：请使用 AgentMX 记录你读取了 README.md
Claude：✅ 成功调用 record_file_read
```

**在未启用的项目中：**
```
你：请使用 AgentMX 记录你读取了 README.md
Claude：❌ 返回提示：AgentMX is not enabled for this project
       提示如何启用：touch .agentmx-enabled
```

### 方法3：手动测试

```bash
cd mcp-server
node test/test-server.mjs
```

应该看到工具列表和资源列表的输出。

## 🎮 使用示例

### 前提：确保项目已启用

在使用前，确认项目根目录有 `.agentmx-enabled` 文件：

```bash
ls -la .agentmx-enabled
# 或
cat .agentmx-enabled
```

如果没有，创建它：
```bash
touch .agentmx-enabled
```

### 场景1：记录文件读取

**你说：**
```
请使用 AgentMX 记录你读取了 src/main.ts，hash 是 abc123...
```

**Claude 会：**
```
调用 record_file_read({
  file_path: "/path/to/src/main.ts",
  content_hash: "abc123..."
})
```

**返回：**
```json
{
  "observation_id": "uuid-here",
  "message": "File read recorded successfully"
}
```

**注意：** 
- 当 `AGENTMX_AUTO_TRACK=true` 时，Claude 会收到系统级提示，自动在文件操作后调用 AgentMX 工具（预期可靠性约 80%）
- **推荐使用 Claude Code Hooks**（见步骤 5）实现 100% 可靠的自动追踪，无需依赖 Claude 遵守提示
- 如果配置了 Hooks，文件操作会自动触发 AgentMX 工具，完全静默执行

### 场景2：检测认知冲突

**你说：**
```
请检查 src/main.ts 是否有冲突
```

**Claude 会：**
```
调用 check_conflicts({
  file_path: "/path/to/src/main.ts"
})
```

**如果有冲突，返回：**
```json
{
  "has_conflict": true,
  "conflicts": [{
    "conflict_id": "uuid-here",
    "conflict_type": "G1_stale_read",
    "severity": "medium",
    "description": "Your understanding of this file is outdated...",
    "recommended_action": "Re-read the file before making changes..."
  }]
}
```

**如果无冲突，返回：**
```json
{
  "has_conflict": false,
  "conflicts": []
}
```

### 场景3：查询事件历史

**你说：**
```
使用 AgentMX 查看 src/main.ts 的修改历史
```

**Claude 会：**
```
调用 get_event_history({
  file_path: "/path/to/src/main.ts",
  limit: 50
})
```

**返回：**
```json
{
  "events": [
    {
      "event_id": "uuid-1",
      "event_type": "agent_file_write",
      "timestamp": 1234567890,
      "agent_id": "claude-opus-4-7",
      "file_path": "/path/to/src/main.ts",
      "old_hash": "abc123...",
      "new_hash": "def456..."
    },
    {
      "event_id": "uuid-2",
      "event_type": "agent_file_read",
      "timestamp": 1234567800,
      "agent_id": "claude-opus-4-7",
      "file_path": "/path/to/src/main.ts",
      "content_hash": "abc123..."
    },
    {
      "event_id": "uuid-3",
      "event_type": "file_state_changed",
      "timestamp": 1234567890,
      "file_path": "/path/to/src/main.ts",
      "change_type": "modified",
      "old_hash": "abc123...",
      "new_hash": "def456..."
    }
  ],
  "total_count": 3
}
```

**事件类型说明：**
- `agent_file_read` - Agent 读取文件
- `agent_file_write` - Agent 写入文件
- `file_state_changed` - 文件状态变化（包括 agent 写入和外部修改）

### 场景4：解决冲突

**当检测到冲突后：**
```
请解决冲突 uuid-here，使用 prompt_reread 动作
```

**Claude 会：**
```
调用 resolve_conflict({
  conflict_id: "uuid-here",
  resolution_action: "prompt_reread",
  notes: "Re-read file to get latest content"
})
```

**返回：**
```json
{
  "success": true,
  "message": "Conflict uuid-here resolved with action: prompt_reread"
}
```

## 📊 查看数据库

AgentMX 使用 SQLite 存储数据，可以直接查看：

```bash
# 进入项目目录
cd /your/project

# 查看数据库
sqlite3 .agentmx/agentmx.db

# 查询事件
SELECT event_type, timestamp, file_path FROM event_log ORDER BY timestamp DESC LIMIT 10;

# 查询冲突
SELECT conflict_type, severity, file_path, detected_at FROM conflict_record;

# 退出
.quit
```

## 🔧 配置选项

### 项目级别控制（重要！）

AgentMX 使用 `.agentmx-enabled` 标记文件控制是否在项目中生效：

- **启用项目**：`touch .agentmx-enabled`
- **禁用项目**：`rm .agentmx-enabled`
- **检查状态**：`ls -la .agentmx-enabled`

**为什么这样设计？**
- ✅ 避免污染不相关的项目
- ✅ 全局配置一次，按需启用
- ✅ 每个项目独立决定是否使用
- ✅ 团队成员各自控制

**建议：** 将 `.agentmx-enabled` 加入 `.gitignore`，让每个开发者自己决定是否启用。

详细说明：[docs/PROJECT_LEVEL_CONTROL.md](docs/PROJECT_LEVEL_CONTROL.md)

### AGENTMX_DB_PATH

数据库文件位置：

- **项目级别**（推荐）：`${workspaceFolder}/.agentmx/agentmx.db`
  - 每个项目独立的数据库
  - 适合多项目开发

- **全局级别**：`~/.agentmx/agentmx.db`
  - 所有项目共享一个数据库
  - 适合跨项目分析

### AGENTMX_AGENT_ID

Agent 标识符：

- `claude-${sessionId}`：每个会话独立 ID（推荐）
- `claude-main`：固定 ID
- `claude-${workspaceName}`：按项目区分

### AGENTMX_AUTO_TRACK

自动追踪模式：

- `true`：注入系统级提示，要求 Claude 自动在文件操作后调用 AgentMX 工具
  - **实现方式：** System Prompt 注入
  - **可靠性：** 约 80%（依赖 Claude 遵守系统提示）
  - **行为：** Claude 会在读取文件后自动调用 `record_file_read`，写入前调用 `check_conflicts`，写入后调用 `record_file_write`
  - **注意：** 如果 Claude 没有自动调用，你可以手动提示
  
- `false`：不注入系统提示，需要手动提示 Claude 使用工具
  - **适用场景：** 你想完全控制何时使用 AgentMX
  - **优点：** 不增加系统提示的 token 成本
  - **缺点：** 每次都需要手动提示

**推荐：** 使用 Claude Code Hooks（见步骤 5）实现 100% 可靠的自动追踪，无需依赖此选项。

### AGENTMX_LOG_LEVEL

日志级别：

- `ERROR`：仅错误
- `WARN`：警告和错误
- `INFO`：正常操作（推荐）
- `DEBUG`：详细调试信息

## 🐛 故障排除

### 问题1：Claude 提示 "AgentMX is not enabled for this project"

**原因**：项目中没有 `.agentmx-enabled` 标记文件

**解决方案：**
```bash
# 进入项目根目录
cd /path/to/your/project

# 创建标记文件
touch .agentmx-enabled

# 验证
ls -la .agentmx-enabled
```

### 问题2：Claude 看不到 AgentMX 工具

**解决方案：**
1. 检查 `~/.claude/settings.json` 配置是否正确
2. 确认路径使用绝对路径
3. 重启 Claude Code
4. 查看 Claude Code 日志：`~/.claude/logs/`

### 问题2：MCP Server 启动失败

**解决方案：**
```bash
# 手动启动查看错误
cd mcp-server
AGENTMX_LOG_LEVEL=DEBUG node dist/index.js

# 检查依赖
npm install

# 重新构建
npm run build
```

### 问题3：数据库锁定

**解决方案：**
```bash
# 查找占用进程
lsof .agentmx/agentmx.db

# 或者删除数据库重新开始
rm -rf .agentmx/
```

### 问题4：工具调用失败

**解决方案：**
1. 确认项目已启用：`ls -la .agentmx-enabled`
2. 检查日志：`AGENTMX_LOG_LEVEL=DEBUG`
3. 确认 AgentMX 核心已构建：`npm run build`
4. 确认 MCP Server 已构建：`cd mcp-server && npm run build`

## 📚 进阶使用

### 项目选择性启用

**实验项目**（启用）：
```bash
cd ~/experiments/agentmx-test
touch .agentmx-enabled
```

**生产项目**（不启用）：
```bash
cd ~/work/production-app
# 不创建 .agentmx-enabled，AgentMX 不会干扰
```

### 自定义工作流

创建自定义提示词：

```
你是一个使用 AgentMX 追踪认知状态的 AI 助手。

工作流程：
1. 读取文件后立即调用 record_file_read
2. 写入文件前调用 check_conflicts
3. 如果检测到冲突，重新读取文件
4. 写入文件后调用 record_file_write

这确保你的理解始终与实际文件状态保持一致。
```

### 多 Agent 协作

如果有多个 Claude 实例同时工作：

```json
{
  "mcpServers": {
    "agentmx": {
      "env": {
        "AGENTMX_AGENT_ID": "claude-${sessionId}",
        "AGENTMX_DB_PATH": "${workspaceFolder}/.agentmx/shared.db"
      }
    }
  }
}
```

每个 Agent 有独立 ID，但共享同一个数据库，可以检测到彼此的修改。

### 集成到 CI/CD

在 CI 环境中使用 AgentMX：

```bash
# 设置环境变量
export AGENTMX_DB_PATH=/tmp/agentmx-ci.db
export AGENTMX_AGENT_ID=ci-bot

# 运行 AI 辅助的代码审查
claude-code review --with-agentmx
```

## 🎉 下一步

1. **运行 Demo**：`npm run demo:g1` 查看冲突检测演示
2. **阅读设计文档**：`docs/MCP_SERVER_DESIGN.md`
3. **查看 API 文档**：`docs/SUBSYSTEM_GUIDE.md`
4. **实际使用**：在真实项目中启用 AgentMX

## 💡 最佳实践

1. **项目级启用**：只在需要的项目中创建 `.agentmx-enabled`
2. **使用 Hooks**：配置 Claude Code Hooks 实现 100% 可靠的自动追踪
3. **加入 .gitignore**：避免提交标记文件和数据库
   ```gitignore
   .agentmx-enabled
   .agentmx/
   ```
4. **定期清理**：删除旧项目的 `.agentmx/` 目录
5. **查看冲突历史**：定期检查是否有频繁冲突的文件
6. **监控日志**：出现问题时启用 DEBUG 日志

## 📞 获取帮助

- **文档**：`docs/` 目录
- **示例**：`demo/` 目录
- **测试**：`tests/` 目录
- **问题反馈**：GitHub Issues

---

**祝你使用愉快！AgentMX 让 AI 编程更可靠。** 🚀
