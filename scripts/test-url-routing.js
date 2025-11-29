#!/usr/bin/env node

/**
 * URL Routing Contract Test
 *
 * Verifies that friendly URLs resolve to the correct MVP surfaces.
 * This is a critical contract test - users touch these URLs directly.
 *
 * Tests:
 *   /events  → Public HTML
 *   /admin   → Admin HTML
 *   /display → Display HTML
 *   /poster  → Poster HTML
 *   /report  → SharedReport HTML
 *   /status  → JSON matching status.schema.json
 *
 * Usage:
 *   BASE_URL="https://www.eventangle.com" npm run test:url-routing
 *   BASE_URL="https://script.google.com/macros/s/<ID>/exec" npm run test:url-routing
 *
 * Note: Reuses infrastructure from health-check.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.BASE_URL;
const BRAND = process.env.BRAND || 'root';
const VERBOSE = process.env.VERBOSE === 'true';

// Surface → URL mapping with expected content markers
// These are the 5 MVP surfaces + status endpoint
const URL_ROUTES = {
  public: {
    path: '/events',
    expectedType: 'html',
    // Content markers that prove we got the right page
    markers: ['Public.html', 'data-surface="public"', 'EventAngle'],
    description: 'Public events page'
  },
  admin: {
    path: '/admin',
    expectedType: 'html',
    markers: ['Admin.html', 'data-surface="admin"', 'Management'],
    description: 'Admin management page'
  },
  display: {
    path: '/display',
    expectedType: 'html',
    markers: ['Display.html', 'data-surface="display"', 'display'],
    description: 'Display/TV surface'
  },
  poster: {
    path: '/poster',
    expectedType: 'html',
    markers: ['Poster.html', 'data-surface="poster"', 'poster'],
    description: 'Poster generation page'
  },
  report: {
    path: '/report',
    expectedType: 'html',
    // SharedReport.html is the actual file name
    markers: ['SharedReport.html', 'data-surface="report"', 'report'],
    description: 'SharedReport analytics page'
  },
  status: {
    path: '/status',
    expectedType: 'json',
    markers: [], // JSON validation handled separately
    description: 'Status endpoint (health check)'
  }
};

// ============================================================================
// HTTP Client (reused from health-check.js)
// ============================================================================

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 30000 }, (response) => {
      // Handle redirects (but track them)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (options.followRedirects !== false) {
          return fetchUrl(response.headers.location, options).then(resolve).catch(reject);
        }
        return resolve({
          statusCode: response.statusCode,
          body: '',
          redirectedTo: response.headers.location
        });
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: data,
          headers: response.headers
        });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timed out after 30 seconds'));
    });
  });
}

// ============================================================================
// Status Schema Validation
// ============================================================================

function loadStatusSchema() {
  const schemaPath = path.join(__dirname, '..', 'schemas', 'status.schema.json');
  try {
    return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to load status.schema.json: ${err.message}`);
    return null;
  }
}

function validateStatusResponse(json, schema) {
  const errors = [];

  // Check required fields from schema
  const required = schema.required || ['ok', 'buildId', 'brandId', 'time'];
  for (const field of required) {
    if (!(field in json)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate field types from schema.properties
  const props = schema.properties || {};

  if (props.ok && typeof json.ok !== 'boolean') {
    errors.push(`Field "ok" should be boolean, got ${typeof json.ok}`);
  }

  if (props.buildId) {
    if (typeof json.buildId !== 'string') {
      errors.push(`Field "buildId" should be string, got ${typeof json.buildId}`);
    } else if (props.buildId.pattern) {
      const pattern = new RegExp(props.buildId.pattern);
      if (!pattern.test(json.buildId)) {
        errors.push(`Field "buildId" does not match pattern: ${props.buildId.pattern}`);
      }
    }
  }

  if (props.brandId) {
    if (typeof json.brandId !== 'string') {
      errors.push(`Field "brandId" should be string, got ${typeof json.brandId}`);
    } else if (props.brandId.pattern) {
      const pattern = new RegExp(props.brandId.pattern);
      if (!pattern.test(json.brandId)) {
        errors.push(`Field "brandId" does not match pattern: ${props.brandId.pattern}`);
      }
    }
  }

  if (props.time) {
    if (typeof json.time !== 'string') {
      errors.push(`Field "time" should be string, got ${typeof json.time}`);
    } else {
      // Validate ISO 8601 date format
      const date = new Date(json.time);
      if (isNaN(date.getTime())) {
        errors.push(`Field "time" is not a valid ISO 8601 date: ${json.time}`);
      }
    }
  }

  // Check for disallowed additional properties
  if (schema.additionalProperties === false) {
    const allowedKeys = Object.keys(props);
    for (const key of Object.keys(json)) {
      if (!allowedKeys.includes(key)) {
        errors.push(`Unexpected field: ${key} (additionalProperties: false)`);
      }
    }
  }

  return errors;
}

// ============================================================================
// Route Testing
// ============================================================================

async function testRoute(surface, config) {
  const url = buildUrl(config.path);
  const result = {
    surface,
    path: config.path,
    url,
    success: false,
    errors: [],
    warnings: [],
    duration: 0
  };

  try {
    const startTime = Date.now();
    const response = await fetchUrl(url);
    result.duration = Date.now() - startTime;
    result.statusCode = response.statusCode;

    // Check HTTP status
    if (response.statusCode !== 200) {
      result.errors.push(`HTTP ${response.statusCode} (expected 200)`);
      if (response.statusCode === 302) {
        result.errors.push('302 redirect suggests executeAs permission issue');
      }
      return result;
    }

    // Validate content type
    const contentType = response.headers['content-type'] || '';

    if (config.expectedType === 'json') {
      // Status endpoint - validate JSON against schema
      if (!contentType.includes('application/json')) {
        result.warnings.push(`Expected JSON content-type, got: ${contentType}`);
      }

      let json;
      try {
        json = JSON.parse(response.body);
      } catch (parseErr) {
        result.errors.push(`Response is not valid JSON: ${parseErr.message}`);
        if (VERBOSE) {
          result.errors.push(`Body preview: ${response.body.substring(0, 200)}`);
        }
        return result;
      }

      // Validate against status.schema.json
      const schema = loadStatusSchema();
      if (schema) {
        const schemaErrors = validateStatusResponse(json, schema);
        result.errors.push(...schemaErrors);
      }

      // Also check ok=true for health
      if (json.ok !== true) {
        result.errors.push(`Status ok=${json.ok} (expected true)`);
        if (json.message) {
          result.errors.push(`Message: ${json.message}`);
        }
      }

      result.json = json;
    } else {
      // HTML page - validate content markers
      if (!contentType.includes('text/html')) {
        result.warnings.push(`Expected HTML content-type, got: ${contentType}`);
      }

      const body = response.body;

      // Check for at least one content marker
      let foundMarker = false;
      for (const marker of config.markers) {
        if (body.includes(marker)) {
          foundMarker = true;
          if (VERBOSE) {
            result.foundMarkers = result.foundMarkers || [];
            result.foundMarkers.push(marker);
          }
        }
      }

      if (!foundMarker && config.markers.length > 0) {
        result.errors.push(`No content markers found. Expected one of: ${config.markers.join(', ')}`);
        if (VERBOSE) {
          // Show a preview of what we got
          const preview = body.substring(0, 500).replace(/\n/g, ' ').substring(0, 200);
          result.errors.push(`Body preview: ${preview}...`);
        }
      }

      // Check for error indicators
      if (body.includes('Error') && body.includes('Script function not found')) {
        result.errors.push('Got Apps Script error page');
      }
      // Check for Google login redirect by looking for accounts.google.com URLs
      // Using regex with word boundary to ensure we match the exact hostname
      const googleLoginPattern = /https:\/\/accounts\.google\.com\//;
      if (googleLoginPattern.test(body)) {
        result.errors.push('Got Google login redirect (check executeAs settings)');
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.errors.push(`Request failed: ${err.message}`);
  }

  return result;
}

function buildUrl(path) {
  if (!BASE_URL) return path;

  // Handle different BASE_URL formats
  let base = BASE_URL.replace(/\/$/, ''); // Remove trailing slash

  // If BASE_URL is a GAS exec URL, use query params instead of path
  if (base.includes('/exec')) {
    // Map path to page parameter
    const pathToPage = {
      '/events': 'public',
      '/admin': 'admin',
      '/display': 'display',
      '/poster': 'poster',
      '/report': 'report',
      '/status': 'status'
    };
    const page = pathToPage[path] || 'public';
    return `${base}?page=${page}&brand=${BRAND}`;
  }

  // For friendly URLs (Cloudflare worker), use path directly
  return `${base}${path}`;
}

// ============================================================================
// Main
// ============================================================================

async function runTests() {
  console.log('');
  console.log('URL Routing Contract Test');
  console.log('='.repeat(60));

  if (!BASE_URL) {
    console.error('ERROR: BASE_URL environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  BASE_URL="https://www.eventangle.com" npm run test:url-routing');
    console.error('  BASE_URL="https://script.google.com/macros/s/<ID>/exec" npm run test:url-routing');
    process.exit(1);
  }

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Brand: ${BRAND}`);
  console.log('');
  console.log('Testing URL routes...');
  console.log('');

  const results = [];
  let passed = 0;
  let failed = 0;

  // Test each route
  for (const [surface, config] of Object.entries(URL_ROUTES)) {
    process.stdout.write(`  ${surface.padEnd(10)} ${config.path.padEnd(12)} `);

    const result = await testRoute(surface, config);
    results.push(result);

    if (result.success) {
      passed++;
      console.log(`PASS (${result.duration}ms)`);
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`    ! ${w}`));
      }
    } else {
      failed++;
      console.log(`FAIL`);
      result.errors.forEach(e => console.log(`    x ${e}`));
      result.warnings.forEach(w => console.log(`    ! ${w}`));
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('');
    console.log('All URL routes resolve correctly!');
    console.log('');
    console.log('Verified routes:');
    for (const [surface, config] of Object.entries(URL_ROUTES)) {
      console.log(`  ${config.path} -> ${surface} (${config.description})`);
    }
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    console.log('FAILED: Some URL routes did not resolve correctly.');
    console.log('');
    console.log('Check:');
    console.log('  1. Worker config (cloudflare-proxy/worker.js pathToPage)');
    console.log('  2. Config.URL_ALIASES (src/mvp/Config.gs)');
    console.log('  3. Apps Script deployment permissions (executeAs: USER_DEPLOYING)');
    console.log('');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
