#!/usr/bin/env node

/**
 * Google Apps Script Version Cleanup Script
 *
 * Cleans up old versions to stay under the 200 version limit.
 * Uses the Google Apps Script API to delete old versions.
 *
 * Usage:
 *   node scripts/cleanup-versions.js [--keep N] [--dry-run]
 *
 * Options:
 *   --keep N     Number of versions to keep (default: 50)
 *   --dry-run    Show what would be deleted without actually deleting
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const DEFAULT_KEEP_COUNT = 50;  // Keep last 50 versions by default
const VERSION_LIMIT = 200;
const CLEANUP_THRESHOLD = 180;  // Start cleanup when we hit this many versions

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepIndex = args.indexOf('--keep');
const keepCount = keepIndex !== -1 ? parseInt(args[keepIndex + 1], 10) : DEFAULT_KEEP_COUNT;

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}${message}${colors.reset}`);
}

/**
 * Read and parse OAuth credentials from ~/.clasprc.json
 */
function getCredentials() {
  const clasprcPath = path.join(process.env.HOME || process.env.USERPROFILE, '.clasprc.json');

  if (!fs.existsSync(clasprcPath)) {
    throw new Error(`No credentials found at ${clasprcPath}. Run 'npx clasp login' first.`);
  }

  const clasprc = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));

  // Handle different credential formats
  if (clasprc.token && clasprc.token.access_token) {
    return clasprc.token;
  } else if (clasprc.access_token) {
    return clasprc;
  } else {
    throw new Error('Invalid credentials format in .clasprc.json');
  }
}

/**
 * Read script ID from .clasp.json
 */
function getScriptId() {
  const claspJsonPath = path.join(process.cwd(), '.clasp.json');

  if (!fs.existsSync(claspJsonPath)) {
    throw new Error('No .clasp.json found in current directory');
  }

  const claspJson = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));

  if (!claspJson.scriptId) {
    throw new Error('No scriptId found in .clasp.json');
  }

  return claspJson.scriptId;
}

/**
 * Make an HTTPS request to the Apps Script API
 */
