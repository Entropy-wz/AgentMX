// Core type definitions for AgentMX

// ============================================================================
// Base Event Types
// ============================================================================

export interface BaseEvent {
  event_id: string;
  timestamp: number;
  project_path: string;
  event_type: string;
}

// ============================================================================
// File System Events
// ============================================================================

export interface FileMightChangedEvent extends BaseEvent {
  event_type: 'file_might_changed';
  file_path: string;
  change_type: 'created' | 'modified' | 'deleted';
}

export interface FileStateChangedEvent extends BaseEvent {
  event_type: 'file_state_changed';
  file_path: string;
  old_hash: string | null;
  new_hash: string | null;
  old_mtime: number | null;
  new_mtime: number | null;
  change_type: 'created' | 'modified' | 'deleted';
}

// ============================================================================
// Agent Events
// ============================================================================

export interface AgentFileReadEvent extends BaseEvent {
  event_type: 'agent_file_read';
  agent_id: string;
  file_path: string;
  content_hash: string;
  read_timestamp: number;
}

export interface AgentFileWriteEvent extends BaseEvent {
  event_type: 'agent_file_write';
  agent_id: string;
  file_path: string;
  old_hash: string | null;
  new_hash: string;
  write_timestamp: number;
}

export interface AgentOperationEvent extends BaseEvent {
  event_type: 'agent_operation';
  agent_id: string;
  operation_type: 'edit' | 'create' | 'delete' | 'move';
  target_files: string[];
  intent_description: string;
}

export interface AgentCommandExecutedEvent extends BaseEvent {
  event_type: 'agent_command_executed';
  agent_id: string;
  command: string;
  exit_code: number;
  affected_files: string[];
}

// ============================================================================
// Conflict Events
// ============================================================================

export type ConflictType = 'G1_stale_read' | 'G2_lost_update' | 'G3_phantom_read';
export type ConflictSeverity = 'low' | 'medium' | 'high';

export interface CognitiveConflictEvent extends BaseEvent {
  event_type: 'cognitive_conflict';
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  agent_id: string;
  file_path: string;
  description: string;
  agent_expected_hash: string | null;
  actual_hash: string | null;
}

// ============================================================================
// Decision Events
// ============================================================================

export type RecoveryActionType = 'auto_refresh' | 'request_diff_summary' | 'block_and_confirm';

export interface RecoveryActionEvent extends BaseEvent {
  event_type: 'recovery_action';
  conflict_id: string;
  action_type: RecoveryActionType;
  target_agent: string;
  message: string;
}

// ============================================================================
// Union Types
// ============================================================================

export type AgentMXEvent =
  | FileMightChangedEvent
  | FileStateChangedEvent
  | AgentFileReadEvent
  | AgentFileWriteEvent
  | AgentOperationEvent
  | AgentCommandExecutedEvent
  | CognitiveConflictEvent
  | RecoveryActionEvent;

// ============================================================================
// Data Models
// ============================================================================

export interface FileSnapshot {
  snapshot_id: string;
  file_path: string;
  content_hash: string;
  mtime: number;
  size: number;
  is_current: boolean;
  captured_at: number;
}

export interface AgentObservation {
  observation_id: string;
  agent_id: string;
  observation_type: 'file_read' | 'operation' | 'command';
  file_path: string | null;
  content_hash: string | null;
  metadata: Record<string, unknown>;
  observed_at: number;
}

export interface ConflictRecord {
  conflict_id: string;
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  agent_id: string;
  file_path: string;
  description: string;
  agent_expected_hash: string | null;
  actual_hash: string | null;
  detected_at: number;
  resolved_at: number | null;
  resolution_action: RecoveryActionType | null;
}

// ============================================================================
// Event Bus Interface
// ============================================================================

export type EventHandler<T extends AgentMXEvent = AgentMXEvent> = (event: T) => void | Promise<void>;

export interface IEventBus {
  publish(event: AgentMXEvent): Promise<void>;
  publishBatch(events: AgentMXEvent[]): Promise<void>;
  subscribe<T extends AgentMXEvent>(eventType: T['event_type'], handler: EventHandler<T>): () => void;
  getEventHistory(filter?: EventFilter): Promise<AgentMXEvent[]>;
}

export interface EventFilter {
  event_type?: string;
  project_path?: string;
  file_path?: string;
  agent_id?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
}

// ============================================================================
// Cognitive Store Interface
// ============================================================================

export interface ICognitiveStore {
  // File state management
  recordFileState(snapshot: Omit<FileSnapshot, 'snapshot_id' | 'captured_at'>): Promise<string>;
  getCurrentFileState(filePath: string): Promise<FileSnapshot | null>;
  getFileStateHistory(filePath: string, limit?: number): Promise<FileSnapshot[]>;

  // Agent observation management
  recordObservation(observation: Omit<AgentObservation, 'observation_id' | 'observed_at'>): Promise<string>;
  getAgentLastRead(agentId: string, filePath: string): Promise<AgentObservation | null>;
  getAgentObservations(agentId: string, limit?: number): Promise<AgentObservation[]>;

  // Conflict management
  recordConflict(conflict: Omit<ConflictRecord, 'conflict_id' | 'detected_at' | 'resolved_at' | 'resolution_action'>): Promise<string>;
  resolveConflict(conflictId: string, action: RecoveryActionType): Promise<void>;
  getUnresolvedConflicts(agentId?: string): Promise<ConflictRecord[]>;
  getConflictHistory(filePath?: string, limit?: number): Promise<ConflictRecord[]>;

  // Batch operations
  recordFileStateBatch(snapshots: Omit<FileSnapshot, 'snapshot_id' | 'captured_at'>[]): Promise<string[]>;
  getAgentsWithObservations(filePath: string): Promise<string[]>;

  // Utility
  close(): Promise<void>;
}

// ============================================================================
// File System Watcher Interface
// ============================================================================

export interface WatchOptions {
  ignore?: string[];
  debounceMs?: number;
  persistent?: boolean;
}

export interface IFileSystemWatcher {
  watch(projectPath: string, options?: WatchOptions): Promise<void>;
  unwatch(projectPath: string): Promise<void>;
  isWatching(projectPath: string): boolean;
  getWatchedProjects(): string[];
  close(): Promise<void>;
}

// ============================================================================
// File State Scanner Interface
// ============================================================================

export interface IFileStateScanner {
  start(eventBus: IEventBus, store: ICognitiveStore): void;
  stop(): void;
  scanFile(filePath: string): Promise<FileSnapshot | null>;
  scanFiles(filePaths: string[]): Promise<Map<string, FileSnapshot>>;
}

// ============================================================================
// Conflict Detector Interface
// ============================================================================

export interface IConflictDetector {
  start(eventBus: IEventBus, store: ICognitiveStore): void;
  stop(): void;
  detectConflictsForFile(filePath: string): Promise<CognitiveConflictEvent[]>;
}
