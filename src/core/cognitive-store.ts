import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  ICognitiveStore,
  FileSnapshot,
  AgentObservation,
  ConflictRecord,
  ConflictType,
  ConflictSeverity,
  RecoveryActionType
} from './types.js';

export class CognitiveStore implements ICognitiveStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    if (process.env.DEBUG_STORE) console.log('[CognitiveStore] Constructor called, methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this)));
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        event_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        project_path TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_event_type ON event_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_event_project ON event_log(project_path);

      CREATE TABLE IF NOT EXISTS file_state (
        snapshot_id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 1,
        captured_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_file_path ON file_state(file_path);
      CREATE INDEX IF NOT EXISTS idx_file_current ON file_state(file_path, is_current);

      CREATE TABLE IF NOT EXISTS agent_observation (
        observation_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        observation_type TEXT NOT NULL,
        file_path TEXT,
        content_hash TEXT,
        metadata TEXT NOT NULL,
        observed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agent_obs ON agent_observation(agent_id, file_path);
      CREATE INDEX IF NOT EXISTS idx_obs_time ON agent_observation(observed_at);

      CREATE TABLE IF NOT EXISTS conflict_record (
        conflict_id TEXT PRIMARY KEY,
        conflict_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        description TEXT NOT NULL,
        agent_expected_hash TEXT,
        actual_hash TEXT,
        detected_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolution_action TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conflict_unresolved ON conflict_record(agent_id, resolved_at);
      CREATE INDEX IF NOT EXISTS idx_conflict_file ON conflict_record(file_path);
    `);
  }

  // ============================================================================
  // File State Management
  // ============================================================================

  async recordFileState(snapshot: Omit<FileSnapshot, 'snapshot_id' | 'captured_at'>): Promise<string> {
    const snapshot_id = uuidv4();
    const captured_at = Date.now();

    // Mark previous snapshots as not current
    if (snapshot.is_current) {
      this.db.prepare('UPDATE file_state SET is_current = 0 WHERE file_path = ? AND is_current = 1')
        .run(snapshot.file_path);
    }

    this.db.prepare(`
      INSERT INTO file_state (snapshot_id, file_path, content_hash, mtime, size, is_current, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot_id,
      snapshot.file_path,
      snapshot.content_hash,
      snapshot.mtime,
      snapshot.size,
      snapshot.is_current ? 1 : 0,
      captured_at
    );

    return snapshot_id;
  }

  async getCurrentFileState(filePath: string): Promise<FileSnapshot | null> {
    const row = this.db.prepare(`
      SELECT * FROM file_state
      WHERE file_path = ? AND is_current = 1
      ORDER BY captured_at DESC
      LIMIT 1
    `).get(filePath) as any;

    if (!row) return null;

    return {
      snapshot_id: row.snapshot_id,
      file_path: row.file_path,
      content_hash: row.content_hash,
      mtime: row.mtime,
      size: row.size,
      is_current: row.is_current === 1,
      captured_at: row.captured_at
    };
  }

  async getFileStateHistory(filePath: string, limit: number = 10): Promise<FileSnapshot[]> {
    const rows = this.db.prepare(`
      SELECT * FROM file_state
      WHERE file_path = ?
      ORDER BY captured_at DESC
      LIMIT ?
    `).all(filePath, limit) as any[];

    return rows.map(row => ({
      snapshot_id: row.snapshot_id,
      file_path: row.file_path,
      content_hash: row.content_hash,
      mtime: row.mtime,
      size: row.size,
      is_current: row.is_current === 1,
      captured_at: row.captured_at
    }));
  }

  // ============================================================================
  // Agent Observation Management
  // ============================================================================

  async recordObservation(observation: Omit<AgentObservation, 'observation_id' | 'observed_at'>): Promise<string> {
    const observation_id = uuidv4();
    const observed_at = Date.now();

    this.db.prepare(`
      INSERT INTO agent_observation (observation_id, agent_id, observation_type, file_path, content_hash, metadata, observed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      observation_id,
      observation.agent_id,
      observation.observation_type,
      observation.file_path,
      observation.content_hash,
      JSON.stringify(observation.metadata),
      observed_at
    );

    return observation_id;
  }

  async getAgentLastRead(agentId: string, filePath: string): Promise<AgentObservation | null> {
    const row = this.db.prepare(`
      SELECT * FROM agent_observation
      WHERE agent_id = ? AND file_path = ? AND observation_type = 'file_read'
      ORDER BY observed_at DESC
      LIMIT 1
    `).get(agentId, filePath) as any;

    if (!row) return null;

    return {
      observation_id: row.observation_id,
      agent_id: row.agent_id,
      observation_type: row.observation_type,
      file_path: row.file_path,
      content_hash: row.content_hash,
      metadata: JSON.parse(row.metadata),
      observed_at: row.observed_at
    };
  }

  async getAgentObservations(agentId: string, limit: number = 50): Promise<AgentObservation[]> {
    const rows = this.db.prepare(`
      SELECT * FROM agent_observation
      WHERE agent_id = ?
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(agentId, limit) as any[];

    return rows.map(row => ({
      observation_id: row.observation_id,
      agent_id: row.agent_id,
      observation_type: row.observation_type,
      file_path: row.file_path,
      content_hash: row.content_hash,
      metadata: JSON.parse(row.metadata),
      observed_at: row.observed_at
    }));
  }

  async getAgentsWithObservations(filePath: string): Promise<string[]> {
    const rows = this.db.prepare(`
      SELECT DISTINCT agent_id
      FROM agent_observation
      WHERE file_path = ?
      ORDER BY observed_at DESC
    `).all(filePath) as any[];

    return rows.map(row => row.agent_id);
  }

  async recordFileStateBatch(snapshots: Omit<FileSnapshot, 'snapshot_id' | 'captured_at'>[]): Promise<string[]> {
    const snapshot_ids: string[] = [];
    const captured_at = Date.now();

    const transaction = this.db.transaction(() => {
      for (const snapshot of snapshots) {
        const snapshot_id = uuidv4();
        snapshot_ids.push(snapshot_id);

        // Mark previous snapshots as not current
        if (snapshot.is_current) {
          this.db.prepare('UPDATE file_state SET is_current = 0 WHERE file_path = ? AND is_current = 1')
            .run(snapshot.file_path);
        }

        this.db.prepare(`
          INSERT INTO file_state (snapshot_id, file_path, content_hash, mtime, size, is_current, captured_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          snapshot_id,
          snapshot.file_path,
          snapshot.content_hash,
          snapshot.mtime,
          snapshot.size,
          snapshot.is_current ? 1 : 0,
          captured_at
        );
      }
    });

    transaction();
    return snapshot_ids;
  }

  // ============================================================================
  // Conflict Management
  // ============================================================================

  async recordConflict(conflict: Omit<ConflictRecord, 'conflict_id' | 'detected_at' | 'resolved_at' | 'resolution_action'>): Promise<string> {
    const conflict_id = uuidv4();
    const detected_at = Date.now();

    this.db.prepare(`
      INSERT INTO conflict_record (conflict_id, conflict_type, severity, agent_id, file_path, description, agent_expected_hash, actual_hash, detected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      conflict_id,
      conflict.conflict_type,
      conflict.severity,
      conflict.agent_id,
      conflict.file_path,
      conflict.description,
      conflict.agent_expected_hash,
      conflict.actual_hash,
      detected_at
    );

    return conflict_id;
  }

  async resolveConflict(conflictId: string, action: RecoveryActionType): Promise<void> {
    const resolved_at = Date.now();

    this.db.prepare(`
      UPDATE conflict_record
      SET resolved_at = ?, resolution_action = ?
      WHERE conflict_id = ?
    `).run(resolved_at, action, conflictId);
  }

  async getUnresolvedConflicts(agentId?: string): Promise<ConflictRecord[]> {
    let query = 'SELECT * FROM conflict_record WHERE resolved_at IS NULL';
    const params: any[] = [];

    if (agentId) {
      query += ' AND agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY detected_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      conflict_id: row.conflict_id,
      conflict_type: row.conflict_type as ConflictType,
      severity: row.severity as ConflictSeverity,
      agent_id: row.agent_id,
      file_path: row.file_path,
      description: row.description,
      agent_expected_hash: row.agent_expected_hash,
      actual_hash: row.actual_hash,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
      resolution_action: row.resolution_action as RecoveryActionType | null
    }));
  }

  async getConflictHistory(filePath?: string, limit: number = 50): Promise<ConflictRecord[]> {
    let query = 'SELECT * FROM conflict_record';
    const params: any[] = [];

    if (filePath) {
      query += ' WHERE file_path = ?';
      params.push(filePath);
    }

    query += ' ORDER BY detected_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      conflict_id: row.conflict_id,
      conflict_type: row.conflict_type as ConflictType,
      severity: row.severity as ConflictSeverity,
      agent_id: row.agent_id,
      file_path: row.file_path,
      description: row.description,
      agent_expected_hash: row.agent_expected_hash,
      actual_hash: row.actual_hash,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
      resolution_action: row.resolution_action as RecoveryActionType | null
    }));
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async close(): Promise<void> {
    this.db.close();
  }
}
