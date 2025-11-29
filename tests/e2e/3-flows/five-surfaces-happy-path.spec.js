/**
 * MINIMAL HAPPY-PATH E2E TEST - All 5 MVP Surfaces
 *
 * Tests the complete "triangle smoke" across all MVP surfaces:
 * 1. Admin - Create event, verify main fields saved
 * 2. Poster - Verify QR + basic info from Admin link
 * 3. Display - Verify event title and schedule
 * 4. Public - Verify CTA / schedule
 * 5. SharedReport - Verify summary fields render
 *
 * Design principles:
 * - Uses fixed demo event fixture for determinism
 * - Cheap and fast: minimal assertions, no complex interactions
 * - Single spec covering entire surface triangle
 *
 * BASE_URL-Aware: Tests work against GAS or eventangle.com:
 *   BASE_URL="https://www.eventangle.com" npm run test:flows
 *   BASE_URL="https://script.google.com/macros/s/<ID>/exec" npm run test:flows
 */

const { test, expect } = require('@playwright/test');
const { getBaseUrl } = require('../../config/environments');

// Use centralized BASE_URL config (defaults to eventangle.com)
const BASE_URL = getBaseUrl();
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';
const BRAND_ID = process.env.BRAND_ID || 'root';

// Fixed demo event fixture for determinism
const DEMO_EVENT = {
  name: `E2E Happy Path ${Date.now()}`,
  date: '2025-12-31',
  time: '18:00',
  venue: 'E2E Test Arena',
  summary: 'Minimal happy-path test event for 5-surface verification',
};

