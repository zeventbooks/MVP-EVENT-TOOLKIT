/**
 * DRY Test Example - Refactored Admin Buttons Test
 *
 * Demonstrates how to build concise admin tests that reuse shared fixtures,
 * selectors, and config-driven helpers instead of reimplementing prompts or
 * navigation inside every spec.
 */

import { test, expect } from '../fixtures';
import { ADMIN_PAGE, COMMON } from '../selectors';

const hasAdminKey = !!process.env.ADMIN_KEY;
const describeAdminExamples = hasAdminKey ? test.describe : test.describe.skip;

if (!hasAdminKey) {
  console.warn('⚠️  ADMIN_KEY not set. Skipping admin DRY example tests.');
}

/**
 * Example: Core admin interactions using the authenticatedAdminPage fixture
 */
describeAdminExamples('Admin Page - DRY Example', () => {
  test('Should clear event form', async ({ authenticatedAdminPage }) => {
    const page = authenticatedAdminPage;

    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Test Event');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Test Location');

    await page.click(ADMIN_PAGE.CANCEL_BUTTON);

    await expect(page.locator(ADMIN_PAGE.EVENT_NAME_INPUT)).toHaveValue('');
    await expect(page.locator(ADMIN_PAGE.EVENT_LOCATION_INPUT)).toHaveValue('');
  });

  test('Should create event with all fields', async ({ authenticatedAdminPage }) => {
    const page = authenticatedAdminPage;

    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Complete Test Event');
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Convention Center');
    await page.fill(ADMIN_PAGE.EVENT_DESCRIPTION_TEXTAREA, 'A comprehensive test event');

    if (await page.isVisible(ADMIN_PAGE.TIME_START_INPUT)) {
      await page.fill(ADMIN_PAGE.TIME_START_INPUT, '18:00');
      await page.fill(ADMIN_PAGE.TIME_END_INPUT, '22:00');
    }

    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
    await expect(page.locator(ADMIN_PAGE.SUCCESS_MESSAGE)).toBeVisible();
  });

  test('Should add sponsor', async ({ authenticatedAdminPage }) => {
    const page = authenticatedAdminPage;

    if (await page.isVisible(ADMIN_PAGE.ADD_SPONSOR_BUTTON)) {
      await page.click(ADMIN_PAGE.ADD_SPONSOR_BUTTON);
      await page.fill(ADMIN_PAGE.SPONSOR_NAME_INPUT, 'Test Sponsor');
      await page.selectOption(ADMIN_PAGE.SPONSOR_TIER_SELECT, 'platinum');
      await page.fill(ADMIN_PAGE.SPONSOR_LOGO_INPUT, 'https://via.placeholder.com/300x100');

      await expect(page.locator(ADMIN_PAGE.SPONSOR_NAME_INPUT)).toHaveValue('Test Sponsor');
    }
  });

  test('Should configure display settings', async ({ authenticatedAdminPage }) => {
    const page = authenticatedAdminPage;
    const displayConfigButton = await page.$('button:has-text("Configure Display")');

    if (displayConfigButton) {
      await displayConfigButton.click();
      await page.selectOption(ADMIN_PAGE.DISPLAY_MODE_SELECT, 'dynamic');

      if (await page.isVisible(ADMIN_PAGE.DISPLAY_URL_INPUT)) {
        await page.fill(ADMIN_PAGE.DISPLAY_URL_INPUT, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
      }

      await page.click(ADMIN_PAGE.SAVE_BUTTON);
      await page.waitForTimeout(500);
    }
  });
});

/**
 * Example: Data-Driven Testing with DRY
 */
const testEvents = [
  { name: 'Morning Workshop', date: '2025-12-01', location: 'Room A' },
  { name: 'Afternoon Seminar', date: '2025-12-01', location: 'Room B' },
  { name: 'Evening Gala', date: '2025-12-01', location: 'Main Hall' },
];

describeAdminExamples('Admin Page - Data-Driven Example', () => {
  for (const eventData of testEvents) {
    test(`Should create event: ${eventData.name}`, async ({ authenticatedAdminPage }) => {
      const page = authenticatedAdminPage;

      await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, eventData.name);
      await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, eventData.date);
      await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, eventData.location);

      await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
      await expect(page.locator(ADMIN_PAGE.SUCCESS_MESSAGE)).toBeVisible();
    });
  }
});

/**
 * Example: Mobile-First Testing with DRY
 */
describeAdminExamples('Admin Page - Mobile Example', () => {
  test('Should create event on mobile', async ({ authenticatedAdminPage, mobile }) => {
    const page = authenticatedAdminPage;

    if (mobile.isMobile) {
      const mobileMenu = await page.$(COMMON.MOBILE_MENU_BUTTON);
      if (mobileMenu && (await mobileMenu.isVisible())) {
        await mobileMenu.click();
      }
    }

    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Mobile Test Event');
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Mobile Venue');

    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
    await expect(page.locator(ADMIN_PAGE.SUCCESS_MESSAGE)).toBeVisible();
  });
});

/**
 * Example: Negative Testing with DRY
 */
const invalidEvents = [
  { name: '', date: '2025-12-25', location: 'Venue', expected: 'name' },
  { name: 'Test Event', date: 'invalid-date', location: 'Venue', expected: 'date' },
  { name: 'Test Event', date: '2025-12-25', location: '', expected: 'location' },
];

describeAdminExamples('Admin Page - Negative Testing Example', () => {
  for (const testCase of invalidEvents) {
    test(`Should show validation for ${testCase.expected}`, async ({ authenticatedAdminPage }) => {
      const page = authenticatedAdminPage;

      if (testCase.name !== undefined) {
        await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, testCase.name);
      }
      if (testCase.date !== undefined) {
        await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, testCase.date);
      }
      if (testCase.location !== undefined) {
        await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, testCase.location);
      }

      await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
      await expect(page.locator(ADMIN_PAGE.ERROR_MESSAGE)).toBeVisible();
    });
  }
});

/**
 * Example: API Integration Testing with DRY
 */
describeAdminExamples('Admin Page - API Integration Example', () => {
  test('Should verify event creation via API', async ({ authenticatedAdminPage, api }) => {
    const page = authenticatedAdminPage;
    const eventName = `API Test Event ${Date.now()}`;

    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, eventName);
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'API Venue');

    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
    await expect(page.locator(ADMIN_PAGE.SUCCESS_MESSAGE)).toBeVisible();

    const response = await api.call('list', { scope: 'events' });
    const events = response?.value?.items || [];
    const createdEvent = events.find(e => e.data?.name === eventName);

    expect(createdEvent).toBeTruthy();
  });
});

/**
 * KEY BENEFITS OF DRY APPROACH
 * - Maintainability: selectors, auth, and navigation live in fixtures/helpers
 * - Readability: specs focus on intent instead of boilerplate
 * - Reliability: centralized flows keep prompts, waits, and data consistent
 */
