# Changelog

All notable changes to AgentMX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-20

### 🎉 File System Watcher & Automatic Conflict Detection

AgentMX v0.2.0 adds real-time file system monitoring and automatic conflict detection, moving from semi-automatic (hook-based) tracking to fully automatic tracking.

### ✨ Added

#### File System Watcher
- **FileSystemWatcher**: Chokidar-based file monitoring with debouncing
  - Watches multiple projects simultaneously
  - Configurable ignore patterns (node_modules, .git, dist, etc.)
  - Debounce strategy: 100ms per-file, 500ms maxWait
  - Publishes `FileMightChangedEvent` to EventBus

#### File State Scanner
- **FileStateScanner**: Automatic hash computation and state tracking
  - Subscribes to `FileMightChangedEvent`
  - Stream-based SHA-256 hashing for large files
  - Publishes `FileStateChangedEvent` when content changes
  - Batch scanning support for multiple files

#### Conflict Detector
- **ConflictDetector**: Event-driven automatic G1 conflict detection
  - Subscribes to `FileStateChangedEvent`
  - Detects conflicts for all agents with stale reads
  - Publishes `CognitiveConflictEvent` automatically
  - No manual `check_conflicts` calls needed

#### Batch Operations
- **EventBus.publishBatch()**: Batch event publishing with SQLite transactions
- **CognitiveStore.recordFileStateBatch()**: Batch file state recording
- **CognitiveStore.getAgentsWithObservations()**: Query agents with observations for a file

#### New MCP Tools
- **start_watching**: Start watching a project for file changes
- **stop_watching**: Stop watching a project

#### Hash Utilities
- **computeFileHash()**: Stream-based SHA-256 hashing
- **computeContentHash()**: In-memory content hashing
- **computeFileHashWithStats()**: Hash with file stats (size, mtime)

### 📦 Dependencies

- Added `chokidar@^3.6.0` for file system watching
- Added `lodash.debounce@^4.0.8` for debouncing

### 🔧 Technical Improvements

- Event-driven architecture: Watcher → Scanner → Detector communicate via EventBus
- Proactive conflict detection: Conflicts detected when files change, not when agents write
- Performance: Batch operations reduce SQLite transaction overhead
- Memory efficient: Stream-based hashing for large files

### 📝 Known Limitations

- Only G1 (Stale Read) conflict detection (G2/G3 planned for v0.3)
- File watching requires explicit `start_watching` tool call
- No automatic file watching on server start (opt-in per project)

### 🔜 Next Steps

See [roadmap](README.md#-路线图) for v0.3+ features:
- **v0.3**: G2/G3 conflict detection
- **v0.4**: Decision Engine and intelligent recovery
- **v0.5**: Web Dashboard and production-ready features

---

## [0.1.0] - 2026-05-19

### 🎉 首次发布

AgentMX v0.1.0 是第一个正式发布版本，提供完整的认知状态追踪核心功能。

### ✨ Added

#### 核心架构
- **Event Bus**: 事件驱动架构，支持发布/订阅模式
- **Cognitive Store**: SQLite 数据库存储，包含 4 个核心表：
  - `event_log`: 事件日志
  - `agent_observation`: Agent 观察记录
  - `file_state`: 文件状态快照
  - `conflict_record`: 冲突记录

#### MCP Server
- **7 个核心 MCP 工具**:
  - `record_file_read`: 记录文件读取操作
  - `record_file_write`: 记录文件写入操作
  - `check_conflicts`: 检查认知冲突
  - `get_event_history`: 查询事件历史
  - `get_conflict_history`: 查询冲突历史
  - `get_file_state`: 获取文件状态
  - `resolve_conflict`: 标记冲突已解决
- **Hash 自动计算**: 工具自动计算文件 SHA-256 hash，无需手动传递
- **项目自动检测**: 通过 `.agentmx-enabled` 标记文件自动识别项目

#### Claude Code 集成
- **Hooks 自动追踪**: 通过 PreToolUse 和 PostToolUse hooks 实现零侵入式追踪
  - PostToolUse + Read: 自动记录文件读取
  - PreToolUse + Write/Edit: 自动检查冲突
  - PostToolUse + Write/Edit: 自动记录文件写入
- **配置示例**: 提供完整的 `.claude/settings.json` 配置示例

#### 冲突检测
- **G1 Stale Read 检测**: 检测 Agent 基于过时文件内容做决策的情况
- **冲突严重性评估**: Low/Medium/High 三级严重性
- **推荐操作**: 为每个冲突提供解决建议

#### 项目级别控制
- **Opt-in 机制**: 只在启用的项目中生效
- **便捷脚本**: 
  - `agentmx.sh` (Linux/Mac)
  - `agentmx.bat` (Windows)
- **命令支持**: enable, disable, status

#### 文档
- **快速开始指南**: [QUICKSTART.md](QUICKSTART.md)
- **MCP Server 设计**: [docs/MCP_SERVER_DESIGN.md](docs/MCP_SERVER_DESIGN.md)
- **工具参考**: [docs/TOOL_REFERENCE.md](docs/TOOL_REFERENCE.md)
- **项目控制**: [docs/PROJECT_LEVEL_CONTROL.md](docs/PROJECT_LEVEL_CONTROL.md)
- **子系统指南**: [docs/SUBSYSTEM_GUIDE.md](docs/SUBSYSTEM_GUIDE.md)
- **配置示例**: [examples/claude-code-hooks/](examples/claude-code-hooks/)

#### 测试
- **集成测试**: 完整的集成测试套件
- **边界测试**: 边界情况和错误处理测试
- **98% 覆盖率**: 行覆盖率 100%
- **演示程序**: 
  - G1 冲突场景演示 (`npm run demo:g1`)
  - 交互式 CLI (`npm run demo:interactive`)

### 📊 性能指标

- 事件记录: < 5ms (SQLite 写入)
- 冲突检测: < 10ms (SQLite 查询)
- 数据库大小: ~1KB per event
- 并发支持: SQLite WAL 模式

### 🔒 安全特性

- 路径验证: 所有文件路径必须在项目目录内
- 权限检查: 只能访问有权限的文件
- 数据隔离: 不同项目使用独立数据库
- 敏感信息保护: 只记录 hash，不记录文件内容

### 📦 包信息

- **agentmx**: 核心库 (Event Bus + Cognitive Store)
- **agentmx-mcp-server**: MCP Server 实现

### 🔧 技术栈

- TypeScript 6.0
- Node.js (ESM)
- better-sqlite3 12.10.0
- @modelcontextprotocol/sdk 1.0.4+
- eventemitter3 5.0.4
- Vitest 4.1.6

### 📝 已知限制

- 仅支持 G1 (Stale Read) 冲突检测
- 需要手动配置 Claude Code Hooks
- 暂不支持文件系统主动监控
- 暂不支持 G2 (Concurrent Write) 和 G3 (Phantom Read) 冲突类型
- 暂不支持批量操作
- 暂不支持查询结果缓存

### 🔜 下一步计划

查看 [README.md](README.md) 中的路线图了解 v0.2+ 的规划。

---

## [Unreleased]

### 计划中的功能

- File System Watcher (v0.2)
- G2/G3 冲突检测 (v0.3)
- Decision Engine (v0.4)
- Web Dashboard (v0.5)

---

[0.1.0]: https://github.com/yourusername/AgentMX/releases/tag/v0.1.0
