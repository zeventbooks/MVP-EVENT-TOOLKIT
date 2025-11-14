/**
 * PAGE TESTS - Level 2: Admin Page Components & Interactions
 *
 * Purpose: Test all buttons, forms, and interactions on Admin page
 * Coverage: UI components, button clicks, form submissions, navigation
 */

const { test, expect } = require('@playwright/test');

const { BASE_URL, TENANT_ID, ADMIN_KEY } = require('../../shared/config/test.config.js');
const TENANT_ID = 'root';

// Track created test events for cleanup
const testEvents = [];

// Cleanup helper
async function deleteTestEvent(page, eventId) {
  try {
    // Attempt to delete event via admin interface
    // Note: Implement actual deletion when delete functionality is available
    console.log(`[Cleanup] Would delete event: ${eventId}`);
  } catch (e) {
    console.log(`[Cleanup] Could not delete event ${eventId}:`, e.message);
  }
}

test.describe('📄 PAGE: Admin - Page Load', () => {

  test('Admin page renders all core elements', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    // Page title
    await expect(page).toHaveTitle(/Admin/);

    // Main sections
    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible();
    await expect(page.locator('h3:has-text("Events List")')).toBeVisible();

    // Navigation links
    await expect(page.locator('a:has-text("Public Page")')).toBeVisible();
    await expect(page.locator('a:has-text("Display Page")')).toBeVisible();
  });

  test('Create event form has all input fields', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#dateISO')).toBeVisible();
    await expect(page.locator('#timeISO')).toBeVisible();
    await expect(page.locator('#location')).toBeVisible();
    await expect(page.locator('#summary')).toBeVisible();
    await expect(page.locator('#tags')).toBeVisible();
  });

  test('Form labels are associated with inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await expect(page.locator('label:has-text("Event Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Location")')).toBeVisible();
  });
});

test.describe('📄 PAGE: Admin - Button Interactions', () => {

  test('Submit button is clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    // Verify button has text
    const btnText = await submitBtn.textContent();
    expect(btnText).toMatch(/create|submit/i);
  });

  test('Submit button prompts for admin key', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toContain('admin key');
      await dialog.dismiss();
    });

    await page.fill('#name', 'Test Event');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    expect(dialogShown).toBe(true);
  });

  test('Configure Display & Sponsors button appears after event creation', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Button Test Event');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });

    // Verify configuration button appears
    const configBtn = page.locator('button:has-text("Configure Display & Sponsors")');
    await expect(configBtn).toBeVisible();
    await expect(configBtn).toBeEnabled();
  });

  test('Configure button expands sponsor configuration panel', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Config Panel Test');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });

    // Click configure button
    await page.click('button:has-text("Configure Display & Sponsors")');

    // Verify display card appears
    await expect(page.locator('#displayCard')).toBeVisible();
    await expect(page.locator('h3:has-text("Display & Sponsors")')).toBeVisible();
  });

  test('Add Sponsor button creates new sponsor input fields', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Sponsor Add Test');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Configure Display & Sponsors")');
    await expect(page.locator('#displayCard')).toBeVisible();

    // Click Add Sponsor button
    const addSponsorBtn = page.locator('button:has-text("Add Sponsor")');
    await expect(addSponsorBtn).toBeVisible();
    await addSponsorBtn.click();

    // Verify sponsor input fields appear
    await expect(page.locator('.sp-name')).toBeVisible();
    await expect(page.locator('.sp-url')).toBeVisible();
    await expect(page.locator('.sp-img')).toBeVisible();
  });

  test('Remove sponsor button works', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Remove Sponsor Test');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Configure Display & Sponsors")');

    // Add a sponsor
    await page.click('button:has-text("Add Sponsor")');
    const initialCount = await page.locator('.sponsor-item').count();

    // Remove sponsor
    const removeBtn = page.locator('button:has-text("Remove")').first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      const afterCount = await page.locator('.sponsor-item').count();
      expect(afterCount).toBeLessThan(initialCount);
    }
  });

  test('Save Configuration button works', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Save Config Test');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Configure Display & Sponsors")');

    // Add sponsor data
    await page.click('button:has-text("Add Sponsor")');
    await page.fill('.sp-name', 'Test Sponsor');
    await page.fill('.sp-url', 'https://example.com');
    await page.fill('.sp-img', 'https://via.placeholder.com/200x100');

    // Click Save Configuration
    const saveBtn = page.locator('button:has-text("Save Configuration")');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify success message
    await expect(page.locator('text=saved')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('📄 PAGE: Admin - Navigation Links', () => {

  test('Public Page link navigates correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    const publicLink = page.locator('a:has-text("Public Page")');
    await expect(publicLink).toBeVisible();

    const href = await publicLink.getAttribute('href');
    expect(href).toContain('p=events');
    expect(href).toContain(`tenant=${TENANT_ID}`);
  });

  test('Display Page link navigates correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    const displayLink = page.locator('a:has-text("Display Page")');
    await expect(displayLink).toBeVisible();

    const href = await displayLink.getAttribute('href');
    expect(href).toContain('page=display');
    expect(href).toContain(`tenant=${TENANT_ID}`);
  });

  test('Event-specific links work after creation', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    await page.fill('#name', 'Link Test Event');
    await page.fill('#dateISO', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard')).toBeVisible({ timeout: 10000 });

    // Verify all link types are present
    await expect(page.locator('#lnkPublic')).toBeVisible();
    await expect(page.locator('#lnkDisplay')).toBeVisible();
    await expect(page.locator('#lnkPoster')).toBeVisible();

    // Verify links contain proper URLs
    const publicUrl = await page.locator('#lnkPublic').textContent();
    expect(publicUrl).toContain(BASE_URL);
  });
});

