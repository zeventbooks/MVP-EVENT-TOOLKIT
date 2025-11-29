#!/usr/bin/env node
/**
 * Story 15: ci:all Single Gate
 *
 * A single, definitive CI gate that runs all local validations.
 * This is the "one command to rule them all" for local CI.
 *
 * Usage:
 *   npm run ci:all           # Run the complete gate
 *   npm run ci:all -- --json # Output JSON for CI systems
 *   npm run ci:all -- --fast # Skip non-critical tests
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more checks failed
 *
 * This gate includes:
 *   1. ESLint (code quality)
 *   2. Unit tests (business logic)
 *   3. Contract tests (API schema validation)
 *   4. Schema consistency (ApiSchemas.gs sync)
 *
 * Story 14 Integration: Each run gets a correlation ID for tracing.
 */

const { execSync } = require('child_process');

// Generate correlation ID for this CI run (Story 14 integration)
function generateRunId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ci-${timestamp}-${random}`;
}

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// Parse CLI args
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const fastMode = args.includes('--fast');
const verbose = args.includes('--verbose') || args.includes('-v');

// Run configuration
const runId = generateRunId();
const startTime = Date.now();

// Results collector
const results = {
  runId,
  timestamp: new Date().toISOString(),
  mode: fastMode ? 'fast' : 'full',
  checks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  timing: {
    startTime: startTime,
    endTime: null,
    durationMs: null,
  },
};

/**
 * Log to console (unless JSON mode)
 */
function log(msg, color = c.white) {
  if (!jsonOutput) {
    console.log(`${color}${msg}${c.reset}`);
  }
}

/**
 * Print the CI gate header
 */
function printHeader() {
  if (jsonOutput) return;

  console.log(`
${c.cyan}${c.bold}╔════════════════════════════════════════════════════════════════╗
║                    CI:ALL SINGLE GATE                          ║
║                   Story 15 Implementation                      ║
╚════════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}Run ID: ${runId}${c.reset}
${c.dim}Mode: ${fastMode ? 'FAST (critical only)' : 'FULL (all checks)'}${c.reset}
${c.dim}Started: ${new Date().toLocaleTimeString()}${c.reset}
`);
}

/**
 * Run a single check
 */
function runCheck(name, command, options = {}) {
  const { critical = true, skipInFastMode = false } = options;

  // Skip if in fast mode and this check can be skipped
  if (fastMode && skipInFastMode) {
    const result = {
      name,
      command,
      status: 'skipped',
      critical,
      durationMs: 0,
      output: null,
      error: null,
    };
    results.checks.push(result);
    results.summary.skipped++;
    results.summary.total++;
    log(`${c.yellow}⊘${c.reset} ${c.dim}${name} (skipped in fast mode)${c.reset}`);
    return true;
  }

  const checkStart = Date.now();
  log(`${c.blue}▶${c.reset} ${name}...`, c.white);

  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: verbose ? 'inherit' : 'pipe',
      env: { ...process.env, FORCE_COLOR: '1', CI: 'true' },
    });

    const durationMs = Date.now() - checkStart;
    const result = {
      name,
      command,
      status: 'passed',
      critical,
      durationMs,
      output: verbose ? null : (output || '').slice(-1000), // Last 1KB
      error: null,
    };
    results.checks.push(result);
    results.summary.passed++;
    results.summary.total++;

    log(`${c.green}✓${c.reset} ${name} ${c.dim}(${formatDuration(durationMs)})${c.reset}`);
    return true;
  } catch (err) {
    const durationMs = Date.now() - checkStart;
    const result = {
      name,
      command,
      status: 'failed',
      critical,
      durationMs,
      output: err.stdout ? err.stdout.slice(-2000) : null,
      error: err.stderr ? err.stderr.slice(-2000) : (err.message || 'Unknown error'),
    };
    results.checks.push(result);
    results.summary.failed++;
    results.summary.total++;

    log(`${c.red}✗${c.reset} ${name} ${c.dim}(${formatDuration(durationMs)})${c.reset}`, c.red);

    // Show error snippet in non-JSON mode
    if (!jsonOutput && err.stderr) {
      const lines = err.stderr.split('\n').slice(-5).join('\n');
      log(`  ${c.dim}${lines}${c.reset}`);
    }

    return !critical; // Return true only if non-critical
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Print results summary
 */
function printSummary() {
  results.timing.endTime = Date.now();
  results.timing.durationMs = results.timing.endTime - results.timing.startTime;

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const allPassed = results.summary.failed === 0;

  console.log(`
${c.cyan}${c.bold}════════════════════════════════════════════════════════════════${c.reset}
${c.bold}                         GATE SUMMARY${c.reset}
${c.cyan}════════════════════════════════════════════════════════════════${c.reset}

