# AgentMX MCP Server

MCP Server that exposes AgentMX cognitive state tracking to Claude.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

### For Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "agentmx": {
      "command": "node",
      "args": ["/absolute/path/to/AgentMX/mcp-server/dist/index.js"],
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

### Environment Variables

- `AGENTMX_DB_PATH`: Path to SQLite database (default: `~/.agentmx/db/agentmx.db`)
- `AGENTMX_AGENT_ID`: Agent identifier (default: `claude-main`)
- `AGENTMX_AUTO_TRACK`: Enable auto-tracking instructions (default: `false`)
- `AGENTMX_LOG_LEVEL`: Log level - ERROR, WARN, INFO, DEBUG (default: `INFO`)

## Available Tools

### record_file_read

Record that the agent read a file.

**Parameters:**
- `file_path` (required): Absolute path to the file
- `content_hash` (required): SHA-256 hash of the content
- `agent_id` (optional): Agent identifier
- `project_path` (optional): Project root path

**Example:**
```typescript
await record_file_read({
  file_path: '/path/to/file.ts',
  content_hash: 'abc123...'
});
```

### check_conflicts

Check for cognitive conflicts before writing.

**Parameters:**
- `file_path` (required): Absolute path to the file
- `agent_id` (optional): Agent identifier
- `project_path` (optional): Project root path

**Example:**
```typescript
const result = await check_conflicts({
  file_path: '/path/to/file.ts'
});

if (result.has_conflict) {
  // Re-read the file
}
```

### record_file_write

Record that the agent wrote to a file.

**Parameters:**
- `file_path` (required): Absolute path to the file
- `new_hash` (required): SHA-256 hash after write
- `old_hash` (optional): SHA-256 hash before write
- `agent_id` (optional): Agent identifier
- `project_path` (optional): Project root path

### get_event_history

Query event history.

**Parameters:**
- `file_path` (optional): Filter by file
- `agent_id` (optional): Filter by agent
- `event_type` (optional): Filter by event type
- `start_time` (optional): Start timestamp
- `end_time` (optional): End timestamp
- `limit` (optional): Max results (default: 50)

### get_conflict_history

Query conflict history.

**Parameters:**
- `file_path` (optional): Filter by file
- `agent_id` (optional): Filter by agent
- `limit` (optional): Max results (default: 50)

### get_file_state

Get current file state and history.

**Parameters:**
- `file_path` (required): Absolute path to the file
- `include_history` (optional): Include historical snapshots
- `history_limit` (optional): Max history entries (default: 10)

### resolve_conflict

Mark a conflict as resolved.

**Parameters:**
- `conflict_id` (required): Conflict ID
- `resolution_action` (required): Action taken (prompt_reread, abort_and_replan, verify_and_rollback, user_override)
- `notes` (optional): Resolution notes

## Resources

### agentmx://auto-track-instructions

Instructions for automatically tracking cognitive state. Claude will load this resource when `AGENTMX_AUTO_TRACK=true`.

## Testing

```bash
# Start the server manually
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Troubleshooting

### Server not starting

Check logs:
```bash
AGENTMX_LOG_LEVEL=DEBUG node dist/index.js
```

### Database locked

Ensure no other processes are using the database:
```bash
lsof ~/.agentmx/db/agentmx.db
```

### Tools not appearing in Claude

1. Verify MCP server is configured in settings.json
2. Restart Claude Code
3. Check Claude Code logs for MCP connection errors

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Test with sample input
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## License

MIT
