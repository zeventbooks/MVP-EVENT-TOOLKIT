#!/usr/bin/env node

/**
 * Environment Health Monitor
 * --------------------------
 * Runs HTTP health checks against critical URLs and records the
 * results so we can spot instability over time.
 *
 * Usage:
 *   node scripts/monitor-health.js [run|watch|history|help] [--option=value]
 *
 * Notable options:
 *   --targets="Name|https://url,Another|https://url"  Override default targets
 *   --interval=60000                                    Override watch interval (ms)
 *   --limit=5                                           Limit for history command
 *   --config=path/to/targets.json                       Load JSON targets file (array or {targets: []})
 *   --scenario=stage-name                               Use scenario filters defined in the JSON config
 *   --report[=path/to/report.md]                        Save Markdown summary for clients/stakeholders
 *   --dry-run                                           Skip HTTP requests (prints config)
 *
 * Environment variables:
 *   HEALTH_TARGETS            Same format as --targets
 *   HEALTH_INTERVAL           Interval in ms for watch mode
 *   HEALTH_TIMEOUT            Per-request timeout in ms (default: 10s)
 *   HEALTH_HISTORY_LIMIT      Max number of runs to retain (default: 40)
 *   HEALTH_CONFIG             Path to JSON targets file (same as --config)
 *   HEALTH_SCENARIO           Scenario name to auto-apply when loading config
*/

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const ICONS = {
  success: '✅',
  failure: '❌',
  warn: '⚠️',
  skip: '⏭️',
  info: 'ℹ️',
  history: '🕘',
  monitor: '🩺',
};

const WORKSPACE_DIR = process.cwd();
const MONITORING_DIR = path.join(WORKSPACE_DIR, '.monitoring');
const HISTORY_FILE = path.join(MONITORING_DIR, 'health-history.json');
const DEFAULT_TARGETS_FILE = path.join(MONITORING_DIR, 'targets.json');
const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT || 10_000);
const DEFAULT_INTERVAL_MS = Number(process.env.HEALTH_INTERVAL || 300_000); // 5 minutes
const HISTORY_LIMIT = Number(process.env.HEALTH_HISTORY_LIMIT || 40);
const DEFAULT_APPS_SCRIPT_DEPLOYMENT_URL =
  process.env.DEFAULT_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw/exec';

const DEFAULT_TARGETS = [
  {
    name: 'QA Events (root tenant)',
    url:
      process.env.QA_EVENTS_URL ||
      `${DEFAULT_APPS_SCRIPT_DEPLOYMENT_URL}?p=events&tenant=root`,
    // Legacy Hostinger QA reference retained for future diagnostics:
    // url:
    //   process.env.QA_EVENTS_URL ||
    //   'https://qa.zeventbooks.com?p=events&tenant=root',
  },
  {
    name: 'QA Admin (root tenant)',
    url:
      process.env.QA_ADMIN_URL ||
      `${DEFAULT_APPS_SCRIPT_DEPLOYMENT_URL}?p=admin&tenant=root`,
    // Legacy Hostinger QA reference retained for future diagnostics:
    // url:
    //   process.env.QA_ADMIN_URL ||
    //   'https://qa.zeventbooks.com?p=admin&tenant=root',
  },
  {
    name: 'Production Events (root tenant)',
    url:
      process.env.PROD_EVENTS_URL ||
      `${DEFAULT_APPS_SCRIPT_DEPLOYMENT_URL}?p=events&tenant=root`,
    // Legacy Hostinger production reference retained for future diagnostics:
    // url:
    //   process.env.PROD_EVENTS_URL ||
    //   'https://zeventbooks.com?p=events&tenant=root',
  },
];

if (typeof fetch !== 'function') {
  console.error(
    `${ICONS.failure} The global fetch API is not available in this Node.js runtime. Please upgrade to Node.js 18+.`
  );
  process.exit(1);
}

function colorize(color, message) {
  return `${COLORS[color] || ''}${message}${COLORS.reset}`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureHistoryFile() {
  if (!fs.existsSync(HISTORY_FILE)) {
    ensureDir(HISTORY_FILE);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ runs: [] }, null, 2));
  }
}

function normalizeTargetsConfig(parsed, sourceLabel) {
  if (!parsed) return null;
  if (Array.isArray(parsed)) {
    return { targets: parsed, scenarios: {} };
  }
  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.targets)) {
      return {
        targets: parsed.targets,
        scenarios: typeof parsed.scenarios === 'object' && parsed.scenarios ? parsed.scenarios : {},
      };
    }
  }
  console.warn(
    colorize('yellow', `${ICONS.warn} Ignoring ${sourceLabel}: JSON must be an array or {"targets": []}.`)
  );
  return null;
}

