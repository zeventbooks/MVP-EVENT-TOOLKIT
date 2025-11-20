const { defineConfig, devices } = require('@playwright/test');
const { getCurrentEnvironment } = require('./tests/config/environments');

// Get the current environment configuration
const env = getCurrentEnvironment();

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', {
      outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || 'playwright-report',
      open: 'never',  // Don't auto-open in CI
    }],
    ['json', { outputFile: '.test-results/playwright-results.json' }],
    ['junit', { outputFile: '.test-results/junit.xml' }],  // For GitHub Actions test result integration
    ['list']
  ],

  use: {
    // Use environment-aware base URL
    // Defaults to Hostinger, can be overridden with BASE_URL or TEST_ENV
    baseURL: env.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'text/html,application/json',
    },

    // Bypass bot detection with realistic user agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',

    // Ignore HTTPS errors for QA/staging environments
    ignoreHTTPSErrors: true,
  },

  // Global setup - print environment info before tests
  globalSetup: require.resolve('./tests/config/global-setup.js'),

  projects: [
    // COST-OPTIMIZED: Only essential devices to minimize CI/CD costs
    // Mobile: Safari iPhone 14 Pro only (represents latest iOS/Safari)
    {
      name: 'iPhone 14 Pro',
      use: { ...devices['iPhone 14 Pro'] },
    },
    // Desktop: Chromium only (most common browser, Chrome/Edge base)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Full device matrix for local/manual testing only
  // Uncomment these when running comprehensive device testing locally
  // NOTE: Running all 11 devices in CI/CD is expensive!
  //
  // projects: [
  //   // MOBILE-FIRST: Test mobile devices FIRST (priority)
  //   {
  //     name: 'iPhone 14',
  //     use: { ...devices['iPhone 14'] },
  //   },
  //   {
  //     name: 'iPhone 14 Pro',
  //     use: { ...devices['iPhone 14 Pro'] },
  //   },
  //   {
  //     name: 'Pixel 7',
  //     use: { ...devices['Pixel 7'] },
  //   },
  //   {
  //     name: 'Samsung Galaxy S21',
  //     use: { ...devices['Galaxy S21'] },
  //   },
  //   {
  //     name: 'iPad Pro',
  //     use: { ...devices['iPad Pro'] },
  //   },
  //   {
  //     name: 'Mobile 3G (Slow Network)',
  //     use: {
  //       ...devices['Pixel 5'],
  //       launchOptions: {
  //         // Throttle to simulate 3G
  //         slowMo: 100,
  //       },
  //     },
  //   },
  //   // DESKTOP: Test desktop browsers (secondary)
  //   {
  //     name: 'chromium',
  //     use: { ...devices['Desktop Chrome'] },
  //   },
  //   {
  //     name: 'firefox',
  //     use: { ...devices['Desktop Firefox'] },
  //   },
  //   {
  //     name: 'webkit',
  //     use: { ...devices['Desktop Safari'] },
  //   },
  //   // DISPLAY: TV/Large Screen Testing
  //   {
  //     name: 'TV Display (1080p)',
  //     use: {
  //       ...devices['Desktop Chrome'],
  //       viewport: { width: 1920, height: 1080 },
  //     },
  //   },
  //   {
  //     name: 'TV Display (4K)',
  //     use: {
  //       ...devices['Desktop Chrome'],
  //       viewport: { width: 3840, height: 2160 },
  //     },
  //   },
  // ],

  // No webServer needed - we test deployed URLs directly (Google Apps Script or Hostinger)
});
