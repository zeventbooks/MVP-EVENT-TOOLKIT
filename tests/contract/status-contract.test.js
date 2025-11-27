/**
 * Status Contract Test - Single Source of Truth Validation
 *
 * This test validates that the live ?page=status endpoint returns values
 * that match the canonical BUILD_ID and BRAND_ID constants defined in Config.gs.
 *
 * Purpose: DevOps / SDET contract validation
 * - Ensures BUILD_ID is exposed consistently
 * - Ensures brandId matches configured brands
 * - Pins the status API contract for integration flow
 *
 * Run: npm run test:status-contract
 *
 * Environment:
 *   BASE_URL - Target environment (default: https://eventangle.com)
 *   CI - When set, network-dependent tests are skipped (no external HTTP calls in CI)
 *   SKIP_NETWORK_TESTS - Explicitly skip network tests
 */

const fs = require('fs');
const path = require('path');

// --- CI Detection ---
// Skip network tests in CI environments where external HTTP calls may not work
const isCI = process.env.CI === 'true' || process.env.CI === true;
const skipNetworkTests = isCI || process.env.SKIP_NETWORK_TESTS === 'true';

// Use describe.skip for network tests in CI, otherwise regular describe
const describeNetwork = skipNetworkTests ? describe.skip : describe;

// --- Extract canonical values from Config.gs (Single Source of Truth) ---

/**
 * Parse BUILD_ID from Config.gs
 * This ensures tests validate against the actual code constant
 */
function getCanonicalBuildId() {
  const configPath = path.join(__dirname, '../../src/mvp/Config.gs');
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Extract BUILD_ID from: BUILD_ID: 'triangle-extended-v1.5',
  const match = configContent.match(/BUILD_ID:\s*['"]([^'"]+)['"]/);
  if (!match) {
    throw new Error('Could not extract BUILD_ID from Config.gs');
  }
  return match[1];
}

/**
 * Parse BRANDS array from Config.gs to get valid brand IDs
 */
