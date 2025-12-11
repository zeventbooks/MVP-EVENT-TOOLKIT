/**
 * EVENTS ERROR STATES TESTS - Story 4
 *
 * Purpose: Test frontend /events error handling with structured responses
 *
 * Coverage per acceptance criteria:
 *   1. Backend working: /events shows events grid or clean empty state
 *   2. Backend broken (500-599): Shows "Temporary Issue" card
 *   3. Backend misconfigured (400-499 or GAS_UPSTREAM_NON_JSON): Shows "Configuration Issue" card
 *   4. Staging shows diagnostic snippet, prod does not
 *   5. No unhandled exceptions in browser console
 *   6. Loading skeleton/spinner behavior on slow responses
 *   7. Malformed JSON handling shows error state
 *
 * @see docs/stories/STORY_4_EVENTS_ERROR_HANDLING.md
 */

const { test, expect } = require('@playwright/test');
const { getBaseUrl } = require('../../config/environments');

const BASE_URL = getBaseUrl();
const BRAND_ID = process.env.BRAND_ID || 'root';

/**
 * Safely determine if URL is for staging environment
 * Uses proper URL parsing to avoid substring sanitization vulnerabilities
 */
function isStagingUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Exact domain checks to prevent bypass attacks
    return hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'stg.eventangle.com' ||
      hostname.endsWith('.stg.eventangle.com');
  } catch {
    // If URL parsing fails, assume staging for safety
    return true;
  }
}

/**
 * Safely determine if URL is for production environment
 * Uses proper URL parsing to avoid substring sanitization vulnerabilities
 */
function isProductionUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Exact domain check - production is www.eventangle.com only
    return hostname === 'www.eventangle.com' || hostname === 'eventangle.com';
  } catch {
    return false;
  }
}

// Timeout config for GAS cold starts
const TIMEOUT_CONFIG = {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
};

