#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join('ops', 'monitoring', 'health-history.json');
const DEFAULT_ENDPOINTS = [
  { name: 'root', path: '' },
  { name: 'status', path: '?page=status' },
  { name: 'diagnostics', path: '?page=diagnostics' },
  { name: 'self-test', path: '?page=self-test' },
  { name: 'api-docs', path: '?page=api-docs' }
];

function request(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function ensureHistoryFile() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ runs: [] }, null, 2));
  }
}

async function runHealthMonitor(options = {}) {
  const baseUrl = options.baseUrl || process.env.MONITOR_BASE_URL;
  if (!baseUrl) {
    throw new Error('Set MONITOR_BASE_URL or pass baseUrl option');
  }

  const label = options.label || 'manual';
  const endpoints = options.endpoints || DEFAULT_ENDPOINTS;
  const results = [];
  let allPassed = true;

  for (const endpoint of endpoints) {
    const url = baseUrl + endpoint.path;
    process.stdout.write(`🌐 ${endpoint.name} → ${url}\n`);
    try {
      const response = await request(url);
      const passed = response.status === 200;
      results.push({ ...endpoint, url, status: response.status, passed });
      if (!passed) {
        allPassed = false;
        process.stdout.write(`   ❌ HTTP ${response.status}\n`);
      } else {
        process.stdout.write('   ✅ 200 OK\n');
      }
    } catch (error) {
      results.push({ ...endpoint, url, status: null, passed: false, error: error.message });
      allPassed = false;
      process.stdout.write(`   ❌ ${error.message}\n`);
    }
  }

  if (options.saveHistory !== false) {
    ensureHistoryFile();
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    history.runs.unshift({
      label,
      baseUrl,
      timestamp: new Date().toISOString(),
      passed: allPassed,
      results,
    });
    history.runs = history.runs.slice(0, 50);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }

  return { success: allPassed, results };
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  🩺 Apps Script Health Monitor');
  console.log('══════════════════════════════════════════════════════════════');

  const { success } = await runHealthMonitor({ label: 'manual-cli' });

  if (!success) {
    console.error('\n❌ One or more health checks failed');
    process.exit(1);
  }

  console.log('\n✅ All checks passed');
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Health monitor error');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runHealthMonitor };
