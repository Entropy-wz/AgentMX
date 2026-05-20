# 测试指南勘误表

本文档记录测试指南中发现的问题和修正。

## 发现日期：2026-05-19

### 问题 1：`get_file_state` 工具返回格式错误

**原始预期结果**（错误）：
```
- ✅ 工具调用成功
- ✅ 返回 `success: true`
- ✅ 数据库路径为：`D:\exp_all\mx_test1\.agentmx\agentmx.db`
```

**实际返回格式**：
```json
{
  "current_state": {
    "snapshot_id": "uuid",
    "file_path": "完整路径",
    "content_hash": "sha256哈希",
    "size": 文件大小,
    "mtime": 时间戳,
    "is_current": true,
    "captured_at": 时间戳
  },
  "history": []  // 如果 include_history: true
}
```

**修正后的预期结果**：
- ✅ 工具调用成功（不报错）
- ✅ 返回 JSON 对象，包含 `current_state` 字段
- ✅ `current_state` 包含文件信息（file_path, content_hash, size, mtime, is_current）
- ✅ 如果文件不存在或为空，`current_state` 可能为 null 或显示 size: 0

**根本原因**：
- `get_file_state` 工具设计为返回文件状态对象，而不是简单的成功标志
- 测试文档编写时未仔细查看 MCP Server 的实际实现

---

### 问题 2：`record_file_read` 工具返回格式错误

**原始预期结果**（错误）：
```
- ✅ `record_file_read` 返回 `success: true`
- ✅ 返回 `observation_id`
```

**实际返回格式**：
```json
{
  "observation_id": "uuid",
  "message": "File read recorded successfully",
  "potential_conflicts": [...]  // 可选，如果检测到潜在冲突
}
```

**修正后的预期结果**：
- ✅ `record_file_read` 返回 JSON 对象
- ✅ 包含 `observation_id` 字段（UUID 格式）
- ✅ 包含 `message: "File read recorded successfully"`
- ✅ 如果文件状态已变化，可能包含 `potential_conflicts` 警告

---

### 问题 3：测试 3 的步骤不够清晰，导致用户无法正确执行

**原始问题**：
- ❌ 步骤 1 没有明确说明如何调用 `record_file_read` 工具
- ❌ 没有给出具体的工具参数示例
- ❌ 没有说明 `file_path` 应该使用相对路径还是绝对路径
- ❌ 没有验证步骤，无法确认 `record_file_read` 是否成功

**用户遇到的现象**：
```
调用 check_conflicts 返回 has_conflict: false
预期：has_conflict: true
```

**根本原因**：
`check_conflicts` 的工作原理（第 656 行）：
```typescript
if (lastRead && currentState && lastRead.content_hash !== currentState.content_hash) {
  // 检测到冲突
}
```

冲突检测需要满足两个条件：
1. `lastRead` 存在（Agent 之前读取过该文件）
2. `lastRead.content_hash !== currentState.content_hash`（文件哈希已变化）

如果返回 `has_conflict: false`，可能是：
- 步骤 1 没有正确执行（`lastRead` 为 null）
- 步骤 2 没有执行（文件没有被修改）
- 步骤 1 和步骤 3 中的 `file_path` 或 `agent_id` 不匹配

**修正方案**：
1. 添加详细的工具调用示例
2. 强调 `file_path` 必须使用相对路径
3. 添加验证步骤，确认 `record_file_read` 成功
4. 添加故障排查部分，帮助用户诊断问题

**修正后的测试 3**：
- ✅ 步骤 1：明确说明如何调用 `record_file_read`，包括参数示例
- ✅ 步骤 2：验证文件是否真的被修改
- ✅ 步骤 3：检查冲突
- ✅ 故障排查：5 个诊断步骤，帮助用户找出问题所在

**`check_conflicts` 工具返回格式**：
```json
{
  "has_conflict": true,
  "conflicts": [
    {
      "conflict_id": "uuid",
      "conflict_type": "G1_stale_read",
      "severity": "medium",
      "description": "Your understanding of this file is outdated...",
      "agent_expected_hash": "旧哈希",
      "actual_hash": "新哈希",
      "detected_at": 时间戳,
      "recommended_action": "Re-read the file before making changes..."
    }
  ]
}
```

---

