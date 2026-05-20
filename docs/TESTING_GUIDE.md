# AgentMX v0.2.0 功能测试指南

本文档提供完整的测试步骤，用于验证 AgentMX v0.2.0 的所有功能。

## 📋 测试清单

- ✅ 环境搭建和配置
- ✅ v0.1 手动追踪功能测试
- ✅ v0.2 自动监控功能测试
- ✅ G1 冲突检测测试
- ✅ 事件历史查询测试
- ✅ 批量操作测试
- ✅ 项目级别控制测试
- ✅ 多 Agent 协作测试

---

## 第一部分：搭建测试环境

### 1.1 系统要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- 操作系统：Windows / macOS / Linux

### 1.2 构建 AgentMX

```bash
# 1. 进入 AgentMX 目录
cd D:\exp_all\AgentMX

# 2. 安装依赖
npm install

# 3. 构建核心库
npm run build

# 4. 验证构建成功
ls dist/  # 应该看到编译后的 .js 和 .d.ts 文件

# 5. 构建 MCP Server
cd mcp-server
npm install
npm run build

# 6. 验证 MCP Server 构建成功
ls dist/index.js  # 应该存在
```

### 1.3 创建测试项目

```bash
# 1. 创建测试项目目录
mkdir D:\exp_all\mx_test1
cd D:\exp_all\mx_test1

# 2. 初始化项目
npm init -y

# 3. 创建测试文件结构
mkdir src
mkdir tests
```

### 1.4 配置 Claude Code MCP

```bash
# 在测试项目中配置 MCP Server
cd D:\exp_all\mx_test1

# 添加 AgentMX MCP Server
claude mcp add agentmx -e AGENTMX_AUTO_TRACK=true -e AGENTMX_LOG_LEVEL=DEBUG -- node D:\exp_all\AgentMX\mcp-server\dist\index.js

# 验证配置
claude mcp list
# 应该看到：agentmx: node D:\exp_all\AgentMX\mcp-server\dist\index.js - ✓ Connected
```

### 1.5 启用 AgentMX

```bash
# 在测试项目根目录创建启用标记
cd D:\exp_all\mx_test1
touch .agentmx-enabled

# Windows 用户使用：
# type nul > .agentmx-enabled

# 验证标记文件存在
ls -la | grep .agentmx-enabled
```

---

## 第二部分：配置测试环境和文件

### 2.1 创建测试文件

```bash
cd D:\exp_all\mx_test1  # 或你的测试项目路径
```

**重要提示**：
- 测试文档中使用 `mx_test1` 作为示例路径，你可以使用任何项目名称（如 `mx_test2`）
- 确保在创建文件时添加实际内容，不要创建空文件
- 空文件（0 字节）会导致哈希值为空字符串的哈希，可能影响测试结果

**创建 `src/calculator.js`**：
```javascript
// src/calculator.js
// 功能：简单的计算器模块

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, subtract, multiply };
```

**使用命令创建**（推荐）：
```bash
# 创建目录
mkdir -p src

# 创建文件并写入内容
cat > src/calculator.js << 'EOF'
// src/calculator.js
// 功能：简单的计算器模块

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, subtract, multiply };
EOF
```

**创建 `src/utils.js`**：
```javascript
// src/utils.js
// 功能：工具函数

function formatNumber(num) {
  return num.toFixed(2);
}

function isEven(num) {
  return num % 2 === 0;
}

module.exports = { formatNumber, isEven };
```

**创建 `tests/test-helper.js`**：
```javascript
// tests/test-helper.js
// 功能：测试辅助函数

const crypto = require('crypto');
const fs = require('fs');

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { computeFileHash, sleep };
```

### 2.2 验证文件创建

```bash
# 验证文件结构
tree src tests
# 或者
ls -R src tests

# 应该看到：
# src/
#   calculator.js
#   utils.js
# tests/
#   test-helper.js
```

---

## 第三部分：测试代码和验证

### 测试 1：项目级别控制验证

**目标**：验证 AgentMX 只在有 `.agentmx-enabled` 标记的项目中生效。

**测试步骤**：

```bash
# 1. 在 Claude Code 中打开测试项目
cd D:\exp_all\mx_test1  # 或你的测试项目路径

# 2. 启动 Claude Code
claude

# 3. 在 Claude Code 中执行以下命令
```

