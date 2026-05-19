import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CognitiveStore } from '../src/core/cognitive-store';
import { EventBus } from '../src/core/event-bus';
import { FileStateChangedEvent } from '../src/core/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

describe('Edge Cases and Uncovered Code Paths', () => {
  let store: CognitiveStore;
  let eventBus: EventBus;
  const testDbPath = './test-edge-cases.db';

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    store = new CognitiveStore(testDbPath);
    eventBus = new EventBus(store);
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('EventBus Query Filters', () => {
    it('should filter events by time range (start_time and end_time)', async () => {
      const baseTime = Date.now();

      // Event 1: at baseTime
      const event1: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: baseTime,
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file1.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: baseTime,
        change_type: 'created'
      };

      // Event 2: at baseTime + 1000
      const event2: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: baseTime + 1000,
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file2.ts',
        old_hash: null,
        new_hash: 'hash2',
        old_mtime: null,
        new_mtime: baseTime + 1000,
        change_type: 'created'
      };

      // Event 3: at baseTime + 2000
      const event3: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: baseTime + 2000,
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file3.ts',
        old_hash: null,
        new_hash: 'hash3',
        old_mtime: null,
        new_mtime: baseTime + 2000,
        change_type: 'created'
      };

      await eventBus.publish(event1);
      await eventBus.publish(event2);
      await eventBus.publish(event3);

      // Test start_time filter (line 90-92)
      const afterStart = await eventBus.getEventHistory({
        start_time: baseTime + 500
      });
      expect(afterStart.length).toBe(2);
      expect(afterStart.map(e => e.event_id)).toContain(event2.event_id);
      expect(afterStart.map(e => e.event_id)).toContain(event3.event_id);

      // Test end_time filter (line 95-97)
      const beforeEnd = await eventBus.getEventHistory({
        end_time: baseTime + 1500
      });
      expect(beforeEnd.length).toBe(2);
      expect(beforeEnd.map(e => e.event_id)).toContain(event1.event_id);
      expect(beforeEnd.map(e => e.event_id)).toContain(event2.event_id);

      // Test both start_time and end_time
      const inRange = await eventBus.getEventHistory({
        start_time: baseTime + 500,
        end_time: baseTime + 1500
      });
      expect(inRange.length).toBe(1);
      expect(inRange[0].event_id).toBe(event2.event_id);
    });

    it('should filter events by agent_id (line 120-124)', async () => {
      const event1: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      // Create an agent operation event with agent_id
      const agentEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'agent_operation' as const,
        agent_id: 'claude-1',
        operation_type: 'file_write' as const,
        file_path: '/test/project/file.ts',
        success: true
      };

      await eventBus.publish(event1);
      await eventBus.publish(agentEvent);

      // Filter by agent_id
      const agentEvents = await eventBus.getEventHistory({
        agent_id: 'claude-1'
      });

      expect(agentEvents.length).toBe(1);
      expect(agentEvents[0].event_id).toBe(agentEvent.event_id);
    });
  });

  describe('CognitiveStore Conflict History', () => {
    it('should filter conflict history by file_path (line 282-284)', async () => {
      // Record conflicts for different files
      const conflict1Id = await store.recordConflict({
        conflict_type: 'G1_stale_read',
        severity: 'medium',
        agent_id: 'claude-1',
        file_path: '/test/project/file1.ts',
        description: 'Conflict in file1',
        agent_expected_hash: 'old_hash1',
        actual_hash: 'new_hash1'
      });

      const conflict2Id = await store.recordConflict({
        conflict_type: 'G1_stale_read',
        severity: 'medium',
        agent_id: 'claude-1',
        file_path: '/test/project/file2.ts',
        description: 'Conflict in file2',
        agent_expected_hash: 'old_hash2',
        actual_hash: 'new_hash2'
      });

      const conflict3Id = await store.recordConflict({
        conflict_type: 'G2_concurrent_write',
        severity: 'high',
        agent_id: 'claude-2',
        file_path: '/test/project/file1.ts',
        description: 'Another conflict in file1',
        agent_expected_hash: 'old_hash3',
        actual_hash: 'new_hash3'
      });

      // Get all conflicts (no filter)
      const allConflicts = await store.getConflictHistory();
      expect(allConflicts.length).toBe(3);

      // Filter by file_path (this exercises line 282-284)
      const file1Conflicts = await store.getConflictHistory('/test/project/file1.ts');
      expect(file1Conflicts.length).toBe(2);
      expect(file1Conflicts.map(c => c.conflict_id)).toContain(conflict1Id);
      expect(file1Conflicts.map(c => c.conflict_id)).toContain(conflict3Id);

      const file2Conflicts = await store.getConflictHistory('/test/project/file2.ts');
      expect(file2Conflicts.length).toBe(1);
      expect(file2Conflicts[0].conflict_id).toBe(conflict2Id);
    });

    it('should respect limit parameter in conflict history', async () => {
      // Record multiple conflicts
      for (let i = 0; i < 10; i++) {
        await store.recordConflict({
          conflict_type: 'G1_stale_read',
          severity: 'low',
          agent_id: 'claude-1',
          file_path: `/test/project/file${i}.ts`,
          description: `Conflict ${i}`,
          agent_expected_hash: `old_hash${i}`,
          actual_hash: `new_hash${i}`
        });
      }

      // Test default limit (50)
      const defaultLimit = await store.getConflictHistory();
      expect(defaultLimit.length).toBe(10);

      // Test custom limit
      const limited = await store.getConflictHistory(undefined, 5);
      expect(limited.length).toBe(5);
    });
  });

  describe('EventBus file_path Filter', () => {
    it('should filter events by file_path (line 113-117)', async () => {
      const event1: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file1.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      const event2: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/test/project',
        event_type: 'file_state_changed',
        file_path: '/test/project/file2.ts',
        old_hash: null,
        new_hash: 'hash2',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      // Filter by file_path
      const file1Events = await eventBus.getEventHistory({
        file_path: '/test/project/file1.ts'
      });

      expect(file1Events.length).toBe(1);
      expect(file1Events[0].event_id).toBe(event1.event_id);
    });
  });
});
