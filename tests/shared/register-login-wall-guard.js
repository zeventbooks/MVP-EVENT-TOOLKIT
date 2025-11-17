const playwright = require('@playwright/test');
const { isGoogleLoginWall, LOGIN_WALL_SKIP_MESSAGE } = require('./environment-guards');

if (!playwright.__loginWallGuardInstalled) {
  const baseTest = playwright.test;

  const attachLoginWallWatcher = page => {
    if (!page || page.__loginWallGuarded) {
      return;
    }

    const originalGoto = page.goto.bind(page);
    page.goto = async (...args) => {
      const response = await originalGoto(...args);

      if (await isGoogleLoginWall(page)) {
        baseTest.skip(true, LOGIN_WALL_SKIP_MESSAGE);
      }

      return response;
    };

    page.__loginWallGuarded = true;
  };

  playwright.test = baseTest.extend({
    context: async ({ context }, use) => {
      const originalNewPage = context.newPage.bind(context);
      context.newPage = async (...args) => {
        const newPage = await originalNewPage(...args);
        attachLoginWallWatcher(newPage);
        return newPage;
      };

      context.on('page', attachLoginWallWatcher);
      await use(context);
    },
    page: async ({ page }, use) => {
      attachLoginWallWatcher(page);
      await use(page);
    },
  });

  playwright.__loginWallGuardInstalled = true;
}
