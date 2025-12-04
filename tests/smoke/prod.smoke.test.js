/**
 * Production Smoke Tests - MINIMAL read-only health checks
 *
 * DANGER: These tests run against LIVE PRODUCTION (www.eventangle.com)
 *
 * SAFETY CONSTRAINTS:
 * - READ-ONLY: No writes, no mutations, no form submissions
 * - MINIMAL: Only 3 tests (status + admin load + public load)
 * - FAST: Complete in < 30 seconds
 * - OPT-IN ONLY: Never runs automatically, requires explicit workflow_dispatch
 *
 * Use case: Verify production is alive after a release or incident
 *
 * Run locally:
 *   BASE_URL="https://www.eventangle.com" npm run test:prod:smoke:minimal
 *
 * CI:
 *   Only via workflow_dispatch with use_production=true
 */

const { test, expect } = require('@playwright/test');

// Production URL - hardcoded for safety (don't inherit from env)
const PROD_URL = 'https://www.eventangle.com';
const BRAND_ID = 'root';

test.describe('PRODUCTION SMOKE - Read-Only Health Checks', () => {

  test.beforeAll(async () => {
    console.log('========================================');
    console.log('PRODUCTION SMOKE TESTS');
    console.log('Target: ' + PROD_URL);
    console.log('These are READ-ONLY tests against LIVE PRODUCTION');
    console.log('========================================');
  });

  test('Status API - Production is alive', async ({ page }) => {
    const response = await page.goto(`${PROD_URL}?p=status&brand=${BRAND_ID}`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('ok', true);
    expect(json).toHaveProperty('buildId');
    expect(json).toHaveProperty('brandId', BRAND_ID);
    expect(json).toHaveProperty('timestamp');

    console.log('Production status OK, buildId: ' + json.buildId);
  });

  test('Admin Page - Loads without errors (read-only)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    const response = await page.goto(`${PROD_URL}?page=admin&brand=${BRAND_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    expect(response.status()).toBe(200);
    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible({ timeout: 10000 });

    // No critical JS errors
    const criticalErrors = errors.filter(e =>
      !e.message.includes('google.script') &&
      !e.message.includes('google is not defined')
    );
    expect(criticalErrors.length).toBe(0);

    console.log('Admin page loaded successfully');
  });

  test('Public Page - Loads without errors (read-only)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    const response = await page.goto(`${PROD_URL}?p=events&brand=${BRAND_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    expect(response.status()).toBe(200);
    await expect(page.locator('.container, main#app')).toBeVisible({ timeout: 10000 });

    // No critical JS errors
    const criticalErrors = errors.filter(e =>
      !e.message.includes('google.script') &&
      !e.message.includes('google is not defined')
    );
    expect(criticalErrors.length).toBe(0);

    console.log('Public page loaded successfully');
  });

});
