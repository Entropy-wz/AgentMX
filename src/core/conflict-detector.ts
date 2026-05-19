import { v4 as uuidv4 } from 'uuid';
import type {
  IEventBus,
  ICognitiveStore,
  IConflictDetector,
  FileStateChangedEvent,
  CognitiveConflictEvent
} from './types.js';

export class ConflictDetector implements IConflictDetector {
  private eventBus: IEventBus | null = null;
  private store: ICognitiveStore | null = null;
  private unsubscribe: (() => void) | null = null;

  start(eventBus: IEventBus, store: ICognitiveStore): void {
    this.eventBus = eventBus;
    this.store = store;

    this.unsubscribe = eventBus.subscribe<FileStateChangedEvent>(
      'file_state_changed',
      (event) => this.handleFileStateChanged(event)
    );
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.eventBus = null;
    this.store = null;
  }

  async detectConflictsForFile(filePath: string): Promise<CognitiveConflictEvent[]> {
    if (!this.store) return [];

    const conflicts: CognitiveConflictEvent[] = [];
    const currentState = await this.store.getCurrentFileState(filePath);

    if (!currentState) return conflicts;

    const agentIds = await this.store.getAgentsWithObservations(filePath);

    for (const agentId of agentIds) {
      const lastRead = await this.store.getAgentLastRead(agentId, filePath);

      if (lastRead && lastRead.content_hash !== currentState.content_hash) {
        // G1 stale read conflict detected
        const conflict_id = await this.store.recordConflict({
          conflict_type: 'G1_stale_read',
          severity: 'medium',
          agent_id: agentId,
          file_path: filePath,
          description: `Agent has stale file state - file was modified after agent read it`,
          agent_expected_hash: lastRead.content_hash,
          actual_hash: currentState.content_hash
        });

        const conflictEvent: CognitiveConflictEvent = {
          event_id: uuidv4(),
          timestamp: Date.now(),
          project_path: '', // Will be filled by caller
          event_type: 'cognitive_conflict',
          conflict_type: 'G1_stale_read',
          severity: 'medium',
          agent_id: agentId,
          file_path: filePath,
          description: `File ${filePath} changed externally. Agent's understanding is outdated.`,
          agent_expected_hash: lastRead.content_hash,
          actual_hash: currentState.content_hash
        };

        conflicts.push(conflictEvent);
      }
    }

    return conflicts;
  }

  private async handleFileStateChanged(event: FileStateChangedEvent): Promise<void> {
    if (!this.eventBus || !this.store) return;

    const { file_path, project_path } = event;

    // Detect conflicts for all agents
    const conflicts = await this.detectConflictsForFile(file_path);

    // Publish conflict events
    for (const conflict of conflicts) {
      conflict.project_path = project_path;
      await this.eventBus.publish(conflict);
    }
  }
}
