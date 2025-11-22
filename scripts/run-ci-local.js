#!/usr/bin/env node
/**
 * Local CI Runner - Mirrors GitHub Actions CI pipeline
 *
 * Usage:
 *   node scripts/run-ci-local.js           # Full CI (Stage 1 + Stage 2)
 *   node scripts/run-ci-local.js stage1    # Stage 1 only (lint + unit + contract)
 *   node scripts/run-ci-local.js stage2    # Stage 2 only (API + smoke + flows + pages)
 *   node scripts/run-ci-local.js quick     # Quick CI (critical tests only)
 *   node scripts/run-ci-local.js --help    # Show help
 *
 * This script implements the same progressive gating as the CI:
 * - Stage 1 must pass before Stage 2 runs
 * - API tests must pass before smoke tests
 * - Smoke tests must pass before expensive tests (flows + pages)
 */

const { execSync } = require('child_process');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[PASS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[FAIL]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`),
  stage: (msg) => console.log(`\n${colors.bright}${colors.yellow}>>> ${msg}${colors.reset}\n`),
};

/**
 * Run a command and return success/failure
 */
function runCommand(name, command) {
  log.stage(`Running: ${name}`);
  console.log(`$ ${command}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    log.success(`${name} passed`);
    return true;
  } catch (error) {
    log.error(`${name} failed`);
    return false;
  }
}

/**
 * Stage 1: Build & Validate (mirrors stage1-deploy.yml)
 */
async function runStage1() {
  log.header('STAGE 1: Build & Validate');
  log.info('This stage runs: ESLint, Unit Tests, Contract Tests');
  log.info('Mirrors: .github/workflows/stage1-deploy.yml');

  const results = {
    lint: false,
    unitTests: false,
    contractTests: false,
    triangleContracts: false,
  };

  // 1. Lint
  results.lint = runCommand('ESLint (Code Quality)', 'npm run lint');
  if (!results.lint) {
    log.error('Stage 1 BLOCKED: Fix lint errors before proceeding');
    return { success: false, results };
  }

  // 2. Unit Tests
  results.unitTests = runCommand('Unit Tests (Jest)', 'npm run test:unit');
  if (!results.unitTests) {
    log.error('Stage 1 BLOCKED: Fix unit test failures before proceeding');
    return { success: false, results };
  }

  // 3. Contract Tests
  results.contractTests = runCommand('Contract Tests', 'npm run test:contract');
  if (!results.contractTests) {
    log.error('Stage 1 BLOCKED: Fix contract test failures before proceeding');
    return { success: false, results };
  }

  // 4. Triangle Contract Tests (all phases)
  log.stage('Running Triangle Contract Tests (all phases)');
  const triangleResults = [];
  triangleResults.push(runCommand('Triangle Before Contract', 'npm run test:triangle:before:contract'));
  triangleResults.push(runCommand('Triangle During Contract', 'npm run test:triangle:during:contract'));
  triangleResults.push(runCommand('Triangle After Contract', 'npm run test:triangle:after:contract'));
  triangleResults.push(runCommand('Triangle All Contract', 'npm run test:triangle:all:contract'));

  results.triangleContracts = triangleResults.every(r => r);
  if (!results.triangleContracts) {
    log.warn('Triangle contract tests had failures (non-blocking for local dev)');
  }

  return { success: true, results };
}

/**
 * Stage 2: E2E Testing (mirrors stage2-testing.yml)
 */
async function runStage2(skipGates = false) {
  log.header('STAGE 2: E2E Testing (Progressive)');
  log.info('This stage runs: API Tests -> Smoke Tests -> Flows -> Pages');
  log.info('Mirrors: .github/workflows/stage2-testing.yml');
  log.info('Progressive gating: Each stage must pass to proceed');

  const results = {
    apiTests: false,
    smokeTests: false,
    flowTests: false,
    pageTests: false,
  };

  // Check if BASE_URL is set
  if (!process.env.BASE_URL && !process.env.GOOGLE_SCRIPT_URL) {
    log.warn('BASE_URL not set - using default Apps Script URL');
    log.info('Set BASE_URL to test against a specific deployment');
  }

  // Gate 0: API Tests (always run first)
  results.apiTests = runCommand('API Tests (Critical)', 'npm run test:api');
  if (!results.apiTests && !skipGates) {
    log.error('Stage 2 Gate 1 BLOCKED: API tests failed');
    log.info('Fix API issues before running smoke tests');
    return { success: false, results, stoppedAt: 'api' };
  }

  // Gate 1: Smoke Tests
  results.smokeTests = runCommand('Smoke Tests (Critical)', 'npm run test:smoke');
  if (!results.smokeTests && !skipGates) {
    log.error('Stage 2 Gate 2 BLOCKED: Smoke tests failed');
    log.info('Fix smoke test issues before running expensive tests');
    return { success: false, results, stoppedAt: 'smoke' };
  }

  // Expensive tests (only if previous gates passed)
  log.stage('Running Expensive Tests (Flow + Page)');

  results.flowTests = runCommand('Flow Tests (Expensive)', 'npm run test:flows');
  results.pageTests = runCommand('Page Tests (Expensive)', 'npm run test:pages');

  const expensivePassed = results.flowTests && results.pageTests;
  if (!expensivePassed) {
    log.warn('Some expensive tests failed - review test reports');
  }

  return {
    success: results.apiTests && results.smokeTests && expensivePassed,
    results
  };
}

