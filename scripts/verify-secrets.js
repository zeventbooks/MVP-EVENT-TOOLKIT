#!/usr/bin/env node

/**
 * Verify Google Cloud Secrets Configuration
 *
 * This script checks if all required secrets and configurations are properly set up
 * for GitHub Actions deployment.
 *
 * Usage:
 *   node scripts/verify-secrets.js
 *
 * Or with environment variables:
 *   SERVICE_ACCOUNT_JSON='...' SCRIPT_ID='...' node scripts/verify-secrets.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Expected configuration values
const EXPECTED = {
  scriptId: '1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l',
  serviceAccountEmail: 'apps-script-deployer@zeventbooks.iam.gserviceaccount.com',
  serviceAccountId: '103062520768864288562',
  gcpProject: 'zeventbooks',
};

// Verification results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: [],
};

/**
 * Print section header
 */
function printHeader(title) {
  console.log('');
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.cyan + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log('');
}

/**
 * Print check result
 */
function printCheck(passed, message, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;

  console.log(`${color}${icon} ${message}${colors.reset}`);

  if (details) {
    console.log(`   ${colors.yellow}${details}${colors.reset}`);
  }

  results.checks.push({ passed, message, details });

  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Print warning
 */
function printWarning(message, details = '') {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);

  if (details) {
    console.log(`   ${details}`);
  }

  results.warnings++;
}

/**
 * Print info
 */
function printInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

/**
 * Check if environment variable is set
 */
function checkEnvVar(name, required = true) {
  const value = process.env[name];

  if (!value) {
    if (required) {
      printCheck(false, `${name} is set`, 'Environment variable is not set');
    } else {
      printWarning(`${name} is not set`, 'This is optional but recommended');
    }
    return null;
  }

  printCheck(true, `${name} is set`);
  return value;
}

/**
 * Validate JSON structure
 */
function validateJSON(jsonString, name) {
  try {
    const parsed = JSON.parse(jsonString);
    printCheck(true, `${name} is valid JSON`);
    return parsed;
  } catch (error) {
    printCheck(false, `${name} is valid JSON`, `Parse error: ${error.message}`);
    return null;
  }
}

/**
 * Validate service account JSON structure
 */
function validateServiceAccountJSON(json) {
  const requiredFields = [
    'type',
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri',
  ];

  let allFieldsPresent = true;

  for (const field of requiredFields) {
    if (!json[field]) {
      printCheck(false, `Service account JSON has field: ${field}`, 'Field is missing or empty');
      allFieldsPresent = false;
    }
  }

  if (allFieldsPresent) {
    printCheck(true, 'Service account JSON has all required fields');
  }

  // Validate specific values
  if (json.type !== 'service_account') {
    printCheck(false, 'Service account type is correct', `Expected "service_account", got "${json.type}"`);
  } else {
    printCheck(true, 'Service account type is correct');
  }

  if (json.project_id !== EXPECTED.gcpProject) {
    printWarning(
      'Service account project_id differs from expected',
      `Expected: ${EXPECTED.gcpProject}, Got: ${json.project_id}`
    );
  } else {
    printCheck(true, 'Service account project_id matches expected value');
  }

  if (json.client_email !== EXPECTED.serviceAccountEmail) {
    printWarning(
      'Service account email differs from expected',
      `Expected: ${EXPECTED.serviceAccountEmail}, Got: ${json.client_email}`
    );
  } else {
    printCheck(true, 'Service account email matches expected value');
  }

  if (json.client_id !== EXPECTED.serviceAccountId) {
    printWarning(
      'Service account ID differs from expected',
      `Expected: ${EXPECTED.serviceAccountId}, Got: ${json.client_id}`
    );
  } else {
    printCheck(true, 'Service account ID matches expected value');
  }

  // Check private key format
  if (json.private_key && json.private_key.includes('BEGIN PRIVATE KEY')) {
    printCheck(true, 'Private key appears to be in correct format');
  } else {
    printCheck(false, 'Private key appears to be in correct format', 'Should contain PEM-formatted key');
  }
}

/**
 * Validate Script ID
 */
function validateScriptId(scriptId) {
  if (scriptId !== EXPECTED.scriptId) {
    printWarning(
      'SCRIPT_ID differs from expected',
      `Expected: ${EXPECTED.scriptId}\nGot: ${scriptId}`
    );
  } else {
    printCheck(true, 'SCRIPT_ID matches expected value');
  }

  // Check format (should be alphanumeric with hyphens/underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(scriptId)) {
    printCheck(true, 'SCRIPT_ID format is valid');
  } else {
    printCheck(false, 'SCRIPT_ID format is valid', 'Should only contain alphanumeric, hyphens, and underscores');
  }
}

/**
 * Check if Config.gs exists and can be read
 */
function checkConfigFile() {
  const configPath = path.join(process.cwd(), 'Config.gs');

  if (!fs.existsSync(configPath)) {
    printCheck(false, 'Config.gs file exists', 'File not found');
    return null;
  }

  printCheck(true, 'Config.gs file exists');

  try {
    const content = fs.readFileSync(configPath, 'utf8');

    // Check for placeholder admin secrets
    if (content.includes('CHANGE_ME_')) {
      printWarning(
        'Config.gs contains placeholder admin secrets',
        'Replace CHANGE_ME_* values before production deployment'
      );
    } else {
      printInfo('Config.gs appears to have custom admin secrets (good!)');
    }

    return content;
  } catch (error) {
    printCheck(false, 'Config.gs can be read', error.message);
    return null;
  }
}

