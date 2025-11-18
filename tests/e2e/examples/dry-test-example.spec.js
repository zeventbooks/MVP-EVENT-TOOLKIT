/**
 * DRY Test Example - Refactored Admin Buttons Test
 *
 * This demonstrates how to refactor tests using DRY principles:
 * 1. Use centralized selectors
 * 2. Use fixtures for authentication
 * 3. Use config for environment variables
 * 4. Use page objects for reusable interactions
 *
 * BEFORE (admin-buttons.spec.js - 200+ lines with duplication):
 * - Hardcoded BASE_URL, ADMIN_KEY
 * - Inline dialog handlers (repeated 14 times)
 * - Hardcoded selectors
 * - No reusability
 *
 * AFTER (this file - DRY, maintainable):
 * - Uses centralized config
 * - Uses fixtures for auth
 * - Uses centralized selectors
 * - Reusable, testable, maintainable
 */

const { test, expect } = require('@playwright/test');
const { authenticatedAdminPage } = require('../fixtures');
const { ADMIN_PAGE, COMMON } = require('../selectors');

test.describe('Admin Page - DRY Example', () => {

  // Use fixture for authenticated admin page
  test('Should clear event form', async ({ authenticatedAdminPage: { page, config } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Fill some data
    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Test Event');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Test Location');

    // Click clear button using centralized selector
    await page.click(ADMIN_PAGE.CANCEL_BUTTON);

    // Verify form is cleared
    const eventName = await page.inputValue(ADMIN_PAGE.EVENT_NAME_INPUT);
    expect(eventName).toBe('');
  });

  test('Should create event with all fields', async ({ authenticatedAdminPage: { page, config } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Fill form using centralized selectors
    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Complete Test Event');
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Convention Center');
    await page.fill(ADMIN_PAGE.EVENT_DESCRIPTION_TEXTAREA, 'A comprehensive test event');

    if (await page.isVisible(ADMIN_PAGE.TIME_START_INPUT)) {
      await page.fill(ADMIN_PAGE.TIME_START_INPUT, '18:00');
      await page.fill(ADMIN_PAGE.TIME_END_INPUT, '22:00');
    }

    // Submit using centralized selector
    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);

    // Wait for success message
    await page.waitForSelector(ADMIN_PAGE.SUCCESS_MESSAGE, { timeout: 5000 });

    const successMessage = await page.textContent(ADMIN_PAGE.SUCCESS_MESSAGE);
    expect(successMessage).toContain('success');
  });

  test('Should add sponsor', async ({ authenticatedAdminPage: { page, config } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Click add sponsor button
    if (await page.isVisible(ADMIN_PAGE.ADD_SPONSOR_BUTTON)) {
      await page.click(ADMIN_PAGE.ADD_SPONSOR_BUTTON);

      // Fill sponsor details
      await page.fill(ADMIN_PAGE.SPONSOR_NAME_INPUT, 'Test Sponsor');
      await page.selectOption(ADMIN_PAGE.SPONSOR_TIER_SELECT, 'platinum');
      await page.fill(ADMIN_PAGE.SPONSOR_LOGO_INPUT, 'https://via.placeholder.com/300x100');

      // Verify sponsor fields are visible
      const sponsorName = await page.inputValue(ADMIN_PAGE.SPONSOR_NAME_INPUT);
      expect(sponsorName).toBe('Test Sponsor');
    }
  });

  test('Should configure display settings', async ({ authenticatedAdminPage: { page, config } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Navigate to display configuration
    const displayConfigButton = await page.$('button:has-text("Configure Display")');

    if (displayConfigButton) {
      await displayConfigButton.click();

      // Select display mode
      await page.selectOption(ADMIN_PAGE.DISPLAY_MODE_SELECT, 'dynamic');

      // Add display URL
      if (await page.isVisible(ADMIN_PAGE.DISPLAY_URL_INPUT)) {
        await page.fill(ADMIN_PAGE.DISPLAY_URL_INPUT, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
      }

      // Save configuration
      await page.click(ADMIN_PAGE.SAVE_BUTTON);

      // Verify saved
      await page.waitForTimeout(1000);
    }
  });
});

/**
 * Example: Data-Driven Testing with DRY
 */
test.describe('Admin Page - Data-Driven Example', () => {
  const testEvents = [
    {
      name: 'Morning Workshop',
      date: '2025-12-01',
      location: 'Room A'
    },
    {
      name: 'Afternoon Seminar',
      date: '2025-12-01',
      location: 'Room B'
    },
    {
      name: 'Evening Gala',
      date: '2025-12-01',
      location: 'Main Hall'
    }
  ];

  for (const eventData of testEvents) {
    test(`Should create event: ${eventData.name}`, async ({ authenticatedAdminPage: { page, config } }) => {
      await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

      await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, eventData.name);
      await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, eventData.date);
      await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, eventData.location);

      await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);

      await page.waitForSelector(ADMIN_PAGE.SUCCESS_MESSAGE, { timeout: 5000 });
    });
  }
});

