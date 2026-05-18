import EventEmitter from 'eventemitter3';
import type {
  IEventBus,
  AgentMXEvent,
  EventHandler,
  EventFilter
} from './types.js';
import type { CognitiveStore } from './cognitive-store.js';

export class EventBus implements IEventBus {
  private emitter: EventEmitter;
  private store: CognitiveStore | null;

  constructor(store?: CognitiveStore) {
    this.emitter = new EventEmitter();
    this.store = store || null;
  }

  async publish(event: AgentMXEvent): Promise<void> {
    // Persist event to store if available
    if (this.store) {
      await this.persistEvent(event);
    }

    // Emit to subscribers
    this.emitter.emit(event.event_type, event);
    this.emitter.emit('*', event); // Wildcard for all events
  }

  subscribe<T extends AgentMXEvent>(
    eventType: T['event_type'],
    handler: EventHandler<T>
  ): () => void {
    this.emitter.on(eventType, handler as any);

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, handler as any);
    };
  }

  async getEventHistory(filter?: EventFilter): Promise<AgentMXEvent[]> {
    if (!this.store) {
      throw new Error('EventBus: Cannot query event history without a CognitiveStore');
    }

    return this.queryEvents(filter);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async persistEvent(event: AgentMXEvent): Promise<void> {
    if (!this.store) return;

    // Access the underlying database through a type assertion
    // This is safe because we control both EventBus and CognitiveStore
    const db = (this.store as any).db;

    db.prepare(`
      INSERT INTO event_log (event_id, timestamp, project_path, event_type, payload)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      event.event_id,
      event.timestamp,
      event.project_path,
      event.event_type,
      JSON.stringify(event)
    );
  }

  private async queryEvents(filter?: EventFilter): Promise<AgentMXEvent[]> {
    if (!this.store) return [];

    const db = (this.store as any).db;
    let query = 'SELECT payload FROM event_log WHERE 1=1';
    const params: any[] = [];

    if (filter?.event_type) {
      query += ' AND event_type = ?';
      params.push(filter.event_type);
    }

    if (filter?.project_path) {
      query += ' AND project_path = ?';
      params.push(filter.project_path);
    }

    if (filter?.start_time) {
      query += ' AND timestamp >= ?';
      params.push(filter.start_time);
    }

    if (filter?.end_time) {
      query += ' AND timestamp <= ?';
      params.push(filter.end_time);
    }

    // Handle file_path and agent_id by parsing JSON payload
    // This is less efficient but works for v0.1
    query += ' ORDER BY timestamp DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = db.prepare(query).all(...params) as any[];
    let events = rows.map((row: any) => JSON.parse(row.payload) as AgentMXEvent);

    // Post-filter for JSON fields
    if (filter?.file_path) {
      events = events.filter(e => {
        const event = e as any;
        return event.file_path === filter.file_path;
      });
    }

    if (filter?.agent_id) {
      events = events.filter(e => {
        const event = e as any;
        return event.agent_id === filter.agent_id;
      });
    }

    return events;
  }
}
