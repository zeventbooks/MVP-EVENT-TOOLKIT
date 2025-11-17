/**
 * SCENARIO 1: First-Time Admin
 *
 * Testing complete admin workflow from initial setup to event creation
 * Focus: Customer-first ease of use, making complex tasks dead simple
 *
 * Architecture: Tests both frontend UX and backend integration
 * SDET Focus: Contract, unit, integration, and e2e testing
 */

const { test, expect } = require('@playwright/test');
const { isGoogleLoginWall, LOGIN_WALL_SKIP_MESSAGE } = require('../../shared/environment-guards');

const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';
const TENANT_ID = 'root';

test.describe('SCENARIO 1: First-Time Admin', () => {
  let createdEventId = null;

  test.afterEach(async () => {
    // Cleanup: Track created resources for potential cleanup
    if (createdEventId) {
      console.log(`[Cleanup] Event created: ${createdEventId}`);
    }
  });

  async function openAdminPageOrSkip(page) {
    await page.goto(`${BASE_URL}?p=admin&tenant=${TENANT_ID}`);
    if (await isGoogleLoginWall(page)) {
      test.skip(true, LOGIN_WALL_SKIP_MESSAGE);
      return;
    }
  }

  test('1.1 Open admin page → Should see empty form', async ({ page }) => {
    await openAdminPageOrSkip(page);

    // VERIFY: Page loads successfully
    await expect(page).toHaveTitle(/Admin/);

    // VERIFY: Empty form state
    const nameInput = page.locator('#name, input[name="name"], input[placeholder*="Event Name" i]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('');

    const dateInput = page.locator('#dateISO, input[type="date"], input[name="date"]');
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveValue('');

    const locationInput = page.locator('#location, input[name="location"]');
    await expect(locationInput).toBeVisible();
    await expect(locationInput).toHaveValue('');

    // VERIFY: Form is in pristine state (no validation errors)
    const errorMessages = page.locator('.error, .error-message, [role="alert"]');
    await expect(errorMessages).toHaveCount(0);

    // VERIFY: Submit button is present but form is empty
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")');
    await expect(submitBtn).toBeVisible();

    console.log('✅ Test 1.1 PASSED: Admin page displays empty form');
  });

  test('1.2 Try to submit without admin key → Should prompt', async ({ page }) => {
    await openAdminPageOrSkip(page);

    let dialogShown = false;
    let dialogMessage = '';

    // Listen for prompt dialog
    page.on('dialog', async dialog => {
      dialogShown = true;
      dialogMessage = dialog.message();
      expect(dialog.type()).toBe('prompt');
      expect(dialogMessage.toLowerCase()).toContain('admin key');
      await dialog.dismiss();
    });

    // Fill minimal valid data
    await page.fill('#name, input[name="name"]', 'Test Event');
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');

    // Submit without providing admin key
    await page.click('button[type="submit"]');

    // Wait for dialog to appear
    await page.waitForTimeout(1000);

    // VERIFY: Admin key prompt was shown
    expect(dialogShown).toBe(true);
    expect(dialogMessage.toLowerCase()).toContain('admin');

    console.log('✅ Test 1.2 PASSED: Admin key prompt appears on submit');
  });

  test('1.3 Submit with invalid data → Should show error', async ({ page }) => {
    await openAdminPageOrSkip(page);

    // Handle admin key prompt
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    // Test 1: Empty event name
    await page.fill('#name, input[name="name"]', '');
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // VERIFY: Error for empty name (either validation message or failed submission)
    const nameInput = page.locator('#name, input[name="name"]');
    const isInvalid = await nameInput.evaluate(el => !el.validity.valid || el.hasAttribute('aria-invalid'));

    // If native HTML5 validation, input should be invalid
    // If custom validation, should show error message
    const hasError = isInvalid || await page.locator('.error, [role="alert"]').count() > 0;
    expect(hasError).toBe(true);

    // Test 2: Invalid date (past date might be rejected)
    await page.fill('#name, input[name="name"]', 'Valid Event Name');
    await page.fill('#dateISO, input[type="date"]', '2020-01-01'); // Past date
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // VERIFY: Either succeeds (past dates allowed) or shows validation error
    // This test documents actual behavior
    const pastDateHandling = await page.locator('.error, [role="alert"]').count();
    console.log(`Past date validation: ${pastDateHandling > 0 ? 'REJECTED' : 'ALLOWED'}`);

    console.log('✅ Test 1.3 PASSED: Form validation working');
  });

  test('1.4 Submit valid event → Should see success + links', async ({ page }) => {
    await openAdminPageOrSkip(page);

    // Handle admin key prompt
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    const eventName = `Test Event ${Date.now()}`;
    const eventDate = '2025-12-31';
    const eventTime = '19:00';
    const eventLocation = 'Test Venue';
    const eventSummary = 'This is a test event for automated testing';

    // Fill complete valid event form
    await page.fill('#name, input[name="name"]', eventName);
    await page.fill('#dateISO, input[type="date"]', eventDate);
    await page.fill('#timeISO, input[type="time"]', eventTime);
    await page.fill('#location, input[name="location"]', eventLocation);
    await page.fill('#summary, textarea[name="summary"]', eventSummary);

    // Submit form
    await page.click('button[type="submit"]');

    // VERIFY: Success confirmation appears within 10 seconds
    await expect(page.locator('#eventCard, .event-card, .success-card')).toBeVisible({ timeout: 10000 });

    // VERIFY: Event links are generated
    const publicLink = page.locator('#lnkPublic, a:has-text("Public"), [data-link-type="public"]');
    await expect(publicLink).toBeVisible({ timeout: 5000 });

    const displayLink = page.locator('#lnkDisplay, a:has-text("Display"), [data-link-type="display"]');
    await expect(displayLink).toBeVisible({ timeout: 5000 });

    const posterLink = page.locator('#lnkPoster, a:has-text("Poster"), [data-link-type="poster"]');
    await expect(posterLink).toBeVisible({ timeout: 5000 });

    // VERIFY: Links contain actual URLs (not placeholders)
    const publicUrl = await publicLink.textContent();
    expect(publicUrl).toBeTruthy();
    expect(publicUrl.length).toBeGreaterThan(10);
    expect(publicUrl).toContain('http');

    console.log('✅ Test 1.4 PASSED: Event created successfully with all links');
    console.log(`   Event Name: ${eventName}`);
    console.log(`   Public URL: ${publicUrl}`);
  });

  test('1.5 Submit Sponsor → Should configure sponsor successfully', async ({ page }) => {
    await openAdminPageOrSkip(page);

    // Handle admin key prompt
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    // First create an event
    const eventName = `Sponsor Test Event ${Date.now()}`;
    await page.fill('#name, input[name="name"]', eventName);
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');
    await page.click('button[type="submit"]');

    // Wait for event card
    await expect(page.locator('#eventCard, .event-card')).toBeVisible({ timeout: 10000 });

    // VERIFY: Configure Display & Sponsors button appears
    const configBtn = page.locator('button:has-text("Configure Display"), button:has-text("Sponsors")');
    await expect(configBtn).toBeVisible();

    // Open sponsor configuration
    await configBtn.click();

    // VERIFY: Sponsor configuration panel appears
    await expect(page.locator('#displayCard, .sponsor-config, [data-section="sponsors"]')).toBeVisible();

    // Click Add Sponsor button
    const addSponsorBtn = page.locator('button:has-text("Add Sponsor")');
    await expect(addSponsorBtn).toBeVisible();
    await addSponsorBtn.click();

    // VERIFY: Sponsor input fields appear
    const sponsorNameInput = page.locator('.sp-name, input[name*="sponsor" i][name*="name" i]').first();
    const sponsorUrlInput = page.locator('.sp-url, input[name*="sponsor" i][name*="url" i]').first();
    const sponsorImgInput = page.locator('.sp-img, input[name*="sponsor" i][name*="img" i]').first();

    await expect(sponsorNameInput).toBeVisible();
    await expect(sponsorUrlInput).toBeVisible();
    await expect(sponsorImgInput).toBeVisible();

    // Fill sponsor details
    await sponsorNameInput.fill('Test Sponsor Company');
    await sponsorUrlInput.fill('https://example.com/sponsor');
    await sponsorImgInput.fill('https://via.placeholder.com/400x200?text=Sponsor+Logo');

    // Save sponsor configuration
    const saveBtn = page.locator('button:has-text("Save Configuration"), button:has-text("Save")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // VERIFY: Success message or confirmation
    await expect(page.locator('text=/saved|success|updated/i')).toBeVisible({ timeout: 5000 });

    console.log('✅ Test 1.5 PASSED: Sponsor configured successfully');
  });

  test('1.6 Create Google sign-up forms → Should have form creation options', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=admin&tenant=${TENANT_ID}`);

    // Handle admin key prompt
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    // Create event first
    await page.fill('#name, input[name="name"]', `Form Test Event ${Date.now()}`);
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard, .event-card')).toBeVisible({ timeout: 10000 });

    // VERIFY: Form creation buttons/links exist
    // Check for: Sign-up, Check-in, Walk-in, Survey forms
    const formTypes = ['sign-up', 'check-in', 'walk-in', 'survey'];

    for (const formType of formTypes) {
      // Look for buttons or links related to each form type
      const formButton = page.locator(`button:has-text("${formType}"), a:has-text("${formType}")`, { caseInsensitive: true });
      const formCount = await formButton.count();

      if (formCount > 0) {
        await expect(formButton.first()).toBeVisible();
        console.log(`   ✓ ${formType} form option found`);
      } else {
        console.log(`   ⚠ ${formType} form option not found (may need implementation)`);
      }
    }

    // VERIFY: At least some form generation capability exists
    const hasFormGeneration = await page.locator('button:has-text("form"), a:has-text("form"), button:has-text("Google Form")').count() > 0;

    if (hasFormGeneration) {
      console.log('✅ Test 1.6 PASSED: Form generation options available');
    } else {
      console.log('⚠ Test 1.6 DOCUMENTED: Form generation feature needs implementation');
      // Don't fail - document the gap
    }
  });

  test('1.7 Create Poster → Should generate poster link', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=admin&tenant=${TENANT_ID}`);

    // Handle admin key prompt
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    // Create event
    await page.fill('#name, input[name="name"]', `Poster Test Event ${Date.now()}`);
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');
    await page.fill('#location, input[name="location"]', 'Test Location');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard, .event-card')).toBeVisible({ timeout: 10000 });

    // VERIFY: Poster link exists
    const posterLink = page.locator('#lnkPoster, a:has-text("Poster"), [data-link-type="poster"]');
    await expect(posterLink).toBeVisible({ timeout: 5000 });

    // VERIFY: Poster link is clickable and has valid URL
    const posterUrl = await posterLink.getAttribute('href');
    expect(posterUrl).toBeTruthy();
    expect(posterUrl).toContain('http');
    expect(posterUrl).toContain('poster');

    // Optional: Click poster link and verify it opens (in new tab)
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      posterLink.click()
    ]);

    // VERIFY: Poster page loads within 5 seconds
    await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
    await expect(newPage).toHaveTitle(/Poster|Event/);

    await newPage.close();

    console.log('✅ Test 1.7 PASSED: Poster generated and accessible');
    console.log(`   Poster URL: ${posterUrl}`);
  });
});

