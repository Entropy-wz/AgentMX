# 修复说明：自动项目检测

## 问题
用户报告 Claude Code 看不到 AgentMX 的 MCP 工具。经过诊断发现：

1. `settings.json` 中使用了 `${workspaceFolder}` 变量
2. Claude Code 没有正确替换这个变量
3. MCP Server 使用了默认的全局路径而不是项目路径

## 解决方案
修改 MCP Server，让它自动检测项目目录，而不依赖环境变量中的 `${workspaceFolder}`。

### 实现细节

**修改文件：** `mcp-server/src/index.ts`

**新增函数：**
```typescript
function getDefaultDbPath(): string {
  const cwd = process.cwd();
  const enabledMarker = path.join(cwd, '.agentmx-enabled');

  if (fs.existsSync(enabledMarker)) {
    // Project has AgentMX enabled, use project-local database
    return path.join(cwd, '.agentmx', 'agentmx.db');
  } else {
    // Fall back to home directory
    return path.join(os.homedir(), '.agentmx', 'db', 'agentmx.db');
  }
}
```

**工作原理：**
1. MCP Server 启动时检查当前工作目录（`process.cwd()`）
2. 如果找到 `.agentmx-enabled` 文件，使用项目本地数据库
3. 否则使用全局数据库（`~/.agentmx/db/`）

### 优势
- ✅ 不依赖 `${workspaceFolder}` 变量
- ✅ 自动检测项目是否启用 AgentMX
- ✅ 简化配置（不需要设置 `AGENTMX_DB_PATH`）
- ✅ 向后兼容（仍然支持 `AGENTMX_DB_PATH` 环境变量覆盖）

### 新的配置方式

**简化的 settings.json：**
```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:/exp_all/AgentMX/mcp-server/dist/index.js"],
      "env": {
        "AGENTMX_AUTO_TRACK": "true",
        "AGENTMX_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

不再需要：
- ❌ `AGENTMX_DB_PATH: "${workspaceFolder}/.agentmx/agentmx.db"`
- ❌ `AGENTMX_AGENT_ID: "claude-${sessionId}"`

### 测试结果

**测试命令：**
```bash
cd D:/exp_all/mx_test1
node D:/exp_all/AgentMX/mcp-server/dist/index.js
```

**输出：**
```
[2026-05-19T04:10:20.891Z] [INFO] AgentMX initialized
{
  "dbPath": "D:\\exp_all\\mx_test1\\.agentmx\\agentmx.db",  ✅ 正确检测到项目路径
  "agentId": "claude-main"
}
```

### 用户需要做什么

1. **更新 settings.json：**
   - 移除 `AGENTMX_DB_PATH` 环境变量
   - 移除 `AGENTMX_AGENT_ID` 环境变量（可选）

2. **重启 Claude Code：**
   ```bash
   /exit
   claude
   ```

3. **验证：**
   在启用了 AgentMX 的项目中，询问 Claude：
   ```
   请使用 AgentMX 记录你读取了 README.md
   ```

   Claude 应该能够看到并使用 AgentMX 工具。

### 文档更新
- ✅ 更新 README.md 配置示例
- ✅ 更新 QUICKSTART.md 配置示例
- ✅ 创建 TROUBLESHOOTING.md 故障排查指南
- ✅ 创建 FIX_AUTO_DETECTION.md 修复说明

### 提交信息
```
Fix: Auto-detect project directory for database path

Problem: ${workspaceFolder} variable in settings.json was not being
replaced by Claude Code, causing MCP Server to use global database
path instead of project-local path.

Solution: MCP Server now auto-detects project directory by checking
for .agentmx-enabled marker file in current working directory.

Benefits:
- No dependency on ${workspaceFolder} variable substitution
- Simpler configuration (fewer env vars needed)
- Automatic project detection
- Backward compatible (AGENTMX_DB_PATH still works)

Changes:
- mcp-server/src/index.ts: Add getDefaultDbPath() function
- README.md: Update configuration example
- QUICKSTART.md: Update configuration example
- TROUBLESHOOTING.md: Add troubleshooting guide
- FIX_AUTO_DETECTION.md: Document the fix

Tested: MCP Server correctly detects project path when .agentmx-enabled
exists, falls back to global path otherwise.
```
