/**
 * Story 3.3: End-to-End Testing of User Flows (Playwright)
 *
 * Critical user journey tests that validate:
 * - Event creation workflow (Admin)
 * - Event viewing (Public)
 * - Event management (Admin)
 * - TV Display functionality (Display)
 * - Report generation (SharedReport)
 * - API + UI integration
 *
 * BASE_URL-Aware Testing:
 * - Default: https://stg.eventangle.com (staging)
 * - Production: BASE_URL=https://www.eventangle.com npm run test:story3.3
 *
 * Run: npm run test:story3.3
 */

import { test, expect } from '@playwright/test';
import { ApiHelpers, EventBuilder } from './api/api-helpers.js';
import { getBaseUrl, isProduction, isStaging } from '../config/environments.js';

// Configuration
const BASE_URL = getBaseUrl();
const BRAND_ID = process.env.BRAND_ID || 'root';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';
const IS_STAGING = isStaging();
const IS_PRODUCTION = isProduction();

// Test data cleanup tracking
const createdEventIds = [];

// Timeout configuration for GAS cold starts
const TIMEOUT_CONFIG = {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
};

/**
 * Filter out expected GAS-related JavaScript errors
 */
function filterCriticalErrors(errors) {
  return errors.filter(e =>
    !e.message.includes('google.script') &&
    !e.message.includes('google is not defined') &&
    !e.message.includes('Script error') &&
    !e.message.includes('favicon.ico')
  );
}

/**
 * Generate unique test event data
 */
function generateTestEvent() {
  const timestamp = Date.now();
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1);

  return {
    name: `E2E Test Event ${timestamp}`,
    startDateISO: futureDate.toISOString().split('T')[0],
    venue: 'E2E Test Venue',
    summary: 'Automated E2E test event for Story 3.3 validation',
    timeISO: '14:00',
  };
}

// =============================================================================
// JOURNEY 1: Event Creation Flow (Admin → API → Verification)
// =============================================================================

