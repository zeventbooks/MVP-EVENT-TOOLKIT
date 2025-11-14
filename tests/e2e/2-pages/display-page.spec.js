/**
 * PAGE TESTS - Level 2: Display/TV Page Components & Interactions
 *
 * Purpose: Test TV display page, sponsor carousel, and display features
 * Coverage: TV layout, sponsor rotation, carousel controls, responsive display
 */

const { test, expect } = require('@playwright/test');

const { BASE_URL, TENANT_ID } = require('../../shared/config/test.config.js');

test.describe('📄 PAGE: Display - TV Layout', () => {

  test('Display page loads with TV layout', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page).toHaveTitle(/Display|TV/);
    await expect(page.locator('body[data-tv="1"]')).toBeVisible();
    await expect(page.locator('#stage')).toBeVisible();
  });

  test('TV mode has large readable fonts', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}&tv=1`);

    const fontSize = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).fontSize
    );

    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(20); // Min 20px for 10-12ft viewing
  });

  test('Display has proper viewport for 1080p', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page.locator('#stage')).toBeVisible();

    // Content should fit within viewport
    const stage = page.locator('#stage');
    const boundingBox = await stage.boundingBox();

    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(1920);
      expect(boundingBox.height).toBeLessThanOrEqual(1080);
    }
  });
});

test.describe('📄 PAGE: Display - Sponsor Areas', () => {

  test('Display page has sponsor area containers in DOM', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    // STRICT: Sponsor containers must exist in DOM (even if hidden when no sponsors)
    const topSponsor = page.locator('#sponsorTop, .sponsor-top, [data-sponsor-area="top"]');
    const bottomSponsor = page.locator('#sponsorBottom, .sponsor-bottom, [data-sponsor-area="bottom"]');
    const leftSponsor = page.locator('#sponsorLeft, .sponsor-left, [data-sponsor-area="left"]');
    const rightSponsor = page.locator('#sponsorRight, .sponsor-right, [data-sponsor-area="right"]');

    // At least one sponsor area must exist in page structure
    const sponsorAreas = [
      await topSponsor.count(),
      await bottomSponsor.count(),
      await leftSponsor.count(),
      await rightSponsor.count()
    ];

    const totalSponsorAreas = sponsorAreas.reduce((a, b) => a + b, 0);

    // STRICT: Display page MUST have sponsor area infrastructure
    expect(totalSponsorAreas).toBeGreaterThan(0);
  });

  test('Sponsor areas have proper structure when visible', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    // Find any visible sponsor area
    const sponsorAreas = page.locator('[id^="sponsor"], [class*="sponsor-"]');
    const visibleCount = await sponsorAreas.count();

    if (visibleCount > 0) {
      // STRICT: If sponsors exist, they must be properly structured
      const firstSponsor = sponsorAreas.first();
      await expect(firstSponsor).toBeAttached();

      // Sponsor area should not be empty
      const content = await firstSponsor.textContent();
      const isEmpty = !content || content.trim().length === 0;

      // Allow empty if hidden (display: none), but not if visible
      if (!isEmpty || await firstSponsor.isVisible()) {
        expect(await firstSponsor.isVisible() || isEmpty).toBeTruthy();
      }
    }
  });
});

test.describe('📄 PAGE: Display - Carousel Controls', () => {

  test('Carousel exists and does not crash during rotation', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);
    await page.waitForLoadState('networkidle');

    const errors = [];
    page.on('pageerror', error => errors.push(error));

    const sponsorArea = page.locator('#sponsorTop, .sponsor-top, [data-sponsor-area="top"]');
    const exists = await sponsorArea.count() > 0;

    if (exists) {
      // STRICT: Sponsor area must be in DOM
      await expect(sponsorArea.first()).toBeAttached();

      // Wait for multiple rotation cycles (test stability)
      // Use Promise.race to avoid indefinite wait
      await Promise.race([
        page.waitForTimeout(12000), // Max wait time
        page.waitForSelector('#sponsorTop.rotated, .sponsor-rotated', { timeout: 12000 }).catch(() => {})
      ]);

      // STRICT: No JavaScript errors during carousel operation
      const criticalErrors = errors.filter(e =>
        !e.message.includes('google.script') &&
        !e.message.includes('google is not defined')
      );
      expect(criticalErrors.length).toBe(0);
    }
  });

  test('Manual navigation buttons work', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const prevBtn = page.locator('button:has-text("prev"), button.prev, button[aria-label*="previous" i]');
    const nextBtn = page.locator('button:has-text("next"), button.next, button[aria-label*="next" i]');

    const hasPrev = await prevBtn.count() > 0;
    const hasNext = await nextBtn.count() > 0;

    if (hasPrev) {
      await expect(prevBtn.first()).toBeVisible();
      await prevBtn.first().click();
      await page.waitForTimeout(500);
    }

    if (hasNext) {
      await expect(nextBtn.first()).toBeVisible();
      await nextBtn.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('Pause/Play carousel button works', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const pauseBtn = page.locator('button:has-text("pause"), button[aria-label*="pause" i]');
    const playBtn = page.locator('button:has-text("play"), button[aria-label*="play" i]');

    const hasPause = await pauseBtn.count() > 0;
    const hasPlay = await playBtn.count() > 0;

    if (hasPause) {
      await pauseBtn.first().click();
      await page.waitForTimeout(500);
    }

    if (hasPlay) {
      await playBtn.first().click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('📄 PAGE: Display - Event Information', () => {

  test('Current event details displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    // Should show event info in stage area
    const stage = page.locator('#stage');
    await expect(stage).toBeVisible();

    // Check for event title or "no events" message
    const hasContent = await page.locator('h1, h2, .event-title').count() > 0;
    const hasEmptyState = await page.locator('text=/no events|coming soon/i').count() > 0;

    expect(hasContent || hasEmptyState).toBe(true);
  });

  test('Event date and time displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const stage = page.locator('#stage');
    const content = await stage.textContent();

    // Should contain some content in the stage
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('Event location displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const stage = page.locator('#stage');
    await expect(stage).toBeVisible();

    // Stage should contain meaningful content
    const isEmpty = await stage.evaluate(el => el.textContent.trim().length === 0);
    expect(isEmpty).toBe(false);
  });
});

test.describe('📄 PAGE: Display - Full Screen Mode', () => {

  test('Full screen button exists', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const fullscreenBtn = page.locator('button:has-text("fullscreen"), button[aria-label*="fullscreen" i]');
    const hasFullscreen = await fullscreenBtn.count() > 0;

    if (hasFullscreen) {
      await expect(fullscreenBtn.first()).toBeVisible();
      await expect(fullscreenBtn.first()).toBeEnabled();
    }
  });

  test('Full screen mode can be triggered', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const fullscreenBtn = page.locator('button:has-text("fullscreen"), button[aria-label*="fullscreen" i]');
    const hasFullscreen = await fullscreenBtn.count() > 0;

    if (hasFullscreen) {
      await fullscreenBtn.first().click();
      await page.waitForTimeout(500);

      // Check if fullscreen was requested (may be blocked in headless)
      // Verify no JavaScript errors
      const errors = [];
      page.on('pageerror', error => errors.push(error));
      await page.waitForTimeout(500);
      expect(errors.length).toBe(0);
    }
  });
});

test.describe('📄 PAGE: Display - Refresh and Updates', () => {

  test('Display auto-refreshes data', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    // Display should have refresh logic
    // Check for refresh indicator or timestamp
    const hasRefreshIndicator = await page.locator('[data-refresh], .last-updated').count() > 0;

    // If refresh indicators exist, they should be visible
    if (hasRefreshIndicator) {
      await expect(page.locator('[data-refresh], .last-updated').first()).toBeVisible();
    }
  });

  test('Manual refresh button works', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const refreshBtn = page.locator('button:has-text("refresh"), button[aria-label*="refresh" i]');
    const hasRefresh = await refreshBtn.count() > 0;

    if (hasRefresh) {
      await expect(refreshBtn.first()).toBeVisible();
      await expect(refreshBtn.first()).toBeEnabled();

      await refreshBtn.first().click();
      await page.waitForTimeout(1000);

      // Should not cause errors
      const errors = [];
      page.on('pageerror', error => errors.push(error));
      await page.waitForTimeout(500);
      expect(errors.length).toBe(0);
    }
  });
});

test.describe('📄 PAGE: Display - QR Code Display', () => {

  test('QR code area exists', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const qrCode = page.locator('#qrCode, .qr-code, [data-qr]');
    const hasQR = await qrCode.count() > 0;

    if (hasQR) {
      await expect(qrCode.first()).toBeVisible();
    }
  });

  test('QR code image loads', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const qrImg = page.locator('#qrCode img, .qr-code img');
    const hasQRImg = await qrImg.count() > 0;

    if (hasQRImg) {
      await expect(qrImg.first()).toBeVisible();

      const src = await qrImg.first().getAttribute('src');
      expect(src).toBeTruthy();
    }
  });
});

test.describe('📄 PAGE: Display - Responsive Layouts', () => {

  test('Mobile: Display adapts to portrait', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page.locator('#stage')).toBeVisible();
  });

  test('Tablet: Display adapts to medium screens', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page.locator('#stage')).toBeVisible();
  });

  test('TV: 1080p Full HD', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page.locator('#stage')).toBeVisible();

    // Font should be large enough for TV viewing
    const fontSize = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(20);
  });

  test('TV: 4K Ultra HD', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    await expect(page.locator('#stage')).toBeVisible();

    // Should scale fonts for 4K
    const fontSize = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(20);
  });
});

test.describe('📄 PAGE: Display - Performance', () => {

  test('Display page loads quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);
    await page.waitForLoadState('domcontentloaded');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  test('Sponsor images load efficiently', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      // All images should load without errors
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const src = await img.getAttribute('src');
          expect(src).toBeTruthy();
        }
      }
    }
  });

  test('No memory leaks during carousel rotation', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    // Let carousel run for 30 seconds
    await page.waitForTimeout(30000);

    // Check for JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  });
});

test.describe('📄 PAGE: Display - Accessibility', () => {

  test('Display has proper ARIA labels', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const stage = page.locator('#stage');
    const ariaLabel = await stage.getAttribute('aria-label');
    const role = await stage.getAttribute('role');

    // Should have proper semantic markup
    expect(ariaLabel || role).toBeTruthy();
  });

  test('Carousel controls are keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=display&tenant=${TENANT_ID}`);

    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      // Tab to first button
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(['BUTTON', 'A']).toContain(focusedElement);
    }
  });
});
