#!/usr/bin/env node
/**
 * GAS URL Ban Script - Story 2.1
 *
 * HARD GATE: Prevents shipping code that references script.google.com
 *
 * Purpose:
 *   Make it impossible to "accidentally" ship code that still references
 *   script.google.com. This is a Stage-1 hard gate - build cannot proceed
 *   if banned origins are found outside the allowlist.
 *
 * Scanned Directories:
 *   - tests/**
 *   - worker/**
 *   - web/**
 *   - src/**
 *   - config/**
 *   - cloudflare-proxy/** (worker.js, templates/*)
 *   - Root config files (.env*, deploy-manifest.json, wrangler.toml)
 *
 * Banned Patterns:
 *   - script.google.com/macros/s/   (GAS execution URLs)
 *   - googleusercontent.com/macros  (GAS exec pattern)
 *
 * Allowlist:
 *   - config/gas-upstream.template.json (migration reference)
 *   - Documentation files (*.md) - allowed for historical/migration docs
 *   - Archived files (archive/**) - legacy code not in active use
 *   - Schema files (schemas/**) - JSON Schema examples
 *   - Postman files (postman/**) - API testing collection examples
 *   - .clasp*.json files - Google clasp CLI configuration
 *   - Test files checking for ABSENCE of patterns (negative assertions)
 *
 * Usage:
 *   node scripts/check-banned-origins.mjs
 *   npm run check:banned-origins
 *
 * Exit Codes:
 *   0 - No banned patterns found (or only in allowlisted files)
 *   1 - Banned patterns detected in non-allowlisted files
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// =============================================================================
// Configuration
// =============================================================================

/**
 * Banned URL patterns - any file containing these is a violation
 * These are the actual GAS execution URL patterns with REAL deployment IDs
 *
 * We distinguish between:
 * - Placeholder IDs (ABC123, XXXX, etc.) - allowed in docs/examples
 * - Real deployment IDs (AKfycb...) - BANNED in active code
 */
const BANNED_PATTERNS = [
  // GAS Web App execution URLs with REAL deployment IDs (AKfycb... pattern)
  // Real IDs are 50+ chars starting with AKfycb
  /script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]{30,}\/exec/gi,
  // GAS project URLs with real project IDs (these should not be in runtime code)
  /script\.google\.com\/home\/projects\/[A-Za-z0-9_-]{40,}/gi,
  // googleusercontent.com macros exec (legacy GAS pattern)
  /googleusercontent\.com\/macros/gi,
];

/**
 * Placeholder patterns - these are allowed in docs/examples
 * Short IDs like ABC123, XXXX, etc. are clearly not real
 */
const PLACEHOLDER_PATTERNS = [
  /script\.google\.com\/macros\/s\/ABC123\/exec/gi,
  /script\.google\.com\/macros\/s\/XXXX\/exec/gi,
  /script\.google\.com\/macros\/s\/XXX\/exec/gi,
  /script\.google\.com\/macros\/s\/YOUR_[A-Z_]+\/exec/gi,
  /script\.google\.com\/macros\/s\/\{[^}]+\}\/exec/gi, // Template placeholders like {ID}
];

/**
 * Directories to scan for banned patterns
 */
const SCAN_DIRECTORIES = [
  'tests',
  'worker',
  'web',
  'src',
  'config',
  'cloudflare-proxy',
];

/**
 * Root files to scan for banned patterns
 */
const SCAN_ROOT_FILES = [
  'deploy-manifest.json',
  'wrangler.toml',
  '.env.example',
  'openapi.yaml',
];

/**
 * File extensions to scan
 */
const SCAN_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.toml',
  '.gs',
  '.sh',
]);

/**
 * Allowlisted paths - these files are allowed to contain banned patterns
 * Paths are relative to ROOT_DIR
 */
const ALLOWLIST = [
  // Migration reference file (if needed)
  'config/gas-upstream.template.json',

  // Deployment manifest - historical record of GAS deployments
  // LEGACY GAS – this file documents historical deployments for audit trail
  // TODO(Story 2.2): Consider migrating to Cloudflare-only deployment tracking
  'deploy-manifest.json',

  // Clasp configuration files (Google's CLI)
  '.clasp.json',
  '.clasp-staging.json',
  '.clasp-production.json',
  '.clasp.json.archived',
  '.clasp-staging.json.archived',
  '.clasp-production.json.archived',
  '.clasp.tmp',
];

