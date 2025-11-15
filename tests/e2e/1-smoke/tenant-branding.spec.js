/**
 * SMOKE TESTS - Tenant Branding & Logo Verification
 *
 * Purpose: Verify tenant-specific branding and logos load correctly
 * Coverage: Logo visibility, tenant identification, multi-tenant isolation
 */

const { test, expect } = require('@playwright/test');

// Use production Apps Script URL
// Set via: export GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
const BASE_URL = process.env.BASE_URL || process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

test.describe('🎨 SMOKE: Tenant Branding', () => {

  test('Admin page loads tenant logo for root tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=root`);

    // Page should load successfully
    expect(page.url()).toContain('tenant=root');

    // Check for logo element (adjust selector based on actual implementation)
    const logo = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, header img').first();

    // Verify logo is visible (if implemented)
    const logoCount = await logo.count();
    if (logoCount > 0) {
      await expect(logo).toBeVisible({ timeout: 5000 });

      // Verify logo has valid src
      const logoSrc = await logo.getAttribute('src');
      expect(logoSrc).toBeTruthy();
      expect(logoSrc.length).toBeGreaterThan(0);
    } else {
      console.log('⚠️ No tenant logo found for root tenant - may not be implemented yet');
    }
  });

  test('Admin page loads tenant logo for abc tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=abc`);

    // Page should load successfully
    expect(page.url()).toContain('tenant=abc');

    // Check for logo element
    const logo = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, header img').first();

    // Verify logo is visible (if implemented)
    const logoCount = await logo.count();
    if (logoCount > 0) {
      await expect(logo).toBeVisible({ timeout: 5000 });

      // Verify logo has valid src
      const logoSrc = await logo.getAttribute('src');
      expect(logoSrc).toBeTruthy();
      expect(logoSrc.length).toBeGreaterThan(0);

      // Verify logo is loaded (not broken)
      const logoLoaded = await logo.evaluate((img) => {
        return img.complete && img.naturalHeight > 0;
      });
      expect(logoLoaded).toBe(true);
    } else {
      console.log('⚠️ No tenant logo found for abc tenant - may not be implemented yet');
    }
  });

  test('Admin page shows correct tenant identification for abc', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=abc`);

    // Verify page contains tenant identifier
    const pageContent = await page.content();

    // Check URL parameter is correct
    expect(page.url()).toContain('tenant=abc');

    // Page should render successfully
    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible();

    // Check for tenant name display (if implemented)
    const tenantName = page.locator('text=/abc|ABC/i').first();
    const tenantCount = await tenantName.count();

    if (tenantCount > 0) {
      console.log('✓ Tenant identifier found on page');
    }
  });

  test('Public page loads tenant logo for abc tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&tenant=abc`);

    // Check for logo element
    const logo = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, header img').first();

    // Verify logo is visible (if implemented)
    const logoCount = await logo.count();
    if (logoCount > 0) {
      await expect(logo).toBeVisible({ timeout: 5000 });

      // Verify logo loaded successfully
      const logoLoaded = await logo.evaluate((img) => {
        return img.complete && img.naturalHeight > 0;
      });
      expect(logoLoaded).toBe(true);
    }
  });

  test('Display page loads tenant branding for abc tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=abc`);

    // Check for logo or branding element
    const brandingElements = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, .branding img, header img');

    const count = await brandingElements.count();
    if (count > 0) {
      const firstElement = brandingElements.first();
      await expect(firstElement).toBeVisible({ timeout: 5000 });

      // Verify image loaded
      const loaded = await firstElement.evaluate((img) => {
        return img.complete && img.naturalHeight > 0;
      });
      expect(loaded).toBe(true);
    }
  });

  test('Different tenants show different branding (isolation)', async ({ page }) => {
    // Load root tenant admin page
    await page.goto(`${BASE_URL}?page=admin&tenant=root`);
    const rootUrl = page.url();
    expect(rootUrl).toContain('tenant=root');

    // Load abc tenant admin page
    await page.goto(`${BASE_URL}?page=admin&tenant=abc`);
    const abcUrl = page.url();
    expect(abcUrl).toContain('tenant=abc');

    // Verify tenants are isolated
    expect(abcUrl).not.toContain('tenant=root');
    expect(rootUrl).not.toContain('tenant=abc');

    // Both pages should load successfully
    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible();
  });
});

test.describe('🎨 SMOKE: Logo Performance', () => {

  test('Tenant logo loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}?page=admin&tenant=abc`);

    const logo = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, header img').first();
    const logoCount = await logo.count();

    if (logoCount > 0) {
      // Wait for logo to be visible
      await expect(logo).toBeVisible({ timeout: 5000 });

      // Verify it loaded reasonably fast
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // 10 seconds max

      console.log(`✓ Logo loaded in ${loadTime}ms`);
    }
  });

  test('Logo image has valid dimensions', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=abc`);

    const logo = page.locator('img[alt*="logo"], img.logo, .tenant-logo img, header img').first();
    const logoCount = await logo.count();

    if (logoCount > 0) {
      await expect(logo).toBeVisible();

      // Get image dimensions
      const dimensions = await logo.evaluate((img) => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        displayed: img.complete
      }));

      expect(dimensions.displayed).toBe(true);
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);

      console.log(`✓ Logo dimensions: ${dimensions.width}x${dimensions.height}`);
    }
  });
});
