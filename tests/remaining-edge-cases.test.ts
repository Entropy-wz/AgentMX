import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CognitiveStore } from '../src/core/cognitive-store';
import { EventBus } from '../src/core/event-bus';
import { FileStateChangedEvent } from '../src/core/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

describe('Remaining Edge Cases', () => {
  let store: CognitiveStore;
  let eventBus: EventBus;
  const testDbPath = './test-remaining.db';

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

  describe('CognitiveStore Edge Cases', () => {
    it('should handle recordFileState with is_current=true (line 89-91)', async () => {
      // Record first snapshot as current
      const snapshot1Id = await store.recordFileState({
        file_path: '/test/file.ts',
        content_hash: 'hash1',
        mtime: Date.now(),
        size: 100,
        is_current: true
      });

      // Verify it's current
      const current1 = await store.getCurrentFileState('/test/file.ts');
      expect(current1?.snapshot_id).toBe(snapshot1Id);
      expect(current1?.is_current).toBe(true);

      // Record second snapshot as current (should mark first as not current)
      const snapshot2Id = await store.recordFileState({
        file_path: '/test/file.ts',
        content_hash: 'hash2',
        mtime: Date.now(),
        size: 200,
        is_current: true
      });

      // Verify second is now current
      const current2 = await store.getCurrentFileState('/test/file.ts');
      expect(current2?.snapshot_id).toBe(snapshot2Id);
      expect(current2?.content_hash).toBe('hash2');

      // Verify history shows both
      const history = await store.getFileStateHistory('/test/file.ts');
      expect(history.length).toBe(2);
    });

    it('should return null when getCurrentFileState finds no current state (line 118)', async () => {
      // Record a non-current snapshot
      await store.recordFileState({
        file_path: '/test/file.ts',
        content_hash: 'hash1',
        mtime: Date.now(),
        size: 100,
        is_current: false
      });

      // Should return null since no current state
      const current = await store.getCurrentFileState('/test/file.ts');
      expect(current).toBeNull();
    });

    it('should return null when getAgentLastRead finds no observation (line 182)', async () => {
      // Query for non-existent agent observation
      const lastRead = await store.getAgentLastRead('non-existent-agent', '/test/file.ts');
      expect(lastRead).toBeNull();
    });
  });

  describe('EventBus Edge Cases', () => {
    it('should throw error when querying history without store (line 44)', async () => {
      // Create EventBus without store
      const busWithoutStore = new EventBus();

      // Should throw error
      await expect(busWithoutStore.getEventHistory()).rejects.toThrow(
        'EventBus: Cannot query event history without a CognitiveStore'
      );
    });

    it('should filter by project_path (line 85-87)', async () => {
      const event1: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/project1',
        event_type: 'file_state_changed',
        file_path: '/project1/file.ts',
        old_hash: null,
        new_hash: 'hash1',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      const event2: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path: '/project2',
        event_type: 'file_state_changed',
        file_path: '/project2/file.ts',
        old_hash: null,
        new_hash: 'hash2',
        old_mtime: null,
        new_mtime: Date.now(),
        change_type: 'created'
      };

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      // Filter by project_path
      const project1Events = await eventBus.getEventHistory({
        project_path: '/project1'
      });

      expect(project1Events.length).toBe(1);
      expect(project1Events[0].event_id).toBe(event1.event_id);
    });
  });
});
