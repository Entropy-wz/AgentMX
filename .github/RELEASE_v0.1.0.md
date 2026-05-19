# AgentMX v0.1.0 - Core Foundation 🎉

**First official release!** AgentMX v0.1.0 provides complete cognitive state tracking functionality for AI coding assistants.

## 🚀 What's New

### Core Features

- ✅ **Event-Driven Architecture**: Event Bus + Cognitive Store with SQLite backend
- ✅ **MCP Server Integration**: 7 core tools for seamless Claude Code integration
- ✅ **Automatic Tracking**: Zero-intrusion tracking via Claude Code Hooks
- ✅ **Project-Level Control**: Opt-in mechanism with `.agentmx-enabled` marker
- ✅ **G1 Conflict Detection**: Detects and alerts on stale read scenarios
- ✅ **98% Test Coverage**: Comprehensive test suite with integration and edge case tests

### 7 MCP Tools

| Tool | Purpose |
|------|---------|
| `record_file_read` | Track file read operations |
| `record_file_write` | Track file write operations |
| `check_conflicts` | Detect cognitive conflicts |
| `get_event_history` | Query event logs |
| `get_conflict_history` | Query conflict records |
| `get_file_state` | Get file state snapshots |
| `resolve_conflict` | Mark conflicts as resolved |

### Documentation

- 📖 [Quick Start Guide](QUICKSTART.md) - Get started in 5 minutes
- 📖 [MCP Server Design](docs/MCP_SERVER_DESIGN.md) - Architecture and integration
- 📖 [Tool Reference](docs/TOOL_REFERENCE.md) - Complete API documentation
- 📖 [Project Control](docs/PROJECT_LEVEL_CONTROL.md) - Enable/disable mechanism
- 📖 [Configuration Examples](examples/claude-code-hooks/) - Claude Code Hooks setup

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/AgentMX.git
cd AgentMX

# Install and build
npm install && npm run build
cd mcp-server && npm install && npm run build

# Enable for your project
./agentmx.sh enable
```

## ⚙️ Configuration

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["D:\\path\\to\\AgentMX\\mcp-server\\dist\\index.js"],
      "env": {
        "AGENTMX_AGENT_ID": "claude-desktop"
      }
    }
  }
}
```

### Claude Code Hooks (Automatic Tracking)

Copy the configuration example to your project:

```bash
cp examples/claude-code-hooks/settings.json .claude/settings.json
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

## 📊 Performance

- **Event Recording**: < 5ms (SQLite write)
- **Conflict Detection**: < 10ms (SQLite query)
- **Database Size**: ~1KB per event
- **Concurrency**: SQLite WAL mode support

## 🔒 Security

- ✅ Path validation (files must be within project directory)
- ✅ Permission checks (respects file system permissions)
- ✅ Data isolation (separate database per project)
- ✅ Privacy protection (only stores file hashes, not content)

## 📝 Known Limitations

- Only G1 (Stale Read) conflict detection is supported
- Requires manual Claude Code Hooks configuration
- No active file system monitoring yet
- G2 (Concurrent Write) and G3 (Phantom Read) detection not yet implemented

## 🔜 What's Next

See our [roadmap](README.md#-路线图) for upcoming features:

- **v0.2**: File System Watcher and automatic conflict detection
- **v0.3**: G2/G3 conflict detection
- **v0.4**: Decision Engine and intelligent recovery
- **v0.5**: Production-ready with Web Dashboard

## 📋 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete details.

## 🙏 Acknowledgments

- [Claude Code](https://claude.ai/code) - AI coding assistant
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite library

## 📞 Support

- 🐛 [Report Issues](https://github.com/yourusername/AgentMX/issues)
- 💬 [Discussions](https://github.com/yourusername/AgentMX/discussions)
- 📖 [Documentation](README.md)

---

**Made with ❤️ by AgentMX Contributors and Claude Opus 4.7**
