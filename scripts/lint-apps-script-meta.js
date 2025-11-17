#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DISALLOWED_TAGS = [
  { tag: 'referrer', reason: 'Google Apps Script rejects referrer meta tags inside HtmlService output.' },
  { tag: 'content-security-policy', reason: 'Content-Security-Policy headers must be enforced via hosting layer, not HtmlService.' },
  { tag: 'x-frame-options', reason: 'X-Frame-Options must be configured outside of HtmlService templates.' }
];
const SKIP_DIRS = new Set(['.git', 'node_modules', '.monitoring', 'dist', '.idea', '.vscode']);

const appsScriptFiles = [];
const htmlFiles = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.gs')) {
      appsScriptFiles.push(fullPath);
    }
    if (entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }
}

walk(ROOT);

const violations = [];

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function noteViolation(file, line, message) {
  violations.push({ file: path.relative(ROOT, file), line, message });
}

for (const file of appsScriptFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /addMetaTag\s*\(\s*(['"])([^'"\s]+)\1/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tagName = match[2].toLowerCase();
    const violation = DISALLOWED_TAGS.find((t) => t.tag === tagName);
    if (violation) {
      noteViolation(file, lineNumberForIndex(content, match.index), `HtmlService.addMetaTag uses disallowed tag "${tagName}". ${violation.reason}`);
    }
  }
}

const metaRegex = /<meta[^>]+>/gi;
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = metaRegex.exec(content)) !== null) {
    const tagContent = match[0].toLowerCase();
    for (const disallowed of DISALLOWED_TAGS) {
      if (
        tagContent.includes(`name="${disallowed.tag}`) ||
        tagContent.includes(`name='${disallowed.tag}`) ||
        tagContent.includes(`http-equiv="${disallowed.tag}`) ||
        tagContent.includes(`http-equiv='${disallowed.tag}`)
      ) {
        noteViolation(file, lineNumberForIndex(content, metaRegex.lastIndex - match[0].length), `Found disallowed <meta> tag (${disallowed.tag}). ${disallowed.reason}`);
      }
    }
  }
}

if (violations.length) {
  console.error('❌ Apps Script meta tag lint failed. Fix the following issues:');
  for (const issue of violations) {
    console.error(` - ${issue.file}:${issue.line} → ${issue.message}`);
  }
  process.exit(1);
}

console.log('✅ Apps Script meta tag lint passed. No disallowed meta tags were found in HtmlService templates.');