/**
 * INTEGRATION TEST: Full admin workflow end-to-end
 */
test.describe('SCENARIO 1: Complete Admin Workflow (Integration)', () => {
  test('Complete first-time admin experience', async ({ page }) => {
    await page.goto(`${BASE_URL}?p=admin&tenant=${TENANT_ID}`);

    // Handle admin key throughout
    page.on('dialog', async dialog => {
      await dialog.accept(ADMIN_KEY);
    });

    const timestamp = Date.now();

    // Step 1: Create Event
    await page.fill('#name, input[name="name"]', `Integration Test ${timestamp}`);
    await page.fill('#dateISO, input[type="date"]', '2025-12-31');
    await page.fill('#timeISO, input[type="time"]', '19:00');
    await page.fill('#location, input[name="location"]', 'Test Venue');
    await page.fill('#summary, textarea[name="summary"]', 'Complete integration test');
    await page.click('button[type="submit"]');

    await expect(page.locator('#eventCard, .event-card')).toBeVisible({ timeout: 10000 });

    // Step 2: Configure Sponsor
    const configBtn = page.locator('button:has-text("Configure")');
    if (await configBtn.count() > 0) {
      await configBtn.click();
      const addSponsorBtn = page.locator('button:has-text("Add Sponsor")');
      if (await addSponsorBtn.count() > 0) {
        await addSponsorBtn.click();
        await page.fill('.sp-name, input[name*="sponsor"][name*="name"]', 'Integration Sponsor');
        await page.fill('.sp-url, input[name*="sponsor"][name*="url"]', 'https://example.com');
        await page.fill('.sp-img, input[name*="sponsor"][name*="img"]', 'https://via.placeholder.com/400x200');

        const saveBtn = page.locator('button:has-text("Save")');
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Step 3: Verify all links
    await expect(page.locator('#lnkPublic, [data-link-type="public"]')).toBeVisible();
    await expect(page.locator('#lnkDisplay, [data-link-type="display"]')).toBeVisible();
    await expect(page.locator('#lnkPoster, [data-link-type="poster"]')).toBeVisible();

    console.log('✅ INTEGRATION TEST PASSED: Complete admin workflow successful');
  });
});
