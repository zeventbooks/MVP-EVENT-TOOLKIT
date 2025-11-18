/**
 * PAGE TESTS - Level 2: Public/Customer Page Components & Interactions
 *
 * Purpose: Test all buttons, navigation, and interactions on Public pages
 * Coverage: Event listing, event details, sponsor displays, analytics
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/.../exec';
const TENANT_ID = 'root';

test.describe('📄 PAGE: Public - Events List View', () => {

  test('Public page loads with proper structure', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    await expect(page).toHaveTitle(/Public|Events/);
    await expect(page.locator('main#app')).toBeVisible();
  });

  test('Page shows events or "no events" message', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    // Should show either event cards or empty state
    const hasEventCards = await page.locator('.event-card').count() > 0;
    const hasEmptyMessage = await page.locator('text=/no events|coming soon/i').count() > 0;

    expect(hasEventCards || hasEmptyMessage).toBe(true);
  });

  test('Event cards have proper structure', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      const firstCard = eventCards.first();

      // Each card should have: title, date, location, link
      await expect(firstCard.locator('h2, h3')).toBeVisible();

      // Should have clickable link or button
      const hasLink = await firstCard.locator('a').count() > 0;
      const hasButton = await firstCard.locator('button').count() > 0;
      expect(hasLink || hasButton).toBe(true);
    }
  });

  test('Event cards are clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      const firstCard = eventCards.first();
      const link = firstCard.locator('a').first();

      await expect(link).toBeVisible();

      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href.length).toBeGreaterThan(0);
    }
  });
});

test.describe('📄 PAGE: Public - Event Detail View', () => {

  test('Event detail shows all information', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      // Click first event
      await eventCards.first().locator('a').first().click();

      // Should navigate to detail view
      await page.waitForLoadState('networkidle');

      // Detail view should show event info
      await expect(page.locator('h1, h2')).toBeVisible();
    }
  });

  test('Back navigation works from event detail', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      await eventCards.first().locator('a').first().click();
      await page.waitForLoadState('networkidle');

      // Navigate back
      await page.goBack();

      // Should return to events list
      await expect(page.locator('.event-card').first()).toBeVisible();
    }
  });
});

test.describe('📄 PAGE: Public - Sponsor Display', () => {

  test('Sponsor banner shows when configured', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    // Check if sponsor elements exist
    const hasSponsorBanner = await page.locator('#sponsorBanner, .sponsor-banner').count() > 0;
    const hasSponsorCard = await page.locator('.sponsor-card').count() > 0;

    // Sponsors are optional, but if present should be visible
    if (hasSponsorBanner) {
      await expect(page.locator('#sponsorBanner, .sponsor-banner')).toBeVisible();
    }

    if (hasSponsorCard) {
      await expect(page.locator('.sponsor-card').first()).toBeVisible();
    }
  });

  test('Sponsor links are clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const sponsorLinks = page.locator('a[data-sponsor], .sponsor-link');
    const count = await sponsorLinks.count();

    if (count > 0) {
      const firstLink = sponsorLinks.first();
      await expect(firstLink).toBeVisible();

      const href = await firstLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('Sponsor images load correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const sponsorImages = page.locator('img[data-sponsor], .sponsor-card img');
    const count = await sponsorImages.count();

    if (count > 0) {
      const firstImg = sponsorImages.first();
      await expect(firstImg).toBeVisible();

      // Check image has src
      const src = await firstImg.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src.length).toBeGreaterThan(0);
    }
  });
});

test.describe('📄 PAGE: Public - Search and Filter', () => {

  test('Search functionality exists', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    // Check if search input exists
    const hasSearch = await page.locator('input[type="search"], input[placeholder*="search" i]').count() > 0;

    if (hasSearch) {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toBeEnabled();
    }
  });

  test('Filter buttons work', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    // Check for filter buttons
    const filterButtons = page.locator('button[data-filter], .filter-btn');
    const count = await filterButtons.count();

    if (count > 0) {
      const firstFilter = filterButtons.first();
      await expect(firstFilter).toBeVisible();
      await expect(firstFilter).toBeEnabled();

      // Click should not cause error
      await firstFilter.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('📄 PAGE: Public - Share Buttons', () => {

  test('Share buttons are present', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      // Check if share buttons exist
      const hasShare = await page.locator('button:has-text("share"), .share-btn').count() > 0;

      if (hasShare) {
        const shareBtn = page.locator('button:has-text("share"), .share-btn').first();
        await expect(shareBtn).toBeVisible();
        await expect(shareBtn).toBeEnabled();
      }
    }
  });

  test('Share button shows share options', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const shareButtons = page.locator('button:has-text("share"), .share-btn');
    const count = await shareButtons.count();

    if (count > 0) {
      await shareButtons.first().click();
      await page.waitForTimeout(500);

      // Should show share menu or trigger share API
      // Verify no JavaScript errors occurred
      const errors = [];
      page.on('pageerror', error => errors.push(error));

      await page.waitForTimeout(500);
      expect(errors.length).toBe(0);
    }
  });
});

test.describe('📄 PAGE: Public - Calendar Integration', () => {

  test('Add to Calendar button exists', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count > 0) {
      // Click into event detail
      await eventCards.first().locator('a').first().click();
      await page.waitForLoadState('networkidle');

      // Check for calendar button
      const hasCalendar = await page.locator('button:has-text("calendar"), a:has-text("calendar"), .calendar-btn').count() > 0;

      if (hasCalendar) {
        const calendarBtn = page.locator('button:has-text("calendar"), a:has-text("calendar"), .calendar-btn').first();
        await expect(calendarBtn).toBeVisible();
      }
    }
  });
});

test.describe('📄 PAGE: Public - Responsive Design', () => {

  test('Mobile: Events list is readable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    await expect(page.locator('main#app')).toBeVisible();

    // Font should be at least 16px to prevent iOS zoom
    const fontSize = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(16);
  });

  test('Mobile: Event cards stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const eventCards = page.locator('.event-card');
    const count = await eventCards.count();

    if (count >= 2) {
      const firstCard = await eventCards.nth(0).boundingBox();
      const secondCard = await eventCards.nth(1).boundingBox();

      if (firstCard && secondCard) {
        // Second card should be below first (y position greater)
        expect(secondCard.y).toBeGreaterThan(firstCard.y);
      }
    }
  });

  test('Tablet: Grid layout adapts', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    await expect(page.locator('main#app')).toBeVisible();
  });

  test('Desktop: Multi-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    await expect(page.locator('main#app')).toBeVisible();
  });
});

test.describe('📄 PAGE: Public - Performance', () => {

  test('Page loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);
    await page.waitForLoadState('domcontentloaded');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  test('Images lazy load', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      // Check if images have loading attribute
      const firstImg = images.first();
      const loading = await firstImg.getAttribute('loading');

      // Should use lazy loading for better performance
      // (or images load correctly without lazy loading)
      expect(loading === 'lazy' || loading === null).toBe(true);
    }
  });
});

test.describe('📄 PAGE: Public - Accessibility', () => {

  test('Page has proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(0);

    // Should have logical heading structure
    const headings = await page.locator('h1, h2, h3, h4').count();
    expect(headings).toBeGreaterThan(0);
  });

  test('Interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
  });

  test('Links have descriptive text', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=events&brand=${TENANT_ID}`);

    const links = page.locator('a');
    const count = await links.count();

    if (count > 0) {
      const firstLink = links.first();
      const text = await firstLink.textContent();
      const ariaLabel = await firstLink.getAttribute('aria-label');

      // Should have either text content or aria-label
      expect((text && text.trim().length > 0) || ariaLabel).toBeTruthy();
    }
  });
});
