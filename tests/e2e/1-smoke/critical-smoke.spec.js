/**
 * SMOKE TESTS - Level 1: Quick Health Checks
 *
 * Purpose: Verify system is alive and basic functionality works
 * Run Time: < 30 seconds
 * Run Frequency: Every deployment, every commit
 *
 * Test Hierarchy:
 * 1. Smoke Tests (this file) - Quick health checks
 * 2. Page Tests - Component and interaction testing
 * 3. Flow Tests - End-to-end user journeys
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/.../exec';
const TENANT_ID = 'root';

test.describe('🚨 SMOKE: Critical Endpoints', () => {

  test('Status API responds with 200 and valid schema', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);
    expect(response.status()).toBe(200);

    const json = await response.json();

    // STRICT: API contract validation
    expect(json).toHaveProperty('ok', true);
    expect(json).toHaveProperty('value');
    expect(json.value).toHaveProperty('build');
    expect(json.value).toHaveProperty('tenant');
    expect(json.value.build).toBe('triangle-extended-v1.3');
    expect(json.value.tenant).toBe(TENANT_ID);

    // STRICT: Response must be JSON (not HTML error page)
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('Health check endpoint is alive', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}?page=test&tenant=${TENANT_ID}`);
    expect(response.status()).toBe(200);
  });

  test('Public page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}?p=events&tenant=${TENANT_ID}`);
    expect(response.status()).toBe(200);
    await expect(page.locator('main#app')).toBeVisible();
  });

  test('Admin page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);
    expect(response.status()).toBe(200);
    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible();
  });

  test('Display page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);
    expect(response.status()).toBe(200);
    await expect(page.locator('#stage')).toBeVisible();
  });
});

test.describe('🚨 SMOKE: Performance Baselines', () => {

  test('Status API responds within 2s', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}?p=status&tenant=${TENANT_ID}`);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  test('Page loads within 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}?p=events&tenant=${TENANT_ID}`);
    await page.waitForLoadState('domcontentloaded');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});

test.describe('🚨 SMOKE: No JavaScript Errors', () => {

  test('Admin page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      !e.message.includes('google.script') &&
      !e.message.includes('google is not defined')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Public page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.goto(`${BASE_URL}?p=events&tenant=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      !e.message.includes('google.script') &&
      !e.message.includes('google is not defined')
    );
    expect(criticalErrors.length).toBe(0);
  });
});
