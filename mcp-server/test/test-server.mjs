#!/usr/bin/env node

/**
 * Test script for AgentMX MCP Server
 *
 * This script simulates MCP protocol messages to test the server.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '../dist/index.js');

console.log('Starting AgentMX MCP Server test...\n');

const server = spawn('node', [serverPath], {
  env: {
    ...process.env,
    AGENTMX_DB_PATH: './test-mcp.db',
    AGENTMX_AGENT_ID: 'test-agent',
    AGENTMX_LOG_LEVEL: 'DEBUG'
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });
});

// Test 1: List tools
console.log('Test 1: Listing available tools...');
server.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
}) + '\n');

setTimeout(() => {
  // Test 2: List resources
  console.log('\nTest 2: Listing resources...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list'
  }) + '\n');
}, 1000);

setTimeout(() => {
  // Test 3: Read auto-track instructions
  console.log('\nTest 3: Reading auto-track instructions...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/read',
    params: {
      uri: 'agentmx://auto-track-instructions'
    }
  }) + '\n');
}, 2000);

setTimeout(() => {
  console.log('\nTest completed. Shutting down server...');
  server.kill();
  process.exit(0);
}, 3000);
