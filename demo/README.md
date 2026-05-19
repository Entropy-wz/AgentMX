# AgentMX Demo & Experiments

本目录包含AgentMX的功能演示和实验场景，用于测试和验证认知状态追踪系统。

## 📋 目录结构

```
demo/
├── README.md                      # 本文件
├── scenario-g1-stale-read.ts      # G1冲突场景演示
├── interactive-cli.ts             # 交互式CLI工具
├── demo.db                        # 演示数据库（运行后生成）
├── interactive.db                 # 交互式数据库（运行后生成）
└── test-file.txt                  # 测试文件（运行后生成）
```

## 🎯 实验目标

这些实验旨在验证AgentMX的核心功能：

1. **认知状态追踪**：记录AI agent对文件的理解
2. **冲突检测**：识别agent认知与实际文件状态的不一致
3. **事件溯源**：完整记录所有操作历史
4. **恢复机制**：提供冲突解决方案

## 🚀 快速开始

### 前置条件

```bash
# 确保已安装依赖
npm install

# 确保已编译TypeScript
npm run build
```

### 实验1：G1 Stale Read 场景演示

这是一个自动化演示，展示最常见的认知冲突场景。

**场景描述：**
1. 创建文件并记录初始状态
2. Agent读取文件（建立认知状态）
3. 文件被外部修改（模拟用户手动编辑）
4. 系统检测到G1冲突（agent的认知过时）
5. 触发恢复动作（提示agent重新读取）

**运行方式：**

```bash
npx tsx demo/scenario-g1-stale-read.ts
```

**预期输出：**

```
======================================================================
AgentMX Demo: G1 Stale Read Detection
======================================================================

Step 1: Create initial file
----------------------------------------------------------------------
  File: ./demo/test-file.txt
  Content: "Hello, World!"
  Hash: e3b0c44298fc1c14...
  📢 Event: File state changed - ./demo/test-file.txt

Step 2: Agent reads the file
----------------------------------------------------------------------
  Agent "claude-demo-agent" reads file
  Agent sees: "Hello, World!"
  Agent's cognitive state: hash=e3b0c44298fc1c14...
  📢 Event: Agent operation - file_read on ./demo/test-file.txt

Step 3: External modification (simulating user edit)
----------------------------------------------------------------------
  File modified externally
  New content: "Hello, AgentMX! This file was modified externally."
  New hash: 7d865e959b2466918...
  📢 Event: File state changed - ./demo/test-file.txt

Step 4: Detect cognitive conflict (G1 Stale Read)
----------------------------------------------------------------------
  Agent's last read hash: e3b0c44298fc1c14...
  Current file hash:      7d865e959b2466918...
  ⚠️  CONFLICT DETECTED: G1_STALE_READ
  Agent's cognitive state is out of sync with reality!

Step 5: Recovery action
----------------------------------------------------------------------
  Recommended action: PROMPT_REREAD
  System should notify agent to re-read the file before proceeding
  
  Agent re-reads file...
  Agent now sees: "Hello, AgentMX! This file was modified externally."
  Agent's cognitive state updated: hash=7d865e959b2466918...
  
  ✅ Conflict resolved: Agent's cognitive state is now aligned

Step 6: Query event history
----------------------------------------------------------------------
  Total events recorded: 5
  1. [file_state_changed] 2026-05-19T01:30:00.000Z
  2. [agent_file_read] 2026-05-19T01:30:00.100Z
  3. [file_state_changed] 2026-05-19T01:30:00.200Z
  4. [cognitive_conflict] 2026-05-19T01:30:00.250Z
  5. [recovery_action] 2026-05-19T01:30:00.300Z

Step 7: Query conflict history
----------------------------------------------------------------------
  Total conflicts for this file: 1
  1. [G1_stale_read] Severity: medium
     Detected: 2026-05-19T01:30:00.250Z
     Resolved: 2026-05-19T01:30:00.300Z
     Action: prompt_reread

======================================================================
Demo completed successfully!
======================================================================

Key takeaways:
  1. AgentMX tracks both file state and agent cognitive state
  2. It detects when agent's understanding becomes stale
  3. It provides recovery mechanisms to restore alignment
  4. All events are logged for debugging and analysis
```

### 实验2：交互式CLI

这是一个交互式工具，让你手动触发各种场景并观察系统行为。

**运行方式：**

```bash
npx tsx demo/interactive-cli.ts
```

**可用命令：**

1. **Create file** - 创建测试文件
2. **Agent reads file** - 模拟agent读取文件
3. **Modify file (external)** - 模拟外部修改文件
4. **Check for conflicts** - 检测认知冲突
5. **View file state history** - 查看文件状态历史
6. **View agent observations** - 查看agent观察记录
7. **View event history** - 查看事件历史
8. **View conflict history** - 查看冲突历史
9. **Change agent ID** - 切换agent身份

**实验建议流程：**

```
1. Create file
   → 输入: "Initial content"

2. Agent reads file
   → 观察: Agent observation被记录

3. Modify file (external)
   → 输入: "Modified content"
   → 观察: File state changed事件

4. Check for conflicts
   → 观察: G1_STALE_READ冲突被检测

5. Agent reads file (again)
   → 观察: Agent认知状态更新

6. Check for conflicts
   → 观察: 不再有冲突

7. View event history
   → 观察: 完整的事件链

8. View conflict history
   → 观察: 冲突记录和解决状态
```

## 🧪 实验场景说明

### G1: Stale Read（过时读取）

**触发条件：**
- Agent读取文件后，文件被外部修改
- Agent的content_hash ≠ 当前文件的content_hash

**严重程度：** Medium

