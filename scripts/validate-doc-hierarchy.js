#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(process.cwd(), 'doc-hierarchy.manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Missing doc-hierarchy.manifest.json.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.documents)) {
  console.error('Manifest must expose a "documents" array.');
  process.exit(1);
}

const parseMetadata = (content) => {
  const blockMatch = content.match(/<!--\s*DOC-HIERARCHY([\s\S]*?)-->/);
  if (!blockMatch) {
    return null;
  }
  const raw = blockMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const meta = {};
  raw.forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) return;
    meta[key.trim().toLowerCase()] = rest.join(':').trim();
  });
  return meta;
};

const normalize = (value) => (value === undefined || value === null ? '' : String(value).trim());

const errors = [];
manifest.documents.forEach((doc) => {
  const filePath = path.join(process.cwd(), doc.file);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file: ${doc.file}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const metadata = parseMetadata(content);
  if (!metadata) {
    errors.push(`Missing DOC-HIERARCHY block in ${doc.file}`);
    return;
  }
  const expectations = {
    tier: doc.tier,
    parent: doc.parent,
    path: doc.path,
    name: doc.name,
    role: doc.role,
    token: doc.token,
  };
  Object.entries(expectations).forEach(([key, expected]) => {
    if (expected === undefined) return;
    const observed = metadata[key];
    if (normalize(observed) !== normalize(expected)) {
      errors.push(
        `Mismatch in ${doc.file}: expected ${key}="${expected}" but found "${observed ?? 'undefined'}"`
      );
    }
  });
});

if (errors.length) {
  console.error('\nDocumentation hierarchy violations found:');
  errors.forEach((err) => console.error(` - ${err}`));
  process.exit(1);
}

console.log('Documentation hierarchy validated successfully.');
