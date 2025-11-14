/**
 * Global Test Configuration
 *
 * Shared configuration for all test types across Triangle phases
 */

// Environment
const ENV = process.env.NODE_ENV || 'test';
const IS_CI = process.env.CI === 'true';

// ============================================================================
// BASE_URL VALIDATION
// ============================================================================

/**
 * Validates and returns BASE_URL with proper error handling
 * @returns {string} Valid BASE_URL
 * @throws {Error} If BASE_URL is not set or invalid
 */
function getValidatedBaseUrl() {
  const url = process.env.BASE_URL;

  // If BASE_URL not set, provide clear error message
  if (!url || url.trim() === '') {
    throw new Error(
      '❌ BASE_URL environment variable is not set!\n\n' +
      'To run tests, you must set BASE_URL:\n' +
      '  export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"\n\n' +
      'Or run with:\n' +
      '  BASE_URL="..." npm run test:api\n\n' +
      'In CI/CD, ensure BASE_URL is set in the workflow environment.'
    );
  }

  // Validate URL format
  try {
    new URL(url); // Will throw if invalid
  } catch (error) {
    throw new Error(
      `❌ BASE_URL is not a valid URL: "${url}"\n\n` +
      'BASE_URL must be a complete URL, for example:\n' +
      '  https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec\n'
    );
  }

  // Check for placeholder values
  const placeholders = ['...', 'YOUR_SCRIPT_ID', 'CHANGE_ME', 'localhost:3000'];
  for (const placeholder of placeholders) {
    if (url.includes(placeholder)) {
      console.warn(
        `⚠️  WARNING: BASE_URL appears to contain placeholder "${placeholder}"\n` +
        `   Current BASE_URL: ${url}\n` +
        `   Tests may fail if this is not a real deployment URL.\n`
      );
      // Don't throw - might be intentional for local dev
      break;
    }
  }

  return url;
}

// Base URLs - with validation
const BASE_URL = getValidatedBaseUrl();
const TENANT_ID = process.env.TENANT_ID || 'root';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';

// Environment-specific URLs (optional overrides)
const DEV_URL = process.env.DEV_URL || BASE_URL;
const STAGING_URL = process.env.STAGING_URL || BASE_URL;
const PROD_URL = process.env.PROD_URL || BASE_URL;

// Multi-tenant admin keys (for multi-tenant testing)
const TENANT_ADMIN_KEYS = {
  root: process.env.ROOT_ADMIN_KEY || process.env.ADMIN_KEY || 'CHANGE_ME_root',
  abc: process.env.ABC_ADMIN_KEY || 'CHANGE_ME_abc',
  cbc: process.env.CBC_ADMIN_KEY || 'CHANGE_ME_cbc',
  cbl: process.env.CBL_ADMIN_KEY || 'CHANGE_ME_cbl',
};

// Test configuration
const TEST_CONFIG = {
  // Timeouts
  timeouts: {
    short: 5000,      // 5 seconds - quick operations
    medium: 30000,    // 30 seconds - API calls
    long: 60000,      // 60 seconds - complex operations
    veryLong: 120000  // 2 minutes - full E2E flows
  },

  // Retries
  retries: {
    api: IS_CI ? 3 : 1,
    ui: IS_CI ? 2 : 0,
    maxBackoffMs: 16000 // 16 seconds max backoff
  },

  // Performance thresholds
  performance: {
    apiResponseTime: 2000,    // 2 seconds
    pageLoadTime: 5000,       // 5 seconds
    timeToFirstByte: 1000,    // 1 second
    domContentLoaded: 3000    // 3 seconds
  },

  // Browser configuration
  browser: {
    headless: IS_CI,
    slowMo: IS_CI ? 0 : 50,
    devtools: !IS_CI,
    viewport: {
      width: 1920,
      height: 1080
    }
  },

  // Device viewports
  devices: {
    mobile: { width: 375, height: 667, name: 'iPhone SE' },
    mobileL: { width: 414, height: 896, name: 'iPhone 12 Pro' },
    tablet: { width: 768, height: 1024, name: 'iPad' },
    desktop: { width: 1920, height: 1080, name: 'Desktop HD' },
    tv: { width: 1920, height: 1080, name: 'TV 1080p' },
    '4k': { width: 3840, height: 2160, name: 'TV 4K' }
  },

  // API configuration
  api: {
    baseUrl: BASE_URL,
    timeout: 30000,
    retries: IS_CI ? 3 : 1,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },

  // Test data
  testData: {
    tenantId: TENANT_ID,
    adminKey: ADMIN_KEY,
    defaultEventDate: '2025-12-31',
    defaultLocation: 'Test Venue'
  },

  // Triangle phase colors (for reporting)
  trianglePhases: {
    before: {
      name: 'Before Event',
      emoji: '📋',
      color: '#10b981',
      description: 'Pre-Event Preparation'
    },
    during: {
      name: 'During Event',
      emoji: '▶️',
      color: '#f59e0b',
      description: 'Live Execution'
    },
    after: {
      name: 'After Event',
      emoji: '📊',
      color: '#8b5cf6',
      description: 'Post-Event Analytics'
    },
    all: {
      name: 'All Phases',
      emoji: '⚡',
      color: '#3b82f6',
      description: 'Always Available'
    }
  },

  // Screenshots
  screenshots: {
    enabled: true,
    path: 'test-results/screenshots',
    onFailureOnly: IS_CI
  },

  // Video recording
  video: {
    enabled: IS_CI,
    path: 'test-results/videos',
    onFailureOnly: true
  },

  // Reporting
  reporting: {
    htmlReport: true,
    jsonReport: true,
    junitReport: IS_CI,
    path: 'test-results'
  }
};

// Export configuration
module.exports = {
  ENV,
  IS_CI,
  BASE_URL,
  TENANT_ID,
  ADMIN_KEY,
  DEV_URL,
  STAGING_URL,
  PROD_URL,
  TENANT_ADMIN_KEYS,
  TEST_CONFIG
};
