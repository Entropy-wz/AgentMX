import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CognitiveStore } from '../src/core/cognitive-store.js';
import { EventBus } from '../src/core/event-bus.js';
import type {
  FileStateChangedEvent,
  AgentFileReadEvent,
  CognitiveConflictEvent
} from '../src/core/types.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

describe('EventBus + CognitiveStore Integration', () => {
  let store: CognitiveStore;
  let eventBus: EventBus;
  let dbPath: string;

  beforeEach(() => {
    // Create temporary database
    dbPath = path.join(process.cwd(), `test-${uuidv4()}.db`);
    store = new CognitiveStore(dbPath);
    eventBus = new EventBus(store);
  });

  afterEach(async () => {
    await store.close();
    // Clean up test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('Event Publishing and Persistence', () => {
    it('should publish and persist file state changed event', async () => {
      const event: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event);

      const history = await eventBus.getEventHistory({
        event_type: 'file_state_changed',
        limit: 10
      });

      expect(history).toHaveLength(1);
      expect(history[0].event_id).toBe(event.event_id);
      expect(history[0].event_type).toBe('file_state_changed');
    });

    it('should handle multiple event types', async () => {
      const fileEvent: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      const agentEvent: AgentFileReadEvent = {
        event_id: uuidv4(),
        timestamp: Date.now() + 1000,
        project_path: '/test/project',
        event_type: 'agent_file_read',
        agent_id: 'agent-1',
        file_path: '/test/project/file.ts',
        content_hash: 'abc123',
        read_timestamp: Date.now()
      };

      await eventBus.publish(fileEvent);
      await eventBus.publish(agentEvent);

      const allEvents = await eventBus.getEventHistory({ limit: 10 });
      expect(allEvents).toHaveLength(2);

      const fileEvents = await eventBus.getEventHistory({
        event_type: 'file_state_changed',
        limit: 10
      });
      expect(fileEvents).toHaveLength(1);

      const agentEvents = await eventBus.getEventHistory({
        event_type: 'agent_file_read',
        limit: 10
      });
      expect(agentEvents).toHaveLength(1);
    });
  });

  describe('Event Subscription', () => {
    it('should notify subscribers when event is published', async () => {
      let receivedEvent: FileStateChangedEvent | null = null;

      const unsubscribe = eventBus.subscribe<FileStateChangedEvent>(
        'file_state_changed',
        (event) => {
          receivedEvent = event;
        }
      );

      const event: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent?.event_id).toBe(event.event_id);

      unsubscribe();
    });

    it('should support multiple subscribers', async () => {
      const received1: FileStateChangedEvent[] = [];
      const received2: FileStateChangedEvent[] = [];

      eventBus.subscribe<FileStateChangedEvent>('file_state_changed', (e) => received1.push(e));
      eventBus.subscribe<FileStateChangedEvent>('file_state_changed', (e) => received2.push(e));

      const event: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event);

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('should unsubscribe correctly', async () => {
      let callCount = 0;

      const unsubscribe = eventBus.subscribe<FileStateChangedEvent>(
        'file_state_changed',
        () => { callCount++; }
      );

      const event: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event);
      expect(callCount).toBe(1);

      unsubscribe();

      // Create a new event with different ID for second publish
      const event2: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'abc123',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event2);
      expect(callCount).toBe(1); // Should not increment
    });
  });

  describe('File State Management', () => {
    it('should record and retrieve current file state', async () => {
      const snapshotId = await store.recordFileState({
        file_path: '/test/file.ts',
        content_hash: 'hash123',
        mtime: Date.now(),
        size: 1024,
        is_current: true
      });

      expect(snapshotId).toBeTruthy();

      const current = await store.getCurrentFileState('/test/file.ts');
      expect(current).not.toBeNull();
      expect(current?.content_hash).toBe('hash123');
      expect(current?.is_current).toBe(true);
    });

    it('should maintain file state history', async () => {
      const file = '/test/file.ts';

      await store.recordFileState({
        file_path: file,
        content_hash: 'hash1',
        mtime: Date.now(),
        size: 100,
        is_current: true
      });

      await store.recordFileState({
        file_path: file,
        content_hash: 'hash2',
        mtime: Date.now(),
        size: 200,
        is_current: true
      });

      await store.recordFileState({
        file_path: file,
        content_hash: 'hash3',
        mtime: Date.now(),
        size: 300,
        is_current: true
      });

      const history = await store.getFileStateHistory(file, 10);
      expect(history).toHaveLength(3);
      expect(history[0].content_hash).toBe('hash3'); // Most recent first
      expect(history[1].content_hash).toBe('hash2');
      expect(history[2].content_hash).toBe('hash1');

      // Only the latest should be current
      const current = await store.getCurrentFileState(file);
      expect(current?.content_hash).toBe('hash3');
    });
  });

  describe('Agent Observation Management', () => {
    it('should record and retrieve agent observations', async () => {
      const obsId = await store.recordObservation({
        agent_id: 'agent-1',
        observation_type: 'file_read',
        file_path: '/test/file.ts',
        content_hash: 'hash123',
        metadata: { line_count: 100 }
      });

      expect(obsId).toBeTruthy();

      const lastRead = await store.getAgentLastRead('agent-1', '/test/file.ts');
      expect(lastRead).not.toBeNull();
      expect(lastRead?.content_hash).toBe('hash123');
      expect(lastRead?.metadata.line_count).toBe(100);
    });

    it('should track multiple agent reads', async () => {
      const file = '/test/file.ts';
      const agent = 'agent-1';

      await store.recordObservation({
        agent_id: agent,
        observation_type: 'file_read',
        file_path: file,
        content_hash: 'hash1',
        metadata: {}
      });

      await store.recordObservation({
        agent_id: agent,
        observation_type: 'file_read',
        file_path: file,
        content_hash: 'hash2',
        metadata: {}
      });

      const lastRead = await store.getAgentLastRead(agent, file);
      expect(lastRead?.content_hash).toBe('hash2'); // Most recent

      const allObs = await store.getAgentObservations(agent, 10);
      expect(allObs).toHaveLength(2);
    });
  });

  describe('Conflict Detection Scenario', () => {
    it('should detect G1 stale read conflict', async () => {
      const file = '/test/file.ts';
      const agent = 'agent-1';

      // 1. Agent reads file
      await store.recordObservation({
        agent_id: agent,
        observation_type: 'file_read',
        file_path: file,
        content_hash: 'hash1',
        metadata: {}
      });

      await store.recordFileState({
        file_path: file,
        content_hash: 'hash1',
        mtime: Date.now(),
        size: 100,
        is_current: true
      });

      // 2. File changes externally
      await store.recordFileState({
        file_path: file,
        content_hash: 'hash2',
        mtime: Date.now(),
        size: 200,
        is_current: true
      });

      // 3. Detect conflict
      const lastRead = await store.getAgentLastRead(agent, file);
      const currentState = await store.getCurrentFileState(file);

      expect(lastRead?.content_hash).toBe('hash1');
      expect(currentState?.content_hash).toBe('hash2');
      expect(lastRead?.content_hash).not.toBe(currentState?.content_hash);

      // 4. Record conflict
      const conflictId = await store.recordConflict({
        conflict_type: 'G1_stale_read',
        severity: 'low',
        agent_id: agent,
        file_path: file,
        description: 'Agent read hash1 but current is hash2',
        agent_expected_hash: 'hash1',
        actual_hash: 'hash2'
      });

      expect(conflictId).toBeTruthy();

      const conflicts = await store.getUnresolvedConflicts(agent);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflict_type).toBe('G1_stale_read');
    });

    it('should resolve conflicts', async () => {
      const conflictId = await store.recordConflict({
        conflict_type: 'G2_lost_update',
        severity: 'medium',
        agent_id: 'agent-1',
        file_path: '/test/file.ts',
        description: 'Test conflict',
        agent_expected_hash: 'hash1',
        actual_hash: 'hash2'
      });

      let unresolved = await store.getUnresolvedConflicts();
      expect(unresolved).toHaveLength(1);

      await store.resolveConflict(conflictId, 'auto_refresh');

      unresolved = await store.getUnresolvedConflicts();
      expect(unresolved).toHaveLength(0);

      const history = await store.getConflictHistory();
      expect(history).toHaveLength(1);
      expect(history[0].resolved_at).not.toBeNull();
      expect(history[0].resolution_action).toBe('auto_refresh');
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by time range', async () => {
      const now = Date.now();

      await eventBus.publish({
        event_id: uuidv4(),
        timestamp: now - 2000,
        project_path: '/test',
        event_type: 'file_state_changed',
        file_path: '/test/file1.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: now - 2000,
        change_type: 'created'
      });

      await eventBus.publish({
        event_id: uuidv4(),
        timestamp: now,
        project_path: '/test',
        event_type: 'file_state_changed',
        file_path: '/test/file2.ts',
        old_hash: null,
        new_hash: 'hash2',
        old_mtime: null,
        new_mtime: now,
        change_type: 'created'
      });

      const recent = await eventBus.getEventHistory({
        start_time: now - 1000,
        limit: 10
      });

      expect(recent).toHaveLength(1);
      expect((recent[0] as FileStateChangedEvent).file_path).toBe('/test/file2.ts');
    });

    it('should filter events by file path', async () => {
      await eventBus.publish({
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test',
        event_type: 'file_state_changed',
        file_path: '/test/file1.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      });

      await eventBus.publish({
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test',
        event_type: 'file_state_changed',
        file_path: '/test/file2.ts',
        old_hash: null,
        new_hash: 'hash2',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      });

      const filtered = await eventBus.getEventHistory({
        file_path: '/test/file1.ts',
        limit: 10
      });

      expect(filtered).toHaveLength(1);
      expect((filtered[0] as FileStateChangedEvent).file_path).toBe('/test/file1.ts');
    });
  });
});