/**
 * Check GitHub Actions workflow file
 */
function checkGitHubWorkflow() {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');

  if (!fs.existsSync(workflowPath)) {
    printWarning('GitHub Actions workflow file exists', 'File not found: .github/workflows/ci.yml');
    return;
  }

  printCheck(true, 'GitHub Actions workflow file exists');

  try {
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Check for required secrets in workflow
    const requiredSecrets = [
      'APPS_SCRIPT_SERVICE_ACCOUNT_JSON',
      'SCRIPT_ID',
      'ADMIN_KEY_ROOT',
    ];

    for (const secret of requiredSecrets) {
      if (content.includes(`secrets.${secret}`)) {
        printCheck(true, `Workflow references secret: ${secret}`);
      } else {
        printWarning(`Workflow references secret: ${secret}`, 'Not found in workflow file');
      }
    }
  } catch (error) {
    printWarning('GitHub Actions workflow can be read', error.message);
  }
}

/**
 * Print summary
 */
function printSummary() {
  console.log('');
  console.log(colors.bright + '─'.repeat(70) + colors.reset);

  const totalChecks = results.passed + results.failed;
  const passRate = totalChecks > 0 ? Math.round((results.passed / totalChecks) * 100) : 0;

  console.log(`${colors.bright}✅ Passed:${colors.reset} ${colors.green}${results.passed}${colors.reset}`);
  console.log(`${colors.bright}❌ Failed:${colors.reset} ${colors.red}${results.failed}${colors.reset}`);
  console.log(`${colors.bright}⚠️  Warnings:${colors.reset} ${colors.yellow}${results.warnings}${colors.reset}`);
  console.log(`${colors.bright}📊 Pass Rate:${colors.reset} ${passRate}%`);

  console.log(colors.bright + '─'.repeat(70) + colors.reset);
  console.log('');

  if (results.failed === 0 && results.warnings === 0) {
    console.log(colors.green + colors.bright + '🎉 ALL CHECKS PASSED!' + colors.reset);
    console.log(colors.green + 'Your configuration is ready for deployment.' + colors.reset);
  } else if (results.failed === 0) {
    console.log(colors.yellow + '⚠️  CONFIGURATION HAS WARNINGS' + colors.reset);
    console.log(colors.yellow + 'Review warnings above and address if needed.' + colors.reset);
  } else {
    console.log(colors.red + '❌ CONFIGURATION HAS ERRORS' + colors.reset);
    console.log(colors.red + 'Fix errors above before deploying.' + colors.reset);
  }

  console.log('');
}

/**
 * Print usage instructions
 * @private Reserved for future use
 */
function _printUsage() {
  console.log('');
  console.log(colors.bright + 'Usage:' + colors.reset);
  console.log('  node scripts/verify-secrets.js');
  console.log('');
  console.log(colors.bright + 'With environment variables:' + colors.reset);
  console.log('  SERVICE_ACCOUNT_JSON=\'...\' SCRIPT_ID=\'...\' node scripts/verify-secrets.js');
  console.log('');
  console.log(colors.bright + 'What this script checks:' + colors.reset);
  console.log('  - Environment variables are set');
  console.log('  - Service account JSON is valid and has correct structure');
  console.log('  - SCRIPT_ID matches expected value');
  console.log('  - Config.gs file exists and is readable');
  console.log('  - GitHub Actions workflow references required secrets');
  console.log('');
}

/**
 * Main verification function
 */
async function main() {
  console.log('');
  console.log(colors.bright + colors.blue + '╔═══════════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.bright + colors.blue + '║                                                                   ║' + colors.reset);
  console.log(colors.bright + colors.blue + '║           Google Cloud Secrets Verification Tool                  ║' + colors.reset);
  console.log(colors.bright + colors.blue + '║                                                                   ║' + colors.reset);
  console.log(colors.bright + colors.blue + '╚═══════════════════════════════════════════════════════════════════╝' + colors.reset);

  // Check Environment Variables
  printHeader('Environment Variables');

  const serviceAccountJson = checkEnvVar('SERVICE_ACCOUNT_JSON', true);
  const scriptId = checkEnvVar('SCRIPT_ID', true);
  checkEnvVar('ADMIN_KEY_ROOT', false);

  // Validate Service Account JSON
  if (serviceAccountJson) {
    printHeader('Service Account JSON Validation');

    const parsed = validateJSON(serviceAccountJson, 'SERVICE_ACCOUNT_JSON');

    if (parsed) {
      validateServiceAccountJSON(parsed);
    }
  }

  // Validate Script ID
  if (scriptId) {
    printHeader('Script ID Validation');
    validateScriptId(scriptId);
  }

  // Check Project Files
  printHeader('Project Files');
  checkConfigFile();
  checkGitHubWorkflow();

  // Print summary
  printHeader('Summary');
  printSummary();

  // Exit with appropriate code
  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red + '❌ Fatal error:' + colors.reset, error);
    process.exit(1);
  });
}

module.exports = { main };
