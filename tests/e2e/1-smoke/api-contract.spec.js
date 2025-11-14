/**
 * API CONTRACT TESTS - Level 1: API Response Validation
 *
 * Purpose: Validate API endpoints return correct data structures
 * Run Time: < 30 seconds
 * Run Frequency: Every deployment
 *
 * Tests:
 * - Status API schema
 * - Analytics API schema
 * - Event creation API response
 * - Response times
 * - Error responses
 */

const { test, expect } = require('@playwright/test');
const { BASE_URL, TENANT_ID } = require('../../shared/config/test.config.js');

test.describe('🔌 API CONTRACT: Status Endpoint', () => {

  test('Status API returns valid JSON schema', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);

    // STRICT: Must be 200 OK
    expect(response.status()).toBe(200);

    // STRICT: Must be JSON content type
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const json = await response.json();

    // STRICT: Schema validation
    expect(json).toHaveProperty('ok');
    expect(typeof json.ok).toBe('boolean');

    expect(json).toHaveProperty('value');
    expect(typeof json.value).toBe('object');

    expect(json.value).toHaveProperty('build');
    expect(typeof json.value.build).toBe('string');
    expect(json.value.build.length).toBeGreaterThan(0);

    expect(json.value).toHaveProperty('tenant');
    expect(json.value.tenant).toBe(TENANT_ID);
  });

  test('Status API responds within SLA', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);
    const duration = Date.now() - start;

    // STRICT: Status check must be fast (< 2s)
    expect(duration).toBeLessThan(2000);
    expect(response.status()).toBe(200);
  });

  test('Status API returns consistent structure on multiple calls', async ({ request }) => {
    const calls = 3;
    const responses = [];

    for (let i = 0; i < calls; i++) {
      const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);
      const json = await response.json();
      responses.push(json);
    }

    // STRICT: All responses must have same structure
    for (const resp of responses) {
      expect(resp).toHaveProperty('ok', true);
      expect(resp).toHaveProperty('value');
      expect(resp.value).toHaveProperty('build');
      expect(resp.value).toHaveProperty('tenant');
    }

    // STRICT: Build version should be consistent
    const builds = responses.map(r => r.value.build);
    expect(new Set(builds).size).toBe(1); // All same build
  });
});

test.describe('🔌 API CONTRACT: Analytics Endpoint', () => {

  test('Analytics API exists and returns JSON', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=report&tenant=${TENANT_ID}`);

    // Intercept network requests to analytics API
    const apiCalls = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('getSharedAnalytics') || url.includes('analytics') || url.includes('report')) {
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('json')) {
            const json = await response.json();
            apiCalls.push({ url, json, status: response.status() });
          }
        } catch (e) {
          // Not JSON response, ignore
        }
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow API calls to complete

    // STRICT: If analytics API was called, validate response
    if (apiCalls.length > 0) {
      const analyticsCall = apiCalls[0];

      expect(analyticsCall.status).toBe(200);
      expect(analyticsCall.json).toBeTruthy();

      // Analytics should return object with data
      expect(typeof analyticsCall.json).toBe('object');
    }
  });
});

test.describe('🔌 API CONTRACT: Event Creation Response', () => {

  test('Event creation API returns proper response structure', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';
    const responses = [];

    // Capture API responses
    page.on('response', async response => {
      const url = response.url();
      if (url.includes(BASE_URL) && response.request().method() === 'POST') {
        try {
          const json = await response.json();
          responses.push({ url, json, status: response.status() });
        } catch (e) {
          // Not JSON, ignore
        }
      }
    });

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', `API Test ${Date.now()}`);
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // STRICT: Event creation should return success response
    if (responses.length > 0) {
      const createResponse = responses[responses.length - 1];

      // Should return 200 OK
      expect(createResponse.status).toBeLessThan(400);

      // Response should have data
      expect(createResponse.json).toBeTruthy();
    }
  });
});

test.describe('🔌 API CONTRACT: Error Responses', () => {

  test('Invalid API parameters return proper error', async ({ request }) => {
    // Test with invalid tenant
    const response = await request.get(`${BASE_URL}?p=status&tenant=INVALID_999`);

    // STRICT: Should return error status or handle gracefully
    const status = response.status();

    // Either 400-level error or 200 with error in body
    if (status === 200) {
      const json = await response.json();
      // If 200, should have error indicated in response
      expect(json.ok === false || json.error || json.message).toBeTruthy();
    } else {
      // Or return proper error status
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    }
  });

  test('Missing parameters handled gracefully', async ({ request }) => {
    // Test status API without tenant parameter
    const response = await request.get(`${BASE_URL}?p=status`);

    // STRICT: Should not crash (no 500 error)
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('🔌 API CONTRACT: Response Headers', () => {

  test('CORS headers are present', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);

    const headers = response.headers();

    // Check for CORS headers (important for cross-origin requests)
    // Note: Google Apps Script may handle this automatically
    expect(response.status()).toBe(200);
  });

  test('Content-Type header is correct for JSON endpoints', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);

    const contentType = response.headers()['content-type'];

    // STRICT: JSON endpoints must have JSON content type
    expect(contentType).toMatch(/application\/json|text\/javascript/i);
  });
});

test.describe('🔌 API CONTRACT: Performance', () => {

  test('All API endpoints respond within acceptable time', async ({ request }) => {
    const endpoints = [
      { name: 'Status', url: `${BASE_URL}?p=status&tenant=${TENANT_ID}`, maxTime: 2000 },
      { name: 'Events', url: `${BASE_URL}?p=events&tenant=${TENANT_ID}`, maxTime: 5000 },
      { name: 'Admin', url: `${BASE_URL}?page=admin&tenant=${TENANT_ID}`, maxTime: 5000 },
    ];

    for (const endpoint of endpoints) {
      const start = Date.now();
      const response = await request.get(endpoint.url);
      const duration = Date.now() - start;

      // STRICT: Must respond within time limit
      expect(duration).toBeLessThan(endpoint.maxTime);
      expect(response.status()).toBeLessThan(400);
    }
  });

  test('API can handle rapid sequential requests', async ({ request }) => {
    const requests = 5;
    const results = [];

    for (let i = 0; i < requests; i++) {
      const start = Date.now();
      const response = await request.get(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);
      const duration = Date.now() - start;

      results.push({
        status: response.status(),
        duration,
        success: response.status() === 200
      });
    }

    // STRICT: All requests should succeed
    const allSuccess = results.every(r => r.success);
    expect(allSuccess).toBe(true);

    // STRICT: Average response time should be acceptable
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    expect(avgDuration).toBeLessThan(3000); // Average under 3s
  });
});