### 问题 4：`start_watching` 工具返回格式错误

**原始预期结果**（错误）：
```
- ✅ 返回 `success: true`
- ✅ 返回 `watching: true`
- ✅ 返回 `watched_paths` 列表
```

**实际返回格式**：
```json
{
  "success": true,
  "message": "Started watching project: /path/to/project",
  "watched_projects": ["/path/to/project"]
}
```

或者如果已经在监控：
```json
{
  "success": true,
  "message": "Already watching project: /path/to/project",
  "watched_projects": ["/path/to/project"]
}
```

**修正后的预期结果**：
- ✅ 返回 JSON 对象
- ✅ 包含 `success: true`
- ✅ 包含 `message: "Started watching project: ..."`
- ✅ 包含 `watched_projects` 数组，列出正在监控的项目路径
- ✅ 如果已经在监控，返回 "Already watching project" 消息

---

### 问题 5：空文件导致的测试问题

**问题描述**：
用户创建了空的 `src/calculator.js` 文件（0 字节），导致：
- `content_hash` 为空字符串的 SHA-256 哈希
- `size: 0`
- 测试结果与预期不符

**解决方案**：
在测试指南的"创建测试文件"部分添加了：
1. **重要提示**：不要创建空文件
2. **推荐方法**：使用 `cat > file << 'EOF'` 命令确保文件有内容
3. **验证步骤**：创建文件后检查文件大小

**修正后的文件创建命令**：
```bash
# 推荐：使用 heredoc 创建文件
cat > src/calculator.js << 'EOF'
// src/calculator.js
function add(a, b) { return a + b; }
module.exports = { add };
EOF

# 验证文件不为空
ls -lh src/calculator.js  # 应该显示文件大小 > 0
```

---

## 经验教训

### 1. 编写测试文档时应该先查看实际实现

在编写预期结果之前，应该：
1. 阅读 MCP Server 的源代码（`mcp-server/src/index.ts`）
2. 查看每个工具的实际返回格式
3. 运行一次实际测试，记录真实输出
4. 基于真实输出编写预期结果

### 2. 返回格式应该详细而非简化

错误做法：
```
预期结果：返回 success: true
```

正确做法：
```
预期结果：
- 返回 JSON 对象
- 包含 success: true
- 包含 message 字段
- 包含其他相关字段（列出所有字段）
```

### 3. 测试文件应该有实际内容

- 不要使用 `touch` 创建空文件
- 使用 `cat > file << 'EOF'` 或 `echo "content" > file` 确保有内容
- 创建后验证文件大小

### 4. 路径应该灵活而非硬编码

错误做法：
```
数据库路径为：D:\exp_all\mx_test1\.agentmx\agentmx.db
```

正确做法：
```
数据库路径为：<项目路径>\.agentmx\agentmx.db
（例如：D:\exp_all\mx_test1\.agentmx\agentmx.db）
```

---

## 已修复的测试

以下测试的预期结果已在 `TESTING_GUIDE.md` 中修正：

- ✅ 测试 1：项目级别控制验证
- ✅ 测试 2：手动文件读取追踪
- ✅ 测试 3：手动冲突检测
- ✅ 测试 4：文件写入追踪
- ✅ 测试 5：启动文件系统监控
- ✅ 测试 10：停止文件监控

其他测试的预期结果基本正确，但建议在实际测试时仔细对比。

---

## 建议的测试流程

1. **第一次测试**：
   - 按照测试指南执行
   - 记录所有实际输出
   - 对比预期结果和实际结果
   - 标记差异

2. **验证差异**：
   - 检查是否是测试文档错误
   - 检查是否是实现错误
   - 检查是否是测试环境问题

3. **更新文档**：
   - 修正测试文档中的错误预期
   - 添加实际遇到的问题到勘误表
   - 补充注意事项和常见错误

4. **重新测试**：
   - 使用修正后的文档重新测试
   - 确保所有测试通过
   - 记录性能指标

---

## 联系方式

如果发现更多问题，请：
1. 记录问题详情（预期 vs 实际）
2. 检查 MCP Server 日志（设置 `AGENTMX_LOG_LEVEL=DEBUG`）
3. 提交 Issue 到 GitHub 仓库
4. 更新本勘误表

---

**最后更新**：2026-05-19
**版本**：v0.2.0
