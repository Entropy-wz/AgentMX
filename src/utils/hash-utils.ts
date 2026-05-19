import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

/**
 * Compute SHA-256 hash of a file using stream-based processing.
 * This approach is memory-efficient for large files.
 *
 * @param filePath - Absolute path to the file
 * @returns SHA-256 hash as hex string
 * @throws Error if file cannot be read
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

/**
 * Compute SHA-256 hash of in-memory content.
 *
 * @param content - String or Buffer to hash
 * @returns SHA-256 hash as hex string
 */
export function computeContentHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute file hash along with file stats (size, mtime).
 * Useful for creating file snapshots.
 *
 * @param filePath - Absolute path to the file
 * @returns Object containing hash, size, and mtime
 * @throws Error if file cannot be read or stat fails
 */
export async function computeFileHashWithStats(filePath: string): Promise<{
  hash: string;
  size: number;
  mtime: number;
}> {
  const stats = await stat(filePath);
  const hash = await computeFileHash(filePath);

  return {
    hash,
    size: stats.size,
    mtime: stats.mtimeMs
  };
}
