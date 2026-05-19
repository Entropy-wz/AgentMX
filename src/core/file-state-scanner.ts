import { v4 as uuidv4 } from 'uuid';
import type {
  IEventBus,
  ICognitiveStore,
  IFileStateScanner,
  FileMightChangedEvent,
  FileStateChangedEvent,
  FileSnapshot
} from './types.js';
import { computeFileHashWithStats } from '../utils/hash-utils.js';

export class FileStateScanner implements IFileStateScanner {
  private eventBus: IEventBus | null = null;
  private store: ICognitiveStore | null = null;
  private unsubscribe: (() => void) | null = null;

  start(eventBus: IEventBus, store: ICognitiveStore): void {
    this.eventBus = eventBus;
    this.store = store;

    this.unsubscribe = eventBus.subscribe<FileMightChangedEvent>(
      'file_might_changed',
      (event) => this.handleFileMightChanged(event)
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

  async scanFile(filePath: string): Promise<FileSnapshot | null> {
    try {
      const { hash, size, mtime } = await computeFileHashWithStats(filePath);

      return {
        snapshot_id: uuidv4(),
        file_path: filePath,
        content_hash: hash,
        mtime,
        size,
        is_current: true,
        captured_at: Date.now()
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File deleted
      }
      throw error;
    }
  }

  async scanFiles(filePaths: string[]): Promise<Map<string, FileSnapshot>> {
    const results = new Map<string, FileSnapshot>();

    const scanPromises = filePaths.map(async (filePath) => {
      const snapshot = await this.scanFile(filePath);
      if (snapshot) {
        results.set(filePath, snapshot);
      }
    });

    await Promise.all(scanPromises);
    return results;
  }

  private async handleFileMightChanged(event: FileMightChangedEvent): Promise<void> {
    if (!this.eventBus || !this.store) return;

    const { file_path, change_type, project_path } = event;

    // Get previous state
    const previousState = await this.store.getCurrentFileState(file_path);

    // Scan current state
    const currentSnapshot = await this.scanFile(file_path);

    // Determine if state actually changed
    const old_hash = previousState?.content_hash || null;
    const new_hash = currentSnapshot?.content_hash || null;
    const old_mtime = previousState?.mtime || null;
    const new_mtime = currentSnapshot?.mtime || null;

    // Only publish if hash actually changed (or file deleted/created)
    if (old_hash !== new_hash) {
      // Record new state if file exists
      if (currentSnapshot) {
        await this.store.recordFileState({
          file_path: currentSnapshot.file_path,
          content_hash: currentSnapshot.content_hash,
          mtime: currentSnapshot.mtime,
          size: currentSnapshot.size,
          is_current: true
        });
      }

      // Publish FileStateChangedEvent
      const stateChangedEvent: FileStateChangedEvent = {
        event_id: uuidv4(),
        timestamp: Date.now(),
        project_path,
        event_type: 'file_state_changed',
        file_path,
        old_hash,
        new_hash,
        old_mtime,
        new_mtime,
        change_type
      };

      await this.eventBus.publish(stateChangedEvent);
    }
  }
}
