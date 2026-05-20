# AgentMX v0.2.0 Release Notes

**Release Date:** May 20, 2026

## 🎉 Overview

AgentMX v0.2.0 introduces **real-time file system monitoring** and **automatic conflict detection**, transforming AgentMX from a semi-automatic tracking system to a fully automatic one. Agents no longer need to manually check for conflicts—AgentMX detects them automatically when files change.

## ✨ Major Features

### 1. File System Watcher (`FileSystemWatcher`)
- **Real-time monitoring** using Chokidar
- **Multi-project support**: Watch multiple projects simultaneously
- **Smart debouncing**: 100ms per-file, 500ms maxWait to avoid duplicate events
- **Configurable ignore patterns**: Skip node_modules, .git, dist, build, coverage, .agentmx.db
- **Event-driven**: Publishes `FileMightChangedEvent` to EventBus

**Usage:**
```typescript
const watcher = new FileSystemWatcher(eventBus);
await watcher.watch('/path/to/project');
// Automatically detects file changes and publishes events
```

### 2. File State Scanner (`FileStateScanner`)
- **Automatic hash computation**: SHA-256 stream-based hashing
- **Large file support**: Memory-efficient streaming for files >1MB
- **State tracking**: Records file snapshots to database
- **Change detection**: Only publishes events when content actually changes
- **Batch operations**: Scan multiple files efficiently

**Key Methods:**
- `scanFile(filePath)`: Compute hash and metadata for a single file
- `scanFiles(filePaths)`: Batch scan multiple files

### 3. Conflict Detector (`ConflictDetector`)
- **Automatic G1 detection**: Detects stale reads without manual checks
- **Multi-agent support**: Detects conflicts for all agents with observations
- **Event-driven**: Subscribes to `FileStateChangedEvent`
- **Database recording**: Automatically records conflicts to database
- **Deletion handling**: Detects conflicts when files are deleted

**Conflict Type:**
- **G1 (Stale Read)**: Agent read file, then file changed externally
  - Severity: Medium
  - Automatic detection: ✅ Yes
  - Recovery: Prompt agent to re-read file

### 4. Batch Operations
- **EventBus.publishBatch()**: Publish multiple events in a single transaction
- **CognitiveStore.recordFileStateBatch()**: Record multiple file states atomically
- **Performance**: Reduces SQLite transaction overhead for bulk operations

### 5. Hash Utilities
- **computeFileHash(filePath)**: Stream-based SHA-256 hashing
- **computeContentHash(content)**: In-memory hashing for strings/buffers
- **computeFileHashWithStats(filePath)**: Hash + file metadata (size, mtime)

## 📊 Test Coverage

**Total Tests:** 107 passing
- **Unit Tests:** 74 tests across 4 components
  - hash-utils: 22 tests
  - file-state-scanner: 17 tests
  - conflict-detector: 15 tests
  - file-system-watcher: 20 tests
- **Integration Tests:** 7 tests for end-to-end workflows
- **v0.1 Tests:** 26 tests (no regressions)

**Coverage:** >80% for all v0.2 components

## 🔄 Event Flow

```
FileSystemWatcher
    ↓ (FileMightChangedEvent)
FileStateScanner
    ↓ (FileStateChangedEvent)
ConflictDetector
    ↓ (CognitiveConflictEvent)
EventBus → CognitiveStore (database)
```

## 🚀 New MCP Tools

### `start_watching`
Start watching a project for file changes.

**Parameters:**
- `project_path` (required): Path to project directory

**Example:**
```bash
mcp_call start_watching --project_path /path/to/project
```

**Response:**
```json
{
  "success": true,
  "data": {
    "project_path": "/path/to/project",
    "watching": true,
    "message": "Started watching project"
  }
}
```

### `stop_watching`
Stop watching a project.

**Parameters:**
- `project_path` (required): Path to project directory

## 📦 Dependencies Added

- `chokidar@^3.6.0`: File system watching
- `lodash.debounce@^4.0.8`: Event debouncing

## 🔧 Technical Improvements

### Architecture
- **Event-driven**: All components communicate via EventBus
- **Decoupled**: Watcher, Scanner, Detector are independent
- **Scalable**: Supports multiple projects and agents

### Performance
- **Stream-based hashing**: Memory-efficient for large files
- **Batch operations**: Reduced database transaction overhead
- **Debouncing**: Prevents duplicate event processing

### Reliability
- **Comprehensive testing**: 107 tests with >80% coverage
- **Error handling**: Graceful handling of file system errors
- **Database transactions**: Atomic batch operations

## 📝 Known Limitations

1. **G1 Only**: Only detects stale reads (G2/G3 planned for v0.3)
2. **Opt-in Watching**: Requires explicit `start_watching` call per project
3. **No Auto-start**: File watching doesn't start automatically on server startup
4. **Single Process**: Watcher runs in same process as MCP server

## 🔜 Roadmap

### v0.3 (Planned)
- **G2 Conflict Detection**: Lost updates (concurrent writes)
- **G3 Conflict Detection**: Phantom reads (file deletion)
- **Cross-file Dependencies**: Track file relationships

### v0.4 (Planned)
- **Decision Engine**: Intelligent conflict resolution
- **Recovery Strategies**: Automatic conflict recovery
- **Conflict Prioritization**: Handle multiple conflicts

### v0.5 (Planned)
- **Web Dashboard**: Visual conflict monitoring
- **Production Features**: Clustering, persistence, monitoring
- **Advanced Analytics**: Conflict patterns and trends

## 🛠️ Migration from v0.1

### Breaking Changes
None. v0.2 is fully backward compatible with v0.1.

### New Workflow
**Before (v0.1):**
```typescript
// Manual tracking
await store.recordObservation({...});
const conflicts = await store.checkConflicts(filePath);
```

**After (v0.2):**
```typescript
// Automatic tracking
const watcher = new FileSystemWatcher(eventBus);
await watcher.watch(projectPath);
// Conflicts detected automatically!
```

## 📚 Documentation

- **README.md**: Project overview and quick start
- **CLAUDE.md**: Development guidelines and architecture
- **docs/TESTING_GUIDE.md**: Testing procedures
- **docs/superpowers/specs/**: Detailed design documents

## 🐛 Bug Fixes

- Fixed module loading issue with stale compiled files
- Fixed conflict detection for deleted files
- Fixed file state recording in integration tests

## 📋 Verification Checklist

- ✅ All 107 tests passing
- ✅ >80% code coverage for v0.2 components
- ✅ No regressions in v0.1 tests
- ✅ CHANGELOG.md updated
- ✅ Dependencies added to package.json
- ✅ TypeScript compilation successful
- ✅ MCP tools implemented and tested
- ✅ Documentation updated

## 🎯 Getting Started

### Installation
```bash
npm install
npm run build
```

### Running Tests
```bash
npm test                    # Run all tests
npm run test:coverage       # Generate coverage report
npm run test:watch         # Watch mode
```

### Demo
```bash
npm run demo:g1            # G1 conflict demo
npm run demo:interactive   # Interactive CLI
```

### Using in MCP Server
```bash
cd mcp-server
npm install
npm run build
npm run dev
```

## 📞 Support

For issues, questions, or feedback:
- Check [CLAUDE.md](CLAUDE.md) for development guidelines
- Review [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for testing procedures
- See [README.md](README.md) for architecture overview

---

**AgentMX v0.2.0** - Automatic Conflict Detection for AI Agents