/**
 * Quick CI - Critical tests only
 */
async function runQuickCI() {
  log.header('QUICK CI: Critical Tests Only');
  log.info('Runs: Lint -> Unit -> Contract -> API -> Smoke');
  log.info('Use this before committing for fast feedback');

  const results = {
    lint: false,
    unitTests: false,
    contractTests: false,
    apiTests: false,
    smokeTests: false,
  };

  // Stage 1 critical
  results.lint = runCommand('ESLint', 'npm run lint');
  if (!results.lint) return { success: false, results };

  results.unitTests = runCommand('Unit Tests', 'npm run test:unit');
  if (!results.unitTests) return { success: false, results };

  results.contractTests = runCommand('Contract Tests', 'npm run test:contract');
  if (!results.contractTests) return { success: false, results };

  // Stage 2 critical
  results.apiTests = runCommand('API Tests', 'npm run test:api');
  if (!results.apiTests) return { success: false, results };

  results.smokeTests = runCommand('Smoke Tests', 'npm run test:smoke');

  return { success: results.smokeTests, results };
}

/**
 * Print summary
 */
function printSummary(stage1Results, stage2Results) {
  log.header('CI SUMMARY');

  console.log('Stage 1 (Build & Validate):');
  if (stage1Results) {
    console.log(`  Lint:              ${stage1Results.results.lint ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Unit Tests:        ${stage1Results.results.unitTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Contract Tests:    ${stage1Results.results.contractTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Triangle Contracts:${stage1Results.results.triangleContracts ? colors.green + 'PASS' : colors.yellow + 'WARN'}${colors.reset}`);
    console.log(`  Overall:           ${stage1Results.success ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
  } else {
    console.log('  (skipped)');
  }

  console.log('\nStage 2 (E2E Testing):');
  if (stage2Results) {
    console.log(`  API Tests:         ${stage2Results.results.apiTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Smoke Tests:       ${stage2Results.results.smokeTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Flow Tests:        ${stage2Results.results.flowTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Page Tests:        ${stage2Results.results.pageTests ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    console.log(`  Overall:           ${stage2Results.success ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
    if (stage2Results.stoppedAt) {
      console.log(`  ${colors.yellow}(stopped at ${stage2Results.stoppedAt} due to gate failure)${colors.reset}`);
    }
  } else {
    console.log('  (skipped - Stage 1 failed)');
  }

  const overallSuccess = (stage1Results?.success ?? true) && (stage2Results?.success ?? true);
  console.log(`\n${colors.bright}OVERALL: ${overallSuccess ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);

  return overallSuccess;
}

/**
 * Print help
 */
function printHelp() {
  console.log(`
${colors.bright}Local CI Runner - Mirrors GitHub Actions CI Pipeline${colors.reset}

${colors.cyan}USAGE:${colors.reset}
  node scripts/run-ci-local.js [command]
  npm run ci:local [command]

${colors.cyan}COMMANDS:${colors.reset}
  (none)    Run full CI (Stage 1 + Stage 2)
  stage1    Run Stage 1 only (lint, unit, contract tests)
  stage2    Run Stage 2 only (API, smoke, flow, page tests)
  quick     Run quick CI (critical tests only - fast feedback)
  --help    Show this help

${colors.cyan}EXAMPLES:${colors.reset}
  # Full CI before creating a PR
  npm run ci:local

  # Quick check before committing
  npm run ci:local quick

  # Just validate Stage 1 (no deployment needed)
  npm run ci:local stage1

  # Run Stage 2 against a specific URL
  BASE_URL=https://your-deployment.com npm run ci:local stage2

${colors.cyan}ENVIRONMENT VARIABLES:${colors.reset}
  BASE_URL            Deployment URL for E2E tests
  GOOGLE_SCRIPT_URL   Alternative to BASE_URL

${colors.cyan}CI PARITY:${colors.reset}
  This script mirrors the exact behavior of the GitHub Actions workflows:
  - stage1-deploy.yml   -> npm run ci:local stage1
  - stage2-testing.yml  -> npm run ci:local stage2

${colors.cyan}NPM SCRIPTS (EQUIVALENT):${colors.reset}
  npm run test:ci:stage1     Stage 1 tests only
  npm run test:ci:stage2     Stage 2 tests only
  npm run test:ci            Full CI pipeline
  npm run test:ci:quick      Quick critical tests
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  if (command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  console.log(`
${colors.bright}${colors.cyan}
  ╔═══════════════════════════════════════════════════════════╗
  ║           LOCAL CI RUNNER - MVP Event Toolkit             ║
  ║                                                           ║
  ║  Mirrors GitHub Actions for local development parity      ║
  ╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  let stage1Results = null;
  let stage2Results = null;
  let success = false;

  switch (command) {
    case 'stage1':
      stage1Results = await runStage1();
      success = stage1Results.success;
      printSummary(stage1Results, null);
      break;

    case 'stage2':
      stage2Results = await runStage2();
      success = stage2Results.success;
      printSummary(null, stage2Results);
      break;

    case 'quick': {
      const quickResults = await runQuickCI();
      console.log(`\n${colors.bright}QUICK CI: ${quickResults.success ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
      success = quickResults.success;
      break;
    }

    case 'full':
    default:
      stage1Results = await runStage1();
      if (stage1Results.success) {
        stage2Results = await runStage2();
      }
      success = printSummary(stage1Results, stage2Results);
      break;
  }

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
