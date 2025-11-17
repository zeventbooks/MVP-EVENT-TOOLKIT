#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join('coverage', 'coverage-summary.json');
const COVERAGE_FINAL = path.join('coverage', 'coverage-final.json');
const REPORT_FILE = path.join('.quality-gate-report.json');
const THRESHOLDS = {
  lines: 60,
  statements: 60,
  functions: 55,
  branches: 40,
};

function runTests() {
  console.log('\n🧪 Running Jest with coverage (test:jest)...');
  execSync('npm run test:jest', { stdio: 'inherit' });
}

function aggregateFromFinal() {
  if (!fs.existsSync(COVERAGE_FINAL)) {
    throw new Error(
      `Coverage summary not found at ${COVERAGE_FILE} or ${COVERAGE_FINAL}`
    );
  }

  const data = JSON.parse(fs.readFileSync(COVERAGE_FINAL, 'utf8'));
  const totals = {
    lines: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
  };

  Object.values(data).forEach(entry => {
    ['lines', 'statements', 'functions', 'branches'].forEach(metric => {
      const stats = entry[metric];
      if (stats) {
        totals[metric].covered += stats.covered || 0;
        totals[metric].total += stats.total || 0;
      }
    });
  });

  const pct = metric => {
    const { covered, total } = totals[metric];
    if (total === 0) return 100;
    return Math.round((covered / total) * 10000) / 100;
  };

  return {
    lines: pct('lines'),
    statements: pct('statements'),
    functions: pct('functions'),
    branches: pct('branches'),
  };
}

function readCoverage() {
  if (fs.existsSync(COVERAGE_FILE)) {
    const json = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    const total = json.total;
    return {
      lines: total.lines.pct,
      statements: total.statements.pct,
      functions: total.functions.pct,
      branches: total.branches.pct,
    };
  }

  return aggregateFromFinal();
}

function evaluate(coverage) {
  const failures = [];
  for (const [metric, required] of Object.entries(THRESHOLDS)) {
    const actual = coverage[metric];
    if (actual < required) {
      failures.push(`${metric} ${actual}% < required ${required}%`);
    }
  }
  return failures;
}

function writeReport(coverage, failures) {
  const payload = {
    generatedAt: new Date().toISOString(),
    coverage,
    thresholds: THRESHOLDS,
    status: failures.length ? 'failed' : 'passed',
    failures,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(payload, null, 2));
  console.log(`\n📝 Quality gate report written to ${REPORT_FILE}`);
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  📊 Quality Gate (tests + coverage enforcement)');
  console.log('══════════════════════════════════════════════════════════════');

  runTests();
  const coverage = readCoverage();
  console.log('\nCoverage summary:');
  Object.entries(coverage).forEach(([metric, value]) => {
    console.log(`  • ${metric.padEnd(10)} ${value}% (min ${THRESHOLDS[metric]}%)`);
  });

  const failures = evaluate(coverage);
  writeReport(coverage, failures);

  if (failures.length) {
    console.error('\n❌ Quality gate failed:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\n✅ Quality gate passed');
}

main().catch(error => {
  console.error('\n❌ Quality gate error');
  console.error(error.message);
  process.exit(1);
});