**在 Claude Code 中执行**：
```
请调用 get_file_state 工具，查询 src/calculator.js 的状态
```

**预期结果**：
- ✅ 工具调用成功（不报错）
- ✅ 返回 JSON 对象，包含 `current_state` 字段
- ✅ `current_state` 包含文件信息：
  - `file_path`: 完整的文件路径
  - `content_hash`: SHA-256 哈希值
  - `size`: 文件大小（字节）
  - `mtime`: 最后修改时间戳
  - `is_current`: true
- ✅ 如果文件不存在或为空，`current_state` 可能为 null 或显示 size: 0

**注意**：
- 如果返回 `AGENTMX_NOT_ENABLED` 错误，说明项目未启用 AgentMX，需要创建 `.agentmx-enabled` 文件
- 数据库会自动创建在项目的 `.agentmx/agentmx.db` 路径下

**验证功能**：项目级别 opt-in 机制正常工作

---

### 测试 2：手动文件读取追踪（v0.1 功能）

**目标**：验证 `record_file_read` 工具正确记录 Agent 的文件读取操作。

**在 Claude Code 中执行**：
```
1. 请读取 src/calculator.js 文件
2. 计算该文件的 SHA-256 哈希值
3. 调用 record_file_read 工具记录读取操作，参数：
   - agent_id: "test-agent-1"
   - file_path: "src/calculator.js"
   - content_hash: <刚才计算的哈希值>
```

**预期结果**：
- ✅ `record_file_read` 返回 JSON 对象
- ✅ 包含 `observation_id` 字段（UUID 格式）
- ✅ 包含 `message: "File read recorded successfully"`
- ✅ 如果文件状态已变化，可能包含 `potential_conflicts` 警告

**验证命令**：
```
请调用 get_event_history 工具，参数：
- file_path: "src/calculator.js"
- event_type: "agent_file_read"
- limit: 10
```

**预期结果**：
- ✅ 事件历史中包含刚才的读取记录
- ✅ `agent_id` 为 "test-agent-1"
- ✅ `content_hash` 匹配

**验证功能**：手动文件读取追踪正常工作

---

### 测试 3：手动冲突检测（v0.1 功能）

**目标**：验证 `check_conflicts` 工具能检测到文件变化导致的冲突。

**测试步骤**：

**步骤 1：Agent 读取文件并记录**

在 Claude Code 中执行：
```
1. 请读取 src/utils.js 文件
2. 计算该文件的 SHA-256 哈希值
3. 调用 record_file_read 工具记录读取操作，参数：
   - agent_id: "test-agent-2"
   - file_path: "src/utils.js"
   - content_hash: <刚才计算的哈希值>
```

**重要**：
- 确保 `file_path` 使用相对路径 `"src/utils.js"`（不是绝对路径）
- `content_hash` 必须是实际文件内容的 SHA-256 哈希
- 记录返回的 `observation_id`，用于后续验证

**步骤 2：手动修改文件**

在终端中执行（不在 Claude Code 中）：
```bash
# 方式 1：使用 echo 追加内容
echo "" >> D:\exp_all\mx_test1\src\utils.js
echo "// Added comment by external process" >> D:\exp_all\mx_test1\src\utils.js

# 或方式 2：使用编辑器手动修改文件
# 打开 D:\exp_all\mx_test1\src\utils.js，在末尾添加一行注释，保存
```

**验证文件已修改**：
```bash
# 检查文件大小是否增加
ls -lh D:\exp_all\mx_test1\src\utils.js

# 查看文件内容
cat D:\exp_all\mx_test1\src\utils.js
```

**步骤 3：检查冲突**

在 Claude Code 中执行：
```
调用 check_conflicts 工具，参数：
- agent_id: "test-agent-2"
- file_path: "src/utils.js"

注意：file_path 必须与步骤 1 中使用的路径完全相同
```

**预期结果**：
- ✅ 返回 JSON 对象，包含 `has_conflict` 字段
- ✅ `has_conflict: true`（因为文件已被修改）
- ✅ `conflicts` 数组包含冲突详情：
  - `conflict_id`: UUID
  - `conflict_type: "G1_stale_read"`
  - `severity: "medium"`
  - `description`: 说明文件已过时
  - `agent_expected_hash`: Agent 读取时的哈希
  - `actual_hash`: 当前文件哈希
  - `recommended_action`: 建议重新读取文件

