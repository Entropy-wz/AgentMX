#!/usr/bin/env node

/**
 * Test project-level control for AgentMX MCP Server
 *
 * This script tests that AgentMX only works in projects with .agentmx-enabled marker file.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '../dist/index.js');

// Create temporary test directories
const tempDir = path.join(os.tmpdir(), 'agentmx-test-' + Date.now());
const enabledProject = path.join(tempDir, 'enabled-project');
const disabledProject = path.join(tempDir, 'disabled-project');

console.log('Setting up test environment...\n');

// Create directories
fs.mkdirSync(enabledProject, { recursive: true });
fs.mkdirSync(disabledProject, { recursive: true });

// Create marker file in enabled project
fs.writeFileSync(path.join(enabledProject, '.agentmx-enabled'), '');

console.log(`✓ Created enabled project: ${enabledProject}`);
console.log(`✓ Created disabled project: ${disabledProject}`);
console.log(`✓ Marker file exists in enabled project: ${fs.existsSync(path.join(enabledProject, '.agentmx-enabled'))}`);
console.log(`✓ Marker file exists in disabled project: ${fs.existsSync(path.join(disabledProject, '.agentmx-enabled'))}\n`);

// Start MCP server
const server = spawn('node', [serverPath], {
  env: {
    ...process.env,
    AGENTMX_DB_PATH: path.join(tempDir, 'test.db'),
    AGENTMX_AGENT_ID: 'test-agent',
    AGENTMX_LOG_LEVEL: 'ERROR' // Suppress logs for cleaner output
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';
let testResults = [];

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        testResults.push(response);
      } catch (e) {
        // Ignore non-JSON output
      }
    }
  });
});

function sendRequest(id, method, params = {}) {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params
  }) + '\n');
}

// Test sequence
setTimeout(() => {
  console.log('Test 1: Call record_file_read in ENABLED project...');
  sendRequest(1, 'tools/call', {
    name: 'record_file_read',
    arguments: {
      file_path: path.join(enabledProject, 'test.txt'),
      content_hash: 'abc123',
      project_path: enabledProject
    }
  });
}, 500);

setTimeout(() => {
  console.log('Test 2: Call record_file_read in DISABLED project...');
  sendRequest(2, 'tools/call', {
    name: 'record_file_read',
    arguments: {
      file_path: path.join(disabledProject, 'test.txt'),
      content_hash: 'abc123',
      project_path: disabledProject
    }
  });
}, 1500);

setTimeout(() => {
  console.log('Test 3: Call check_conflicts in ENABLED project...');
  sendRequest(3, 'tools/call', {
    name: 'check_conflicts',
    arguments: {
      file_path: path.join(enabledProject, 'test.txt'),
      project_path: enabledProject
    }
  });
}, 2500);

setTimeout(() => {
  console.log('Test 4: Call check_conflicts in DISABLED project...');
  sendRequest(4, 'tools/call', {
    name: 'check_conflicts',
    arguments: {
      file_path: path.join(disabledProject, 'test.txt'),
      project_path: disabledProject
    }
  });
}, 3500);

// Evaluate results
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Enabled project should succeed
  const test1 = testResults.find(r => r.id === 1);
  if (test1 && test1.result) {
    const content = JSON.parse(test1.result.content[0].text);
    if (content.observation_id) {
      console.log('✓ Test 1 PASSED: Enabled project allows record_file_read');
      passed++;
    } else {
      console.log('✗ Test 1 FAILED: Expected observation_id in response');
      console.log('  Response:', JSON.stringify(content, null, 2));
      failed++;
    }
  } else {
    console.log('✗ Test 1 FAILED: No response received');
    failed++;
  }

  // Test 2: Disabled project should fail with AGENTMX_NOT_ENABLED
  const test2 = testResults.find(r => r.id === 2);
  if (test2 && test2.result) {
    const content = JSON.parse(test2.result.content[0].text);
    if (content.error && content.error.code === 'AGENTMX_NOT_ENABLED') {
      console.log('✓ Test 2 PASSED: Disabled project rejects record_file_read');
      passed++;
    } else {
      console.log('✗ Test 2 FAILED: Expected AGENTMX_NOT_ENABLED error');
      console.log('  Response:', JSON.stringify(content, null, 2));
      failed++;
    }
  } else {
    console.log('✗ Test 2 FAILED: No response received');
    failed++;
  }

  // Test 3: Enabled project should succeed
  const test3 = testResults.find(r => r.id === 3);
  if (test3 && test3.result) {
    const content = JSON.parse(test3.result.content[0].text);
    if (content.has_conflict !== undefined) {
      console.log('✓ Test 3 PASSED: Enabled project allows check_conflicts');
      passed++;
    } else {
      console.log('✗ Test 3 FAILED: Expected has_conflict in response');
      console.log('  Response:', JSON.stringify(content, null, 2));
      failed++;
    }
  } else {
    console.log('✗ Test 3 FAILED: No response received');
    failed++;
  }

  // Test 4: Disabled project should fail with AGENTMX_NOT_ENABLED
  const test4 = testResults.find(r => r.id === 4);
  if (test4 && test4.result) {
    const content = JSON.parse(test4.result.content[0].text);
    if (content.error && content.error.code === 'AGENTMX_NOT_ENABLED') {
      console.log('✓ Test 4 PASSED: Disabled project rejects check_conflicts');
      passed++;
    } else {
      console.log('✗ Test 4 FAILED: Expected AGENTMX_NOT_ENABLED error');
      console.log('  Response:', JSON.stringify(content, null, 2));
      failed++;
    }
  } else {
    console.log('✗ Test 4 FAILED: No response received');
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  // Cleanup
  console.log('Cleaning up...');
  server.kill();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('✓ Cleanup complete\n');

  process.exit(failed > 0 ? 1 : 0);
}, 4500);
