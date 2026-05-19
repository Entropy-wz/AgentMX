# AgentMX 项目级别控制

## 🎯 设计目标

AgentMX 采用**项目级别的 opt-in 机制**，确保：
- ✅ 只在你需要的项目中启用
- ✅ 不污染其他项目的 Claude 环境
- ✅ 配置一次，自动识别项目
- ✅ 简单的启用/禁用方式

## 🔧 工作原理

### 全局配置 + 项目标记

1. **全局配置**（一次性）：在 `~/.claude/settings.json` 中配置 MCP Server
2. **项目标记**（按需）：在需要的项目中创建 `.agentmx-enabled` 文件

```
~/.claude/settings.json  ← 全局配置（一次性）
    ↓
项目A/
  .agentmx-enabled       ← 有标记文件，AgentMX 生效 ✅
  src/
  
项目B/
  (无标记文件)            ← 无标记文件，AgentMX 不生效 ❌
  src/
```

### 检查逻辑

当 Claude 调用 AgentMX 工具时：

```typescript
function isAgentMXEnabled(projectPath: string): boolean {
  const markerFile = path.join(projectPath, '.agentmx-enabled');
  return fs.existsSync(markerFile);
}
```

- **有标记文件**：工具正常工作
- **无标记文件**：返回友好提示，告诉你如何启用

## 📝 使用方法

### 1. 全局配置（一次性）

编辑 `~/.claude/settings.json`：

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

**重要**：将路径替换为你的实际路径。

### 2. 为项目启用 AgentMX

#### 方法 A：手动创建标记文件

```bash
cd /path/to/your/project
touch .agentmx-enabled
```

#### 方法 B：使用 echo 命令

```bash
cd /path/to/your/project
echo "" > .agentmx-enabled
```

#### 方法 C：在 Windows 中

```cmd
cd C:\path\to\your\project
type nul > .agentmx-enabled
```

### 3. 禁用 AgentMX

只需删除标记文件：

```bash
rm .agentmx-enabled
```

## 🧪 验证

### 测试启用状态

在**已启用**的项目中：

```
你：请使用 AgentMX 记录你读取了 README.md
Claude：✅ 调用 record_file_read 成功
```

在**未启用**的项目中：

```
你：请使用 AgentMX 记录你读取了 README.md
Claude：❌ 返回提示信息：
{
  "success": false,
  "error": {
    "code": "AGENTMX_NOT_ENABLED",
    "message": "AgentMX is not enabled for this project",
    "how_to_enable": [
      "Create a marker file: touch /path/to/project/.agentmx-enabled",
      "Or run: echo \"\" > .agentmx-enabled",
      "Then AgentMX will automatically work in this project"
    ]
  }
}
```

## 📊 数据隔离

即使全局配置，每个项目的数据也是完全隔离的：

```
项目A/
  .agentmx/
    agentmx.db          ← 项目A的数据
    
项目B/
  .agentmx/
    agentmx.db          ← 项目B的数据（如果启用）
```

数据库路径由 `${workspaceFolder}` 变量自动确定。

## 🎯 典型使用场景

### 场景 1：实验性项目

```bash
# 在实验文件夹中启用
cd ~/experiments/agentmx-test
touch .agentmx-enabled

# 在生产项目中不启用
cd ~/work/production-app
# 不创建 .agentmx-enabled
```

### 场景 2：团队协作

将 `.agentmx-enabled` 加入 `.gitignore`：

```gitignore
# .gitignore
.agentmx-enabled
.agentmx/
```

每个团队成员自己决定是否启用 AgentMX。

### 场景 3：CI/CD 环境

在 CI 脚本中临时启用：

```bash
# .github/workflows/test.yml
- name: Enable AgentMX for testing
  run: touch .agentmx-enabled

- name: Run AI-assisted tests
  run: claude-code test --with-agentmx
```

## 🔍 故障排除

### 问题 1：工具调用失败，提示未启用

**原因**：项目中没有 `.agentmx-enabled` 文件

**解决**：
```bash
touch .agentmx-enabled
```

### 问题 2：创建了标记文件，但仍然提示未启用

**原因**：可能在错误的目录创建了文件

**解决**：
```bash
# 检查当前目录
pwd

# 确认标记文件存在
ls -la .agentmx-enabled

# 确认 Claude 的工作目录
# 在 Claude Code 中，workspaceFolder 是打开的项目根目录
```

### 问题 3：想要全局启用（所有项目）

**不推荐**，但如果确实需要：

修改 MCP Server 代码，注释掉检查逻辑：

```typescript
// 在 mcp-server/src/index.ts 中
function isAgentMXEnabled(projectPath: string): boolean {
  return true; // 强制启用
}
```

然后重新构建：
```bash
cd mcp-server
npm run build
```

## 📚 最佳实践

1. **默认禁用**：新项目默认不启用 AgentMX
2. **显式启用**：需要时才创建 `.agentmx-enabled`
3. **加入 .gitignore**：避免提交标记文件到版本控制
4. **定期清理**：删除不再使用的项目的 `.agentmx/` 目录
5. **文档说明**：在项目 README 中说明如何启用 AgentMX

## 🎉 优势总结

| 特性 | 传统方式 | AgentMX 方式 |
|------|---------|-------------|
| 配置复杂度 | 每个项目配置 | 全局配置一次 |
| 项目隔离 | 手动管理 | 自动隔离 |
| 启用/禁用 | 修改配置文件 | 创建/删除标记文件 |
| 数据污染 | 可能污染 | 完全隔离 |
| 团队协作 | 配置冲突 | 各自决定 |

---

**现在你可以放心地在全局配置 AgentMX，只在需要的项目中启用！** 🚀
