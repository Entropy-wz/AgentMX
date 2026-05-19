/**
 * Scenario: G1 Stale Read Detection
 *
 * This demo simulates the core problem AgentMX solves:
 * An AI agent reads a file, the file is modified externally,
 * and the system detects the cognitive misalignment.
 */

import { CognitiveStore } from '../src/core/cognitive-store';
import { EventBus } from '../src/core/event-bus';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Helper function to compute file hash
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function runScenario() {
  console.log('='.repeat(70));
  console.log('AgentMX Demo: G1 Stale Read Detection');
  console.log('='.repeat(70));
  console.log();

  // Setup
  const dbPath = './demo/demo.db';
  const testFilePath = './demo/test-file.txt';
  const projectPath = path.resolve('./demo');

  // Clean up previous run
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

  const store = new CognitiveStore(dbPath);
  const eventBus = new EventBus(store);

  // Subscribe to events
  eventBus.subscribe('file_state_changed', (event) => {
    console.log(`📢 Event: File state changed - ${event.file_path}`);
  });

  eventBus.subscribe('agent_operation', (event) => {
    console.log(`📢 Event: Agent operation - ${event.operation_type} on ${event.file_path}`);
  });

  console.log('Step 1: Create initial file');
  console.log('-'.repeat(70));
  const initialContent = 'Hello, World!';
  fs.writeFileSync(testFilePath, initialContent);
  const initialHash = computeHash(initialContent);
  const initialMtime = fs.statSync(testFilePath).mtimeMs;

  console.log(`  File: ${testFilePath}`);
  console.log(`  Content: "${initialContent}"`);
  console.log(`  Hash: ${initialHash.substring(0, 16)}...`);
  console.log();

  // Record initial file state
  await store.recordFileState({
    file_path: testFilePath,
    content_hash: initialHash,
    mtime: initialMtime,
    size: initialContent.length,
    is_current: true
  });

  await eventBus.publish({
    event_id: crypto.randomUUID(),
    timestamp: Date.now(),
    project_path: projectPath,
    event_type: 'file_state_changed',
    file_path: testFilePath,
    old_hash: null,
    new_hash: initialHash,
    old_mtime: null,
    new_mtime: initialMtime,
    change_type: 'created'
  });

  console.log('Step 2: Agent reads the file');
  console.log('-'.repeat(70));
  const agentId = 'claude-demo-agent';

  // Simulate agent reading the file
  const readContent = fs.readFileSync(testFilePath, 'utf-8');
  console.log(`  Agent "${agentId}" reads file`);
  console.log(`  Agent sees: "${readContent}"`);
  console.log(`  Agent's cognitive state: hash=${initialHash.substring(0, 16)}...`);
  console.log();

  // Record agent observation
  await store.recordObservation({
    agent_id: agentId,
    observation_type: 'file_read',
    file_path: testFilePath,
    content_hash: initialHash,
    metadata: {
      content_preview: readContent.substring(0, 50)
    }
  });

  await eventBus.publish({
    event_id: crypto.randomUUID(),
    timestamp: Date.now(),
    project_path: projectPath,
    event_type: 'agent_file_read',
    agent_id: agentId,
    file_path: testFilePath,
    content_hash: initialHash
  });

  console.log('Step 3: External modification (simulating user edit)');
  console.log('-'.repeat(70));

  // Wait a bit to ensure different mtime
  await new Promise(resolve => setTimeout(resolve, 100));

  const modifiedContent = 'Hello, AgentMX! This file was modified externally.';
  fs.writeFileSync(testFilePath, modifiedContent);
  const modifiedHash = computeHash(modifiedContent);
  const modifiedMtime = fs.statSync(testFilePath).mtimeMs;

  console.log(`  File modified externally`);
  console.log(`  New content: "${modifiedContent}"`);
  console.log(`  New hash: ${modifiedHash.substring(0, 16)}...`);
  console.log();

  // Record new file state
  await store.recordFileState({
    file_path: testFilePath,
    content_hash: modifiedHash,
    mtime: modifiedMtime,
    size: modifiedContent.length,
    is_current: true
  });

  await eventBus.publish({
    event_id: crypto.randomUUID(),
    timestamp: Date.now(),
    project_path: projectPath,
    event_type: 'file_state_changed',
    file_path: testFilePath,
    old_hash: initialHash,
    new_hash: modifiedHash,
    old_mtime: initialMtime,
    new_mtime: modifiedMtime,
    change_type: 'modified'
  });

  console.log('Step 4: Detect cognitive conflict (G1 Stale Read)');
  console.log('-'.repeat(70));

  // Check if agent's understanding is stale
  const agentLastRead = await store.getAgentLastRead(agentId, testFilePath);
  const currentFileState = await store.getCurrentFileState(testFilePath);

  console.log(`  Agent's last read hash: ${agentLastRead?.content_hash?.substring(0, 16)}...`);
  console.log(`  Current file hash:      ${currentFileState?.content_hash?.substring(0, 16)}...`);

  if (agentLastRead?.content_hash !== currentFileState?.content_hash) {
    console.log(`  ⚠️  CONFLICT DETECTED: G1_STALE_READ`);
    console.log(`  Agent's cognitive state is out of sync with reality!`);
    console.log();

    // Record conflict
    const conflictId = await store.recordConflict({
      conflict_type: 'G1_stale_read',
      severity: 'medium',
      agent_id: agentId,
      file_path: testFilePath,
      description: 'Agent has stale file state - file was modified externally after agent read it',
      agent_expected_hash: agentLastRead?.content_hash || null,
      actual_hash: currentFileState?.content_hash || null
    });

    await eventBus.publish({
      event_id: crypto.randomUUID(),
      timestamp: Date.now(),
      project_path: projectPath,
      event_type: 'cognitive_conflict',
      conflict_id: conflictId,
      conflict_type: 'G1_stale_read',
      severity: 'medium',
      agent_id: agentId,
      file_path: testFilePath,
      description: 'Stale read detected'
    });

    console.log('Step 5: Recovery action');
    console.log('-'.repeat(70));
    console.log(`  Recommended action: PROMPT_REREAD`);
    console.log(`  System should notify agent to re-read the file before proceeding`);
    console.log();

    // Simulate agent re-reading
    console.log(`  Agent re-reads file...`);
    const rereadContent = fs.readFileSync(testFilePath, 'utf-8');
    console.log(`  Agent now sees: "${rereadContent}"`);
    console.log(`  Agent's cognitive state updated: hash=${modifiedHash.substring(0, 16)}...`);
    console.log();

    // Record new observation
    await store.recordObservation({
      agent_id: agentId,
      observation_type: 'file_read',
      file_path: testFilePath,
      content_hash: modifiedHash,
      metadata: {
        content_preview: rereadContent.substring(0, 50),
        reason: 'conflict_recovery'
      }
    });

    // Resolve conflict
    await store.resolveConflict(conflictId, 'prompt_reread');
    console.log(`  ✅ Conflict resolved: Agent's cognitive state is now aligned`);
  }

  console.log();
  console.log('Step 6: Query event history');
  console.log('-'.repeat(70));
  const events = await eventBus.getEventHistory({ limit: 10 });
  console.log(`  Total events recorded: ${events.length}`);
  events.forEach((event, i) => {
    console.log(`  ${i + 1}. [${event.event_type}] ${new Date(event.timestamp).toISOString()}`);
  });

  console.log();
  console.log('Step 7: Query conflict history');
  console.log('-'.repeat(70));
  const conflicts = await store.getConflictHistory(testFilePath);
  console.log(`  Total conflicts for this file: ${conflicts.length}`);
  conflicts.forEach((conflict, i) => {
    console.log(`  ${i + 1}. [${conflict.conflict_type}] Severity: ${conflict.severity}`);
    console.log(`     Detected: ${new Date(conflict.detected_at).toISOString()}`);
    console.log(`     Resolved: ${conflict.resolved_at ? new Date(conflict.resolved_at).toISOString() : 'Not resolved'}`);
    console.log(`     Action: ${conflict.resolution_action || 'None'}`);
  });

  // Cleanup
  await store.close();

  console.log();
  console.log('='.repeat(70));
  console.log('Demo completed successfully!');
  console.log('='.repeat(70));
  console.log();
  console.log('Key takeaways:');
  console.log('  1. AgentMX tracks both file state and agent cognitive state');
  console.log('  2. It detects when agent\'s understanding becomes stale');
  console.log('  3. It provides recovery mechanisms to restore alignment');
  console.log('  4. All events are logged for debugging and analysis');
  console.log();
}

// Run the scenario
runScenario().catch(console.error);