**验证功能**：手动 G1 冲突检测正常工作

**故障排查**：

如果 `check_conflicts` 返回 `has_conflict: false`，请检查以下几点：

1. **验证步骤 1 是否正确执行**
   ```
   调用 get_event_history 工具，参数：
   - agent_id: "test-agent-2"
   - event_type: "agent_file_read"
   - limit: 5
   ```
   - ✅ 应该看到 `agent_file_read` 事件
   - ❌ 如果没有看到，说明 `record_file_read` 没有被正确调用

2. **验证文件路径是否一致**
   - 步骤 1 中使用的 `file_path`：`"src/utils.js"`
   - 步骤 3 中使用的 `file_path`：`"src/utils.js"`
   - ⚠️ 路径必须完全相同（包括大小写、斜杠方向）

3. **验证文件是否真的被修改**
   ```bash
   # 检查文件大小
   ls -lh D:\exp_all\mx_test1\src\utils.js
   
   # 查看文件内容
   cat D:\exp_all\mx_test1\src\utils.js
   ```
   - 文件大小应该比步骤 1 时更大
   - 文件末尾应该有新添加的注释

4. **验证 agent_id 是否一致**
   - 步骤 1：`agent_id: "test-agent-2"`
   - 步骤 3：`agent_id: "test-agent-2"`
   - ⚠️ 必须完全相同

5. **查看数据库中的观察记录**
   ```
   调用 get_file_state 工具，参数：
   - file_path: "src/utils.js"
   - include_history: true
   ```
   - 应该看到文件的当前哈希值
   - 如果有历史记录，应该看到旧的哈希值

---

### 测试 4：文件写入追踪（v0.1 功能）

**目标**：验证 `record_file_write` 工具正确记录文件写入操作。

**在 Claude Code 中执行**：
```
1. 读取 src/calculator.js，记录旧哈希值
2. 修改文件：在末尾添加一个新函数 divide(a, b)
3. 计算新哈希值
4. 调用 record_file_write 工具，参数：
   - agent_id: "test-agent-1"
   - file_path: "src/calculator.js"
   - old_hash: <旧哈希值>
   - new_hash: <新哈希值>
```

**预期结果**：
- ✅ `record_file_write` 返回 JSON 对象
- ✅ 包含 `success: true`
- ✅ 包含 `message: "File write recorded successfully"`
- ✅ 文件状态已更新到数据库

**验证命令**：
```
调用 get_file_state 工具，参数：
- file_path: "src/calculator.js"
- include_history: true
```

**预期结果**：
- ✅ `current_state` 对象包含：
  - `content_hash`: 新哈希值（与刚才写入的匹配）
  - `file_path`: 文件路径
  - `size`: 文件大小
  - `mtime`: 最后修改时间
  - `is_current: true`
- ✅ `history` 数组包含历史状态记录（如果有的话）
- ✅ 历史记录中可以看到旧的哈希值

**验证功能**：文件写入追踪和状态历史记录正常工作

---

### 测试 5：启动文件系统监控（v0.2 功能）

**目标**：验证 `start_watching` 工具能启动文件监控。

**在 Claude Code 中执行**：
```
调用 start_watching 工具，参数：
- project_path: "D:\exp_all\mx_test1"
- watch_patterns: ["src/**/*.js", "tests/**/*.js"]
- ignore_patterns: ["node_modules/**", "*.log"]
```

**预期结果**：
- ✅ 返回 JSON 对象
- ✅ 包含 `success: true`
- ✅ 包含 `message: "Started watching project: ..."`
- ✅ 包含 `watched_projects` 数组，列出正在监控的项目路径
- ✅ 如果已经在监控，返回 "Already watching project" 消息

**验证功能**：文件系统监控启动成功

---

### 测试 6：自动文件变化检测（v0.2 功能）

**目标**：验证文件变化时自动触发扫描和状态更新。

**测试步骤**：

**步骤 1：确保监控已启动**
```
（如果未启动，执行测试 5）
```

**步骤 2：手动修改文件**
```bash
# 在终端中修改文件
echo "\n// Test auto-detection" >> D:\exp_all\mx_test1\src\calculator.js
```

**步骤 3：等待自动检测**
```
等待 2-3 秒（防抖时间）
```

