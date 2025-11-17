#!/usr/bin/env node

const https = require('https');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join('ops', 'domains', 'config.json');
const STATUS_PATH = path.join('ops', 'domains', 'dns-status.json');

function ensureStatusDir() {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Domain config not found at ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve(fetchUrl(nextUrl, redirects + 1));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          finalUrl: res.responseUrl || url,
          body: Buffer.concat(chunks).toString()
        });
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => request.destroy(new Error('timeout')));
  });
}

async function verifyDns(host) {
  try {
    const records = await dns.resolve(host);
    return { ok: true, records };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function verifyDomains(options = {}) {
  const config = readConfig();
  const results = [];

  for (const domain of config.domains) {
    const url = `${domain.protocol || 'https'}://${domain.host}${domain.path || ''}`;
    const record = await verifyDns(domain.host).catch(err => ({ ok: false, error: err.message }));
    let response;
    try {
      response = await fetchUrl(url);
    } catch (error) {
      response = { statusCode: null, finalUrl: null, error: error.message };
    }

    const target = response?.finalUrl || '';
    const expected = domain.expectedTargetContains || options.expectedTargetContains || '';
    const matchesTarget = expected ? target.includes(expected) : true;
    const ok = record.ok && matchesTarget && (!domain.expectedStatus || domain.expectedStatus === response.statusCode);

    results.push({
      host: domain.host,
      path: domain.path || '/',
      url,
      ok,
      record,
      response,
      expected
    });
  }

  const payload = {
    checkedAt: new Date().toISOString(),
    success: results.every(r => r.ok),
    results
  };

  ensureStatusDir();
  fs.writeFileSync(STATUS_PATH, JSON.stringify(payload, null, 2));

  if (!options.quiet) {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  🌐 Domain & Redirect Verification');
    console.log('══════════════════════════════════════════════════════════════');
    results.forEach(result => {
      const icon = result.ok ? '✅' : '❌';
      console.log(`${icon} ${result.host}${result.path || '/'} → ${result.response?.finalUrl || 'n/a'}`);
      if (!result.ok) {
        console.log(`   DNS: ${result.record.ok ? 'ok' : result.record.error}`);
        console.log(`   Expected target fragment: ${result.expected || 'n/a'}`);
      }
    });
    console.log(`\nOverall: ${payload.success ? 'READY' : 'ACTION REQUIRED'}`);
  }

  return { success: payload.success, results };
}

async function main() {
  const result = await verifyDomains();
  if (!result.success) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Domain verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = { verifyDomains };
