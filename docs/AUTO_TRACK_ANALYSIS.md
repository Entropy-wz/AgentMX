# AgentMX 自动追踪问题分析

## 问题 1：Token 成本高（1.8k）

### 原因
Claude 没有看到 MCP 工具，所以使用了低效的方式：
```
❌ 读取 schema → 手动构造 SQL → 生成 UUID → 插入 → 查询验证
   Token 成本：~1.8k
```

### 应该的方式
```
✅ 调用 MCP 工具：agentmx_record_file_read
   Token 成本：~100-200 tokens
```

### 解决方案
**你需要先修复 MCP Server 加载问题！**

1. 更新 `C:\Users\lenovo\.claude\settings.json`：
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

2. 完全退出并重启 Claude Code：
```bash
/exit
# 关闭终端
# 重新打开终端
cd D:/exp_all/mx_test1
claude
```

3. 验证 MCP 工具是否加载：
在 Claude Code 中输入 `/tools`，应该看到 `agentmx_*` 工具。

---

## 问题 2：自动追踪的实现

### 当前状态：❌ 未实现

`AGENTMX_AUTO_TRACK` 变量被定义了，但从未被使用。目前的实现中：
- ✅ MCP Server 提供了 7 个工具
- ✅ MCP Resource 提供了自动追踪指令
- ❌ **但没有自动拦截机制**

### 为什么没有自动追踪？

**技术限制：**
1. MCP 协议不支持拦截其他工具的调用
2. Claude Code 不提供 hooks 机制
3. MCP Server 无法"强制"Claude 调用工具

### 可行的方案

#### 方案 A：依赖 Claude 的自觉性（当前实现）

**机制：**
- MCP Resource `auto-track-instructions` 提供指令
- MCP Prompt `agentmx-workflow` 提供工作流模板
- 依赖 Claude 主动遵守

**优点：**
- 无需修改架构
- 灵活（Claude 可以判断是否需要追踪）

**缺点：**
- ❌ Claude 可能忽略或忘记
- ❌ Token 成本高（每次都要读取指令）
- ❌ 不可靠

**当前问题：**
你的 Claude 没有看到 MCP 工具，所以根本无法使用。

#### 方案 B：System Prompt 注入（推荐）

**机制：**
修改 MCP Server，在 `initialize` 响应中注入系统提示：

```typescript
// 在 initialize 处理中
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      // 注入系统提示
      systemPrompt: AGENTMX_AUTO_TRACK ? `
        IMPORTANT: You MUST call AgentMX tools after file operations:
        - After Read tool: call agentmx_record_file_read
        - After Write/Edit tool: call agentmx_record_file_write
        - Before any file operation: call agentmx_check_conflicts
        
        This is MANDATORY for cognitive state tracking.
      ` : undefined
    },
    serverInfo: { name: "agentmx", version: "0.1.0" }
  };
});
```

**优点：**
- ✅ 系统级别的指令，Claude 更可能遵守
- ✅ 只在 `AUTO_TRACK=true` 时启用
- ✅ 相对可靠

**缺点：**
- ⚠️ 仍然依赖 Claude 的遵守
- ⚠️ 增加每次对话的 token 成本（系统提示）

#### 方案 C：Claude Code Plugin（理想但不可行）

**机制：**
创建 Claude Code 插件，在 Read/Write 工具执行后自动调用 AgentMX。

**优点：**
- ✅ 完全自动
- ✅ 零 token 成本
- ✅ 100% 可靠

**缺点：**
- ❌ Claude Code 目前不支持这种插件机制
- ❌ 需要官方支持

#### 方案 D：Wrapper Script（可行但复杂）

**机制：**
创建一个包装脚本，拦截 Claude Code 的工具调用：

```bash
# claude-with-agentmx.sh
#!/bin/bash
# 启动 Claude Code，但拦截工具调用
# 在 Read/Write 后自动调用 AgentMX
```

**优点：**
- ✅ 完全自动
- ✅ 不依赖 Claude 的遵守

**缺点：**
- ❌ 实现复杂
- ❌ 维护成本高
- ❌ 可能与 Claude Code 更新冲突

### 推荐方案：B（System Prompt 注入）

这是当前最实用的方案：
1. 修改 MCP Server，注入系统提示
2. 当 `AUTO_TRACK=true` 时，强制要求 Claude 调用工具
3. 相对可靠，实现简单

### Token 成本分析

**方案 A（当前）：**
- 每次手动提醒：~50 tokens
- Claude 读取指令：~200 tokens
- Claude 调用工具：~100 tokens
- **总计：~350 tokens/次**

**方案 B（System Prompt）：**
- 系统提示（一次性）：~100 tokens
- Claude 调用工具：~100 tokens
- **总计：~200 tokens/次**（首次 +100）

**理想方案（自动拦截）：**
- 工具调用：~50 tokens
- **总计：~50 tokens/次**

### 结论

1. **立即修复：** 先让 MCP Server 正确加载（更新 settings.json）
2. **短期方案：** 实现 System Prompt 注入（方案 B）
3. **长期方案：** 等待 Claude Code 支持插件机制（方案 C）

---

## 下一步行动

### 优先级 1：修复 MCP Server 加载
按照 [QUICK_FIX.md](../QUICK_FIX.md) 操作。

### 优先级 2：实现 System Prompt 注入
修改 MCP Server，在 `AUTO_TRACK=true` 时注入系统提示。

### 优先级 3：优化 Token 成本
- 简化工具参数
- 批量操作支持
- 缓存机制

---

## 用户期望 vs 现实

### 用户期望
> "自动追踪所有文件操作，无需手动命令"

### 当前现实
> "需要手动命令 Claude 调用工具，或依赖 Claude 自觉遵守指令"

### 技术限制
MCP 协议和 Claude Code 目前不支持工具拦截机制。

### 可行的妥协
使用 System Prompt 注入，让 Claude "强烈倾向于"自动调用工具。

---

## 成本对比

| 方案 | Token/次 | 可靠性 | 实现难度 |
|------|----------|--------|----------|
| 手动命令 | 1800 | 100% | 简单 |
| Resource 指令 | 350 | 50% | 简单 |
| System Prompt | 200 | 80% | 中等 |
| 自动拦截 | 50 | 100% | 不可行 |

**推荐：System Prompt 方案**（性价比最高）