**步骤 4：查询事件历史**
```
调用 get_event_history 工具，参数：
- file_path: "src/calculator.js"
- event_type: "file_state_changed"
- limit: 5
```

**预期结果**：
- ✅ 事件历史中包含 `file_state_changed` 事件
- ✅ 事件时间戳在最近几秒内
- ✅ `new_hash` 与当前文件哈希匹配

**验证功能**：文件系统监控自动检测文件变化

---

### 测试 7：自动冲突检测（v0.2 核心功能）

**目标**：验证文件变化时自动检测所有 Agent 的冲突。

**测试步骤**：

**步骤 1：Agent 读取文件**
```
1. 读取 src/utils.js
2. 计算哈希值
3. 调用 record_file_read，agent_id: "test-agent-3"
```

**步骤 2：确保监控已启动**
```
（如果未启动，调用 start_watching）
```

**步骤 3：手动修改文件**
```bash
# 在终端中修改文件
echo "\nfunction newFunction() { return true; }" >> D:\exp_all\mx_test1\src\utils.js
```

**步骤 4：等待自动检测**
```
等待 2-3 秒
```

**步骤 5：查询冲突历史**
```
调用 get_conflict_history 工具，参数：
- file_path: "src/utils.js"
- agent_id: "test-agent-3"
- limit: 5
```

**预期结果**：
- ✅ 冲突历史中包含新的冲突记录
- ✅ `conflict_type: "G1_stale_read"`
- ✅ `agent_id: "test-agent-3"`
- ✅ `detected_at` 时间戳在最近几秒内
- ✅ 冲突描述清晰说明文件已变化

**验证功能**：自动冲突检测正常工作（v0.2 核心功能）

---

### 测试 8：批量操作性能（v0.2 功能）

**目标**：验证批量操作能高效处理多个文件。

**测试步骤**：

**步骤 1：创建多个测试文件**
```bash
# 在终端中创建 10 个测试文件
cd D:\exp_all\mx_test1\src
for i in {1..10}; do
  echo "// Test file $i" > "test$i.js"
done
```

**步骤 2：等待自动扫描**
```
等待 3-5 秒（批量扫描和防抖）
```

**步骤 3：查询事件历史**
```
调用 get_event_history 工具，参数：
- event_type: "file_state_changed"
- limit: 20
```

**预期结果**：
- ✅ 事件历史中包含 10 个 `file_state_changed` 事件
- ✅ 所有事件时间戳接近（批量处理）
- ✅ 文件路径为 `src/test1.js` 到 `src/test10.js`

**验证功能**：批量文件扫描和事件发布正常工作

---

### 测试 9：多 Agent 协作场景

**目标**：验证多个 Agent 同时工作时的冲突检测。

**测试步骤**：

**步骤 1：Agent A 读取文件**
```
1. 读取 src/calculator.js
2. 计算哈希值
3. 调用 record_file_read，agent_id: "agent-a"
```

**步骤 2：Agent B 读取同一文件**
```
1. 读取 src/calculator.js
2. 计算哈希值
3. 调用 record_file_read，agent_id: "agent-b"
```

**步骤 3：Agent A 修改文件**
```
1. 修改 src/calculator.js（添加注释）
2. 计算新哈希值
3. 调用 record_file_write，agent_id: "agent-a"
```

**步骤 4：等待自动检测**
```
等待 2-3 秒
```

**步骤 5：Agent B 检查冲突**
```
调用 check_conflicts 工具，参数：
- agent_id: "agent-b"
- file_path: "src/calculator.js"
```

**预期结果**：
- ✅ 返回 `has_conflict: true`
- ✅ Agent B 的观察已过时
- ✅ 提示 Agent B 重新读取文件

**验证功能**：多 Agent 协作冲突检测正常工作

---

### 测试 10：停止文件监控（v0.2 功能）

**目标**：验证 `stop_watching` 工具能正确停止监控。

**在 Claude Code 中执行**：
```
调用 stop_watching 工具
```

**预期结果**：
- ✅ 返回 JSON 对象
- ✅ 包含 `success: true`
- ✅ 包含 `message: "Stopped watching project: ..."`
- ✅ 监控已停止，后续文件修改不会触发事件

**验证步骤**：
```bash
# 在终端中修改文件
echo "\n// After stop watching" >> D:\exp_all\mx_test1\src\calculator.js

# 等待 3 秒
sleep 3
```