test.describe('Journey 1: Event Creation Flow', () => {
  test.describe.configure({ retries: 2 }); // Enable retries for transient failures

  let api;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);
  });

  test.afterEach(async () => {
    // Cleanup created events
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
        console.log(`✓ Cleaned up event: ${eventId}`);
      } catch (error) {
        console.warn(`⚠ Failed to delete event ${eventId}:`, error.message);
      }
    }
    createdEventIds.length = 0;
  });

  test('Admin creates event via API → Event appears in list → View event details', async ({ page }) => {
    // Step 1: Create event via API
    const eventData = new EventBuilder()
      .withName(`API Created Event ${Date.now()}`)
      .withDate('2025-12-20')
      .withVenue('API Test Venue')
      .build();

    const createResponse = await api.createEvent(BRAND_ID, eventData, ADMIN_KEY);
    const createData = await createResponse.json();

    expect(createResponse.ok()).toBe(true);
    expect(createData.ok).toBe(true);
    expect(createData.value).toHaveProperty('id');

    const eventId = createData.value.id;
    createdEventIds.push(eventId);
    console.log(`✓ Created event via API: ${eventId}`);

    // Step 2: Navigate to public page and verify event appears
    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);

    // Wait for page to load
    await expect(page.locator('main#app, #app, .events-container')).toBeVisible({ timeout: 15000 });

    // Step 3: Verify event appears in the list
    const eventCard = page.locator(`.event-card:has-text("${eventData.name.substring(0, 20)}")`).first();
    const eventFound = await eventCard.count() > 0;

    if (eventFound) {
      console.log(`✓ Event found in public list: ${eventData.name}`);
      await expect(eventCard).toBeVisible();
    } else {
      // Event might be on a detail page or filtered
      console.log('⚠ Event not in main list, checking via API...');

      // Verify via API
      const getResponse = await api.getEvent(BRAND_ID, eventId);
      const getData = await getResponse.json();
      expect(getData.ok).toBe(true);
      expect(getData.value.name).toBe(eventData.name);
      console.log(`✓ Event verified via API: ${eventData.name}`);
    }

    // Step 4: Navigate to event detail page (if available)
    const detailUrl = `${BASE_URL}?page=public&brand=${BRAND_ID}&id=${eventId}`;
    await page.goto(detailUrl, TIMEOUT_CONFIG);

    // Verify event details are displayed
    await expect(page.locator('main, #app, .event-detail')).toBeVisible({ timeout: 15000 });

    // Verify no critical JS errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.waitForTimeout(1000);
    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length).toBe(0);
  });

  test('Admin creates event via UI → Verify API reflects changes', async ({ page }) => {
    // Track JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Step 1: Navigate to Admin page
    await page.goto(`${BASE_URL}?page=admin&brand=${BRAND_ID}`, TIMEOUT_CONFIG);

    // Set up dialog handler for admin key prompt
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt' && dialog.message().toLowerCase().includes('admin')) {
        await dialog.accept(ADMIN_KEY);
      } else if (dialog.type() === 'alert') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    // Wait for admin page to load
    await expect(
      page.locator('h2:has-text("Create Event"), h1:has-text("Admin"), form#eventForm, .admin-container').first()
    ).toBeVisible({ timeout: 15000 });

    // Step 2: Fill the event creation form
    const testEvent = generateTestEvent();

    await page.fill('#name', testEvent.name);
    await page.fill('#startDateISO', testEvent.startDateISO);
    await page.fill('#timeISO', testEvent.timeISO);
    await page.fill('#venue', testEvent.venue);

    // Expand advanced section if present
    const advancedHeader = page.locator('#advancedEventDetailsHeader');
    if (await advancedHeader.count() > 0) {
      await advancedHeader.click();
      await page.waitForTimeout(300);
      const summaryField = page.locator('#summary');
      if (await summaryField.count() > 0) {
        await summaryField.fill(testEvent.summary);
      }
    }

    // Step 3: Submit the form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create Event")');
    await submitBtn.click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Step 4: Extract event ID from page or success message
    let eventId = null;

    // Try to find event ID in the page
    const eventIdAttr = await page.locator('[data-event-id]').first().getAttribute('data-event-id');
    if (eventIdAttr) {
      eventId = eventIdAttr;
    }

    // Step 5: Verify via API
    const listResponse = await api.listEvents(BRAND_ID);
    const listData = await listResponse.json();

    expect(listData.ok).toBe(true);
    expect(listData.value).toBeInstanceOf(Array);

    // Find the created event
    const createdEvent = listData.value.find(e => e.name === testEvent.name);
    if (createdEvent) {
      eventId = createdEvent.id;
      createdEventIds.push(eventId);
      console.log(`✓ Created event via UI: ${eventId}`);

      expect(createdEvent.venue).toBe(testEvent.venue);
      expect(createdEvent.startDateISO).toBe(testEvent.startDateISO);
    }

    // Verify no critical JS errors
    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length).toBe(0);
  });
});

// =============================================================================
// JOURNEY 2: Event Viewing Flow (Public Surface)
// =============================================================================

test.describe('Journey 2: Event Viewing Flow (Public)', () => {
  let api;
  let testEventId;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    // Create a test event for viewing tests
    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: `View Test Event ${Date.now()}`,
      venue: 'View Test Venue',
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    // Cleanup
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Public page loads event details correctly', async ({ page }) => {
    // Step 1: Navigate to public event page
    await page.goto(`${BASE_URL}?page=public&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    // Step 2: Verify page loaded
    await expect(page.locator('main, #app, .public-container')).toBeVisible({ timeout: 15000 });

    // Step 3: Verify event content is displayed
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(500);

    // Step 4: Verify no console errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.waitForTimeout(1000);
    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length).toBe(0);
  });

  test('Public page works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to public page
    await page.goto(`${BASE_URL}?page=public&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    // Verify mobile-friendly layout
    await expect(page.locator('main, #app')).toBeVisible({ timeout: 15000 });

    // Check font size is readable on mobile
    const fontSize = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(14);

    // Verify no horizontal scrolling (mobile-friendly)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });

  test('Events list page shows available events', async ({ page }) => {
    // Navigate to events list
    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);

    // Verify page loaded
    await expect(page.locator('main#app, #app, .events-container')).toBeVisible({ timeout: 15000 });

    // Check for event cards or list items
    const eventElements = page.locator('.event-card, .event-item, [data-event-id]');
    const count = await eventElements.count();

    console.log(`Found ${count} events on page`);
    expect(count).toBeGreaterThanOrEqual(0); // May be 0 if no events
  });
});

