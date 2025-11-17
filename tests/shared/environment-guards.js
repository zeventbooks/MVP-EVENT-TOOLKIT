/**
 * Environment-level helpers to keep Playwright scenarios resilient when the
 * target deployment isn't anonymously accessible (e.g. Apps Script set to
 * "Only myself"). These guards let tests explain why they're skipped instead
 * of failing with opaque Google login redirects.
 */

const GOOGLE_LOGIN_TITLE = /sign in - google accounts/i;
const GOOGLE_LOGIN_CONTINUE_TEXT = /to continue to script\.google\.com/i;
const GOOGLE_LOGIN_URL = /accounts\.google\.com/i;
const GOOGLE_LOGIN_IDENTIFIER = 'input#identifierId, input[name="identifier"], input[type="email"]';
const GOOGLE_LOGIN_NEXT_BUTTON = 'button:has-text("Next"), div[role="button"]:has-text("Next")';

const LOGIN_WALL_SKIP_MESSAGE =
  'Deployment requires Google authentication. Publish the Apps Script as "Anyone" or point BASE_URL to an anonymous deployment before running scenario tests.';

/**
 * Detects whether the current page is the Google login wall that appears when a
 * Script web app hasn't been deployed with anonymous access.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isGoogleLoginWall(page) {
  try {
    // Give the browser a moment to follow cross-domain redirects that occur
    // when the Apps Script deployment is private.
    await Promise.race([
      page.waitForURL(GOOGLE_LOGIN_URL, { timeout: 2500 }),
      page.waitForLoadState('domcontentloaded', { timeout: 2500 }),
      page.waitForTimeout(1500),
    ]).catch(() => {});

    const url = page.url();
    if (GOOGLE_LOGIN_URL.test(url)) {
      return true;
    }

    const title = await page.title().catch(() => '');
    if (GOOGLE_LOGIN_TITLE.test(title)) {
      return true;
    }

    // Best-effort attempt to read the body text – this will succeed because the
    // login wall is still first-party content.
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (GOOGLE_LOGIN_CONTINUE_TEXT.test(bodyText)) {
      return true;
    }

    const identifierVisible = await page.locator(GOOGLE_LOGIN_IDENTIFIER).first().isVisible().catch(() => false);
    const nextButtonVisible = await page.locator(GOOGLE_LOGIN_NEXT_BUTTON).first().isVisible().catch(() => false);
    if (identifierVisible && nextButtonVisible) {
      return true;
    }
  } catch (error) {
    // Swallow errors and assume no login wall so tests keep running; the
    // original navigation failure will still surface if there is a real issue.
  }
  return false;
}

module.exports = {
  isGoogleLoginWall,
  LOGIN_WALL_SKIP_MESSAGE,
};

