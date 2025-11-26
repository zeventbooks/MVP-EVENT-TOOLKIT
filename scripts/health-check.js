#!/usr/bin/env node

/**
 * Health Check Script
 *
 * Verifies that the status endpoint is responding correctly.
 * Reads BASE_URL from environment variable and validates the response.
 *
 * Usage:
 *   BASE_URL="https://www.eventangle.com/events" npm run test:health
 *   BASE_URL="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec" npm run test:health
 *
 * Expected response:
 *   {
 *     "ok": true,
 *     "buildId": "triangle-extended-v1.5",
 *     "brandId": "root",
 *     "timestamp": "2025-11-25T00:00:00Z"
 *   }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Read BUILD_ID from Config.gs
function getBuildIdFromConfig() {
  const configPath = path.join(__dirname, '..', 'src', 'mvp', 'Config.gs');
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    // Match BUILD_ID: 'value' or BUILD_ID: "value"
    const match = configContent.match(/BUILD_ID:\s*['"]([^'"]+)['"]/);
    if (match) {
      return match[1];
    }
    throw new Error('BUILD_ID not found in Config.gs');
  } catch (err) {
    console.error(`Failed to read Config.gs: ${err.message}`);
    process.exit(1);
  }
}

// Make HTTP/HTTPS request
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 30000 }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchUrl(response.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, body: data });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timed out after 30 seconds'));
    });
  });
}

async function runHealthCheck() {
  const baseUrl = process.env.BASE_URL;
  const brand = process.env.BRAND || 'root';

  if (!baseUrl) {
    console.error('❌ ERROR: BASE_URL environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  BASE_URL="https://www.eventangle.com/events" npm run test:health');
    console.error('  BASE_URL="https://script.google.com/macros/s/<ID>/exec" npm run test:health');
    process.exit(1);
  }

  const expectedBuildId = getBuildIdFromConfig();
  const statusUrl = `${baseUrl}?page=status&brand=${brand}`;

  console.log('');
  console.log('🏥 Health Check');
  console.log('═'.repeat(60));
  console.log(`📍 URL: ${statusUrl}`);
  console.log(`📦 Expected Build ID: ${expectedBuildId}`);
  console.log('');

  try {
    console.log('⏳ Fetching status endpoint...');
    const startTime = Date.now();
    const { statusCode, body } = await fetchUrl(statusUrl);
    const duration = Date.now() - startTime;

    console.log(`✓ Response received in ${duration}ms`);
    console.log('');

    // Parse JSON response
    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      console.error('❌ FAIL: Response is not valid JSON');
      console.error(`   Raw response: ${body.substring(0, 500)}`);
      process.exit(1);
    }

    console.log('📋 Response:');
    console.log(JSON.stringify(json, null, 2));
    console.log('');

    // Validate response structure
    const errors = [];

    if (typeof json.ok !== 'boolean') {
      errors.push('Missing or invalid "ok" field (expected boolean)');
    }

    if (json.ok !== true) {
      errors.push(`"ok" is not true: ${json.ok}`);
      if (json.message) {
        errors.push(`  Message: ${json.message}`);
      }
    }

    if (!json.buildId) {
      errors.push('Missing "buildId" field');
    } else if (json.buildId !== expectedBuildId) {
      errors.push(`"buildId" mismatch: expected "${expectedBuildId}", got "${json.buildId}"`);
    }

    if (!json.brandId) {
      errors.push('Missing "brandId" field');
    } else if (json.brandId !== brand) {
      errors.push(`"brandId" mismatch: expected "${brand}", got "${json.brandId}"`);
    }

    if (!json.timestamp) {
      errors.push('Missing "timestamp" field');
    } else {
      // Validate timestamp is ISO 8601 format
      const timestampDate = new Date(json.timestamp);
      if (isNaN(timestampDate.getTime())) {
        errors.push(`"timestamp" is not a valid ISO 8601 date: ${json.timestamp}`);
      }
    }

    // Report results
    if (errors.length > 0) {
      console.log('❌ HEALTH CHECK FAILED');
      console.log('═'.repeat(60));
      errors.forEach((err) => console.log(`   • ${err}`));
      console.log('');
      process.exit(1);
    }

    console.log('✅ HEALTH CHECK PASSED');
    console.log('═'.repeat(60));
    console.log(`   ✓ ok: ${json.ok}`);
    console.log(`   ✓ buildId: ${json.buildId}`);
    console.log(`   ✓ brandId: ${json.brandId}`);
    console.log(`   ✓ timestamp: ${json.timestamp}`);
    console.log(`   ✓ Response time: ${duration}ms`);
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ HEALTH CHECK FAILED');
    console.error('═'.repeat(60));
    console.error(`   Error: ${err.message}`);
    console.error('');
    process.exit(1);
  }
}

runHealthCheck();
