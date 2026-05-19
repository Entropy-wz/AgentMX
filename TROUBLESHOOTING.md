# AgentMX 故障排查指南

## 问题：Claude Code 看不到 AgentMX 工具

### 症状
- 在 Claude Code 中，AgentMX 的 MCP 工具没有出现
- 询问 Claude 使用 AgentMX 时，Claude 表示不知道 AgentMX 是什么

### 可能的原因和解决方案

#### 1. MCP Server 没有正确启动

**检查方法：**

查看 Claude Code 的 MCP Server 日志：

**Windows:**
```
%APPDATA%\Claude\logs\
```

**Mac/Linux:**
```
~/.claude/logs/
```

查找包含 "agentmx" 或 "MCP" 的日志文件。

**解决方案：**

如果看到错误信息，根据错误类型修复：
- 如果是 "Cannot find module"：重新编译 MCP Server
- 如果是路径错误：检查 settings.json 中的路径

#### 2. `${workspaceFolder}` 变量没有被替换

**症状：**
MCP Server 日志显示使用了默认路径而不是项目路径。

**原因：**
Claude Code 的某些版本可能不支持 `${workspaceFolder}` 变量。

**解决方案 A：使用绝对路径（临时方案）**

编辑 `~/.claude/settings.json`：

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:/exp_all/AgentMX/mcp-server/dist/index.js"],
      "env": {
        "AGENTMX_DB_PATH": "D:/exp_all/mx_test1/.agentmx/agentmx.db",
        "AGENTMX_AGENT_ID": "claude-main",
        "AGENTMX_AUTO_TRACK": "true",
        "AGENTMX_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

**缺点：** 每个项目需要单独配置。

**解决方案 B：使用默认路径（推荐）**

不使用 `${workspaceFolder}`，让 MCP Server 使用默认路径：

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:/exp_all/AgentMX/mcp-server/dist/index.js"],
      "env": {
        "AGENTMX_AGENT_ID": "claude-${sessionId}",
        "AGENTMX_AUTO_TRACK": "true",
        "AGENTMX_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

然后修改 MCP Server 代码，让它自动检测当前工作目录。

**解决方案 C：修改 MCP Server 自动检测工作目录（最佳方案）**

修改 `mcp-server/src/index.ts`，让它自动使用当前工作目录：

```typescript
// 自动检测项目根目录
function getProjectRoot(): string {
  // 如果设置了环境变量，使用环境变量
  if (process.env.AGENTMX_PROJECT_ROOT) {
    return process.env.AGENTMX_PROJECT_ROOT;
  }
  
  // 否则使用当前工作目录
  return process.cwd();
}

const projectRoot = getProjectRoot();
const defaultDbPath = path.join(projectRoot, '.agentmx', 'agentmx.db');
const AGENTMX_DB_PATH = process.env.AGENTMX_DB_PATH || defaultDbPath;
```

#### 3. MCP Server 编译问题

**检查方法：**

```bash
cd D:/exp_all/AgentMX/mcp-server
npm run build
```

查看是否有编译错误。

**解决方案：**

如果有错误，修复后重新编译：

```bash
npm run build
```

#### 4. Claude Code 没有重启

**解决方案：**

修改 `settings.json` 后，必须完全退出并重启 Claude Code：

1. 在 Claude Code 中输入 `/exit`
2. 关闭终端窗口
3. 重新运行 `claude` 命令

#### 5. .agentmx-enabled 文件位置错误

**检查方法：**

```bash
ls -la D:/exp_all/mx_test1/.agentmx-enabled
```

**解决方案：**

确保文件在项目根目录：

```bash
cd D:/exp_all/mx_test1
touch .agentmx-enabled
```

或使用便捷脚本：

```bash
D:/exp_all/AgentMX/agentmx.sh enable
```

## 诊断步骤

### 步骤 1：测试 MCP Server 是否能启动

```bash
cd D:/exp_all/mx_test1
node D:/exp_all/AgentMX/mcp-server/dist/index.js
```

应该看到类似输出：

```
[2026-05-19T04:07:56.050Z] [INFO] AgentMX initialized
{
  "dbPath": "...",
  "agentId": "..."
}
```

按 Ctrl+C 退出。

### 步骤 2：测试 MCP 协议通信

运行测试脚本：

```bash
cd D:/exp_all/AgentMX/mcp-server
npm test
```

应该看到所有测试通过。

### 步骤 3：检查 Claude Code 配置

```bash
cat ~/.claude/settings.json
```

确认：
1. `mcpServers.agentmx` 存在
2. 路径正确
3. JSON 格式正确（没有多余的逗号）

### 步骤 4：查看 Claude Code 日志

**Windows:**
```
type %APPDATA%\Claude\logs\mcp-agentmx.log
```

**Mac/Linux:**
```
cat ~/.claude/logs/mcp-agentmx.log
```

查找错误信息。

### 步骤 5：使用诊断脚本

**Windows:**
```
D:\exp_all\AgentMX\mcp-server\test\diagnose-mcp.bat
```

**Linux/Mac:**
```bash
cd D:/exp_all/mx_test1
AGENTMX_DB_PATH="$PWD/.agentmx/agentmx.db" \
AGENTMX_AGENT_ID="claude-test" \
AGENTMX_AUTO_TRACK="true" \
AGENTMX_LOG_LEVEL="DEBUG" \
node D:/exp_all/AgentMX/mcp-server/dist/index.js
```

## 常见错误信息

### "Cannot find module"

**原因：** MCP Server 没有编译或路径错误

**解决：**
```bash
cd D:/exp_all/AgentMX/mcp-server
npm install
npm run build
```

### "ENOENT: no such file or directory"

**原因：** 数据库目录不存在

**解决：**
```bash
mkdir -p D:/exp_all/mx_test1/.agentmx
```

### "AgentMX is not enabled for this project"

**原因：** 缺少 `.agentmx-enabled` 文件

**解决：**
```bash
cd D:/exp_all/mx_test1
touch .agentmx-enabled
```

### MCP Server 启动但 Claude 看不到工具

**原因：** Claude Code 可能没有正确加载 MCP Server

**解决：**
1. 完全退出 Claude Code
2. 检查 `settings.json` 格式
3. 重启 Claude Code
4. 查看日志文件

## 获取帮助

如果以上方法都无法解决问题：

1. 收集诊断信息：
   - Claude Code 版本：在 Claude Code 中运行 `/version`
   - MCP Server 日志
   - settings.json 内容
   - 错误信息截图

2. 在 GitHub 提交 Issue：
   https://github.com/your-repo/AgentMX/issues

3. 包含以下信息：
   - 操作系统和版本
   - 诊断步骤的输出
   - 完整的错误信息
