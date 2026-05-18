# AgentMX

Agent Memory eXchange - Cognitive alignment system for AI coding tools

## Overview

AgentMX is a state synchronization system that tracks the cognitive alignment between AI agents and the actual file system state. It detects when an agent's understanding becomes stale and provides mechanisms to restore alignment.

## Features

- **Event-Driven Architecture**: Pub/sub event bus for decoupled communication
- **Cognitive Store**: SQLite-based storage for file states, agent observations, and conflicts
- **Conflict Detection**: Identifies three types of cognitive conflicts (G1, G2, G3)
- **Event History**: Query and filter historical events

## Installation

```bash
npm install agentmx
```

## Quick Start

```typescript
import { CognitiveStore, EventBus } from 'agentmx';

// Initialize store and event bus
const store = new CognitiveStore('./agentmx.db');
const eventBus = new EventBus(store);

// Subscribe to file state changes
eventBus.subscribe('file_state_changed', (event) => {
  console.log('File changed:', event.file_path);
});

// Record file state
await store.recordFileState({
  file_path: '/project/file.ts',
  content_hash: 'abc123',
  mtime: Date.now(),
  size: 1024,
  is_current: true
});

// Record agent observation
await store.recordObservation({
  agent_id: 'claude-1',
  observation_type: 'file_read',
  file_path: '/project/file.ts',
  content_hash: 'abc123',
  metadata: {}
});

// Detect conflicts
const lastRead = await store.getAgentLastRead('claude-1', '/project/file.ts');
const currentState = await store.getCurrentFileState('/project/file.ts');

if (lastRead?.content_hash !== currentState?.content_hash) {
  await store.recordConflict({
    conflict_type: 'G1_stale_read',
    severity: 'low',
    agent_id: 'claude-1',
    file_path: '/project/file.ts',
    description: 'Agent has stale file state',
    agent_expected_hash: lastRead?.content_hash || null,
    actual_hash: currentState?.content_hash || null
  });
}
```

## Architecture

### Core Components

- **EventBus**: Publish/subscribe event system with persistence
- **CognitiveStore**: SQLite database for state management
- **Event Types**: File system events, agent events, conflict events, decision events

### Conflict Types

- **G1 (Stale Read)**: Agent's last read hash ≠ current file hash
- **G2 (Lost Update)**: External change not caused by agent
- **G3 (Phantom Read)**: Command failed but file changed

## API Reference

### CognitiveStore

```typescript
// File state management
recordFileState(snapshot): Promise<string>
getCurrentFileState(filePath): Promise<FileSnapshot | null>
getFileStateHistory(filePath, limit?): Promise<FileSnapshot[]>

// Agent observation management
recordObservation(observation): Promise<string>
getAgentLastRead(agentId, filePath): Promise<AgentObservation | null>
getAgentObservations(agentId, limit?): Promise<AgentObservation[]>

// Conflict management
recordConflict(conflict): Promise<string>
resolveConflict(conflictId, action): Promise<void>
getUnresolvedConflicts(agentId?): Promise<ConflictRecord[]>
getConflictHistory(filePath?, limit?): Promise<ConflictRecord[]>
```

### EventBus

```typescript
publish(event): Promise<void>
subscribe(eventType, handler): () => void
getEventHistory(filter?): Promise<AgentMXEvent[]>
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Testing

The project includes comprehensive integration tests covering:
- Event publishing and persistence
- Event subscription and unsubscription
- File state management and history
- Agent observation tracking
- Conflict detection scenarios
- Event filtering

Current test coverage: **86.27%** statements, **96.29%** functions

## Version

v0.1.0 - Initial release with Event Bus + Cognitive Store

## License

MIT