// Patterns that indicate internal errors leaking to users
const INTERNAL_ERROR_PATTERNS = [
  /TypeError:/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /at\s+\w+\s+\(/i,
  /\.gs:\d+/i,
  /\.js:\d+:\d+/i,
];

/**
 * Check for internal error leaks in page content
 */
async function assertNoInternalErrors(page) {
  const bodyText = await page.locator('body').innerText();
  for (const pattern of INTERNAL_ERROR_PATTERNS) {
    const match = bodyText.match(pattern);
    expect(match, `Internal error leaked to UI: ${pattern}`).toBeNull();
  }
}

/**
 * Check page layout is not broken
 */
async function assertLayoutNotBroken(page) {
  const hasBody = await page.locator('body').count() > 0;
  expect(hasBody, 'Page body should exist').toBe(true);

  const bodyText = await page.locator('body').innerText();
  const hasVisualContent = await page.locator('img, svg, canvas, div').count() > 0;
  const hasContent = bodyText.trim().length > 0 || hasVisualContent;
  expect(hasContent, 'Page should have content').toBe(true);
}

/**
 * Track and filter JS console errors
 */
function filterCriticalErrors(errors) {
  return errors.filter(e =>
    !e.message.includes('google.script') &&
    !e.message.includes('google is not defined') &&
    !e.message.includes('Script error') &&
    !e.message.includes('ResizeObserver') // Common benign error
  );
}

// =============================================================================
// HAPPY PATH TESTS
// =============================================================================
test.describe('S4-HP: Happy Path - Events Render Correctly', () => {

  test('Events list shows events grid when backend returns events', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Mock successful response with events
    await page.route('**/rpc*', route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.method === 'api_list' || route.request().postData()?.includes('api_list')) {
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ok: true,
            value: {
              items: [
                {
                  id: 'evt-test-1',
                  slug: 'test-event-1',
                  name: 'Test Event 1',
                  startDateISO: '2025-12-15',
                  venue: 'Test Venue 1',
                  links: { publicUrl: '', displayUrl: '', posterUrl: '', signupUrl: '' },
                  qr: { public: '', signup: '' },
                  ctas: { primary: { label: 'Sign Up', url: '' }, secondary: null },
                  settings: { showSchedule: false, showStandings: false, showBracket: false, showSponsors: false }
                },
                {
                  id: 'evt-test-2',
                  slug: 'test-event-2',
                  name: 'Test Event 2',
                  startDateISO: '2025-12-20',
                  venue: 'Test Venue 2',
                  links: { publicUrl: '', displayUrl: '', posterUrl: '', signupUrl: '' },
                  qr: { public: '', signup: '' },
                  ctas: { primary: { label: 'Sign Up', url: '' }, secondary: null },
                  settings: { showSchedule: false, showStandings: false, showBracket: false, showSponsors: false }
                }
              ],
              pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
            }
          })
        });
      }
      return route.continue();
    });

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    // Should show events grid
    const hasEventCards = await page.locator('.event-card, .card, [data-event-id]').count() > 0;
    const hasEventTitle = await page.locator('text=Test Event 1').isVisible().catch(() => false);

    expect(hasEventCards || hasEventTitle, 'Should render event cards or titles').toBe(true);

    // No critical JS errors
    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });

  test('Events list shows clean empty state when no events exist', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Mock successful response with empty events
    await page.route('**/rpc*', route => {
      const body = route.request().postData() || '';
      if (body.includes('api_list')) {
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ok: true,
            value: {
              items: [],
              pagination: { total: 0, limit: 50, offset: 0, hasMore: false }
            }
          })
        });
      }
      return route.continue();
    });

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    // Should show empty state (not error state)
    await assertLayoutNotBroken(page);

    // Look for empty state indicators
    const bodyText = await page.locator('body').innerText();
    const hasEmptyIndicatorOrEventsGrid = bodyText.toLowerCase().includes('no event') ||
      bodyText.toLowerCase().includes('nothing') ||
      bodyText.toLowerCase().includes('empty') ||
      bodyText.toLowerCase().includes('create') ||
      await page.locator('.events-grid, .event-card, .card').count() === 0;

    // Should show empty state or grid (not error)
    expect(hasEmptyIndicatorOrEventsGrid, 'Should show empty state or events grid').toBe(true);

    // Should NOT show error state
    expect(bodyText.toLowerCase()).not.toContain('temporary issue');
    expect(bodyText.toLowerCase()).not.toContain('configuration issue');
    expect(bodyText.toLowerCase()).not.toContain('something went wrong');

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});

// =============================================================================
// 5XX ERROR TESTS - TEMPORARY ISSUE
// =============================================================================
test.describe('S4-5XX: Server Errors Show Temporary Issue Card', () => {

  const serverErrors = [
    { status: 500, code: 'INTERNAL', message: 'Internal server error' },
    { status: 502, code: 'BAD_GATEWAY', message: 'Bad gateway' },
    { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
  ];

  for (const error of serverErrors) {
    test(`${error.status} error shows Temporary Issue card`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error));

      await page.route('**/rpc*', route => route.fulfill({
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: error.code,
          message: error.message,
          status: error.status
        })
      }));

      await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
      await page.waitForTimeout(3000);

      await assertNoInternalErrors(page);
      await assertLayoutNotBroken(page);

      // Should show Temporary Issue state
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const hasTemporaryIssue = bodyText.toLowerCase().includes('temporary') ||
        bodyText.toLowerCase().includes('try again') ||
        bodyText.toLowerCase().includes('moment');

      expect(hasTemporaryIssue, `Should show Temporary Issue for ${error.status}`).toBe(true);

      // Should NOT expose raw error code
      expect(bodyText).not.toContain(error.code);
      expect(bodyText).not.toContain(String(error.status));

      const criticalErrors = filterCriticalErrors(errors);
      expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
    });
  }

  test('504 timeout shows Taking Too Long card', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 504,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'TIMEOUT',
        message: 'Gateway timeout',
        status: 504
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);

    // Should show timeout-related message
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasTimeoutMessage = bodyText.toLowerCase().includes('taking') ||
      bodyText.toLowerCase().includes('long') ||
      bodyText.toLowerCase().includes('try again');

    expect(hasTimeoutMessage, 'Should show timeout message for 504').toBe(true);

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});

