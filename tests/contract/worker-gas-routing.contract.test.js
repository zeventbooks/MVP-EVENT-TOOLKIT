/**
 * Worker → GAS Routing Contract Test (Stage-1 Hermetic)
 *
 * Story 3 - Validate Worker → GAS Routing With New NU Transport
 *
 * Purpose:
 *   Hermetic validation of Worker configuration for GAS routing.
 *   Ensures correct deployment IDs, /api/* routing logic, and
 *   response type guarantees WITHOUT making HTTP calls.
 *
 * Stage-1 Test (Hermetic):
 *   - No network calls
 *   - Validates source code contracts
 *   - Runs in CI without staging environment
 *
 * Acceptance Criteria Validated:
 *   - Correct GAS_DEPLOYMENT_ID env var for staging Worker
 *   - Worker handles JSON POST properly (/api/* → JSON responses)
 *   - Worker never returns HTML on /api/*
 *   - CORS rules are defined correctly
 *
 * @see cloudflare-proxy/worker.js - Worker implementation
 * @see wrangler.toml - Staging deployment configuration
 * @see cloudflare-proxy/wrangler.toml - All environment configurations
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Source File Paths
// =============================================================================

const WORKER_PATH = path.join(__dirname, '../../cloudflare-proxy/worker.js');
const ROOT_WRANGLER_PATH = path.join(__dirname, '../../wrangler.toml');
const PROXY_WRANGLER_PATH = path.join(__dirname, '../../cloudflare-proxy/wrangler.toml');
const ENVIRONMENTS_PATH = path.join(__dirname, '../../config/environments.js');

// =============================================================================
// Known Deployment IDs (Single Source of Truth)
// =============================================================================

const STAGING_DEPLOYMENT_ID = 'AKfycbxx2nN-zkU-Jke1ECl1C7RUwOyGmrZ6B-6-ViMIjXKrIT3Q1dLh5lf5LK5Ymdg-cbcJ';
const PRODUCTION_DEPLOYMENT_ID = 'AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ';

// =============================================================================
// Helper Functions
// =============================================================================

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractFromWorker(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1] : null;
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Worker → GAS Routing Contract', () => {

  describe('GAS Deployment ID Configuration', () => {
    let rootWranglerContent;
    let proxyWranglerContent;

    beforeAll(() => {
      rootWranglerContent = readFileContent(ROOT_WRANGLER_PATH);
      proxyWranglerContent = readFileContent(PROXY_WRANGLER_PATH);
    });

    test('root wrangler.toml has correct staging DEPLOYMENT_ID', () => {
      // Staging deployment should NOT use production ID
      expect(rootWranglerContent).toContain(`DEPLOYMENT_ID = "${STAGING_DEPLOYMENT_ID}"`);
      expect(rootWranglerContent).not.toContain(`DEPLOYMENT_ID = "${PRODUCTION_DEPLOYMENT_ID}"`);
    });

    test('root wrangler.toml has correct GAS_DEPLOYMENT_BASE_URL for staging', () => {
      const expectedUrl = `https://script.google.com/macros/s/${STAGING_DEPLOYMENT_ID}/exec`;
      expect(rootWranglerContent).toContain(expectedUrl);
    });

    test('root wrangler.toml points to correct worker path', () => {
      expect(rootWranglerContent).toContain('main = "cloudflare-proxy/worker.js"');
    });

    test('root wrangler.toml is configured for staging environment', () => {
      expect(rootWranglerContent).toContain('name = "eventangle-staging"');
      expect(rootWranglerContent).toContain('stg.eventangle.com');
    });

    test('proxy wrangler.toml [env.staging] has correct deployment ID', () => {
      expect(proxyWranglerContent).toContain(`STAGING_DEPLOYMENT_ID = "${STAGING_DEPLOYMENT_ID}"`);
    });

    test('proxy wrangler.toml [env.production] has correct deployment ID', () => {
      // Production section should have production ID
      expect(proxyWranglerContent).toMatch(
        /\[env\.production\.vars\][\s\S]*?DEPLOYMENT_ID = "AKfycbyS1/
      );
    });

    test('staging and production deployment IDs are different', () => {
      expect(STAGING_DEPLOYMENT_ID).not.toBe(PRODUCTION_DEPLOYMENT_ID);
    });

  });

  describe('Worker /api/* Routing Logic', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('worker handles /api/* POST requests', () => {
      // Worker should have handleApiRequest function
      expect(workerContent).toContain('async function handleApiRequest');
      // Should check for /api/ path
      expect(workerContent).toContain("url.pathname.startsWith('/api/')");
      expect(workerContent).toContain("request.method === 'POST'");
    });

    test('worker has legacy /api/rpc endpoint support', () => {
      // Legacy RPC endpoint for backward compatibility
      expect(workerContent).toContain("pathname === '/api/rpc'");
      expect(workerContent).toContain('handleRpcRequest');
    });

    test('worker returns JSON Content-Type for API responses', () => {
      // API responses should have JSON content type
      expect(workerContent).toContain("'Content-Type': 'application/json'");
    });

    test('worker does NOT return HTML on API error paths', () => {
      // Check that createGracefulErrorResponse returns JSON for API requests
      expect(workerContent).toContain('if (isApiRequest)');
      expect(workerContent).toContain('JSON.stringify({');
      expect(workerContent).toContain("code: isTimeout ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE'");
    });

    test('worker has proper error envelope format', () => {
      // Error responses should follow the envelope contract
      expect(workerContent).toContain('ok: false');
      expect(workerContent).toContain("code: 'BAD_INPUT'");
      expect(workerContent).toContain("code: 'NOT_FOUND'");
    });

    test('worker generates correlation IDs for error tracking', () => {
      expect(workerContent).toContain('function generateCorrId');
      expect(workerContent).toContain('corrId');
    });

  });

  describe('Worker CORS Configuration', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('worker handles OPTIONS preflight requests', () => {
      expect(workerContent).toContain("request.method === 'OPTIONS'");
      expect(workerContent).toContain('handleCORS');
    });

    test('worker has CORS headers defined', () => {
      expect(workerContent).toContain("'Access-Control-Allow-Origin': '*'");
      expect(workerContent).toContain("'Access-Control-Allow-Methods'");
      expect(workerContent).toContain("'Access-Control-Allow-Headers'");
    });

    test('worker sets Access-Control-Max-Age for preflight caching', () => {
      expect(workerContent).toContain("'Access-Control-Max-Age': '86400'");
    });

    test('addCORSHeaders function exists and adds headers', () => {
      expect(workerContent).toContain('function addCORSHeaders');
    });

  });

  describe('Worker Transparency Headers', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('worker adds X-Proxied-By header', () => {
      expect(workerContent).toContain("'X-Proxied-By': 'eventangle-worker'");
      expect(workerContent).toContain("'X-Proxied-By', 'eventangle-worker'");
    });

    test('worker adds X-Worker-Version header', () => {
      expect(workerContent).toContain("'X-Worker-Version'");
      expect(workerContent).toContain('WORKER_VERSION');
    });

    test('worker adds X-Proxy-Duration-Ms header', () => {
      expect(workerContent).toContain("'X-Proxy-Duration-Ms'");
    });

    test('worker adds X-Error-CorrId header on errors', () => {
      expect(workerContent).toContain("'X-Error-CorrId'");
    });

  });

  describe('Worker API Path Extraction', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('worker extracts action from path-based URLs', () => {
      // /api/events/list -> action=list
      expect(workerContent).toContain("pathname.slice('/api/'.length)");
    });

    test('worker converts legacy RPC method to action', () => {
      // api_list -> list
      expect(workerContent).toContain("method.startsWith('api_')");
      expect(workerContent).toContain('.slice(4)');
    });

    test('worker builds GAS request body with action', () => {
      expect(workerContent).toContain('const gasBody = {');
      expect(workerContent).toContain('action,');
    });

    test('worker forwards request to GAS doPost', () => {
      expect(workerContent).toContain('fetch(appsScriptBase');
      expect(workerContent).toContain("method: 'POST'");
    });

  });

  describe('Worker Error Response Contract', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('BAD_INPUT error for invalid JSON body', () => {
      expect(workerContent).toContain("code: 'BAD_INPUT'");
      expect(workerContent).toContain("message: 'Invalid JSON in request body'");
    });

    test('BAD_INPUT error for missing method in RPC', () => {
      expect(workerContent).toContain("message: 'Missing method in RPC request'");
    });

    test('BAD_INPUT error for missing API path', () => {
      expect(workerContent).toContain("message: 'Missing API path'");
    });

    test('NOT_FOUND error format for unknown routes', () => {
      expect(workerContent).toContain("code: 'NOT_FOUND'");
      expect(workerContent).toContain('generate404Json');
    });

    test('TIMEOUT error for upstream timeouts', () => {
      expect(workerContent).toContain("code: isTimeout ? 'TIMEOUT'");
    });

    test('SERVICE_UNAVAILABLE error for upstream failures', () => {
      expect(workerContent).toContain("'SERVICE_UNAVAILABLE'");
    });

  });

  describe('Environment Configuration Sync', () => {
    let environmentsContent;

    beforeAll(() => {
      environmentsContent = readFileContent(ENVIRONMENTS_PATH);
    });

    test('environments.js has STAGING_URL defined', () => {
      expect(environmentsContent).toContain("STAGING_URL = 'https://stg.eventangle.com'");
    });

    test('environments.js has correct staging deployment ID reference', () => {
      expect(environmentsContent).toContain('STAGING_DEPLOYMENT_ID');
    });

    test('staging is the default safe sandbox', () => {
      expect(environmentsContent).toContain('isDefault: true');
      // Staging section should have isDefault: true
      expect(environmentsContent).toMatch(/staging[\s\S]*?isDefault:\s*true/);
    });

  });

  describe('Worker Version', () => {
    let workerContent;

    beforeAll(() => {
      workerContent = readFileContent(WORKER_PATH);
    });

    test('worker has version 1.5.0 or higher', () => {
      const versionMatch = workerContent.match(/const WORKER_VERSION = '([^']+)'/);
      expect(versionMatch).toBeTruthy();

      const [major, minor] = versionMatch[1].split('.').map(Number);
      expect(major).toBeGreaterThanOrEqual(1);
      if (major === 1) {
        expect(minor).toBeGreaterThanOrEqual(5);
      }
    });

  });

});

// =============================================================================
// Snapshot Tests
// =============================================================================

describe('Worker Configuration Snapshots', () => {

  test('staging deployment ID matches expected value', () => {
    const rootWrangler = readFileContent(ROOT_WRANGLER_PATH);
    const idMatch = rootWrangler.match(/DEPLOYMENT_ID = "([^"]+)"/);
    expect(idMatch).toBeTruthy();
    expect(idMatch[1]).toBe(STAGING_DEPLOYMENT_ID);
  });

  test('staging GAS URL is properly constructed', () => {
    const rootWrangler = readFileContent(ROOT_WRANGLER_PATH);
    const expectedUrl = `https://script.google.com/macros/s/${STAGING_DEPLOYMENT_ID}/exec`;
    expect(rootWrangler).toContain(expectedUrl);
  });

});