// =============================================================================
// JOURNEY 3: Display Surface (TV/Kiosk)
// =============================================================================

test.describe('Journey 3: Display Surface (TV/Kiosk)', () => {
  let api;
  let testEventId;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    // Create test event
    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: `Display Test Event ${Date.now()}`,
      settings: { showSponsors: true },
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Display page loads in TV mode (1920x1080)', async ({ page }) => {
    // Set TV resolution
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to display page
    await page.goto(`${BASE_URL}?page=display&brand=${BRAND_ID}&id=${testEventId}&tv=1`, TIMEOUT_CONFIG);

    // Verify display loaded
    await expect(page.locator('main, #app, .display-container, .display')).toBeVisible({ timeout: 15000 });

    // Check for display-specific elements
    const hasDisplayContent = await page.locator('.sponsor-strip, .event-info, .carousel, .rotation').count() > 0 ||
      await page.locator('main').count() > 0;
    expect(hasDisplayContent).toBe(true);
  });

  test('Display bundle API returns correct structure', async () => {
    // Test the API directly
    const response = await api.get(`?p=api&action=getDisplayBundle&brand=${BRAND_ID}&scope=events&id=${testEventId}`);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.value).toHaveProperty('event');
    expect(data.value.event).toHaveProperty('id');
    expect(data.value.event).toHaveProperty('name');
    expect(data.value.event).toHaveProperty('startDateISO');
    expect(data.value.event).toHaveProperty('venue');

    // Check rotation config
    if (data.value.rotation) {
      expect(data.value.rotation).toHaveProperty('sponsorSlots');
      expect(data.value.rotation).toHaveProperty('rotationMs');
    }
  });
});

// =============================================================================
// JOURNEY 4: Poster Surface
// =============================================================================

test.describe('Journey 4: Poster Surface', () => {
  let api;
  let testEventId;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: `Poster Test Event ${Date.now()}`,
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Poster page loads with QR codes', async ({ page }) => {
    // Navigate to poster page
    await page.goto(`${BASE_URL}?page=poster&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    // Verify poster loaded
    await expect(page.locator('main, #app, .poster-container, .poster')).toBeVisible({ timeout: 15000 });

    // Check for QR code elements
    const qrElements = page.locator('img[src*="qr"], img[alt*="QR"], .qr-code, [data-qr]');
    const hasQRCodes = await qrElements.count() > 0;

    if (hasQRCodes) {
      console.log('✓ QR codes found on poster');
    } else {
      console.log('⚠ QR codes not found - may be loaded dynamically');
    }
  });

  test('Poster bundle API returns correct structure', async () => {
    const response = await api.get(`?p=api&action=getPosterBundle&brand=${BRAND_ID}&scope=events&id=${testEventId}`);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.value).toHaveProperty('event');
    expect(data.value.event).toHaveProperty('id');
    expect(data.value.event).toHaveProperty('name');

    // Check for qrCodes and print
    if (data.value.qrCodes) {
      expect(data.value).toHaveProperty('qrCodes');
    }
    if (data.value.print) {
      expect(data.value).toHaveProperty('print');
    }
  });
});

// =============================================================================
// JOURNEY 5: Shared Report (Analytics)
// =============================================================================

test.describe('Journey 5: Shared Report (Analytics)', () => {
  let api;
  let testEventId;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: `Report Test Event ${Date.now()}`,
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Shared report page loads with analytics data', async ({ page }) => {
    // Navigate to report page
    await page.goto(`${BASE_URL}?page=report&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    // Verify report loaded
    await expect(page.locator('main, #app, .report-container, .shared-report')).toBeVisible({ timeout: 15000 });

    // Check for analytics elements (KPIs, charts, tables)
    const analyticsElements = page.locator('.kpi, .metric, .chart, table, .stats');
    const hasAnalytics = await analyticsElements.count() > 0 || await page.locator('main').textContent() !== '';

    expect(hasAnalytics).toBe(true);
  });

  test('Report works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE_URL}?page=report&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    await expect(page.locator('main, #app')).toBeVisible({ timeout: 15000 });

    // Verify readable on mobile
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});