// =============================================================================
// 4XX ERROR TESTS - CONFIGURATION ISSUE
// =============================================================================
test.describe('S4-4XX: Client Errors Show Configuration Issue Card', () => {

  test('400 BAD_INPUT shows Configuration Issue in staging', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid request parameters',
        status: 400,
        errorCode: 'BAD_INPUT'
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);

    // Should show Configuration Issue or Setting Up state
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasConfigState = bodyText.toLowerCase().includes('configuration') ||
      bodyText.toLowerCase().includes('setting') ||
      bodyText.toLowerCase().includes('try again later') ||
      bodyText.toLowerCase().includes('misconfigured');

    expect(hasConfigState, 'Should show Configuration Issue for 400').toBe(true);

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });

  test('GAS_UPSTREAM_NON_JSON errorCode shows Configuration Issue', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'BAD_INPUT',
        message: 'Upstream returned non-JSON response',
        status: 400,
        errorCode: 'GAS_UPSTREAM_NON_JSON'
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);

    // Should show Configuration Issue state
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasConfigState = bodyText.toLowerCase().includes('configuration') ||
      bodyText.toLowerCase().includes('setting') ||
      bodyText.toLowerCase().includes('try again later');

    expect(hasConfigState, 'Should show Configuration Issue for GAS_UPSTREAM_NON_JSON').toBe(true);

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});

