#!/usr/bin/env node

/**
 * AgentMX MCP Server
 *
 * Exposes AgentMX cognitive state tracking functionality to Claude via MCP.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CognitiveStore } from '../../dist/core/cognitive-store.js';
import { EventBus } from '../../dist/core/event-bus.js';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Environment configuration
const AGENTMX_DB_PATH = process.env.AGENTMX_DB_PATH || path.join(os.homedir(), '.agentmx', 'db', 'agentmx.db');
const AGENTMX_AGENT_ID = process.env.AGENTMX_AGENT_ID || 'claude-main';
const AGENTMX_AUTO_TRACK = process.env.AGENTMX_AUTO_TRACK === 'true';
const AGENTMX_LOG_LEVEL = process.env.AGENTMX_LOG_LEVEL || 'INFO';

// Logging utility
function log(level: string, message: string, data?: any) {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  const currentLevel = levels.indexOf(AGENTMX_LOG_LEVEL);
  const messageLevel = levels.indexOf(level);

  if (messageLevel <= currentLevel) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.error(logMessage);
    if (data) {
      console.error(JSON.stringify(data, null, 2));
    }
  }
}

// Helper function to compute hash
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// Initialize AgentMX
let store: CognitiveStore;
let eventBus: EventBus;

try {
  // Ensure directory exists
  const dbDir = path.dirname(AGENTMX_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  store = new CognitiveStore(AGENTMX_DB_PATH);
  eventBus = new EventBus(store);
  log('INFO', 'AgentMX initialized', { dbPath: AGENTMX_DB_PATH, agentId: AGENTMX_AGENT_ID });
} catch (error) {
  log('ERROR', 'Failed to initialize AgentMX', error);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'agentmx',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ============================================================================
// Tools
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'record_file_read',
        description: 'Record that the agent read a file. Call this after reading any file to track cognitive state.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file that was read',
            },
            content_hash: {
              type: 'string',
              description: 'SHA-256 hash of the file content',
            },
            agent_id: {
              type: 'string',
              description: 'Agent identifier (optional, defaults to environment variable)',
            },
            project_path: {
              type: 'string',
              description: 'Project root path (optional, defaults to current working directory)',
            },
          },
          required: ['file_path', 'content_hash'],
        },
      },
      {
        name: 'record_file_write',
        description: 'Record that the agent wrote to a file. Call this after writing to any file.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file that was written',
            },
            old_hash: {
              type: 'string',
              description: 'SHA-256 hash of the file content before write (null if new file)',
            },
            new_hash: {
              type: 'string',
              description: 'SHA-256 hash of the file content after write',
            },
            agent_id: {
              type: 'string',
              description: 'Agent identifier (optional)',
            },
            project_path: {
              type: 'string',
              description: 'Project root path (optional)',
            },
          },
          required: ['file_path', 'new_hash'],
        },
      },
      {
        name: 'check_conflicts',
        description: 'Check if there are any cognitive conflicts for a file. Call this before writing to ensure your understanding is current.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file to check',
            },
            agent_id: {
              type: 'string',
              description: 'Agent identifier (optional)',
            },
            project_path: {
              type: 'string',
              description: 'Project root path (optional)',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'get_event_history',
        description: 'Query the event history. Useful for understanding what happened to a file or what an agent did.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Filter by file path',
            },
            agent_id: {
              type: 'string',
              description: 'Filter by agent ID',
            },
            event_type: {
              type: 'string',
              description: 'Filter by event type',
            },
            start_time: {
              type: 'number',
              description: 'Filter by start timestamp (milliseconds)',
            },
            end_time: {
              type: 'number',
              description: 'Filter by end timestamp (milliseconds)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of events to return (default: 50)',
            },
            project_path: {
              type: 'string',
              description: 'Filter by project path',
            },
          },
        },
      },
      {
        name: 'get_conflict_history',
        description: 'Query the conflict history. Useful for understanding past cognitive misalignments.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Filter by file path',
            },
            agent_id: {
              type: 'string',
              description: 'Filter by agent ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of conflicts to return (default: 50)',
            },
          },
        },
      },
      {
        name: 'get_file_state',
        description: 'Get the current state and history of a file.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the file',
            },
            include_history: {
              type: 'boolean',
              description: 'Include historical snapshots (default: false)',
            },
            history_limit: {
              type: 'number',
              description: 'Maximum number of historical snapshots (default: 10)',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'resolve_conflict',
        description: 'Mark a conflict as resolved with a specific action.',
        inputSchema: {
          type: 'object',
          properties: {
            conflict_id: {
              type: 'string',
              description: 'The conflict ID to resolve',
            },
            resolution_action: {
              type: 'string',
              enum: ['prompt_reread', 'abort_and_replan', 'verify_and_rollback', 'user_override'],
              description: 'The action taken to resolve the conflict',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the resolution',
            },
          },
          required: ['conflict_id', 'resolution_action'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'record_file_read': {
        const { file_path, content_hash, agent_id = AGENTMX_AGENT_ID, project_path = process.cwd() } = args as any;

        log('DEBUG', 'record_file_read', { file_path, content_hash, agent_id });

        // Record observation
        const observation_id = await store.recordObservation({
          agent_id,
          observation_type: 'file_read',
          file_path,
          content_hash,
          metadata: { project_path },
        });

        // Publish event
        await eventBus.publish({
          event_id: crypto.randomUUID(),
          timestamp: Date.now(),
          project_path,
          event_type: 'agent_file_read',
          agent_id,
          file_path,
          content_hash,
          read_timestamp: Date.now(),
        });

        // Check for potential conflicts
        const currentState = await store.getCurrentFileState(file_path);
        const potential_conflicts = [];

        if (currentState && currentState.content_hash !== content_hash) {
          potential_conflicts.push({
            conflict_type: 'G1_stale_read',
            description: `File state has changed since last observation. Current hash: ${currentState.content_hash.substring(0, 16)}..., Your hash: ${content_hash.substring(0, 16)}...`,
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                observation_id,
                message: 'File read recorded successfully',
                potential_conflicts: potential_conflicts.length > 0 ? potential_conflicts : undefined,
              }, null, 2),
            },
          ],
        };
      }

      case 'record_file_write': {
        const { file_path, old_hash, new_hash, agent_id = AGENTMX_AGENT_ID, project_path = process.cwd() } = args as any;

        log('DEBUG', 'record_file_write', { file_path, old_hash, new_hash, agent_id });

        // Record file state
        await store.recordFileState({
          file_path,
          content_hash: new_hash,
          mtime: Date.now(),
          size: 0, // Size not provided in this context
          is_current: true,
        });

        // Record observation
        await store.recordObservation({
          agent_id,
          observation_type: 'operation',
          file_path,
          content_hash: new_hash,
          metadata: { old_hash, project_path, operation: 'write' },
        });

        // Publish event
        await eventBus.publish({
          event_id: crypto.randomUUID(),
          timestamp: Date.now(),
          project_path,
          event_type: 'file_state_changed',
          file_path,
          old_hash: old_hash || null,
          new_hash,
          old_mtime: null,
          new_mtime: Date.now(),
          change_type: old_hash ? 'modified' : 'created',
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'File write recorded successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'check_conflicts': {
        const { file_path, agent_id = AGENTMX_AGENT_ID, project_path = process.cwd() } = args as any;

        log('DEBUG', 'check_conflicts', { file_path, agent_id });

        const lastRead = await store.getAgentLastRead(agent_id, file_path);
        const currentState = await store.getCurrentFileState(file_path);

        const conflicts = [];

        if (lastRead && currentState && lastRead.content_hash !== currentState.content_hash) {
          const conflict_id = await store.recordConflict({
            conflict_type: 'G1_stale_read',
            severity: 'medium',
            agent_id,
            file_path,
            description: 'Agent has stale file state - file was modified after agent read it',
            agent_expected_hash: lastRead.content_hash,
            actual_hash: currentState.content_hash,
          });

          conflicts.push({
            conflict_id,
            conflict_type: 'G1_stale_read',
            severity: 'medium',
            description: 'Your understanding of this file is outdated. The file has been modified since you last read it.',
            agent_expected_hash: lastRead.content_hash,
            actual_hash: currentState.content_hash,
            detected_at: Date.now(),
            recommended_action: 'Re-read the file before making changes to ensure you have the latest content.',
          });

          log('WARN', 'Conflict detected', { conflict_id, file_path, agent_id });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                has_conflict: conflicts.length > 0,
                conflicts,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_event_history': {
        const { file_path, agent_id, event_type, start_time, end_time, limit = 50, project_path } = args as any;

        log('DEBUG', 'get_event_history', { file_path, agent_id, event_type, limit });

        const events = await eventBus.getEventHistory({
          file_path,
          agent_id,
          event_type,
          start_time,
          end_time,
          limit,
          project_path,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                events: events.map((e: any) => ({
                  event_id: e.event_id,
                  event_type: e.event_type,
                  timestamp: e.timestamp,
                  file_path: (e as any).file_path,
                  agent_id: (e as any).agent_id,
                  details: e,
                })),
                total_count: events.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_conflict_history': {
        const { file_path, agent_id, limit = 50 } = args as any;

        log('DEBUG', 'get_conflict_history', { file_path, agent_id, limit });

        let conflicts = await store.getConflictHistory(file_path, limit);

        if (agent_id) {
          conflicts = conflicts.filter((c: any) => c.agent_id === agent_id);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                conflicts,
                total_count: conflicts.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_file_state': {
        const { file_path, include_history = false, history_limit = 10 } = args as any;

        log('DEBUG', 'get_file_state', { file_path, include_history });

        const current_state = await store.getCurrentFileState(file_path);
        let history = undefined;

        if (include_history) {
          history = await store.getFileStateHistory(file_path, history_limit);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_state,
                history,
              }, null, 2),
            },
          ],
        };
      }

      case 'resolve_conflict': {
        const { conflict_id, resolution_action, notes } = args as any;

        log('DEBUG', 'resolve_conflict', { conflict_id, resolution_action });

        await store.resolveConflict(conflict_id, resolution_action);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Conflict ${conflict_id} resolved with action: ${resolution_action}`,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    log('ERROR', `Tool execution failed: ${name}`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TOOL_EXECUTION_ERROR',
              message: error.message,
              details: error.stack,
            },
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Resources
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'agentmx://auto-track-instructions',
        name: 'AgentMX Auto-Track Instructions',
        description: 'Instructions for automatically tracking cognitive state',
        mimeType: 'text/plain',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'agentmx://auto-track-instructions') {
    const instructions = `
# AgentMX Cognitive State Tracking

You are working with AgentMX, a system that tracks your cognitive state to prevent errors from stale information.

## Workflow

1. **After reading any file:**
   - Call \`record_file_read\` with the file path and content hash
   - Note any potential conflicts returned

2. **Before writing to any file:**
   - Call \`check_conflicts\` for that file
   - If conflicts exist, re-read the file first to get the latest content

3. **After writing to any file:**
   - Call \`record_file_write\` with old hash and new hash

4. **If you encounter unexpected file content:**
   - Call \`get_event_history\` to see what changed
   - Call \`get_conflict_history\` to check for past issues

## Why This Matters

Files can be modified by:
- Other AI agents working in parallel
- Users editing files manually
- External processes (build tools, formatters, etc.)

AgentMX ensures your understanding stays aligned with reality, preventing bugs from stale reads.

## Example

\`\`\`
// Read file
const content = await Read('/path/to/file.ts');
const hash = computeHash(content);

// Track the read
await record_file_read({ file_path: '/path/to/file.ts', content_hash: hash });

// Before writing, check for conflicts
const check = await check_conflicts({ file_path: '/path/to/file.ts' });

if (check.has_conflict) {
  // Re-read to get latest content
  const newContent = await Read('/path/to/file.ts');
  // ... re-analyze and proceed
} else {
  // Safe to write
  await Write('/path/to/file.ts', modifiedContent);
  await record_file_write({
    file_path: '/path/to/file.ts',
    old_hash: hash,
    new_hash: computeHash(modifiedContent)
  });
}
\`\`\`
`.trim();

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: instructions,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ============================================================================
// Prompts
// ============================================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'agentmx-workflow',
        description: 'Workflow for using AgentMX cognitive state tracking',
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === 'agentmx-workflow') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please follow the AgentMX cognitive state tracking workflow. After reading files, call record_file_read. Before writing files, call check_conflicts. After writing files, call record_file_write.',
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('INFO', 'AgentMX MCP Server started', {
    autoTrack: AGENTMX_AUTO_TRACK,
    agentId: AGENTMX_AGENT_ID,
  });
}

main().catch((error) => {
  log('ERROR', 'Server failed to start', error);
  process.exit(1);
});
