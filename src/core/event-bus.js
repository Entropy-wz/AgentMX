import EventEmitter from 'eventemitter3';
export class EventBus {
    emitter;
    store;
    constructor(store) {
        this.emitter = new EventEmitter();
        this.store = store || null;
    }
    async publish(event) {
        // Persist event to store if available
        if (this.store) {
            await this.persistEvent(event);
        }
        // Emit to subscribers
        this.emitter.emit(event.event_type, event);
        this.emitter.emit('*', event); // Wildcard for all events
    }
    subscribe(eventType, handler) {
        this.emitter.on(eventType, handler);
        // Return unsubscribe function
        return () => {
            this.emitter.off(eventType, handler);
        };
    }
    async getEventHistory(filter) {
        if (!this.store) {
            throw new Error('EventBus: Cannot query event history without a CognitiveStore');
        }
        return this.queryEvents(filter);
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async persistEvent(event) {
        if (!this.store)
            return;
        // Access the underlying database through a type assertion
        // This is safe because we control both EventBus and CognitiveStore
        const db = this.store.db;
        db.prepare(`
      INSERT INTO event_log (event_id, timestamp, project_path, event_type, payload)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.event_id, event.timestamp, event.project_path, event.event_type, JSON.stringify(event));
    }
    async queryEvents(filter) {
        if (!this.store)
            return [];
        const db = this.store.db;
        let query = 'SELECT payload FROM event_log WHERE 1=1';
        const params = [];
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
        const rows = db.prepare(query).all(...params);
        let events = rows.map((row) => JSON.parse(row.payload));
        // Post-filter for JSON fields
        if (filter?.file_path) {
            events = events.filter(e => {
                const event = e;
                return event.file_path === filter.file_path;
            });
        }
        if (filter?.agent_id) {
            events = events.filter(e => {
                const event = e;
                return event.agent_id === filter.agent_id;
            });
        }
        return events;
    }
}