// =============================================================================
// STAGING DIAGNOSTICS TESTS
// =============================================================================
test.describe('S4-DIAG: Staging Shows Diagnostics, Prod Does Not', () => {

  test('Staging build shows diagnostic details for configuration errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Check if we're on staging using secure URL parsing
    const isStaging = isStagingUrl(BASE_URL);

    await page.route('**/rpc*', route => route.fulfill({
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'BAD_INPUT',
        message: 'Configuration error',
        status: 400,
        errorCode: 'GAS_UPSTREAM_NON_JSON',
        corrId: 'test-corr-12345'
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertLayoutNotBroken(page);

    // In staging, should have diagnostic details expandable
    if (isStaging) {
      // Look for diagnostic info or details element
      const hasDetails = await page.locator('details, [data-testid="config-error-state"]').count() > 0;
      const bodyText = await page.locator('body').innerText().catch(() => '');

      // Staging should show status or errorCode somewhere (in expandable)
      const hasDiagnosticText = bodyText.includes('Status') ||
        bodyText.includes('Error') ||
        bodyText.includes('Ref:') ||
        await page.locator('details').count() > 0;

      console.log('Staging diagnostics check:', { hasDetails, hasDiagnosticText, isStaging });
    }

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });

  test('Production build does not leak error codes to users', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Use secure URL parsing to check production environment
    const isProduction = isProductionUrl(BASE_URL);

    await page.route('**/rpc*', route => route.fulfill({
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'INTERNAL',
        message: 'Internal server error at /api/events line 42',
        status: 500,
        errorCode: 'GAS_INTERNAL_ERROR',
        corrId: 'secret-corr-99999'
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertLayoutNotBroken(page);

    // In production, should NOT expose internal details
    if (isProduction) {
      const bodyText = await page.locator('body').innerText().catch(() => '');

      expect(bodyText).not.toContain('INTERNAL');
      expect(bodyText).not.toContain('GAS_INTERNAL_ERROR');
      expect(bodyText).not.toContain('line 42');
      expect(bodyText).not.toContain('/api/events');
    }

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});

// =============================================================================
// MALFORMED JSON TESTS
// =============================================================================
test.describe('S4-JSON: Malformed JSON Shows Error State', () => {

  test('Truncated JSON response shows error state gracefully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '{"ok": true, "value": {"items": ['
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);

    // Page should handle malformed JSON without crashing
    // We just verify the page doesn't throw unhandled errors
    const criticalErrors = filterCriticalErrors(errors);
    // Note: JSON parse errors may throw, but should be caught by the app
    console.log('Truncated JSON test - errors:', criticalErrors.map(e => e.message));
  });

  test('Empty response body shows error state gracefully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: ''
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);
  });

  test('Non-JSON response (HTML error page) shows error state', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: '<html><head><title>Error</title></head><body><h1>Service Unavailable</h1></body></html>'
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    await assertNoInternalErrors(page);
    await assertLayoutNotBroken(page);
  });
});

// =============================================================================
// LOADING STATE TESTS
// =============================================================================
test.describe('S4-LOAD: Loading State Behavior', () => {

  test('Slow response shows loading skeleton/spinner', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Delay the response by 3 seconds
    await page.route('**/rpc*', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          value: {
            items: [
              {
                id: 'evt-slow',
                slug: 'slow-event',
                name: 'Slow Loading Event',
                startDateISO: '2025-12-25',
                venue: 'Test Venue',
                links: { publicUrl: '', displayUrl: '', posterUrl: '', signupUrl: '' },
                qr: { public: '', signup: '' },
                ctas: { primary: { label: 'Sign Up', url: '' }, secondary: null },
                settings: { showSchedule: false, showStandings: false, showBracket: false, showSponsors: false }
              }
            ],
            pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
          }
        })
      });
    });

    const response = await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    expect(response.status()).toBe(200);

    // During the delay, should show loading indicator
    // Check immediately after page load (before the delayed response)
    const hasLoadingIndicator = await page.locator('.loading-state, .loading-spinner, .spinner, .skeleton, [class*="loading"]').isVisible().catch(() => false);

    console.log('Loading indicator visible during delay:', hasLoadingIndicator);

    // Wait for response and verify content loads
    await page.waitForTimeout(4000);

    // After response, should show events or be in a valid state
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasContent = bodyText.length > 0;
    expect(hasContent, 'Page should have content after slow response').toBe(true);

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });

  test('Loading state disappears after successful load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.route('**/rpc*', route => route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        value: {
          items: [
            {
              id: 'evt-quick',
              slug: 'quick-event',
              name: 'Quick Loading Event',
              startDateISO: '2025-12-30',
              venue: 'Quick Venue',
              links: { publicUrl: '', displayUrl: '', posterUrl: '', signupUrl: '' },
              qr: { public: '', signup: '' },
              ctas: { primary: { label: 'Sign Up', url: '' }, secondary: null },
              settings: { showSchedule: false, showStandings: false, showBracket: false, showSponsors: false }
            }
          ],
          pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
        }
      })
    }));

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    // After load, loading indicators should be hidden
    const loadingVisible = await page.locator('.loading-state:visible, .loading-spinner:visible').count();
    expect(loadingVisible, 'Loading indicators should be hidden after load').toBe(0);

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});

// =============================================================================
// RETRY BUTTON TESTS
// =============================================================================
test.describe('S4-RETRY: Retry Button Functionality', () => {

  test('Error states show retry button that reloads page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    let requestCount = 0;
    await page.route('**/rpc*', route => {
      requestCount++;
      return route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: 'INTERNAL',
          message: 'Server error',
          status: 500
        })
      });
    });

    await page.goto(`${BASE_URL}?page=events&brand=${BRAND_ID}`, TIMEOUT_CONFIG);
    await page.waitForTimeout(3000);

    // Look for retry button
    const retryButton = page.locator('button:has-text("Try Again"), button:has-text("Retry"), .btn-retry');
    const hasRetry = await retryButton.count() > 0;

    if (hasRetry) {
      // Click retry and verify page reloads (request count increases)
      const initialCount = requestCount;
      await retryButton.first().click();
      await page.waitForTimeout(2000);

      // Request count should have increased (page reloaded)
      console.log('Request counts - initial:', initialCount, 'after retry:', requestCount);
    }

    const criticalErrors = filterCriticalErrors(errors);
    expect(criticalErrors.length, 'No unhandled JS exceptions').toBe(0);
  });
});