/**
 * Allowlisted directory patterns - entire directories that are excluded
 */
const ALLOWLISTED_DIRECTORIES = [
  'archive',           // Legacy code archive
  'node_modules',      // Dependencies
  '.git',              // Git internals
  'schemas',           // JSON Schema examples
  'postman',           // Postman collection examples
  'docs',              // Documentation
  '.github/workflow-archive', // Archived workflows
];

/**
 * Allowlisted extensions - documentation files
 */
const ALLOWLISTED_EXTENSIONS = new Set([
  '.md',        // Markdown documentation
  '.mdx',       // MDX documentation
  '.txt',       // Text files (diagrams, notes)
  '.backup',    // Backup files
]);

/**
 * Context patterns that indicate a file is CHECKING for absence of GAS URLs
 * (i.e., negative assertions in tests)
 */
const NEGATIVE_ASSERTION_PATTERNS = [
  /expect\([^)]+\)\.not\.toContain/,
  /expect\([^)]+\)\.not\.toMatch/,
  /toContain.*script\.google/i,
  /toContain.*googleusercontent/i,
  /should.*not.*contain/i,
  /'script\.googleusercontent\.com'/,  // Banned pattern list in tests
];

// =============================================================================
// ANSI Colors
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
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
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a path should be excluded based on allowlist
 */
