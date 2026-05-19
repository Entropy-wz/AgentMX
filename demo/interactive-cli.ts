/**
 * Interactive CLI for AgentMX
 *
 * This allows you to manually trigger different scenarios and observe
 * how AgentMX tracks cognitive state and detects conflicts.
 */

import { CognitiveStore } from '../src/core/cognitive-store';
import { EventBus } from '../src/core/event-bus';
import { createHash } from 'crypto';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

class InteractiveCLI {
  private store: CognitiveStore;
  private eventBus: EventBus;
  private currentAgent: string = 'claude-interactive';
  private testFilePath: string = './demo/interactive-file.txt';
  private projectPath: string = './demo';

  constructor() {
    this.store = new CognitiveStore('./demo/interactive.db');
    this.eventBus = new EventBus(this.store);

    // Subscribe to all events
    this.eventBus.subscribe('file_state_changed', (event) => {
      console.log(`  📢 [Event] File state changed: ${event.file_path}`);
    });

    this.eventBus.subscribe('agent_file_read', (event) => {
      console.log(`  📢 [Event] Agent read file: ${event.agent_id} -> ${event.file_path}`);
    });

    this.eventBus.subscribe('cognitive_conflict', (event) => {
      console.log(`  ⚠️  [Event] Conflict detected: ${event.conflict_type} (${event.severity})`);
    });
  }