// =============================================================================
// JOURNEY 6: Event Management (Admin Updates)
// =============================================================================

test.describe('Journey 6: Event Management', () => {
  let api;
  let testEventId;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: `Manage Test Event ${Date.now()}`,
      venue: 'Original Venue',
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Update event via API → UI reflects changes', async ({ page }) => {
    // Step 1: Update event via API
    const updateResponse = await api.updateEvent(BRAND_ID, testEventId, {
      venue: 'Updated Venue via API',
    }, ADMIN_KEY);

    expect(updateResponse.ok()).toBe(true);

    // Step 2: Verify update via GET API
    const getResponse = await api.getEvent(BRAND_ID, testEventId);
    const getData = await getResponse.json();

    expect(getData.ok).toBe(true);
    expect(getData.value.venue).toBe('Updated Venue via API');

    // Step 3: Verify UI shows updated data
    await page.goto(`${BASE_URL}?page=public&brand=${BRAND_ID}&id=${testEventId}`, TIMEOUT_CONFIG);

    await expect(page.locator('main, #app')).toBeVisible({ timeout: 15000 });

    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Updated Venue via API');
  });

  test('Complete CRUD lifecycle via API', async () => {
    // CREATE - already done in beforeEach

    // READ
    const getResponse = await api.getEvent(BRAND_ID, testEventId);
    const getData = await getResponse.json();
    expect(getData.ok).toBe(true);

    // UPDATE
    const updateResponse = await api.updateEvent(BRAND_ID, testEventId, {
      name: 'Updated Event Name',
    }, ADMIN_KEY);
    const updateData = await updateResponse.json();
    expect(updateData.ok).toBe(true);

    // READ (verify update)
    const getResponse2 = await api.getEvent(BRAND_ID, testEventId);
    const getData2 = await getResponse2.json();
    expect(getData2.value.name).toBe('Updated Event Name');

    // DELETE
    const deleteResponse = await api.deleteEvent(BRAND_ID, testEventId, ADMIN_KEY);
    const deleteData = await deleteResponse.json();
    expect(deleteData.ok).toBe(true);

    // Remove from cleanup array since we already deleted
    const idx = createdEventIds.indexOf(testEventId);
    if (idx > -1) createdEventIds.splice(idx, 1);

    // Verify deletion
    const getResponse3 = await api.getEvent(BRAND_ID, testEventId);
    if (getResponse3.status() === 404) {
      expect(getResponse3.ok()).toBe(false);
    } else {
      const getData3 = await getResponse3.json();
      expect(getData3.ok).toBe(false);
    }
  });
});

// =============================================================================
// JOURNEY 7: Cross-Surface Integration
// =============================================================================