**在 Claude Code 中查询**：
```
调用 get_event_history 工具，参数：
- file_path: "src/calculator.js"
- event_type: "file_state_changed"
- limit: 5
```

**预期结果**：
- ✅ 最新的 `file_state_changed` 事件时间戳在停止监控之前
- ✅ 停止监控后的文件修改没有触发新事件

**验证功能**：停止文件监控正常工作

---

### 测试 11：冲突解决流程

**目标**：验证完整的冲突检测和解决流程。

**测试步骤**：

**步骤 1：创建冲突**
```
1. 读取 src/utils.js，agent_id: "test-agent-4"
2. 记录读取操作
3. 手动修改文件（在终端中）
4. 等待自动冲突检测
```

**步骤 2：查询冲突**
```
调用 get_conflict_history 工具，参数：
- agent_id: "test-agent-4"
- file_path: "src/utils.js"
- limit: 1
```

**预期结果**：
- ✅ 返回最新的冲突记录
- ✅ 记录 `conflict_id`

**步骤 3：解决冲突**
```
1. Agent 重新读取 src/utils.js
2. 调用 resolve_conflict 工具，参数：
   - conflict_id: <上一步获取的 conflict_id>
   - resolution_action: "prompt_reread"
   - notes: "Agent has re-read the file"
```

**预期结果**：
- ✅ 返回 `success: true`
- ✅ 冲突状态更新为已解决

**步骤 4：验证解决状态**
```
再次调用 get_conflict_history，查看冲突记录
```

**预期结果**：
- ✅ 冲突记录的 `resolved_at` 字段有值
- ✅ `resolution_action` 为 "prompt_reread"

**验证功能**：完整的冲突检测和解决流程正常工作

---

## 第四部分：清理测试环境

### 4.1 停止监控

```
在 Claude Code 中调用 stop_watching 工具
```

### 4.2 查看数据库

```bash
# 查看数据库文件
ls -lh D:\exp_all\mx_test1\.agentmx\agentmx.db

# 使用 SQLite 查看数据（可选）
sqlite3 D:\exp_all\mx_test1\.agentmx\agentmx.db

# 在 SQLite 中执行：
.tables
SELECT COUNT(*) FROM event_log;
SELECT COUNT(*) FROM agent_observation;
SELECT COUNT(*) FROM file_state;
SELECT COUNT(*) FROM conflict_record;
.quit
```

### 4.3 清理测试文件（可选）

```bash
# 删除测试项目（如果不再需要）
rm -rf D:\exp_all\mx_test1

# 或者只删除 AgentMX 数据
rm -rf D:\exp_all\mx_test1\.agentmx
```

---

## 第五部分：测试结果总结

### 功能验证清单

| 测试项 | 功能 | 版本 | 状态 |
|--------|------|------|------|
| 测试 1 | 项目级别控制 | v0.1 | ⬜ |
| 测试 2 | 手动文件读取追踪 | v0.1 | ⬜ |
| 测试 3 | 手动冲突检测 | v0.1 | ⬜ |
| 测试 4 | 文件写入追踪 | v0.1 | ⬜ |
| 测试 5 | 启动文件系统监控 | v0.2 | ⬜ |
| 测试 6 | 自动文件变化检测 | v0.2 | ⬜ |
| 测试 7 | 自动冲突检测 | v0.2 | ⬜ |
| 测试 8 | 批量操作性能 | v0.2 | ⬜ |
| 测试 9 | 多 Agent 协作 | v0.1+v0.2 | ⬜ |
| 测试 10 | 停止文件监控 | v0.2 | ⬜ |
| 测试 11 | 冲突解决流程 | v0.1+v0.2 | ⬜ |

### 性能指标

记录以下性能数据：

- **文件监控响应时间**：从文件修改到检测到变化的时间
  - 预期：< 3 秒（包含防抖）
  - 实际：_______

- **冲突检测延迟**：从文件变化到冲突记录创建的时间
  - 预期：< 5 秒
  - 实际：_______

- **批量扫描性能**：10 个文件的扫描时间
  - 预期：< 10 秒
  - 实际：_______

- **数据库大小**：完成所有测试后的数据库文件大小
  - 预期：< 1 MB
  - 实际：_______

---