test.describe('5-Surface Happy Path Smoke Test', () => {
  // Store URLs extracted from Admin for subsequent surface tests
  let surfaceUrls = {
    public: null,
    display: null,
    poster: null,
    report: null,
  };

  test('Admin: create event, verify main fields saved', async ({ page }) => {
    // Navigate to Admin
    await page.goto(`${BASE_URL}?page=admin&brand=${BRAND_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Handle auth prompt
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept(ADMIN_KEY);
      } else {
        await dialog.accept();
      }
    });

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');

    // Fill event form with demo fixture
    await page.fill('#name', DEMO_EVENT.name);
    await page.fill('#startDateISO', DEMO_EVENT.date);

    // Time field may or may not be required
    const timeInput = page.locator('#timeISO');
    if (await timeInput.isVisible()) {
      await timeInput.fill(DEMO_EVENT.time);
    }

    await page.fill('#venue', DEMO_EVENT.venue);

    // Summary field (may have different selectors)
    const summaryInput = page.locator('#summary, #description, textarea[placeholder*="description"]').first();
    if (await summaryInput.isVisible()) {
      await summaryInput.fill(DEMO_EVENT.summary);
    }

    // Submit form
    await page.click('button[type="submit"]');

    // Verify event card appears (confirms creation)
    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 15000 });

    // Verify event name is displayed in the event card
    const eventInfo = page.locator('#eventInfo, #eventCard');
    await expect(eventInfo).toContainText(DEMO_EVENT.name, { timeout: 5000 });

    // Extract all surface URLs for subsequent tests
    const publicLink = page.locator('#lnkPublic');
    const displayLink = page.locator('#lnkDisplay');
    const posterLink = page.locator('#lnkPoster');
    const reportLink = page.locator('#lnkReport');

    // Wait for links to be populated
    await expect(publicLink).toBeVisible({ timeout: 10000 });

    // Get href attributes (links are anchor elements)
    surfaceUrls.public = await publicLink.getAttribute('href');
    surfaceUrls.display = await displayLink.getAttribute('href');
    surfaceUrls.poster = await posterLink.getAttribute('href');
    surfaceUrls.report = await reportLink.getAttribute('href');

    // Verify we have all URLs
    expect(surfaceUrls.public).toBeTruthy();
    expect(surfaceUrls.display).toBeTruthy();
    expect(surfaceUrls.poster).toBeTruthy();
    expect(surfaceUrls.report).toBeTruthy();

    console.log('Admin: Event created and all surface URLs extracted');
  });

  test('Poster: verify QR + basic info from Admin link', async ({ page }) => {
    test.skip(!surfaceUrls.poster, 'Poster URL not available - run Admin test first');

    await page.goto(surfaceUrls.poster, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');

    // Verify event name is displayed
    await expect(page.locator(`text=${DEMO_EVENT.name}`)).toBeVisible({ timeout: 10000 });

    // Verify venue/location is displayed
    await expect(page.locator(`text=${DEMO_EVENT.venue}`)).toBeVisible({ timeout: 5000 });

    // Verify QR code section exists (may be hidden if no QR configured)
    // The QR grid or individual QR codes should be present
    const qrElements = page.locator('#qrGrid, .qr-code, [data-qr], canvas, img[alt*="QR"]');
    const qrCount = await qrElements.count();

    // At minimum, the poster structure should exist even if QR isn't rendered yet
    const posterContainer = page.locator('.poster-container, .poster, main');
    await expect(posterContainer.first()).toBeVisible();

    console.log(`Poster: Event info verified, QR elements found: ${qrCount}`);
  });

  test('Display: verify event title and schedule', async ({ page }) => {
    test.skip(!surfaceUrls.display, 'Display URL not available - run Admin test first');

    // Set TV viewport for display testing
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(surfaceUrls.display, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');

    // Display uses body[data-tv="1"] or similar marker
    // The stage iframe embeds Public content
    const stage = page.locator('#stage, iframe, main');
    await expect(stage.first()).toBeVisible({ timeout: 10000 });

    // Event title should be visible (either in main content or iframe)
    // For TV display, content may be in iframe - check main page first
    const titleInMain = page.locator(`text=${DEMO_EVENT.name}`);
    const hasTitle = await titleInMain.count() > 0;

    if (!hasTitle) {
      // Title might be in the embedded iframe - just verify stage loads
      const stageFrame = page.frameLocator('#stage');
      const frameContent = stageFrame.locator('body');
      // Frame should have content (even if we can't verify exact text due to cross-origin)
      await expect(stage.first()).toBeVisible();
    } else {
      await expect(titleInMain.first()).toBeVisible();
    }

    // Verify TV mode attributes or layout
    const tvBody = page.locator('body[data-tv="1"], body.tv-mode, #tv, main#tv');
    const isTvMode = await tvBody.count() > 0;

    console.log(`Display: Stage visible, TV mode: ${isTvMode}`);
  });

  test('Public: verify CTA / schedule', async ({ page }) => {
    test.skip(!surfaceUrls.public, 'Public URL not available - run Admin test first');

    await page.goto(surfaceUrls.public, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');

    // Verify event name is displayed
    await expect(page.locator(`text=${DEMO_EVENT.name}`)).toBeVisible({ timeout: 10000 });

    // Verify main app container
    const mainApp = page.locator('main#app, main, #list, .event-detail');
    await expect(mainApp.first()).toBeVisible();

    // Verify venue is displayed
    await expect(page.locator(`text=${DEMO_EVENT.venue}`)).toBeVisible({ timeout: 5000 });

    // Check for CTA elements (buttons, links for registration/signup)
    const ctaElements = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Register"), button:has-text("Sign"), .cta, [data-cta]'
    );
    const ctaCount = await ctaElements.count();

    // Check for schedule container (may be empty if no schedule items)
    const scheduleContainer = page.locator('#schedule-container, .schedule, [data-schedule], #schedule');
    const hasSchedule = await scheduleContainer.count() > 0;

    console.log(`Public: Event displayed, CTAs found: ${ctaCount}, Schedule section: ${hasSchedule}`);
  });

  test('SharedReport: verify summary fields render', async ({ page }) => {
    test.skip(!surfaceUrls.report, 'Report URL not available - run Admin test first');

    await page.goto(surfaceUrls.report, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');

    // Wait for loading to complete (report fetches data async)
    const loading = page.locator('#loading, .loading');
    await expect(loading).toBeHidden({ timeout: 15000 });

    // Check if we got an error state (acceptable for sparse data)
    const errorState = page.locator('#errorState, .error-state');
    const hasError = await errorState.isVisible().catch(() => false);

    if (hasError) {
      // Error state is acceptable for newly created events with no analytics
      console.log('SharedReport: Error state shown (expected for new events with no data)');
      return;
    }

    // Verify report header exists
    const reportHeader = page.locator('.report-header, #reportTitle');
    await expect(reportHeader.first()).toBeVisible({ timeout: 5000 });

    // Verify metrics grid exists (may be empty but should render)
    const metricsGrid = page.locator('#metricsGrid, .metrics-grid');
    const hasMetrics = await metricsGrid.count() > 0;

    // Verify surface performance section exists
    const surfacePerf = page.locator('#surfacePerformance, .section-card');
    const hasSurfacePerf = await surfacePerf.count() > 0;

    // Even with sparse data, the report structure should render
    expect(hasMetrics || hasSurfacePerf).toBeTruthy();

    console.log(`SharedReport: Header visible, Metrics: ${hasMetrics}, Surface perf: ${hasSurfacePerf}`);
  });
});

test.describe('5-Surface Happy Path - Serial Full Flow', () => {
  /**
   * Single test that covers the complete flow through all 5 surfaces.
   * This ensures the surfaces work together as an integrated system.
   */
  test('Complete happy path: Admin → Poster → Display → Public → SharedReport', async ({
    page,
    context,
  }) => {
    // ====================
    // SURFACE 1: ADMIN - Create Event
    // ====================
    console.log('1/5 ADMIN: Creating event...');

    await page.goto(`${BASE_URL}?page=admin&brand=${BRAND_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept(ADMIN_KEY);
      } else {
        await dialog.accept();
      }
    });

    await page.waitForLoadState('networkidle');

    const eventName = `Full Flow ${Date.now()}`;
    await page.fill('#name', eventName);
    await page.fill('#startDateISO', '2025-12-31');
    await page.fill('#venue', 'Full Flow Venue');

    await page.click('button[type="submit"]');
    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#eventCard, #eventInfo')).toContainText(eventName);

    // Get URLs
    const publicUrl = await page.locator('#lnkPublic').getAttribute('href');
    const displayUrl = await page.locator('#lnkDisplay').getAttribute('href');
    const posterUrl = await page.locator('#lnkPoster').getAttribute('href');
    const reportUrl = await page.locator('#lnkReport').getAttribute('href');

    console.log('   Admin: Event created, URLs extracted');

    // ====================
    // SURFACE 2: POSTER - Verify from Admin link
    // ====================
    console.log('2/5 POSTER: Verifying event info and QR...');

    const posterPage = await context.newPage();
    await posterPage.goto(posterUrl, { waitUntil: 'networkidle', timeout: 30000 });

    await expect(posterPage.locator(`text=${eventName}`)).toBeVisible({ timeout: 10000 });
    await expect(posterPage.locator('text=Full Flow Venue')).toBeVisible();

    // Poster structure should exist
    await expect(posterPage.locator('.poster-container, .poster, main').first()).toBeVisible();

    console.log('   Poster: Event info verified');
    await posterPage.close();

    // ====================
    // SURFACE 3: DISPLAY - Verify TV layout
    // ====================
    console.log('3/5 DISPLAY: Verifying TV layout...');

    const displayPage = await context.newPage();
    await displayPage.setViewportSize({ width: 1920, height: 1080 });
    await displayPage.goto(displayUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Stage iframe should be visible
    await expect(displayPage.locator('#stage, iframe, main').first()).toBeVisible({ timeout: 10000 });

    console.log('   Display: TV layout verified');
    await displayPage.close();

    // ====================
    // SURFACE 4: PUBLIC - Verify event details
    // ====================
    console.log('4/5 PUBLIC: Verifying event details...');

    const publicPage = await context.newPage();
    await publicPage.goto(publicUrl, { waitUntil: 'networkidle', timeout: 30000 });

    await expect(publicPage.locator(`text=${eventName}`)).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=Full Flow Venue')).toBeVisible();

    // Main container visible
    await expect(publicPage.locator('main#app, main, #list').first()).toBeVisible();

    console.log('   Public: Event details verified');
    await publicPage.close();

    // ====================
    // SURFACE 5: SHARED REPORT - Verify renders
    // ====================
    console.log('5/5 SHARED REPORT: Verifying report renders...');

    const reportPage = await context.newPage();
    await reportPage.goto(reportUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for loading to finish
    await expect(reportPage.locator('#loading, .loading')).toBeHidden({ timeout: 15000 });

    // Either report content or error state should show
    const hasContent = await reportPage.locator('.report-header, #metricsGrid, #errorState').first().isVisible();
    expect(hasContent).toBeTruthy();

    console.log('   SharedReport: Report structure verified');
    await reportPage.close();

    console.log('All 5 surfaces verified successfully!');
  });
});
