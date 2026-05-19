import chokidar, { FSWatcher } from 'chokidar';
import debounce from 'lodash.debounce';
import { v4 as uuidv4 } from 'uuid';
import type { IEventBus, IFileSystemWatcher, WatchOptions, FileMightChangedEvent } from './types.js';
import path from 'path';

const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/venv/**',
  '**/.venv/**',
  '**/.agentmx/**',
  '**/*.log',
  '**/.DS_Store',
  '**/Thumbs.db'
];

export class FileSystemWatcher implements IFileSystemWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private debouncedHandlers: Map<string, any> = new Map();
  private eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  async watch(projectPath: string, options?: WatchOptions): Promise<void> {
    if (this.watchers.has(projectPath)) {
      throw new Error(`Already watching project: ${projectPath}`);
    }

    const ignorePatterns = [
      ...DEFAULT_IGNORE_PATTERNS,
      ...(options?.ignore || [])
    ];

    const watcher = chokidar.watch(projectPath, {
      ignored: ignorePatterns,
      persistent: options?.persistent ?? true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher
      .on('add', (filePath) => this.handleChange(projectPath, filePath, 'created', options?.debounceMs))
      .on('change', (filePath) => this.handleChange(projectPath, filePath, 'modified', options?.debounceMs))
      .on('unlink', (filePath) => this.handleChange(projectPath, filePath, 'deleted', options?.debounceMs));

    this.watchers.set(projectPath, watcher);
  }

  async unwatch(projectPath: string): Promise<void> {
    const watcher = this.watchers.get(projectPath);
    if (!watcher) {
      throw new Error(`Not watching project: ${projectPath}`);
    }

    await watcher.close();
    this.watchers.delete(projectPath);

    // Clean up debounced handlers for this project
    for (const [key, handler] of this.debouncedHandlers.entries()) {
      if (key.startsWith(projectPath)) {
        handler.cancel();
        this.debouncedHandlers.delete(key);
      }
    }
  }

  isWatching(projectPath: string): boolean {
    return this.watchers.has(projectPath);
  }

  getWatchedProjects(): string[] {
    return Array.from(this.watchers.keys());
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.watchers.values()).map(w => w.close());
    await Promise.all(closePromises);
    this.watchers.clear();
    this.debouncedHandlers.clear();
  }

  private handleChange(
    projectPath: string,
    filePath: string,
    changeType: 'created' | 'modified' | 'deleted',
    debounceMs?: number
  ): void {
    const handlerKey = `${projectPath}:${filePath}`;

    if (!this.debouncedHandlers.has(handlerKey)) {
      const handler = debounce(
        () => this.publishFileChange(projectPath, filePath, changeType),
        debounceMs || 100,
        { maxWait: 500 }
      );
      this.debouncedHandlers.set(handlerKey, handler);
    }

    this.debouncedHandlers.get(handlerKey)();
  }

  private async publishFileChange(
    projectPath: string,
    filePath: string,
    changeType: 'created' | 'modified' | 'deleted'
  ): Promise<void> {
    const event: FileMightChangedEvent = {
      event_id: uuidv4(),
      timestamp: Date.now(),
      project_path: projectPath,
      event_type: 'file_might_changed',
      file_path: path.resolve(filePath),
      change_type: changeType
    };

    await this.eventBus.publish(event);
  }
}