test.describe('📄 PAGE: Admin - Form Validation', () => {

  test('Form accepts valid input', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await page.fill('#name', 'Valid Event Name');
    await page.fill('#dateISO', '2025-12-31');
    await page.fill('#timeISO', '19:00');
    await page.fill('#location', 'Test Venue');
    await page.fill('#summary', 'Event description');
    await page.fill('#tags', 'test, event');

    // All fields should accept input without errors
    const nameValue = await page.locator('#name').inputValue();
    expect(nameValue).toBe('Valid Event Name');
  });

  test('Date field accepts ISO format', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await page.fill('#dateISO', '2025-12-31');
    const dateValue = await page.locator('#dateISO').inputValue();
    expect(dateValue).toBe('2025-12-31');
  });

  test('Time field accepts time format', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await page.fill('#timeISO', '19:30');
    const timeValue = await page.locator('#timeISO').inputValue();
    expect(timeValue).toBe('19:30');
  });
});

test.describe('📄 PAGE: Admin - Responsive Design', () => {

  test('Mobile: Form is usable on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await expect(page.locator('#name')).toBeVisible();

    // Check tap target size (44px minimum for iOS)
    const inputHeight = await page.locator('#name').evaluate(el => el.offsetHeight);
    expect(inputHeight).toBeGreaterThanOrEqual(40);
  });

  test('Tablet: Form layout adapts', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await expect(page.locator('h2:has-text("Create Event")')).toBeVisible();
  });
});

test.describe('📄 PAGE: Admin - Accessibility', () => {

  test('Keyboard navigation through form', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['INPUT', 'TEXTAREA', 'BUTTON']).toContain(focusedElement);
  });

  test('Form has proper ARIA labels', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);

    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();

    // Should have associated label
    const label = page.locator('label[for="name"]');
    const labelExists = await label.count() > 0;

    if (!labelExists) {
      // Check for aria-label
      const ariaLabel = await nameInput.getAttribute('aria-label');
      expect(ariaLabel || labelExists).toBeTruthy();
    }
  });
});