function loadTargetsFromFile(filePath) {
  if (!filePath) return null;
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_DIR, filePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeTargetsConfig(parsed, resolvedPath);
  } catch (error) {
    console.warn(colorize('yellow', `${ICONS.warn} Failed to parse ${resolvedPath}: ${error.message}`));
    return null;
  }
}

function loadHistory() {
  try {
    ensureHistoryFile();
    const content = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(
      colorize(
        'yellow',
        `${ICONS.warn} Unable to load health history (${error.message}). Starting with empty history.`
      )
    );
    return { runs: [] };
  }
}

function saveHistory(history) {
  ensureHistoryFile();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function recordRun(run) {
  const history = loadHistory();
  history.runs.unshift(run);
  history.runs = history.runs.slice(0, HISTORY_LIMIT);
  saveHistory(history);
}

function parseArgs(rawArgs) {
  const args = [...rawArgs];
  let command = 'run';

  if (args[0] && !args[0].startsWith('--')) {
    command = args.shift();
  }

  const options = args.reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const trimmed = arg.replace(/^--/, '');
    if (!trimmed) return acc;
    const [key, value] = trimmed.split('=');
    if (value === undefined) {
      acc[key] = true;
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});

  return { command, options };
}

function parseTargets(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [maybeName, maybeUrl] = entry.split('|');
      if (maybeUrl) {
        return {
          name: maybeName.trim(),
          url: maybeUrl.trim(),
        };
      }

      return {
        name: maybeName.trim(),
        url: maybeName.trim(),
      };
    })
    .filter(target => target.url);
}

function applyScenario(config, scenarioName, sourceLabel) {
  if (!scenarioName) {
    return { targets: config.targets, scenario: null };
  }

  const scenarios = config.scenarios || {};
  const scenario = scenarios[scenarioName];
  if (!scenario) {
    console.warn(
      colorize('yellow', `${ICONS.warn} Scenario "${scenarioName}" not found in ${sourceLabel}. Using all targets.`)
    );
    return { targets: config.targets, scenario: null };
  }

  let filtered = config.targets;
  if (Array.isArray(scenario.targets) && scenario.targets.length) {
    const names = new Set(scenario.targets);
    filtered = filtered.filter(target => names.has(target.name));
  }
  if (Array.isArray(scenario.categories) && scenario.categories.length) {
    const categories = new Set(scenario.categories);
    filtered = filtered.filter(target => target.category && categories.has(target.category));
  }

  if (!filtered.length) {
    console.warn(
      colorize(
        'yellow',
        `${ICONS.warn} Scenario "${scenarioName}" in ${sourceLabel} matched zero targets. Using all targets.`
      )
    );
    return { targets: config.targets, scenario: null };
  }

  return {
    targets: filtered,
    scenario: {
      name: scenarioName,
      description: scenario.description,
      source: sourceLabel,
    },
  };
}

