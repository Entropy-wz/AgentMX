# Claude Code Hooks 配置示例

这个目录包含 AgentMX 与 Claude Code Hooks 集成的配置示例。

## 文件说明

### settings.json

这是项目级别的 Claude Code 配置文件，应该放在你的项目的 `.claude/settings.json` 路径下。

**重要**：这个文件是**示例**，不要直接复制到 AgentMX 项目根目录。你应该将它复制到**你自己的项目**中。

## 使用方法

### 1. 复制配置到你的项目

```bash
# 进入你的项目目录
cd /path/to/your/project

# 创建 .claude 目录（如果不存在）
mkdir -p .claude

# 复制配置文件
cp /path/to/AgentMX/examples/claude-code-hooks/settings.json .claude/settings.json
```

### 2. 启用 AgentMX

在项目根目录创建启用标记：

```bash
touch .agentmx-enabled
```

### 3. 配置 MCP Server

确保已经在项目中配置了 AgentMX MCP Server：

```bash
claude mcp add agentmx -e AGENTMX_AUTO_TRACK=true -e AGENTMX_LOG_LEVEL=INFO -- node /path/to/AgentMX/mcp-server/dist/index.js
```

### 4. 重启 Claude Code

配置修改后需要重启 Claude Code 才能生效。

## Hooks 工作原理

### PreToolUse Hooks（工具调用前）

**Write|Edit 工具调用前**：
1. 输出调试信息（可选）
2. 调用 `check_conflicts` 检查认知冲突
3. 如果检测到冲突，Claude 会收到警告

### PostToolUse Hooks（工具调用后）

**Read 工具调用后**：
- 自动调用 `record_file_read` 记录文件读取操作

**Write|Edit 工具调用后**：
1. 输出调试信息（可选）
2. 自动调用 `record_file_write` 记录文件写入操作

## 配置说明

### Hook 结构

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "ToolName1|ToolName2",  // 匹配的工具名称（支持管道符分隔）
        "hooks": [                          // 要执行的 hooks 列表
          {
            "type": "command",              // 类型：command 或 mcp_tool
            "command": "echo 'message'"     // 命令内容
          },
          {
            "type": "mcp_tool",             // MCP 工具调用
            "server": "agentmx",            // MCP server 名称
            "tool": "tool_name",            // 工具名称
            "input": {                      // 工具参数
              "param": "${tool_input.param}" // 可以引用工具的输入参数
            }
          }
        ]
      }
    ],
    "PostToolUse": [
      // 同样的结构
    ]
  }
}
```

### 参数引用

在 hook 的 `input` 中，可以使用以下变量：

- `${tool_input.file_path}` - 引用工具调用的 file_path 参数
- `${tool_input.param_name}` - 引用工具调用的任意参数
- `${tool_output}` - 引用工具的输出结果（仅在 PostToolUse 中可用）

## 调试

### 启用调试输出

配置中的 `echo` 命令可以帮助你调试 hooks 是否正常执行：

```json
{
  "type": "command",
  "command": "echo '[PreToolUse] About to Write/Edit file'"
}
```

### 查看日志

AgentMX 的日志级别可以通过环境变量控制：

```bash
claude mcp add agentmx -e AGENTMX_LOG_LEVEL=DEBUG -- node /path/to/AgentMX/mcp-server/dist/index.js
```

日志级别：
- `ERROR` - 仅错误
- `WARN` - 警告和错误
- `INFO` - 正常操作（推荐）
- `DEBUG` - 详细调试信息

## 注意事项

1. **Hooks 是静默执行的**：Claude 不会看到 hooks 的执行过程，它们在后台自动运行
2. **配置文件位置**：必须放在项目的 `.claude/settings.json`，不是 `.claude/settings.local.json`
3. **重启生效**：修改配置后需要重启 Claude Code
4. **项目级别**：每个项目需要单独配置，不会影响其他项目

## 故障排除

### Hooks 没有执行

1. 检查配置文件位置是否正确（`.claude/settings.json`）
2. 确认已重启 Claude Code
3. 检查 MCP Server 是否正常连接：`claude mcp list`
4. 查看 Claude Code 日志：`~/.claude/logs/`

### MCP 工具调用失败

1. 确认项目已启用：`ls -la .agentmx-enabled`
2. 检查 MCP Server 日志级别：`AGENTMX_LOG_LEVEL=DEBUG`
3. 手动测试工具是否可用

## 更多信息

- [AgentMX 快速开始](../../QUICKSTART.md)
- [MCP Server 设计文档](../../docs/MCP_SERVER_DESIGN.md)
- [工具参考文档](../../docs/TOOL_REFERENCE.md)