${c.bold}Checks:${c.reset}
  ${c.green}Passed:${c.reset}  ${results.summary.passed}
  ${c.red}Failed:${c.reset}  ${results.summary.failed}
  ${c.yellow}Skipped:${c.reset} ${results.summary.skipped}
  ${c.white}Total:${c.reset}   ${results.summary.total}

${c.bold}Timing:${c.reset}
  Total Duration: ${formatDuration(results.timing.durationMs)}

${c.bold}Run ID:${c.reset} ${c.dim}${runId}${c.reset}
`);

  // Per-check timing breakdown
  if (verbose) {
    console.log(`${c.bold}Check Breakdown:${c.reset}`);
    results.checks.forEach(check => {
      const icon = check.status === 'passed' ? c.green + '✓' :
                   check.status === 'failed' ? c.red + '✗' :
                   c.yellow + '⊘';
      console.log(`  ${icon}${c.reset} ${check.name}: ${formatDuration(check.durationMs)}`);
    });
    console.log('');
  }

  // Final verdict
  if (allPassed) {
    console.log(`${c.bgGreen}${c.white}${c.bold}                    ✓ GATE PASSED                              ${c.reset}`);
    console.log(`\n${c.green}All checks passed. Ready to commit/push.${c.reset}\n`);
  } else {
    console.log(`${c.bgRed}${c.white}${c.bold}                    ✗ GATE FAILED                              ${c.reset}`);
    console.log(`\n${c.red}${results.summary.failed} check(s) failed. Fix issues before proceeding.${c.reset}`);

    // List failed checks
    const failed = results.checks.filter(c => c.status === 'failed');
    if (failed.length > 0) {
      console.log(`\n${c.bold}Failed Checks:${c.reset}`);
      failed.forEach(check => {
        console.log(`  ${c.red}•${c.reset} ${check.name}`);
        if (check.critical) {
          console.log(`    ${c.dim}(critical - blocks gate)${c.reset}`);
        }
      });
    }

    console.log(`\n${c.dim}Use '${c.white}npm run ci:all -- --verbose${c.dim}' for detailed output${c.reset}\n`);
  }
}

/**
 * Main gate runner
 */
async function main() {
  printHeader();

  let allCriticalPassed = true;

  // ═══════════════════════════════════════════════════════════════
  // GATE 1: Code Quality (ESLint)
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[1/6] Code Quality${c.reset}`, c.cyan);
  if (!runCheck('ESLint', 'npm run lint', { critical: true })) {
    allCriticalPassed = false;
    if (!fastMode) {
      log(`${c.yellow}⚠ Lint failed - continuing to collect all failures${c.reset}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GATE 2: Unit Tests
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[2/6] Unit Tests${c.reset}`, c.cyan);
  if (!runCheck('Jest Unit Tests', 'npm run test:unit', { critical: true })) {
    allCriticalPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // GATE 3: Contract Tests
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[3/6] Contract Tests${c.reset}`, c.cyan);
  if (!runCheck('API Contract Tests', 'npm run test:contract', { critical: true })) {
    allCriticalPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // GATE 4: Schema Validation
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[4/6] Schema Validation${c.reset}`, c.cyan);

  // Schema sync test (validates ApiSchemas.gs matches test schemas)
  if (!runCheck('Schema Sync', 'npm run test:schemas', { critical: true })) {
    allCriticalPassed = false;
  }

  // Bundle contracts (validates bundle structure)
  if (!runCheck('Bundle Contracts', 'npm run test:story8', { critical: false, skipInFastMode: true })) {
    // Non-critical - warn but don't fail
  }

  // ═══════════════════════════════════════════════════════════════
  // GATE 5: MVP Surface & Dead Export Guards
  // Prevents zombie APIs and non-MVP surfaces from creeping in
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[5/6] MVP Guards${c.reset}`, c.cyan);

  // Surface check - validates only 5 MVP surfaces are referenced
  if (!runCheck('MVP Surfaces', 'node scripts/check-surfaces.js', { critical: true })) {
    allCriticalPassed = false;
  }

  // Dead export check - detects unused api_* functions in Code.gs
  if (!runCheck('Dead Exports', 'node scripts/check-dead-code.js --fail-on-dead', { critical: true })) {
    allCriticalPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // GATE 6: Surface → Schema Fields Linter
  // Prevents schema drift - surfaces only read fields in JSON schema
  // ═══════════════════════════════════════════════════════════════
  log(`\n${c.bold}[6/6] Schema Fields${c.reset}`, c.cyan);

  // Schema fields check - validates HTML surfaces only reference schema-defined fields
  if (!runCheck('Schema Fields', 'node scripts/check-schema-fields.js', { critical: true })) {
    allCriticalPassed = false;
  }

  // Print final summary
  printSummary();

  // Exit with appropriate code
  process.exit(allCriticalPassed ? 0 : 1);
}

// Run the gate
main().catch(err => {
  if (!jsonOutput) {
    console.error(`${c.red}Gate runner error: ${err.message}${c.reset}`);
  } else {
    results.error = err.message;
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit(1);
});
