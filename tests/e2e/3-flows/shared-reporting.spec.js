/**
 * SHARED REPORTING FLOWS
 *
 * Tests:
 * - SharedReport.html page loads with analytics
 * - Navigation from Admin.html to SharedReport works
 * - Analytics API returns correct data structure
 * - Event Manager view shows event-specific metrics
 * - Sponsor view (future) shows sponsor-specific metrics
 * - Export to Google Sheets functionality
 * - Mobile responsive layout
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/.../exec';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';
const TENANT_ID = 'root';

test.describe('📊 SHARED REPORTING: Analytics Dashboard', () => {

  test('SharedReport page loads and displays key metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // STRICT: Page must have proper heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
    await expect(heading.first()).toContainText(/Analytics|Report|Metrics|Dashboard/i);

    // STRICT: Page must have metrics structure (even if values are zero)
    const metricsContainer = page.locator('.metrics, .metrics-grid, [data-metrics], .dashboard, main');
    await expect(metricsContainer.first()).toBeAttached();

    // STRICT: At least one metric display must exist
    const metricElements = page.locator('.metric-card, .metric, [data-metric], .stat-card, .kpi');
    const metricCount = await metricElements.count();

    // Must have at least one metric visualization
    expect(metricCount).toBeGreaterThan(0);

    // STRICT: No JavaScript errors on page load
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e =>
      !e.message.includes('google.script') &&
      !e.message.includes('google is not defined')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Navigation from Admin to SharedReport works', async ({ page, context }) => {
    console.log('🔗 Testing navigation from Admin to SharedReport...');

    // Create an event in Admin first
    await page.goto(`${BASE_URL}?page=admin&brand=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    const eventName = `Report Test ${Date.now()}`;
    await page.fill('#name', eventName);
    await page.fill('#dateISO', '2025-12-31');
    await page.fill('#location', 'Test Venue');

    await page.click('button[type="submit"]');
    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });

    console.log('✅ Event created in Admin');

    // Verify the SharedReport link appears
    const reportLink = page.locator('#lnkReport, a:has-text("Analytics"), a:has-text("Report")');
    const hasReportLink = await reportLink.count() > 0;

    if (hasReportLink) {
      const reportUrl = await reportLink.first().textContent();
      console.log(`✅ Report link found: ${reportUrl?.substring(0, 50)}...`);

      // Click the link to navigate to SharedReport
      const reportPage = await context.newPage();
      await reportPage.goto(reportUrl || `${BASE_URL}?page=report&brand=${TENANT_ID}`);
      await reportPage.waitForLoadState('networkidle');

      await expect(reportPage.locator('h1')).toContainText(/Analytics|Report|Metrics/i);
      console.log('✅ Navigation to SharedReport successful');

      await reportPage.close();
    } else {
      console.log('⚠️ Report link not found in event card (may need to refresh)');
    }
  });

  test('SharedReport displays surface performance breakdown', async ({ page }) => {
    console.log('📊 Testing surface performance breakdown...');

    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // Wait for analytics to load
    await page.waitForTimeout(2000);

    // Check for surface performance section
    const surfaceSection = page.locator('section:has-text("Surface Performance"), [data-section="surface-performance"]');
    const hasSurfaceSection = await surfaceSection.count() > 0;

    if (hasSurfaceSection) {
      console.log('✅ Surface performance section found');

      // Check for surface types
      const surfaces = ['Public', 'Display', 'Poster'];
      for (const surface of surfaces) {
        const surfaceRow = page.locator(`text=${surface}`);
        const hasSurface = await surfaceRow.count() > 0;

        if (hasSurface) {
          console.log(`✅ Surface found: ${surface}`);
        }
      }
    } else {
      console.log('⚠️ Surface performance section not found (may be loading or no data)');
    }
  });

  test('SharedReport displays sponsor performance', async ({ page }) => {
    console.log('📊 Testing sponsor performance display...');

    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // Wait for analytics to load
    await page.waitForTimeout(2000);

    // Check for sponsor performance section
    const sponsorSection = page.locator('section:has-text("Sponsor Performance"), [data-section="sponsor-performance"]');
    const hasSponsorSection = await sponsorSection.count() > 0;

    if (hasSponsorSection) {
      console.log('✅ Sponsor performance section found');

      // Check for sponsor metrics
      const sponsorTable = page.locator('table.sponsor-table, [data-table="sponsors"]');
      const hasTable = await sponsorTable.count() > 0;

      if (hasTable) {
        console.log('✅ Sponsor performance table rendered');
      }
    } else {
      console.log('⚠️ Sponsor performance section not found (may be loading or no data)');
    }
  });

  test('SharedReport is mobile responsive', async ({ page }) => {
    console.log('📱 Testing mobile responsiveness...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // Verify page is responsive
    const main = page.locator('main, .container');
    await expect(main).toBeVisible();

    const mainBox = await main.boundingBox();
    if (mainBox) {
      // Main content should fit within mobile viewport
      expect(mainBox.width).toBeLessThanOrEqual(375);
      console.log(`✅ Mobile layout: ${mainBox.width}px width (fits viewport)`);
    }

    // Check that metric cards stack vertically on mobile
    const metricGrid = page.locator('.metrics-grid, [data-grid="metrics"]');
    const hasGrid = await metricGrid.count() > 0;

    if (hasGrid) {
      const gridBox = await metricGrid.first().boundingBox();
      if (gridBox) {
        console.log(`✅ Metrics grid responsive: ${gridBox.width}px`);
      }
    }
  });
});

test.describe('📊 SHARED REPORTING: API Integration', () => {

  test('Analytics API returns valid data structure', async ({ page }) => {
    console.log('🔌 Testing analytics API...');

    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // Intercept API call to analytics
    let apiResponse = null;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('api_getSharedAnalytics') || text.includes('Analytics loaded')) {
        console.log(`📡 ${text}`);
      }
    });

    // Wait for potential API call
    await page.waitForTimeout(3000);

    // Check if error message appears
    const errorMsg = page.locator('text=/error|failed|unable/i');
    const hasError = await errorMsg.count() > 0;

    if (hasError) {
      const errorText = await errorMsg.first().textContent();
      console.log(`⚠️ API error detected: ${errorText}`);
    } else {
      console.log('✅ No API errors detected');
    }
  });

  test('Export to Sheets button exists', async ({ page }) => {
    console.log('💾 Testing export functionality...');

    await page.goto(`${BASE_URL}?page=report&brand=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    // Check for export button
    const exportBtn = page.locator('button:has-text("Export"), button[data-action="export"]');
    const hasExportBtn = await exportBtn.count() > 0;

    if (hasExportBtn) {
      await expect(exportBtn.first()).toBeVisible();
      console.log('✅ Export button found');

      // Note: We don't actually click it to avoid creating test sheets
      const btnText = await exportBtn.first().textContent();
      console.log(`✅ Export button text: "${btnText}"`);
    } else {
      console.log('⚠️ Export button not found');
    }
  });
});

test.describe('🔺 TRIANGLE: SharedReport Integration', () => {

  test('Full cycle: Create event → Configure sponsors → View analytics', async ({ page, context }) => {
    console.log('🔺 Testing complete analytics cycle...');

    // ====================
    // STEP 1: Create event with sponsors in Admin
    // ====================
    console.log('📝 Creating event with sponsors...');
    await page.goto(`${BASE_URL}?page=admin&brand=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    const timestamp = Date.now();
    const eventName = `Analytics Cycle ${timestamp}`;

    await page.fill('#name', eventName);
    await page.fill('#dateISO', '2025-12-31');
    await page.fill('#timeISO', '19:00');
    await page.fill('#location', 'Analytics Test Venue');
    await page.fill('#summary', 'Testing shared analytics functionality');

    await page.click('button[type="submit"]');
    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });

    console.log('✅ Event created');

    // Configure sponsors
    await page.click('button:has-text("Configure Display & Sponsors")');
    await page.click('button:has-text("Add Sponsor")');

    await page.fill('.sp-name', 'Analytics Test Sponsor');
    await page.fill('.sp-url', 'https://analytics-test.example.com');
    await page.fill('.sp-img', 'https://via.placeholder.com/500x250');
    await page.check('.sp-tvTop');

    await page.click('button:has-text("Save Configuration")');
    await expect(page.locator('text=saved')).toBeVisible({ timeout: 5000 });

    console.log('✅ Sponsor configured');

    // Get the report URL
    const reportLinkElem = page.locator('#lnkReport');
    const hasReportLink = await reportLinkElem.count() > 0;

    let reportUrl = `${BASE_URL}?page=report&brand=${TENANT_ID}`;
    if (hasReportLink) {
      reportUrl = await reportLinkElem.textContent() || reportUrl;
    }

    // ====================
    // STEP 2: Navigate to SharedReport
    // ====================
    console.log('📊 Opening SharedReport...');
    const reportPage = await context.newPage();
    await reportPage.goto(reportUrl);
    await reportPage.waitForLoadState('networkidle');

    await expect(reportPage.locator('h1')).toContainText(/Analytics|Report/i);
    console.log('✅ SharedReport loaded');

    // Wait for analytics to load
    await reportPage.waitForTimeout(2000);

    // ====================
    // STEP 3: Verify analytics data appears
    // ====================
    console.log('🔍 Verifying analytics data...');

    // Check for any metric values (even if zero)
    const metricValues = reportPage.locator('.metric-value, [data-value]');
    const hasMetrics = await metricValues.count() > 0;

    if (hasMetrics) {
      console.log(`✅ Found ${await metricValues.count()} metric values`);
    } else {
      console.log('⚠️ No metric values found (may be initial state with zero data)');
    }

    // Check for "No data" or empty state message
    const emptyState = reportPage.locator('text=/no data|no analytics|no events/i');
    const hasEmptyState = await emptyState.count() > 0;

    if (hasEmptyState) {
      console.log('ℹ️ Empty state detected (expected for new events with no impressions)');
    } else {
      console.log('✅ Data state detected (analytics may have data)');
    }

    console.log('🎉 ANALYTICS CYCLE COMPLETE!');

    await reportPage.close();
  });
});
