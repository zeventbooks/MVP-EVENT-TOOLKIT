/**
 * Stage-2 API Smoke Test: Environment Alignment Gate
 *
 * Story 5 - Validate Worker ↔ GAS deployment alignment
 *
 * Purpose:
 *   Ensure Worker /env-status and GAS /whoami return matching deployment
 *   information. Prevents 503 disasters from deployment mismatches.
 *
 * Acceptance Criteria:
 *   - Worker /env-status and GAS /whoami deploymentId MUST match
 *   - scriptId matches expected staging/production Script ID
 *   - account email contains "zeventbook"
 *   - both environments report "staging" (for staging deploys)
 *   - CI blocks release if Worker ↔ GAS mismatch detected
 *
 * @see cloudflare-proxy/worker.js - handleEnvStatusEndpoint()
 * @see src/mvp/Code.gs - api_whoami()
 */

import { test, expect } from '@playwright/test';

// Brand to test - uses root by default
const BRAND = process.env.TEST_BRAND || 'root';

// Expected Script IDs for each environment
const EXPECTED_SCRIPT_IDS = {
  staging: '1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ',
  production: '1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l'
};

// Detect if running against production
const IS_PRODUCTION = process.env.USE_PRODUCTION === 'true' ||
  process.env.BASE_URL?.includes('www.eventangle.com');

// Expected environment name based on deployment target
const EXPECTED_ENV = IS_PRODUCTION ? 'production' : 'staging';

// Expected Script ID based on environment
const EXPECTED_SCRIPT_ID = IS_PRODUCTION
  ? EXPECTED_SCRIPT_IDS.production
  : EXPECTED_SCRIPT_IDS.staging;