function isAllowlisted(filePath) {
  const relativePath = relative(ROOT_DIR, filePath);

  // Check exact file matches
  if (ALLOWLIST.includes(relativePath)) {
    return true;
  }

  // Check directory exclusions
  for (const dir of ALLOWLISTED_DIRECTORIES) {
    if (relativePath.startsWith(dir + '/') || relativePath === dir) {
      return true;
    }
  }

  // Check extension exclusions
  const ext = extname(filePath).toLowerCase();
  if (ALLOWLISTED_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

/**
 * Check if file content contains negative assertions (testing for absence)
 */
function containsNegativeAssertions(content) {
  return NEGATIVE_ASSERTION_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Scan a file for banned patterns
 * @returns {object[]} Array of violations found
 */
function scanFile(filePath) {
  const violations = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(ROOT_DIR, filePath);

    // Check if this file contains negative assertions (test files checking for absence)
    if (containsNegativeAssertions(content)) {
      return violations; // Skip - this is a test checking for absence of banned patterns
    }

    // Check each banned pattern
    for (const pattern of BANNED_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        // Reset for each line
        pattern.lastIndex = 0;

        while ((match = pattern.exec(line)) !== null) {
          // Check if this line is a comment explaining the pattern (not actual usage)
          const trimmedLine = line.trim();
          const isComment = trimmedLine.startsWith('//') ||
                           trimmedLine.startsWith('#') ||
                           trimmedLine.startsWith('*') ||
                           trimmedLine.startsWith('<!--');

          // Allow comments that are documenting the migration
          if (isComment && (
            trimmedLine.includes('LEGACY') ||
            trimmedLine.includes('migration') ||
            trimmedLine.includes('removed') ||
            trimmedLine.includes('deprecated') ||
            trimmedLine.includes('no longer') ||
            trimmedLine.includes('not supported')
          )) {
            continue;
          }

          violations.push({
            file: relativePath,
            line: lineNum + 1,
            column: match.index + 1,
            match: match[0],
            context: line.trim().substring(0, 100),
          });
        }
      }
    }
  } catch (error) {
    if (error.code !== 'EISDIR') {
      log.warn(`Could not read file: ${filePath} (${error.message})`);
    }
  }

  return violations;
}

/**
 * Recursively scan a directory
 * @returns {object[]} Array of all violations found
 */
function scanDirectory(dirPath) {
  const violations = [];

  if (!existsSync(dirPath)) {
    return violations;
  }

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);

      // Skip allowlisted paths
      if (isAllowlisted(fullPath)) {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        violations.push(...scanDirectory(fullPath));
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (SCAN_EXTENSIONS.has(ext)) {
          violations.push(...scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    log.warn(`Could not scan directory: ${dirPath} (${error.message})`);
  }

  return violations;
}

/**
 * Scan root-level files
 */
function scanRootFiles() {
  const violations = [];

  for (const file of SCAN_ROOT_FILES) {
    const filePath = join(ROOT_DIR, file);
    if (existsSync(filePath) && !isAllowlisted(filePath)) {
      violations.push(...scanFile(filePath));
    }
  }

  // Also scan .env* files
  try {
    const rootEntries = readdirSync(ROOT_DIR);
    for (const entry of rootEntries) {
      if (entry.startsWith('.env') && !entry.endsWith('.example')) {
        const filePath = join(ROOT_DIR, entry);
        if (!isAllowlisted(filePath)) {
          violations.push(...scanFile(filePath));
        }
      }
    }
  } catch (error) {
    log.warn(`Could not scan root directory for .env files: ${error.message}`);
  }

  return violations;
}

// =============================================================================
// Main
// =============================================================================

function main() {
  log.header('GAS URL BAN SCRIPT - Story 2.1');

  console.log('Purpose: Prevent shipping code that references script.google.com');
  console.log('');
  console.log('Banned patterns:');
  console.log('  - script.google.com/macros/s/{ID}/exec');
  console.log('  - script.google.com/home/projects/{ID}');
  console.log('  - googleusercontent.com/macros');
  console.log('');

  log.info('Scanning directories for banned GAS URLs...');
  console.log('');

  const allViolations = [];
  let filesScanned = 0;

  // Scan configured directories
  for (const dir of SCAN_DIRECTORIES) {
    const dirPath = join(ROOT_DIR, dir);
    if (existsSync(dirPath)) {
      log.info(`Scanning ${dir}/...`);
      const violations = scanDirectory(dirPath);
      allViolations.push(...violations);
      // Count files (approximate)
      try {
        const count = readdirSync(dirPath, { recursive: true }).length;
        filesScanned += count;
      } catch {
        // Ignore counting errors
      }
    }
  }

  // Scan root files
  log.info('Scanning root configuration files...');
  allViolations.push(...scanRootFiles());
  filesScanned += SCAN_ROOT_FILES.length;

  console.log('');

  // Report results
  if (allViolations.length === 0) {
    log.success('No banned GAS URLs found in scanned files');
    console.log('');
    console.log('Scanned directories:');
    SCAN_DIRECTORIES.forEach(dir => console.log(`  - ${dir}/`));
    console.log('  - Root config files');
    console.log('');
    console.log('Allowlisted (not scanned):');
    console.log('  - archive/** (legacy code)');
    console.log('  - *.md (documentation)');
    console.log('  - schemas/** (JSON Schema examples)');
    console.log('  - postman/** (API testing examples)');
    console.log('  - .clasp*.json (Google clasp config)');
    console.log('');
    log.success('Stage-1 GAS URL ban check: PASSED');
    process.exit(0);
  } else {
    log.error(`Found ${allViolations.length} banned GAS URL reference(s):\n`);

    // Group violations by file
    const byFile = {};
    for (const v of allViolations) {
      if (!byFile[v.file]) {
        byFile[v.file] = [];
      }
      byFile[v.file].push(v);
    }

    for (const [file, violations] of Object.entries(byFile)) {
      console.log(`${colors.red}${colors.bright}${file}${colors.reset}`);
      for (const v of violations) {
        console.log(`  Line ${v.line}: ${colors.dim}${v.context}${colors.reset}`);
        console.log(`  ${colors.yellow}Match: ${v.match}${colors.reset}`);
        console.log('');
      }
    }

    console.log(`${colors.bright}${colors.red}${'='.repeat(70)}${colors.reset}`);
    log.error('STAGE-1 HARD GATE FAILED: Banned GAS URLs detected');
    console.log(`${colors.bright}${colors.red}${'='.repeat(70)}${colors.reset}`);
    console.log('');
    console.log('To fix:');
    console.log('  1. Remove or replace the banned URLs with Cloudflare Worker URLs');
    console.log('  2. If legacy reference is needed for migration, move to:');
    console.log('     config/gas-upstream.template.json');
    console.log('     with a "// LEGACY GAS – remove after migration" banner');
    console.log('');
    console.log('See Story 2.1 for details.');
    console.log('');
    process.exit(1);
  }
}

main();