function apiRequest(method, endpoint, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'script.googleapis.com',
      path: `/v1${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * List all versions for a script
 */
async function listVersions(scriptId, accessToken) {
  const versions = [];
  let pageToken = null;

  do {
    const endpoint = `/projects/${scriptId}/versions${pageToken ? `?pageToken=${pageToken}` : ''}`;
    const response = await apiRequest('GET', endpoint, accessToken);

    if (response.versions) {
      versions.push(...response.versions);
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return versions;
}

/**
 * Delete a specific version
 */
async function deleteVersion(scriptId, versionNumber, accessToken) {
  const endpoint = `/projects/${scriptId}/versions/${versionNumber}`;
  return apiRequest('DELETE', endpoint, accessToken);
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('');
  log('════════════════════════════════════════════════════════════════', 'blue');
  log('  GOOGLE APPS SCRIPT VERSION CLEANUP', 'blue');
  log('════════════════════════════════════════════════════════════════', 'blue');
  console.log('');

  if (dryRun) {
    log('🔍 DRY RUN MODE - No versions will be deleted', 'yellow');
    console.log('');
  }

  try {
    // Get credentials and script ID
    log('Step 1: Loading credentials...', 'blue');
    const credentials = getCredentials();
    const scriptId = getScriptId();
    log(`  Script ID: ${scriptId}`, 'reset');
    log('  ✓ Credentials loaded', 'green');
    console.log('');

    // List all versions
    log('Step 2: Fetching versions...', 'blue');
    const versions = await listVersions(scriptId, credentials.access_token);
    log(`  Found ${versions.length} versions (limit: ${VERSION_LIMIT})`, 'reset');
    console.log('');

    // Check if cleanup is needed
    if (versions.length < CLEANUP_THRESHOLD) {
      log(`✅ No cleanup needed. ${versions.length} versions is below threshold (${CLEANUP_THRESHOLD})`, 'green');
      console.log('');
      process.exit(0);
    }

    // Sort versions by version number (descending - newest first)
    versions.sort((a, b) => b.versionNumber - a.versionNumber);

    // Determine which versions to delete
    const versionsToKeep = versions.slice(0, keepCount);
    const versionsToDelete = versions.slice(keepCount);

    log(`Step 3: Planning cleanup...`, 'blue');
    log(`  Versions to keep: ${versionsToKeep.length} (newest)`, 'green');
    log(`  Versions to delete: ${versionsToDelete.length}`, 'yellow');
    console.log('');

    if (versionsToDelete.length === 0) {
      log('✅ No versions need to be deleted', 'green');
      console.log('');
      process.exit(0);
    }

    // Show versions to be kept
    log('Keeping these versions:', 'reset');
    versionsToKeep.slice(0, 5).forEach(v => {
      log(`  - Version ${v.versionNumber}: ${v.description || '(no description)'}`, 'reset');
    });
    if (versionsToKeep.length > 5) {
      log(`  ... and ${versionsToKeep.length - 5} more`, 'reset');
    }
    console.log('');

    // Show versions to be deleted
    log('Deleting these versions:', 'yellow');
    versionsToDelete.slice(0, 5).forEach(v => {
      log(`  - Version ${v.versionNumber}: ${v.description || '(no description)'}`, 'yellow');
    });
    if (versionsToDelete.length > 5) {
      log(`  ... and ${versionsToDelete.length - 5} more`, 'yellow');
    }
    console.log('');

    // Perform deletion
    if (dryRun) {
      log('🔍 DRY RUN: Would delete ' + versionsToDelete.length + ' versions', 'yellow');
    } else {
      log('Step 4: Deleting old versions...', 'blue');

      let deleted = 0;
      let errors = 0;

      for (const version of versionsToDelete) {
        process.stdout.write(`  Deleting version ${version.versionNumber}... `);
        try {
          await deleteVersion(scriptId, version.versionNumber, credentials.access_token);
          log('✓', 'green');
          deleted++;
        } catch (error) {
          // Some versions may not be deletable (e.g., in use by deployments)
          if (error.message.includes('FAILED_PRECONDITION') ||
              error.message.includes('in use') ||
              error.message.includes('deployed')) {
            log('⚠ (in use by deployment)', 'yellow');
          } else {
            log(`✗ ${error.message}`, 'red');
            errors++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('');
      log(`════════════════════════════════════════════════════════════════`, 'blue');
      log('  CLEANUP COMPLETE', 'blue');
      log(`════════════════════════════════════════════════════════════════`, 'blue');
      console.log('');
      log(`  ✓ Deleted: ${deleted} versions`, 'green');
      if (errors > 0) {
        log(`  ✗ Errors: ${errors} versions`, 'red');
      }
      log(`  Remaining: ~${versions.length - deleted} versions`, 'reset');
      console.log('');
    }

    process.exit(0);

  } catch (error) {
    console.log('');
    logError('❌ ERROR: ' + error.message);
    console.log('');

    // Provide helpful guidance
    if (error.message.includes('401') || error.message.includes('403')) {
      log('🔧 Authentication failed. Try:', 'yellow');
      log('   1. Run: npx clasp login', 'reset');
      log('   2. Or update OAUTH_CREDENTIALS GitHub secret', 'reset');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      log('🔧 Permission denied. Ensure you have Editor access to the script.', 'yellow');
    } else if (error.message.includes('versions')) {
      log('🔧 Version deletion may not be supported for this script.', 'yellow');
      log('   Manual cleanup may be required:', 'reset');
      log('   1. Go to https://script.google.com/home/projects/{SCRIPT_ID}/versions', 'reset');
      log('   2. Delete old versions manually', 'reset');
    }

    console.log('');
    process.exit(1);
  }
}

// Run cleanup
cleanup();
