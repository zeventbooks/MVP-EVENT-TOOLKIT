#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const ROTATION_FILE = path.join('ops', 'security', 'admin-secret-rotation.json');

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function loadServiceAccount() {
  const raw = process.env.SERVICE_ACCOUNT_JSON || null;
  if (!raw) {
    fail('SERVICE_ACCOUNT_JSON environment variable is required');
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Failed to parse SERVICE_ACCOUNT_JSON: ${error.message}`);
  }
}

function loadSecrets() {
  let raw = process.env.ADMIN_SECRETS_JSON || null;
  const file = process.env.ADMIN_SECRETS_FILE;

  if (!raw && file) {
    if (!fs.existsSync(file)) {
      fail(`ADMIN_SECRETS_FILE not found: ${file}`);
    }
    raw = fs.readFileSync(file, 'utf8');
  }

  if (!raw) {
    fail('Provide secrets via ADMIN_SECRETS_JSON or ADMIN_SECRETS_FILE');
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    fail(`Failed to parse secrets JSON: ${error.message}`);
  }
}

function enforcePolicy(secrets) {
  const invalidKeys = [];
  const requiredTenants = ['root'];

  for (const tenant of Object.keys(secrets)) {
    const value = String(secrets[tenant] || '');
    if (value.length < 16) {
      invalidKeys.push(`${tenant}: minimum length 16`);
    }
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
      invalidKeys.push(`${tenant}: must include upper, lower, number`);
    }
    if (/secret|changeme|password|1234/i.test(value)) {
      invalidKeys.push(`${tenant}: contains banned keyword`);
    }
  }

  for (const tenant of requiredTenants) {
    if (!secrets[tenant]) {
      invalidKeys.push(`${tenant}: missing required tenant secret`);
    }
  }

  if (invalidKeys.length) {
    fail(`Secret policy violations:\n - ${invalidKeys.join('\n - ')}`);
  }
}

async function getScriptClient(credentials) {
  const scriptId = process.env.SCRIPT_ID;
  if (!scriptId) {
    fail('SCRIPT_ID environment variable is required');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.external_request'
    ]
  });

  const authClient = await auth.getClient();
  const script = google.script({ version: 'v1', auth: authClient });
  return { script, scriptId };
}

function recordRotation(secrets) {
  const payload = {
    lastRotation: new Date().toISOString(),
    tenants: {}
  };

  for (const tenant of Object.keys(secrets)) {
    payload.tenants[tenant] = { rotatedAt: payload.lastRotation };
  }

  const previous = fs.existsSync(ROTATION_FILE)
    ? JSON.parse(fs.readFileSync(ROTATION_FILE, 'utf8'))
    : null;

  const merged = previous || { lastRotation: null, tenants: {} };
  merged.lastRotation = payload.lastRotation;
  merged.tenants = { ...merged.tenants, ...payload.tenants };

  fs.writeFileSync(ROTATION_FILE, JSON.stringify(merged, null, 2));
  console.log(`\n🛡️  Rotation log updated (${ROTATION_FILE})`);
}

async function syncAdminSecrets() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  🔐 Syncing Admin Secrets to Apps Script');
  console.log('══════════════════════════════════════════════════════════════\n');

  const credentials = loadServiceAccount();
  const secrets = loadSecrets();
  enforcePolicy(secrets);

  const { script, scriptId } = await getScriptClient(credentials);

  console.log('📡 Calling setupAdminSecrets_ via Apps Script Execution API...');

  await script.scripts.run({
    scriptId,
    requestBody: {
      function: 'setupAdminSecrets_',
      parameters: [secrets],
      devMode: true
    }
  });

  console.log('✅ Secrets updated successfully');
  recordRotation(secrets);
}

if (require.main === module) {
  syncAdminSecrets().catch(error => {
    console.error('\n❌ Failed to sync secrets');
    console.error(error.response?.data || error.message);
    process.exit(1);
  });
}

module.exports = { syncAdminSecrets };