  async start() {
    console.log('='.repeat(70));
    console.log('AgentMX Interactive CLI');
    console.log('='.repeat(70));
    console.log();
    console.log('This CLI lets you simulate agent operations and observe cognitive tracking.');
    console.log();

    while (true) {
      console.log('\nAvailable commands:');
      console.log('  1. Create file');
      console.log('  2. Agent reads file');
      console.log('  3. Modify file (external)');
      console.log('  4. Check for conflicts');
      console.log('  5. View file state history');
      console.log('  6. View agent observations');
      console.log('  7. View event history');
      console.log('  8. View conflict history');
      console.log('  9. Change agent ID');
      console.log('  0. Exit');
      console.log();

      const choice = await question('Enter command number: ');

      try {
        switch (choice.trim()) {
          case '1':
            await this.createFile();
            break;
          case '2':
            await this.agentReadFile();
            break;
          case '3':
            await this.modifyFile();
            break;
          case '4':
            await this.checkConflicts();
            break;
          case '5':
            await this.viewFileHistory();
            break;
          case '6':
            await this.viewAgentObservations();
            break;
          case '7':
            await this.viewEventHistory();
            break;
          case '8':
            await this.viewConflictHistory();
            break;
          case '9':
            await this.changeAgent();
            break;
          case '0':
            await this.exit();
            return;
          default:
            console.log('Invalid choice. Please try again.');
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }

  private async createFile() {
    console.log('\n--- Create File ---');
    const content = await question('Enter file content: ');

    fs.writeFileSync(this.testFilePath, content);
    const hash = computeHash(content);
    const mtime = fs.statSync(this.testFilePath).mtimeMs;

    await this.store.recordFileState({
      file_path: this.testFilePath,
      content_hash: hash,
      mtime: mtime,
      size: content.length,
      is_current: true
    });

    await this.eventBus.publish({
      event_id: crypto.randomUUID(),
      timestamp: Date.now(),
      project_path: this.projectPath,
      event_type: 'file_state_changed',
      file_path: this.testFilePath,
      old_hash: null,
      new_hash: hash,
      old_mtime: null,
      new_mtime: mtime,
      change_type: 'created'
    });

    console.log(`✅ File created: ${this.testFilePath}`);
    console.log(`   Hash: ${hash.substring(0, 16)}...`);
  }

  private async agentReadFile() {
    console.log('\n--- Agent Reads File ---');

    if (!fs.existsSync(this.testFilePath)) {
      console.log('❌ File does not exist. Create it first.');
      return;
    }

    const content = fs.readFileSync(this.testFilePath, 'utf-8');
    const hash = computeHash(content);

    console.log(`Agent "${this.currentAgent}" reads file:`);
    console.log(`Content: "${content}"`);
    console.log(`Hash: ${hash.substring(0, 16)}...`);

    await this.store.recordObservation({
      agent_id: this.currentAgent,
      observation_type: 'file_read',
      file_path: this.testFilePath,
      content_hash: hash,
      metadata: { content_preview: content.substring(0, 50) }
    });

    await this.eventBus.publish({
      event_id: crypto.randomUUID(),
      timestamp: Date.now(),
      project_path: this.projectPath,
      event_type: 'agent_file_read',
      agent_id: this.currentAgent,
      file_path: this.testFilePath,
      content_hash: hash
    });

    console.log('✅ Agent observation recorded');
  }

  private async modifyFile() {
    console.log('\n--- Modify File (External) ---');

    if (!fs.existsSync(this.testFilePath)) {
      console.log('❌ File does not exist. Create it first.');
      return;
    }

    const oldContent = fs.readFileSync(this.testFilePath, 'utf-8');
    const oldHash = computeHash(oldContent);
    const oldMtime = fs.statSync(this.testFilePath).mtimeMs;

    console.log(`Current content: "${oldContent}"`);
    const newContent = await question('Enter new content: ');

    fs.writeFileSync(this.testFilePath, newContent);
    const newHash = computeHash(newContent);
    const newMtime = fs.statSync(this.testFilePath).mtimeMs;

    await this.store.recordFileState({
      file_path: this.testFilePath,
      content_hash: newHash,
      mtime: newMtime,
      size: newContent.length,
      is_current: true
    });

    await this.eventBus.publish({
      event_id: crypto.randomUUID(),
      timestamp: Date.now(),
      project_path: this.projectPath,
      event_type: 'file_state_changed',
      file_path: this.testFilePath,
      old_hash: oldHash,
      new_hash: newHash,
      old_mtime: oldMtime,
      new_mtime: newMtime,
      change_type: 'modified'
    });

    console.log('✅ File modified');
    console.log(`   Old hash: ${oldHash.substring(0, 16)}...`);
    console.log(`   New hash: ${newHash.substring(0, 16)}...`);
  }

  private async checkConflicts() {
    console.log('\n--- Check for Conflicts ---');

    const agentLastRead = await this.store.getAgentLastRead(this.currentAgent, this.testFilePath);
    const currentFileState = await this.store.getCurrentFileState(this.testFilePath);

    if (!agentLastRead) {
      console.log(`ℹ️  Agent "${this.currentAgent}" has not read this file yet.`);
      return;
    }

    if (!currentFileState) {
      console.log('ℹ️  File does not exist or has no recorded state.');
      return;
    }

    console.log(`Agent's last read hash: ${agentLastRead.content_hash?.substring(0, 16)}...`);
    console.log(`Current file hash:      ${currentFileState.content_hash?.substring(0, 16)}...`);

    if (agentLastRead.content_hash !== currentFileState.content_hash) {
      console.log('⚠️  CONFLICT DETECTED: G1_STALE_READ');
      console.log('   Agent\'s cognitive state is out of sync!');

      const conflictId = await this.store.recordConflict({
        conflict_type: 'G1_stale_read',
        severity: 'medium',
        agent_id: this.currentAgent,
        file_path: this.testFilePath,
        description: 'Agent has stale file state',
        agent_expected_hash: agentLastRead.content_hash,
        actual_hash: currentFileState.content_hash
      });

      await this.eventBus.publish({
        event_id: crypto.randomUUID(),
        timestamp: Date.now(),
        project_path: this.projectPath,
        event_type: 'cognitive_conflict',
        conflict_id: conflictId,
        conflict_type: 'G1_stale_read',
        severity: 'medium',
        agent_id: this.currentAgent,
        file_path: this.testFilePath,
        description: 'Stale read detected'
      });

      console.log(`   Conflict ID: ${conflictId}`);
      console.log('   Recommended action: Agent should re-read the file');
    } else {
      console.log('✅ No conflict - Agent\'s cognitive state is aligned');
    }
  }

  private async viewFileHistory() {
    console.log('\n--- File State History ---');
    const history = await this.store.getFileStateHistory(this.testFilePath);

    if (history.length === 0) {
      console.log('No history found.');
      return;
    }

    history.forEach((snapshot, i) => {
      console.log(`${i + 1}. ${new Date(snapshot.captured_at).toISOString()}`);
      console.log(`   Hash: ${snapshot.content_hash.substring(0, 16)}...`);
      console.log(`   Size: ${snapshot.size} bytes`);
      console.log(`   Current: ${snapshot.is_current ? 'Yes' : 'No'}`);
    });
  }

  private async viewAgentObservations() {
    console.log('\n--- Agent Observations ---');
    const observations = await this.store.getAgentObservations(this.currentAgent);

    if (observations.length === 0) {
      console.log(`No observations for agent "${this.currentAgent}".`);
      return;
    }

    observations.forEach((obs, i) => {
      console.log(`${i + 1}. ${new Date(obs.observed_at).toISOString()}`);
      console.log(`   Type: ${obs.observation_type}`);
      console.log(`   File: ${obs.file_path}`);
      console.log(`   Hash: ${obs.content_hash?.substring(0, 16)}...`);
    });
  }

  private async viewEventHistory() {
    console.log('\n--- Event History ---');
    const events = await this.eventBus.getEventHistory({ limit: 20 });

    if (events.length === 0) {
      console.log('No events found.');
      return;
    }

    events.forEach((event, i) => {
      console.log(`${i + 1}. [${event.event_type}] ${new Date(event.timestamp).toISOString()}`);
      console.log(`   Project: ${event.project_path}`);
    });
  }

  private async viewConflictHistory() {
    console.log('\n--- Conflict History ---');
    const conflicts = await this.store.getConflictHistory();

    if (conflicts.length === 0) {
      console.log('No conflicts found.');
      return;
    }

    conflicts.forEach((conflict, i) => {
      console.log(`${i + 1}. [${conflict.conflict_type}] Severity: ${conflict.severity}`);
      console.log(`   Agent: ${conflict.agent_id}`);
      console.log(`   File: ${conflict.file_path}`);
      console.log(`   Detected: ${new Date(conflict.detected_at).toISOString()}`);
      console.log(`   Resolved: ${conflict.resolved_at ? new Date(conflict.resolved_at).toISOString() : 'Not resolved'}`);
      console.log(`   Action: ${conflict.resolution_action || 'None'}`);
    });
  }

  private async changeAgent() {
    console.log('\n--- Change Agent ID ---');
    const newAgent = await question(`Enter new agent ID (current: ${this.currentAgent}): `);
    this.currentAgent = newAgent.trim() || this.currentAgent;
    console.log(`✅ Agent ID changed to: ${this.currentAgent}`);
  }

  private async exit() {
    console.log('\nClosing AgentMX...');
    await this.store.close();
    rl.close();
    console.log('Goodbye!');
  }
}

// Run the CLI
const cli = new InteractiveCLI();
cli.start().catch(console.error);