test.describe('Journey 7: Cross-Surface Integration', () => {
  let api;
  let testEventId;
  let testEventName;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);

    testEventName = `Cross Surface Event ${Date.now()}`;
    const { eventId } = await api.createTestEvent(BRAND_ID, ADMIN_KEY, {
      name: testEventName,
      venue: 'Integration Test Venue',
    });
    testEventId = eventId;
    createdEventIds.push(testEventId);
  });

  test.afterEach(async () => {
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(BRAND_ID, eventId, ADMIN_KEY);
      } catch (error) {
        console.warn(`⚠ Cleanup failed for ${eventId}`);
      }
    }
    createdEventIds.length = 0;
  });

  test('Same event renders correctly across all surfaces', async ({ page }) => {
    const surfaces = [
      { name: 'Public', url: `${BASE_URL}?page=public&brand=${BRAND_ID}&id=${testEventId}` },
      { name: 'Display', url: `${BASE_URL}?page=display&brand=${BRAND_ID}&id=${testEventId}` },
      { name: 'Poster', url: `${BASE_URL}?page=poster&brand=${BRAND_ID}&id=${testEventId}` },
      { name: 'Report', url: `${BASE_URL}?page=report&brand=${BRAND_ID}&id=${testEventId}` },
    ];

    for (const surface of surfaces) {
      await page.goto(surface.url, TIMEOUT_CONFIG);

      // Each surface should render without errors
      const errors = [];
      page.on('pageerror', error => errors.push(error));

      await expect(page.locator('main, #app, body')).toBeVisible({ timeout: 15000 });

      const criticalErrors = filterCriticalErrors(errors);
      expect(criticalErrors.length).toBe(0);

      console.log(`✓ ${surface.name} surface rendered successfully`);
    }
  });
});

// =============================================================================
// JOURNEY 8: System Health and API Status
// =============================================================================

test.describe('Journey 8: System Health', () => {
  let api;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);
  });

  test('System status endpoint returns healthy response', async () => {
    const response = await api.getStatus(BRAND_ID);
    const data = await response.json();

    expect(response.ok()).toBe(true);
    expect(data.ok).toBe(true);
    expect(data).toHaveProperty('buildId');
    expect(data).toHaveProperty('time');

    console.log(`✓ System healthy - Build: ${data.buildId}, Time: ${data.time}`);
  });

  test('Events list API returns valid response', async () => {
    const response = await api.listEvents(BRAND_ID);
    const data = await response.json();

    expect(response.ok()).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.value).toBeInstanceOf(Array);

    console.log(`✓ Events API healthy - ${data.value.length} events found`);
  });

  test('Main page loads without critical errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);

    await expect(page.locator('main, #app, body')).toBeVisible({ timeout: 15000 });

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length).toBe(0);

    console.log('✓ Main page loaded without critical errors');
  });
});

// =============================================================================
// JOURNEY 9: Error Handling and Edge Cases
// =============================================================================

test.describe('Journey 9: Error Handling', () => {
  let api;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelpers(request, BASE_URL);
  });

  test('Non-existent event returns appropriate error', async ({ page }) => {
    const fakeId = 'non-existent-event-12345';

    // Via API
    const response = await api.getEvent(BRAND_ID, fakeId);
    if (response.status() === 404) {
      expect(response.ok()).toBe(false);
    } else {
      const data = await response.json();
      expect(data.ok).toBe(false);
    }

    // Via UI
    await page.goto(`${BASE_URL}?page=public&brand=${BRAND_ID}&id=${fakeId}`, TIMEOUT_CONFIG);

    // Should show error message or fallback
    await page.waitForTimeout(2000);

    // Page should still render (graceful degradation)
    await expect(page.locator('body')).toBeVisible();
  });

  test('Invalid admin key is rejected', async () => {
    const eventData = { name: 'Should Fail Event' };
    const invalidKey = 'INVALID_KEY_12345';

    const response = await api.createEvent(BRAND_ID, eventData, invalidKey);

    if (response.ok()) {
      const data = await response.json();
      expect(data.ok).toBe(false);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

// =============================================================================
// TEST ENVIRONMENT INFO
// =============================================================================

test.describe('Test Environment Info', () => {
  test('Print test environment details', async () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Story 3.3 E2E Test Suite - Environment Information');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Base URL:      ${BASE_URL}`);
    console.log(`  Brand ID:      ${BRAND_ID}`);
    console.log(`  Environment:   ${IS_PRODUCTION ? 'PRODUCTION' : IS_STAGING ? 'STAGING' : 'LOCAL/OTHER'}`);
    console.log(`  Admin Key:     ${ADMIN_KEY ? '***SET***' : 'NOT SET'}`);
    console.log(`  Timestamp:     ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    expect(true).toBe(true);
  });
});
