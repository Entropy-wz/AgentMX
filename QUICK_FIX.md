# 🔧 快速修复指南

## 问题
Claude Code 看不到 AgentMX 工具。

## 解决方案（3 步）

### 1️⃣ 更新 settings.json

编辑 `C:\Users\lenovo\.claude\settings.json`，将 AgentMX 配置改为：

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

**移除这些行：**
- ❌ `"AGENTMX_DB_PATH": "${workspaceFolder}/.agentmx/agentmx.db"`
- ❌ `"AGENTMX_AGENT_ID": "claude-${sessionId}"`

### 2️⃣ 重启 Claude Code

在 Claude Code 中：
```
/exit
```

然后重新启动：
```bash
cd D:/exp_all/mx_test1
claude
```

### 3️⃣ 测试

在 Claude Code 中输入：
```
请使用 AgentMX 记录你读取了 README.md
```

**预期结果：**
Claude 会使用 `agentmx_record_file_read` 工具记录文件读取。

## 工作原理

MCP Server 现在会自动检测项目目录：
- ✅ 如果项目有 `.agentmx-enabled` 文件 → 使用项目本地数据库
- ✅ 否则 → 使用全局数据库

不再需要 `${workspaceFolder}` 变量！

## 如果还是不行

查看详细的故障排查指南：
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [docs/FIX_AUTO_DETECTION.md](docs/FIX_AUTO_DETECTION.md)

或运行诊断脚本：
```bash
D:\exp_all\AgentMX\mcp-server\test\diagnose-mcp.bat
```

## 验证 MCP Server

手动测试 MCP Server 是否正常：

```bash
cd D:/exp_all/mx_test1
node D:/exp_all/AgentMX/mcp-server/dist/index.js
```

应该看到：
```
[INFO] AgentMX initialized
{
  "dbPath": "D:\\exp_all\\mx_test1\\.agentmx\\agentmx.db"  ← 正确的项目路径
}
```

按 Ctrl+C 退出。

---

**修复完成！** 🎉

现在 AgentMX 应该可以在 Claude Code 中正常工作了。