test.describe('Environment Alignment Gate (Story 5)', () => {

  // Store responses for cross-test assertions
  let envStatusResponse: {
    env: string;
    gasBase: string;
    deploymentId: string;
    workerBuild: string;
  };

  let whoamiResponse: {
    scriptId: string;
    deploymentId: string;
    email: string;
    buildId: string;
    brand: string;
    time: string;
  };

  test.describe('Worker /env-status Endpoint', () => {

    test('returns HTTP 200 with JSON', async ({ request }) => {
      const response = await request.get('/env-status');

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
    });

    test('returns required fields (env, gasBase, deploymentId, workerBuild)', async ({ request }) => {
      const response = await request.get('/env-status');
      const json = await response.json();

      // Store for cross-test assertions
      envStatusResponse = json;

      // Validate required fields exist
      expect(json).toHaveProperty('env');
      expect(typeof json.env).toBe('string');
      expect(['staging', 'production']).toContain(json.env);

      expect(json).toHaveProperty('gasBase');
      expect(typeof json.gasBase).toBe('string');
      expect(json.gasBase).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/);

      expect(json).toHaveProperty('deploymentId');
      expect(typeof json.deploymentId).toBe('string');
      expect(json.deploymentId.length).toBeGreaterThan(10);
      expect(json.deploymentId).not.toBe('unknown');

      expect(json).toHaveProperty('workerBuild');
      expect(typeof json.workerBuild).toBe('string');
    });

    test('includes Worker transparency headers', async ({ request }) => {
      const response = await request.get('/env-status');
      const headers = response.headers();

      expect(headers['x-proxied-by']).toBe('eventangle-worker');
      expect(headers['x-worker-version']).toBeDefined();
      expect(headers['cache-control']).toContain('no-cache');
    });

    test('env matches expected environment', async ({ request }) => {
      const response = await request.get('/env-status');
      const json = await response.json();

      expect(json.env).toBe(EXPECTED_ENV);
    });

  });

  test.describe('GAS /whoami Endpoint (via Worker)', () => {

    test('returns HTTP 200 with JSON', async ({ request }) => {
      const response = await request.get(`/?page=whoami&brand=${BRAND}`);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
    });

    test('returns required fields (scriptId, deploymentId, email, buildId)', async ({ request }) => {
      const response = await request.get(`/?page=whoami&brand=${BRAND}`);
      const json = await response.json();

      // Store for cross-test assertions
      whoamiResponse = json;

      // Validate required fields exist
      expect(json).toHaveProperty('scriptId');
      expect(typeof json.scriptId).toBe('string');
      expect(json.scriptId.length).toBeGreaterThan(10);
      expect(json.scriptId).not.toBe('unknown');

      expect(json).toHaveProperty('deploymentId');
      expect(typeof json.deploymentId).toBe('string');
      expect(json.deploymentId.length).toBeGreaterThan(10);
      expect(json.deploymentId).not.toBe('unknown');

      expect(json).toHaveProperty('email');
      expect(typeof json.email).toBe('string');

      expect(json).toHaveProperty('buildId');
      expect(typeof json.buildId).toBe('string');

      expect(json).toHaveProperty('brand');
      expect(json.brand).toBe(BRAND);

      expect(json).toHaveProperty('time');
      expect(typeof json.time).toBe('string');
      // ISO 8601 format validation
      expect(json.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('scriptId matches expected Script ID', async ({ request }) => {
      const response = await request.get(`/?page=whoami&brand=${BRAND}`);
      const json = await response.json();

      expect(json.scriptId).toBe(EXPECTED_SCRIPT_ID);
    });

    test('account email contains "zeventbook"', async ({ request }) => {
      const response = await request.get(`/?page=whoami&brand=${BRAND}`);
      const json = await response.json();

      // Account should be zeventbook@gmail.com or similar
      expect(json.email.toLowerCase()).toContain('zeventbook');
    });

  });

  test.describe('Worker ↔ GAS Alignment (CI Gate)', () => {

    test('deploymentId matches between Worker and GAS', async ({ request }) => {
      // Fetch both endpoints
      const [envStatusRes, whoamiRes] = await Promise.all([
        request.get('/env-status'),
        request.get(`/?page=whoami&brand=${BRAND}`)
      ]);

      const envStatus = await envStatusRes.json();
      const whoami = await whoamiRes.json();

      // CRITICAL: Deployment IDs MUST match
      // If this fails, Worker is pointing to wrong GAS deployment
      expect(envStatus.deploymentId).toBe(whoami.deploymentId);
    });

    test('gasBase URL contains matching deploymentId', async ({ request }) => {
      const [envStatusRes, whoamiRes] = await Promise.all([
        request.get('/env-status'),
        request.get(`/?page=whoami&brand=${BRAND}`)
      ]);

      const envStatus = await envStatusRes.json();
      const whoami = await whoamiRes.json();

      // gasBase should contain the same deploymentId
      expect(envStatus.gasBase).toContain(whoami.deploymentId);
    });

    test('both environments are staging (staging deploys only)', async ({ request }) => {
      // Skip this test for production deployments
      test.skip(IS_PRODUCTION, 'Production deployment - expecting production env');

      const response = await request.get('/env-status');
      const json = await response.json();

      // For staging deploys, env MUST be "staging"
      expect(json.env).toBe('staging');
    });

    test('both environments are production (production deploys only)', async ({ request }) => {
      // Skip this test for staging deployments
      test.skip(!IS_PRODUCTION, 'Staging deployment - expecting staging env');

      const response = await request.get('/env-status');
      const json = await response.json();

      // For production deploys, env MUST be "production"
      expect(json.env).toBe('production');
    });

  });

  test.describe('Alignment Summary Report', () => {

    test('generates alignment report for CI artifacts', async ({ request }) => {
      // Fetch both endpoints
      const [envStatusRes, whoamiRes] = await Promise.all([
        request.get('/env-status'),
        request.get(`/?page=whoami&brand=${BRAND}`)
      ]);

      const envStatus = await envStatusRes.json();
      const whoami = await whoamiRes.json();

      // Build alignment report
      const alignmentReport = {
        timestamp: new Date().toISOString(),
        environment: EXPECTED_ENV,
        worker: {
          env: envStatus.env,
          deploymentId: envStatus.deploymentId,
          workerBuild: envStatus.workerBuild,
          gasBase: envStatus.gasBase
        },
        gas: {
          scriptId: whoami.scriptId,
          deploymentId: whoami.deploymentId,
          email: whoami.email,
          buildId: whoami.buildId
        },
        alignment: {
          deploymentIdMatch: envStatus.deploymentId === whoami.deploymentId,
          scriptIdMatch: whoami.scriptId === EXPECTED_SCRIPT_ID,
          accountValid: whoami.email.toLowerCase().includes('zeventbook'),
          envMatch: envStatus.env === EXPECTED_ENV
        },
        verdict: 'PENDING'
      };

      // Determine overall verdict
      const allChecksPass =
        alignmentReport.alignment.deploymentIdMatch &&
        alignmentReport.alignment.scriptIdMatch &&
        alignmentReport.alignment.accountValid &&
        alignmentReport.alignment.envMatch;

      alignmentReport.verdict = allChecksPass ? 'PASS' : 'FAIL';

      // Log report for CI visibility
      console.log('\n========== ENVIRONMENT ALIGNMENT REPORT ==========');
      console.log(JSON.stringify(alignmentReport, null, 2));
      console.log('='.repeat(50));

      // Final assertion - all checks must pass
      expect(alignmentReport.verdict).toBe('PASS');
    });

  });

});