## 第六部分：常见问题排查

### 问题 1：MCP Server 连接失败

**症状**：`claude mcp list` 显示 ✗ Disconnected

**排查步骤**：
```bash
# 1. 检查 MCP Server 是否能独立运行
node D:\exp_all\AgentMX\mcp-server\dist\index.js

# 2. 检查环境变量
echo $AGENTMX_AUTO_TRACK
echo $AGENTMX_LOG_LEVEL

# 3. 查看 Claude Code 日志
# 日志位置：~/.claude/logs/
```

### 问题 2：工具调用返回 AGENTMX_NOT_ENABLED

**症状**：所有工具调用都返回 "AgentMX is not enabled for this project"

**解决方案**：
```bash
# 确保 .agentmx-enabled 文件存在
cd D:\exp_all\mx_test1
touch .agentmx-enabled

# 重启 Claude Code
```

### 问题 3：文件变化未被检测

**症状**：手动修改文件后，没有触发 `file_state_changed` 事件

**排查步骤**：
```bash
# 1. 确认监控已启动
# 在 Claude Code 中调用 start_watching

# 2. 检查文件是否在监控范围内
# 确保文件路径匹配 watch_patterns

# 3. 检查是否在忽略列表中
# 确保文件路径不匹配 ignore_patterns

# 4. 等待足够的防抖时间（2-3 秒）
```

### 问题 4：冲突未被自动检测

**症状**：文件变化后，没有生成冲突记录

**排查步骤**：
```bash
# 1. 确认 Agent 已记录文件读取
# 调用 get_event_history 查看 agent_file_read 事件

# 2. 确认文件状态已更新
# 调用 get_file_state 查看当前哈希值

# 3. 确认监控已启动
# 自动冲突检测需要 FileSystemWatcher 运行

# 4. 手动触发冲突检测
# 调用 check_conflicts 工具
```

---

## 附录：测试脚本

### 自动化测试脚本（Bash）

```bash
#!/bin/bash
# test-agentmx.sh
# 自动化测试脚本

set -e

PROJECT_DIR="D:/exp_all/mx_test1"
AGENTMX_DIR="D:/exp_all/AgentMX"

echo "=== AgentMX 自动化测试 ==="

# 1. 创建测试项目
echo "1. 创建测试项目..."
mkdir -p "$PROJECT_DIR/src"
mkdir -p "$PROJECT_DIR/tests"

# 2. 创建测试文件
echo "2. 创建测试文件..."
cat > "$PROJECT_DIR/src/test.js" << 'EOF'
function test() {
  return "initial version";
}
module.exports = { test };
EOF

# 3. 启用 AgentMX
echo "3. 启用 AgentMX..."
touch "$PROJECT_DIR/.agentmx-enabled"

# 4. 等待用户在 Claude Code 中执行测试
echo "4. 请在 Claude Code 中执行以下测试："
echo "   - 调用 start_watching"
echo "   - 调用 record_file_read 读取 src/test.js"
echo "   - 等待 5 秒后按回车继续..."
read

# 5. 修改文件触发自动检测
echo "5. 修改文件触发自动检测..."
echo "\n// Modified" >> "$PROJECT_DIR/src/test.js"

echo "6. 等待 3 秒让 AgentMX 检测变化..."
sleep 3

echo "7. 请在 Claude Code 中验证："
echo "   - 调用 get_conflict_history 查看冲突"
echo "   - 应该看到 G1_stale_read 冲突"

echo "=== 测试完成 ==="
```

### 使用方法

```bash
# 赋予执行权限
chmod +x test-agentmx.sh

# 运行测试
./test-agentmx.sh
```

---

## 总结

本测试指南涵盖了 AgentMX v0.2.0 的所有核心功能：

1. ✅ **v0.1 功能**：手动追踪、手动冲突检测、事件历史查询
2. ✅ **v0.2 功能**：自动监控、自动冲突检测、批量操作
3. ✅ **集成功能**：多 Agent 协作、完整冲突解决流程

按照本指南执行测试后，你将全面验证 AgentMX 的功能完整性和稳定性。

**建议测试顺序**：
1. 先完成测试 1-4（v0.1 基础功能）
2. 再完成测试 5-8（v0.2 自动化功能）
3. 最后完成测试 9-11（高级场景）

**预计测试时间**：30-45 分钟