function resolveTargets(options) {
  if (options.targets) {
    const parsed = parseTargets(options.targets);
    if (parsed.length) {
      return { targets: parsed, source: '--targets flag', scenario: null };
    }
  }

  if (process.env.HEALTH_TARGETS) {
    const parsed = parseTargets(process.env.HEALTH_TARGETS);
    if (parsed.length) {
      return { targets: parsed, source: 'HEALTH_TARGETS env var', scenario: null };
    }
  }

  const scenarioName = options.scenario || process.env.HEALTH_SCENARIO;

  const configPath = options.config || process.env.HEALTH_CONFIG;
  if (configPath) {
    const loaded = loadTargetsFromFile(configPath);
    if (loaded && loaded.targets && loaded.targets.length) {
      return { ...applyScenario(loaded, scenarioName, configPath), source: configPath };
    }
  }

  const localConfig = loadTargetsFromFile(DEFAULT_TARGETS_FILE);
  if (localConfig && localConfig.targets && localConfig.targets.length) {
    return { ...applyScenario(localConfig, scenarioName, DEFAULT_TARGETS_FILE), source: DEFAULT_TARGETS_FILE };
  }

  const builtIn = { targets: DEFAULT_TARGETS, scenarios: {} };
  return { ...applyScenario(builtIn, scenarioName, 'built-in defaults'), source: 'built-in defaults' };
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function checkTarget(target, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(target.url, {
      method: 'GET',
      signal: controller.signal,
      headers: target.headers || {},
    });
    const duration = Math.round(performance.now() - started);
    let bodySnippet;
    let missingTokens = [];

    if (target.contains && target.contains.length) {
      const text = await response.text();
      bodySnippet = text.slice(0, 200);
      missingTokens = target.contains.filter(token => !text.includes(token));
    }

    const expectStatus = target.expectStatus || 200;
    const statusOk = response.status === expectStatus || (!target.expectStatus && response.ok);
    const contentOk = missingTokens.length === 0;
    const success = statusOk && contentOk;

    return {
      name: target.name || target.url,
      url: target.url,
      success,
      status: response.status,
      duration,
      checkedAt: new Date().toISOString(),
      category: target.category,
      details: success
        ? 'OK'
        : missingTokens.length
        ? `Missing tokens: ${missingTokens.join(', ')}`
        : `Unexpected status code (expected ${expectStatus}, got ${response.status})`,
      bodySnippet,
    };
  } catch (error) {
    const duration = Math.round(performance.now() - started);
    return {
      name: target.name || target.url,
      url: target.url,
      success: false,
      status: response?.status || 'ERR',
      duration,
      checkedAt: new Date().toISOString(),
      category: target.category,
      details: error.name === 'AbortError' ? 'Request timed out' : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatCategory(category) {
  if (!category) return '';
  return ` [${category}]`;
}

function printResult(result) {
  const icon = result.success ? ICONS.success : ICONS.failure;
  const color = result.success ? 'green' : 'red';
  const status = result.status === 'ERR' ? 'ERR' : `HTTP ${result.status}`;
  const summary = `${icon} ${result.name}${formatCategory(result.category)} → ${status} (${formatDuration(
    result.duration
  )})`;
  console.log(colorize(color, summary));
  if (!result.success && result.details) {
    console.log(colorize('yellow', `   ${ICONS.warn} ${result.details}`));
  }
}

function buildRun(results, startedAt) {
  const healthy = results.filter(result => result.success).length;
  const failed = results.length - healthy;
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
    summary: {
      total: results.length,
      healthy,
      failed,
    },
    results,
  };
}

function printRunSummary(run, metadata = {}) {
  const { healthy, failed, total } = run.summary;
  const summaryIcon = failed === 0 ? ICONS.success : ICONS.failure;
  const color = failed === 0 ? 'green' : 'red';
  console.log(
    colorize(
      color,
      `${summaryIcon} Completed health check: ${healthy}/${total} targets healthy (${failed} failed)`
    )
  );
  if (metadata.targetsSource) {
    console.log(`${ICONS.info} Targets source: ${metadata.targetsSource}`);
  }
  if (metadata.scenario && metadata.scenario.name) {
    const extra = metadata.scenario.description ? ` — ${metadata.scenario.description}` : '';
    console.log(`${ICONS.info} Scenario: ${metadata.scenario.name}${extra}`);
  }
}

function printHistory(limit = 5) {
  const history = loadHistory();
  const runs = history.runs.slice(0, limit);
  if (!runs.length) {
    console.log(`${ICONS.info} No health check history yet.`);
    return;
  }

  runs.forEach((run, index) => {
    const timestamp = new Date(run.startedAt).toLocaleString();
    const { healthy, failed, total } = run.summary;
    const icon = failed === 0 ? ICONS.success : ICONS.failure;
    console.log(
      `${ICONS.history} [${index + 1}] ${timestamp} — ${icon} ${healthy}/${total} healthy (${failed} failed)`
    );
  });
}

function resolveReportPath(options) {
  const reportRequested = Boolean(options.report || options['report-file']);
  if (!reportRequested) {
    return null;
  }

  if (options['report-file'] && options['report-file'] !== true) {
    return path.isAbsolute(options['report-file'])
      ? options['report-file']
      : path.join(WORKSPACE_DIR, options['report-file']);
  }

  if (options.report && options.report !== true) {
    return path.isAbsolute(options.report)
      ? options.report
      : path.join(WORKSPACE_DIR, options.report);
  }

  return path.join(MONITORING_DIR, 'latest-report.md');
}

function formatResultStatus(result) {
  if (result.success) return `${ICONS.success} Healthy`;
  return `${ICONS.failure} Needs attention`;
}

function buildMarkdownReport(run, metadata = {}) {
  const lines = [];
  lines.push('# Environment Health Report');
  lines.push('');
  lines.push(`- Generated: ${new Date(run.completedAt).toLocaleString()}`);
  lines.push(`- Targets checked: ${run.summary.total}`);
  lines.push(`- Healthy: ${run.summary.healthy}`);
  lines.push(`- Failing: ${run.summary.failed}`);
  if (metadata.targetsSource) {
    lines.push(`- Targets source: ${metadata.targetsSource}`);
  }
  if (metadata.scenario && metadata.scenario.name) {
    const scenarioLine = metadata.scenario.description
      ? `${metadata.scenario.name} — ${metadata.scenario.description}`
      : metadata.scenario.name;
    lines.push(`- Scenario: ${scenarioLine}`);
  }
  lines.push('');
  lines.push('## Results by Target');
  lines.push('');
  lines.push('| Status | Target | Surface | HTTP | Duration | Notes |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  run.results.forEach(result => {
    const httpStatus = result.status === 'ERR' ? 'ERR' : `HTTP ${result.status}`;
    const duration = formatDuration(result.duration);
    const notes = (result.details || '').replace(/\n/g, ' ');
    lines.push(
      `| ${formatResultStatus(result)} | ${result.name} | ${result.category || ''} | ${httpStatus} | ${duration} | ${
        notes || '—'
      } |`
    );
  });
  return `${lines.join('\n')}\n`;
}

function persistMarkdownReport(run, metadata, options) {
  const reportPath = resolveReportPath(options);
  if (!reportPath) return null;
  ensureDir(reportPath);
  const markdown = buildMarkdownReport(run, metadata);
  fs.writeFileSync(reportPath, markdown, 'utf8');
  return reportPath;
}

async function executeRun(targets, options, metadata = {}) {
  const startedAt = new Date().toISOString();
  console.log(`\n${ICONS.monitor} Starting health check @ ${startedAt}`);
  if (metadata.scenario && metadata.scenario.name) {
    const extra = metadata.scenario.description ? ` — ${metadata.scenario.description}` : '';
    console.log(`${ICONS.info} Scenario: ${metadata.scenario.name}${extra}`);
  }
  if (options['dry-run']) {
    console.log(`${ICONS.info} Dry run enabled — skipping HTTP requests.`);
  }

  const results = [];
  for (const target of targets) {
    if (options['dry-run']) {
      const fakeResult = {
        name: target.name || target.url,
        url: target.url,
        success: true,
        status: 'SKIP',
        duration: 0,
        checkedAt: new Date().toISOString(),
        category: target.category,
        details: 'Dry run mode',
      };
      results.push(fakeResult);
      console.log(`${ICONS.skip} ${target.name || target.url} (dry run)`);
      continue;
    }

    const result = await checkTarget(target);
    results.push(result);
    printResult(result);
  }

  const run = buildRun(results, startedAt);
  if (!options['dry-run']) {
    recordRun(run);
  } else {
    console.log(`${ICONS.info} Dry run — results not saved to history.`);
  }

  const reportPath = persistMarkdownReport(run, metadata, options);
  if (reportPath) {
    console.log(`${ICONS.info} Shareable Markdown report saved to ${reportPath}`);
  }

  printRunSummary(run, metadata);
  return run;
}

async function watch(targets, options, metadata) {
  const interval = Number(options.interval || DEFAULT_INTERVAL_MS);
  console.log(
    `${ICONS.info} Watching ${targets.length} targets. Interval: ${formatDuration(interval)}. Press Ctrl+C to stop.`
  );

  let stopped = false;
  let timer;

  const loop = async () => {
    if (stopped) return;
    await executeRun(targets, options, metadata);
    if (stopped) return;
    timer = setTimeout(loop, interval);
  };

  process.on('SIGINT', () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`\n${ICONS.info} Watch mode stopped.`);
    process.exit(0);
  });

  await loop();
}

function printHelp() {
  console.log(`
${ICONS.info} Health monitor commands:
  node scripts/monitor-health.js run [--targets=...] [--dry-run]
  node scripts/monitor-health.js watch [--interval=300000]
  node scripts/monitor-health.js history [--limit=5]
  node scripts/monitor-health.js help

Flags like --config, --scenario, --report, and --interval may be combined as needed.
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const { targets, source, scenario } = resolveTargets(options);

  switch (command) {
    case 'run':
      await executeRun(targets, options, { targetsSource: source, scenario });
      break;
    case 'watch':
      await watch(targets, options, { targetsSource: source, scenario });
      break;
    case 'history': {
      const limit = Number(options.limit || 5);
      printHistory(limit);
      break;
    }
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch(error => {
  console.error(colorize('red', `${ICONS.failure} Unexpected error: ${error.message}`));
  process.exit(1);
});
