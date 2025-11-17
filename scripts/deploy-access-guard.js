#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join('ops', 'deploy', 'guardian-status.json');

function ensureStatusDir() {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
}

function writeStatus(payload) {
  ensureStatusDir();
  fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2));
}

async function authenticate() {
  const serviceAccount = process.env.SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) {
    throw new Error('SERVICE_ACCOUNT_JSON is not set');
  }

  const credentials = JSON.parse(serviceAccount);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.webapp.deploy'
    ]
  });

  return auth.getClient();
}

async function runDeployAccessGuard(options = {}) {
  const scriptId = process.env.SCRIPT_ID;
  const checks = [];
  let success = true;

  const record = (name, ok, info = null) => {
    if (!ok) success = false;
    checks.push({ name, ok, info });
  };

  if (!scriptId) {
    record('scriptId', false, 'SCRIPT_ID environment variable is not set');
    writeStatus({
      checkedAt: new Date().toISOString(),
      success: false,
      checks
    });
    return { success: false, checks };
  }

  try {
    const client = await authenticate();
    record('serviceAccountAuth', true, 'Service account authentication successful');

    const script = google.script({ version: 'v1', auth: client });

    try {
      const metadata = await script.projects.get({ scriptId });
      record('projectMetadata', true, `Title: ${metadata.data.title || 'unknown'}`);
    } catch (error) {
      record('projectMetadata', false, error.message);
      writeStatus({ checkedAt: new Date().toISOString(), success: false, checks });
      return { success: false, checks };
    }

    try {
      await script.projects.getContent({ scriptId });
      record('projectContent', true, 'Read access confirmed');
    } catch (error) {
      record('projectContent', false, error.message);
    }

    try {
      await script.projects.versions.list({ scriptId, pageSize: 1 });
      record('versionsList', true, 'Able to list versions');
    } catch (error) {
      record('versionsList', false, error.message);
    }

    try {
      await script.projects.deployments.list({ scriptId, pageSize: 1 });
      record('deploymentsList', true, 'Able to list deployments');
    } catch (error) {
      record('deploymentsList', false, error.message);
    }
  } catch (error) {
    record('serviceAccountAuth', false, error.message);
  }

  const payload = {
    checkedAt: new Date().toISOString(),
    success,
    checks
  };
  writeStatus(payload);

  if (!options.quiet) {
    console.log('═'.repeat(60));
    console.log('  🛡️  Deployment Access Guard');
    console.log('═'.repeat(60));
    checks.forEach(check => {
      const icon = check.ok ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.info || (check.ok ? 'ok' : 'failed')}`);
    });
    console.log(`\nOverall: ${success ? 'READY' : 'BLOCKED'}`);
  }

  return { success, checks };
}

async function main() {
  const result = await runDeployAccessGuard();
  if (!result.success) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Deploy access guard failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runDeployAccessGuard };
