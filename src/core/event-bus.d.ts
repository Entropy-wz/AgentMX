import type { IEventBus, AgentMXEvent, EventHandler, EventFilter } from './types.js';
import type { CognitiveStore } from './cognitive-store.js';
export declare class EventBus implements IEventBus {
    private emitter;
    private store;
    constructor(store?: CognitiveStore);
    publish(event: AgentMXEvent): Promise<void>;
    subscribe<T extends AgentMXEvent>(eventType: T['event_type'], handler: EventHandler<T>): () => void;
    getEventHistory(filter?: EventFilter): Promise<AgentMXEvent[]>;
    private persistEvent;
    private queryEvents;
}