**恢复策略：** PROMPT_REREAD
- 提示agent重新读取文件
- 更新agent的认知状态

**现实案例：**
```
1. Claude读取 config.json (version: 1.0)
2. 用户手动编辑 config.json (version: 2.0)
3. Claude基于旧版本继续操作 ❌
4. AgentMX检测到冲突，提示Claude重新读取 ✅
```

### G2: Concurrent Write（并发写入）

**触发条件：**
- Agent准备写入文件
- 但文件已被其他agent或外部修改

**严重程度：** High

**恢复策略：** ABORT_AND_REPLAN
- 中止当前操作
- 重新评估计划

**现实案例：**
```
1. Agent A读取 database.ts
2. Agent B修改 database.ts
3. Agent A尝试写入（基于旧版本）❌
4. AgentMX检测到冲突，中止写入 ✅
```

### G3: Phantom Read（幻读）

**触发条件：**
- Agent执行命令失败
- 但文件状态仍然改变了

**严重程度：** High

**恢复策略：** VERIFY_AND_ROLLBACK
- 验证实际状态
- 必要时回滚

**现实案例：**
```
1. Agent执行 git commit（命令报错）
2. 但部分文件已被staged
3. Agent认为操作失败，继续其他操作 ❌
4. AgentMX检测到状态不一致 ✅
```

## 📊 数据库结构

运行实验后，可以直接查看SQLite数据库：

```bash
# 查看演示数据库
sqlite3 demo/demo.db

# 查看表结构
.schema

# 查询事件日志
SELECT event_type, timestamp, file_path FROM event_log ORDER BY timestamp DESC LIMIT 10;

# 查询冲突记录
SELECT conflict_type, severity, agent_id, description FROM conflict_record;

# 查询文件状态历史
SELECT file_path, content_hash, is_current, captured_at FROM file_state ORDER BY captured_at DESC;

# 查询agent观察
SELECT agent_id, observation_type, file_path, observed_at FROM agent_observation ORDER BY observed_at DESC;
```

## 🔍 调试技巧

### 启用详细日志

修改demo脚本，添加更多console.log：

```typescript
eventBus.subscribe('*', (event) => {
  console.log('[DEBUG] Event:', JSON.stringify(event, null, 2));
});
```

### 检查数据库状态

```bash
# 实时监控数据库变化
watch -n 1 'sqlite3 demo/demo.db "SELECT COUNT(*) FROM event_log"'
```

### 清理实验数据

```bash
# 删除所有生成的文件
rm -f demo/*.db demo/*.txt
```

## 🎓 学习路径

1. **初学者**：运行scenario-g1-stale-read.ts，理解基本概念
2. **进阶**：使用interactive-cli.ts手动触发各种场景
3. **高级**：修改demo脚本，添加G2/G3场景
4. **专家**：集成到真实的AI agent工作流

## 🤝 接入真实Claude Agent

### 方案1：通过MCP Server（推荐）

创建一个MCP server，暴露AgentMX的API：

```typescript
// 伪代码示例
server.setRequestHandler(ReadFileRequest, async (request) => {
  const content = fs.readFileSync(request.path, 'utf-8');
  const hash = computeHash(content);
  
  // 记录agent观察
  await store.recordObservation({
    agent_id: 'claude-mcp',
    observation_type: 'file_read',
    file_path: request.path,
    content_hash: hash
  });
  
  return { content };
});
```

### 方案2：通过Wrapper脚本

包装Claude Code的文件操作：

```typescript
// wrapper.ts
import { Read } from 'claude-code-sdk';

const originalRead = Read;
Read = async (path) => {
  const result = await originalRead(path);
  
  // 记录到AgentMX
  await agentMX.recordRead('claude', path, result);
  
  return result;
};
```

### 方案3：通过Hooks

利用Claude Code的hooks机制：

```json
// settings.json
{
  "hooks": {
    "onFileRead": "node agentmx-hook.js read",
    "onFileWrite": "node agentmx-hook.js write"
  }
}
```

## 📝 实验报告模板

完成实验后，可以记录以下信息：

```markdown
## 实验报告

**日期：** 2026-05-19
**实验者：** [你的名字]
**实验场景：** G1 Stale Read

### 观察结果
- 冲突检测延迟：< 1ms
- 事件记录完整性：100%
- 恢复策略有效性：✅

### 发现的问题
- [列出任何问题]

### 改进建议
- [列出改进建议]
```

## 🐛 常见问题

**Q: 运行demo时报错 "Cannot find module"**
A: 确保运行了 `npm run build` 编译TypeScript

**Q: 数据库文件被锁定**
A: 确保之前的demo进程已经退出，或删除.db文件重新运行

**Q: 如何重置实验环境？**
A: 删除所有.db和.txt文件：`rm -f demo/*.db demo/*.txt`

**Q: 可以同时运行多个demo吗？**
A: 不建议，因为它们会共享数据库文件。如果需要，修改dbPath使用不同的文件名。

## 📚 相关文档

- [AgentMX设计文档](../docs/superpowers/specs/2026-05-18-agentmx-design.md)
- [实现计划](../docs/superpowers/plans/2026-05-18-event-bus-cognitive-store.md)
- [API文档](../README.md#api-reference)

## 🎉 下一步

完成这些实验后，你应该能够：

1. ✅ 理解AgentMX的核心概念
2. ✅ 识别三种认知冲突类型
3. ✅ 使用API追踪agent认知状态
4. ✅ 设计自己的实验场景
5. ✅ 集成到真实的AI agent工作流

准备好了吗？开始你的第一个实验吧！

```bash
npx tsx demo/scenario-g1-stale-read.ts
```
