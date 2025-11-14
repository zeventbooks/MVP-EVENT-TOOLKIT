#!/usr/bin/env node
/**
 * Script to fix BASE_URL configuration in all test files
 *
 * This script:
 * 1. Finds all test files with hardcoded BASE_URL fallbacks
 * 2. Replaces them with imports from centralized config
 * 3. Handles different import patterns and file structures
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing BASE_URL configuration in test files...\n');

// Patterns to match and replace
const patterns = [
  // Pattern 1: CommonJS with separate BASE_URL and TENANT_ID
  {
    search: /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?\s*\nconst TENANT_ID = ['"]root['"];?/gm,
    replace: "const { BASE_URL, TENANT_ID } = require('../../shared/config/test.config.js');"
  },
  // Pattern 2: CommonJS with only BASE_URL
  {
    search: /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?/g,
    replace: "const { BASE_URL } = require('../../shared/config/test.config.js');"
  },
  // Pattern 3: ES6 import with separate BASE_URL and TENANT_ID
  {
    search: /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?\s*\nconst TENANT_ID = ['"]root['"];?/gm,
    replace: "import { BASE_URL, TENANT_ID } from '../../shared/config/test.config.js';"
  }
];

// Files to update - find all .spec.js and .test.js files
function findTestFiles() {
  const testsDir = path.join(__dirname, '..', 'tests');
  const files = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other non-test directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        // Include .spec.js and .test.js files
        if (entry.name.endsWith('.spec.js') || entry.name.endsWith('.test.js')) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(testsDir);
  return files;
}

// Calculate relative path to config
function getRelativeConfigPath(filePath) {
  const testsDir = path.join(__dirname, '..', 'tests');
  const configPath = path.join(testsDir, 'shared', 'config', 'test.config.js');
  const fileDir = path.dirname(filePath);

  let relativePath = path.relative(fileDir, configPath);

  // Ensure forward slashes for require()
  relativePath = relativePath.replace(/\\/g, '/');

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

// Process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Skip if already using centralized config
    if (content.includes("require('../../shared/config/test.config.js')") ||
        content.includes("require('../shared/config/test.config.js')") ||
        content.includes("from '../../shared/config/test.config.js'") ||
        content.includes("from '../shared/config/test.config.js'")) {
      return { updated: false, file: filePath };
    }

    // Skip the config file itself
    if (filePath.includes('test.config.js')) {
      return { updated: false, file: filePath };
    }

    // Check if file needs updating
    const needsUpdate =
      content.includes('process.env.BASE_URL') ||
      content.includes('process.env.ADMIN_KEY') ||
      content.includes('process.env.TENANT_ID');

    if (!needsUpdate) {
      return { updated: false, file: filePath };
    }

    // Get correct relative path
    const configPath = getRelativeConfigPath(filePath);

    // Collect which variables are used in this file
    const usesBaseUrl = content.includes('const BASE_URL = process.env.BASE_URL');
    const usesAdminKey = content.includes('const ADMIN_KEY = process.env.ADMIN_KEY');
    const usesTenantId = content.includes('const TENANT_ID =');

    // Build the import list
    const imports = [];
    if (usesBaseUrl) imports.push('BASE_URL');
    if (usesTenantId) imports.push('TENANT_ID');
    if (usesAdminKey) imports.push('ADMIN_KEY');

    if (imports.length === 0) {
      return { updated: false, file: filePath };
    }

    const importStatement = `const { ${imports.join(', ')} } = require('${configPath}');`;

    // Pattern 1: BASE_URL, TENANT_ID, and ADMIN_KEY (all three)
    const pattern1 = /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?\s*\nconst TENANT_ID = ['"][^'"]*['"];?\s*\nconst ADMIN_KEY = process\.env\.ADMIN_KEY \|\| ['"][^'"]*['"];?/gm;
    if (pattern1.test(content)) {
      content = content.replace(pattern1, importStatement);
    }

    // Pattern 2: BASE_URL and ADMIN_KEY (no TENANT_ID)
    const pattern2 = /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?\s*\nconst ADMIN_KEY = process\.env\.ADMIN_KEY \|\| ['"][^'"]*['"];?/gm;
    if (pattern2.test(content) && content === originalContent) {
      content = content.replace(pattern2, importStatement);
    }

    // Pattern 3: BASE_URL and TENANT_ID (no ADMIN_KEY)
    const pattern3 = /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?\s*\nconst TENANT_ID = ['"][^'"]*['"];?/gm;
    if (pattern3.test(content) && content === originalContent) {
      content = content.replace(pattern3, importStatement);
    }

    // Pattern 4: Only BASE_URL
    const pattern4 = /const BASE_URL = process\.env\.BASE_URL \|\| ['"][^'"]*['"];?/g;
    if (pattern4.test(content) && content === originalContent) {
      content = content.replace(pattern4, importStatement);
    }

    // Pattern 5: Only ADMIN_KEY
    const pattern5 = /const ADMIN_KEY = process\.env\.ADMIN_KEY \|\| ['"][^'"]*['"];?/g;
    if (pattern5.test(content) && content === originalContent) {
      content = content.replace(pattern5, importStatement);
    }

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return { updated: true, file: filePath };
    }

    return { updated: false, file: filePath };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { updated: false, file: filePath, error: error.message };
  }
}

// Main execution
function main() {
  const testFiles = findTestFiles();
  console.log(`📁 Found ${testFiles.length} test files\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const results = testFiles.map(file => {
    const result = processFile(file);

    if (result.error) {
      console.log(`❌ Error: ${path.relative(process.cwd(), file)}`);
      errorCount++;
    } else if (result.updated) {
      console.log(`✅ Updated: ${path.relative(process.cwd(), file)}`);
      updatedCount++;
    } else {
      skippedCount++;
    }

    return result;
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Updated: ${updatedCount} files`);
  console.log(`   ⏭️  Skipped: ${skippedCount} files (already using config or no BASE_URL)`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount} files`);
  }
  console.log('='.repeat(60) + '\n');

  if (updatedCount > 0) {
    console.log('✨ All test files updated to use centralized BASE_URL configuration!');
  } else {
    console.log('ℹ️  No files needed updating.');
  }
}

main();