function getCanonicalBrandIds() {
  const configPath = path.join(__dirname, '../../src/mvp/Config.gs');
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Find the BRANDS array section (between "const BRANDS = [" and the next "];")
  const brandsMatch = configContent.match(/const BRANDS\s*=\s*\[([\s\S]*?)\];/);
  if (!brandsMatch) {
    throw new Error('Could not find BRANDS array in Config.gs');
  }

  const brandsSection = brandsMatch[1];

  // Extract brand IDs from the BRANDS section only
  // Pattern: { id: 'root', ... } or { id: "root", ... }
  const idMatches = brandsSection.matchAll(/{\s*\n?\s*id:\s*['"]([^'"]+)['"]/g);
  const brandIds = [];
  for (const match of idMatches) {
    brandIds.push(match[1]);
  }

  if (brandIds.length === 0) {
    throw new Error('Could not extract brand IDs from Config.gs BRANDS array');
  }
  return brandIds;
}

// --- Test Configuration ---

const BASE_URL = process.env.BASE_URL || 'https://eventangle.com';
const TIMEOUT_MS = 30000; // 30 seconds for Google Apps Script

// --- HTTP Client ---

async function fetchStatus(brandId = 'root') {
  const url = brandId === 'root'
    ? `${BASE_URL}/status`
    : `${BASE_URL}/${brandId}/status`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// --- Contract Tests ---

describe('Status Contract - Single Source of Truth', () => {
  let CANONICAL_BUILD_ID;
  let CANONICAL_BRAND_IDS;

  beforeAll(() => {
    // Load canonical values from Config.gs
    CANONICAL_BUILD_ID = getCanonicalBuildId();
    CANONICAL_BRAND_IDS = getCanonicalBrandIds();

    console.log('\n==============================================');
    console.log('Status Contract Test - Single Source of Truth');
    console.log('==============================================');
    console.log(`BASE_URL: ${BASE_URL}`);
    console.log(`Canonical BUILD_ID: ${CANONICAL_BUILD_ID}`);
    console.log(`Canonical Brand IDs: ${CANONICAL_BRAND_IDS.join(', ')}`);
    if (skipNetworkTests) {
      console.log('⚠️  Network tests SKIPPED (CI environment detected)');
      console.log('   Run locally with: npm run test:status-contract');
    }
    console.log('==============================================\n');
  });

  describe('Canonical Values Extraction', () => {
    it('should extract BUILD_ID from Config.gs', () => {
      expect(CANONICAL_BUILD_ID).toBeDefined();
      expect(typeof CANONICAL_BUILD_ID).toBe('string');
      expect(CANONICAL_BUILD_ID.length).toBeGreaterThan(0);
    });

    it('should extract brand IDs from Config.gs', () => {
      expect(CANONICAL_BRAND_IDS).toBeDefined();
      expect(Array.isArray(CANONICAL_BRAND_IDS)).toBe(true);
      expect(CANONICAL_BRAND_IDS.length).toBeGreaterThan(0);
      expect(CANONICAL_BRAND_IDS).toContain('root');
    });
  });

  describeNetwork('?page=status API Contract', () => {
    it('should return ok: true', async () => {
      const data = await fetchStatus('root');

      expect(data).toHaveProperty('ok');
      expect(data.ok).toBe(true);
    }, TIMEOUT_MS);

    it('should return buildId matching Config.gs BUILD_ID', async () => {
      const data = await fetchStatus('root');

      expect(data).toHaveProperty('buildId');
      expect(data.buildId).toBe(CANONICAL_BUILD_ID);
    }, TIMEOUT_MS);

    it('should return brandId matching the configured brand', async () => {
      const data = await fetchStatus('root');

      expect(data).toHaveProperty('brandId');
      expect(data.brandId).toBe('root');
      expect(CANONICAL_BRAND_IDS).toContain(data.brandId);
    }, TIMEOUT_MS);

    it('should return timestamp in ISO 8601 format', async () => {
      const data = await fetchStatus('root');

      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');

      // Validate ISO 8601 format
      const parsed = new Date(data.timestamp);
      expect(parsed.toISOString()).toBe(data.timestamp);
    }, TIMEOUT_MS);

    it('should return flat format (no value wrapper)', async () => {
      const data = await fetchStatus('root');

      // Flat format - no envelope wrapper
      expect(data).not.toHaveProperty('value');
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('buildId');
      expect(data).toHaveProperty('brandId');
    }, TIMEOUT_MS);
  });

  describeNetwork('Multi-Brand Contract Validation', () => {
    it.each(['root', 'abc', 'cbc', 'cbl'])(
      'should return consistent buildId for brand: %s',
      async (brandId) => {
        const data = await fetchStatus(brandId);

        expect(data.ok).toBe(true);
        expect(data.buildId).toBe(CANONICAL_BUILD_ID);
        expect(data.brandId).toBe(brandId);
      },
      TIMEOUT_MS
    );

    it('should return ok: false for invalid brand', async () => {
      const url = `${BASE_URL}/nonexistent-brand/status`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      // May redirect or return error
      if (response.ok) {
        const data = await response.json();
        // If it returns JSON, should indicate brand not found
        expect(data.ok).toBe(false);
        expect(data).toHaveProperty('message');
        expect(data.message).toMatch(/not found/i);
      }
      // If not ok, that's also acceptable (404, etc.)
    }, TIMEOUT_MS);
  });

  describeNetwork('Contract Schema Validation', () => {
    it('should match the exact status response schema', async () => {
      const data = await fetchStatus('root');

      // Required fields
      const requiredFields = ['ok', 'buildId', 'brandId', 'timestamp'];
      requiredFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });

      // Type validation
      expect(typeof data.ok).toBe('boolean');
      expect(typeof data.buildId).toBe('string');
      expect(typeof data.brandId).toBe('string');
      expect(typeof data.timestamp).toBe('string');

      // Value constraints
      expect(data.ok).toBe(true);
      expect(data.buildId).toBe(CANONICAL_BUILD_ID);
      expect(CANONICAL_BRAND_IDS).toContain(data.brandId);
    }, TIMEOUT_MS);
  });
});
