# AgentMX MCP Server 快速开始指南

## 🎯 目标

让 Claude 能够自动追踪自己的认知状态，检测并避免基于过时信息的错误操作。

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

### 3. 配置 Claude Code

编辑 `~/.claude/settings.json`（如果不存在则创建）：

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:/exp_all/AgentMX/mcp-server/dist/index.js"],
      "env": {
        "AGENTMX_DB_PATH": "${workspaceFolder}/.agentmx/agentmx.db",
        "AGENTMX_AGENT_ID": "claude-${sessionId}",
        "AGENTMX_AUTO_TRACK": "true",
        "AGENTMX_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

**重要：** 将路径 `D:/exp_all/AgentMX/mcp-server/dist/index.js` 替换为你的实际路径。

### 4. 重启 Claude Code

配置修改后需要重启 Claude Code 才能生效。

## 🧪 验证安装

### 方法1：检查可用工具

在 Claude Code 中，输入：

```
请列出你可用的 AgentMX 工具
```

Claude 应该能看到 7 个工具：
- record_file_read
- record_file_write
- check_conflicts
- get_event_history
- get_conflict_history
- get_file_state
- resolve_conflict

### 方法2：手动测试

```bash
cd mcp-server
node test/test-server.mjs
```

应该看到工具列表和资源列表的输出。

## 🎮 使用示例

### 场景1：Claude 自动追踪文件读取

当 `AGENTMX_AUTO_TRACK=true` 时，Claude 会自动加载追踪指令。

**你说：**
```
请读取 src/main.ts 并告诉我它的功能
```

**Claude 会：**
1. 读取文件
2. 自动调用 `record_file_read` 记录读取操作
3. 分析并回答你的问题

### 场景2：检测认知冲突

**你说：**
```
请修改 src/main.ts，添加一个新函数
```

**Claude 会：**
1. 调用 `check_conflicts` 检查文件是否被修改
2. 如果检测到冲突，重新读取文件
3. 基于最新内容进行修改

### 场景3：查询事件历史

**你说：**
```
使用 AgentMX 查看 src/main.ts 的修改历史
```

**Claude 会：**
1. 调用 `get_event_history` 查询该文件的所有事件
2. 展示完整的操作时间线

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

- `true`：Claude 自动加载追踪指令（推荐）
- `false`：需要手动提示 Claude 使用工具

### AGENTMX_LOG_LEVEL

日志级别：

- `ERROR`：仅错误
- `WARN`：警告和错误
- `INFO`：正常操作（推荐）
- `DEBUG`：详细调试信息

## 🐛 故障排除

### 问题1：Claude 看不到 AgentMX 工具

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
1. 检查日志：`AGENTMX_LOG_LEVEL=DEBUG`
2. 确认 AgentMX 核心已构建：`npm run build`
3. 确认 MCP Server 已构建：`cd mcp-server && npm run build`

## 📚 进阶使用

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

1. **项目级数据库**：每个项目使用独立数据库
2. **启用自动追踪**：`AGENTMX_AUTO_TRACK=true`
3. **定期清理**：删除旧项目的 `.agentmx/` 目录
4. **查看冲突历史**：定期检查是否有频繁冲突的文件
5. **监控日志**：出现问题时启用 DEBUG 日志

## 📞 获取帮助

- **文档**：`docs/` 目录
- **示例**：`demo/` 目录
- **测试**：`tests/` 目录
- **问题反馈**：GitHub Issues

---

**祝你使用愉快！AgentMX 让 AI 编程更可靠。** 🚀
