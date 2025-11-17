/**
 * Environment-level helpers to keep Playwright scenarios resilient when the
 * target deployment isn't anonymously accessible (e.g. Apps Script set to
 * "Only myself"). These guards let tests explain why they're skipped instead
 * of failing with opaque Google login redirects.
 */

const GOOGLE_LOGIN_TITLE = /sign in - google accounts/i;
const GOOGLE_LOGIN_CONTINUE_TEXT = /to continue to script\.google\.com/i;
const GOOGLE_LOGIN_URL = /accounts\.google\.com/i;

/**
 * Detects whether the current page is the Google login wall that appears when a
 * Script web app hasn't been deployed with anonymous access.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isGoogleLoginWall(page) {
  try {
    const url = page.url();
    if (GOOGLE_LOGIN_URL.test(url)) {
      return true;
    }

    const title = await page.title();
    if (GOOGLE_LOGIN_TITLE.test(title)) {
      return true;
    }

    // Best-effort attempt to read the body text – this will succeed because the
    // login wall is still first-party content.
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (GOOGLE_LOGIN_CONTINUE_TEXT.test(bodyText)) {
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
};

