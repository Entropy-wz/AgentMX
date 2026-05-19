import type { ICognitiveStore, FileSnapshot, AgentObservation, ConflictRecord, RecoveryActionType } from './types.js';
export declare class CognitiveStore implements ICognitiveStore {
    private db;
    constructor(dbPath: string);
    private initializeSchema;
    recordFileState(snapshot: Omit<FileSnapshot, 'snapshot_id' | 'captured_at'>): Promise<string>;
    getCurrentFileState(filePath: string): Promise<FileSnapshot | null>;
    getFileStateHistory(filePath: string, limit?: number): Promise<FileSnapshot[]>;
    recordObservation(observation: Omit<AgentObservation, 'observation_id' | 'observed_at'>): Promise<string>;
    getAgentLastRead(agentId: string, filePath: string): Promise<AgentObservation | null>;
    getAgentObservations(agentId: string, limit?: number): Promise<AgentObservation[]>;
    recordConflict(conflict: Omit<ConflictRecord, 'conflict_id' | 'detected_at' | 'resolved_at' | 'resolution_action'>): Promise<string>;
    resolveConflict(conflictId: string, action: RecoveryActionType): Promise<void>;
    getUnresolvedConflicts(agentId?: string): Promise<ConflictRecord[]>;
    getConflictHistory(filePath?: string, limit?: number): Promise<ConflictRecord[]>;
    close(): Promise<void>;
}