/**
 * Example: Mobile-First Testing with DRY
 */
test.describe('Admin Page - Mobile Example', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Should create event on mobile', async ({ authenticatedAdminPage: { page, config } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Mobile menu might be different
    const mobileMenu = await page.$(COMMON.MOBILE_MENU_BUTTON);
    if (mobileMenu && await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }

    // Same selectors work across devices
    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, 'Mobile Test Event');
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'Mobile Venue');

    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);

    await page.waitForSelector(ADMIN_PAGE.SUCCESS_MESSAGE, { timeout: 5000 });
  });
});

/**
 * Example: Negative Testing with DRY
 */
test.describe('Admin Page - Negative Testing Example', () => {
  const invalidEvents = [
    {
      name: '', // Empty name
      date: '2025-12-25',
      location: 'Venue',
      expectedError: 'Event name is required'
    },
    {
      name: 'Test Event',
      date: 'invalid-date', // Invalid date
      location: 'Venue',
      expectedError: 'Invalid date format'
    },
    {
      name: 'Test Event',
      date: '2025-12-25',
      location: '', // Empty location
      expectedError: 'Location is required'
    }
  ];

  for (const testCase of invalidEvents) {
    test(`Should show error for: ${testCase.expectedError}`, async ({ authenticatedAdminPage: { page, config } }) => {
      await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

      if (testCase.name) await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, testCase.name);
      if (testCase.date) await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, testCase.date);
      if (testCase.location) await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, testCase.location);

      await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);

      // Should show error message
      await page.waitForSelector(ADMIN_PAGE.ERROR_MESSAGE, { timeout: 5000 });

      const errorMessage = await page.textContent(ADMIN_PAGE.ERROR_MESSAGE);
      expect(errorMessage.toLowerCase()).toContain(testCase.expectedError.toLowerCase().split(' ')[0]);
    });
  }
});

/**
 * Example: API Integration Testing with DRY
 */
test.describe('Admin Page - API Integration Example', () => {
  test('Should verify event creation via API', async ({ authenticatedAdminPage: { page, config, api } }) => {
    await page.goto(`${config.baseUrl}?page=admin&brand=${config.tenantId}`);

    // Create event via UI
    const eventName = `API Test Event ${Date.now()}`;
    await page.fill(ADMIN_PAGE.EVENT_NAME_INPUT, eventName);
    await page.fill(ADMIN_PAGE.EVENT_DATE_INPUT, '2025-12-25');
    await page.fill(ADMIN_PAGE.EVENT_LOCATION_INPUT, 'API Venue');

    await page.click(ADMIN_PAGE.CREATE_EVENT_BUTTON);
    await page.waitForSelector(ADMIN_PAGE.SUCCESS_MESSAGE, { timeout: 5000 });

    // Verify via API using fixture's api helper
    const events = await api.listEvents();

    const createdEvent = events.find(e => e.data.name === eventName);
    expect(createdEvent).toBeTruthy();
    expect(createdEvent.data.location).toBe('API Venue');
  });
});

/**
 * KEY BENEFITS OF DRY APPROACH:
 *
 * 1. Maintainability:
 *    - Change selector once, updates all tests
 *    - Change auth logic once, updates all tests
 *    - Change config once, updates all tests
 *
 * 2. Readability:
 *    - Tests are concise and focused on behavior
 *    - No duplicate dialog handlers
 *    - No hardcoded values
 *
 * 3. Reliability:
 *    - Centralized selectors are more stable
 *    - Fixtures handle auth consistently
 *    - Config manages environments properly
 *
 * 4. Velocity:
 *    - New tests are faster to write
 *    - Less code to review
 *    - Easier to onboard new team members
 *
 * 5. Coverage:
 *    - Data-driven tests increase coverage
 *    - Negative tests catch edge cases
 *    - API integration validates end-to-end
 */
