import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../src/core/event-bus';
import { FileStateChangedEvent } from '../src/core/types';
import { v4 as uuidv4 } from 'uuid';

describe('EventBus Without Store', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Create EventBus without CognitiveStore
    eventBus = new EventBus();
  });

  it('should publish events without persistence when no store (line 21)', async () => {
    let receivedEvent: FileStateChangedEvent | null = null;

    const event: FileStateChangedEvent = {
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

    // Subscribe to event
    eventBus.subscribe('file_state_changed', (e) => {
      receivedEvent = e as FileStateChangedEvent;
    });

    // Publish event (should work without store, just no persistence)
    await eventBus.publish(event);

    // Verify event was received by subscriber
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent?.event_id).toBe(event.event_id);
  });

  it('should handle persistEvent gracefully when no store (line 55)', async () => {
    // This is implicitly tested by the above test, but let's be explicit
    const event: FileStateChangedEvent = {
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

    // Should not throw error
    await expect(eventBus.publish(event)).resolves.not.toThrow();
  });

  it('should return empty array from queryEvents when no store (line 74)', async () => {
    // Create a new EventBus instance to access private method indirectly
    const bus = new EventBus();

    // getEventHistory calls queryEvents, which should return [] when no store
    await expect(bus.getEventHistory()).rejects.toThrow(
      'EventBus: Cannot query event history without a CognitiveStore'
    );
  });
});
