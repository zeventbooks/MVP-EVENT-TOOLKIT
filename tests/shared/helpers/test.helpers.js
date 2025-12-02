/**
 * Centralized Test Helpers
 *
 * DRY utilities shared across all test types
 * - Envelope validation
 * - Common assertions
 * - Test data factories
 */

// Import brand configuration from centralized source
const { BRANDS } = require('../../../config/brand-config');

/**
 * Validates API response envelope structure
 * Ensures all responses follow Ok/Err pattern
 *
 * @param {Object} response - API response object
 */
const validateEnvelope = (response) => {
  expect(response).toHaveProperty('ok');
  expect(typeof response.ok).toBe('boolean');

  if (response.ok) {
    // notModified responses don't have value property
    if (!response.notModified) {
      expect(response).toHaveProperty('value');
    }
  } else {
    expect(response).toHaveProperty('code');
    expect(response).toHaveProperty('message');
  }
};

/**
 * Validates success response envelope
 *
 * @param {Object} response - API response object
 */
const validateSuccessEnvelope = (response) => {
  validateEnvelope(response);
  expect(response.ok).toBe(true);
  if (!response.notModified) {
    expect(response).toHaveProperty('value');
  }
};

/**
 * Validates error response envelope
 *
 * @param {Object} response - API response object
 * @param {string} expectedCode - Expected error code
 */
const validateErrorEnvelope = (response, expectedCode = null) => {
  validateEnvelope(response);
  expect(response.ok).toBe(false);
  expect(response).toHaveProperty('code');
  expect(response).toHaveProperty('message');

  if (expectedCode) {
    expect(response.code).toBe(expectedCode);
  }
};

/**
 * Validates event object structure (legacy format)
 *
 * @param {Object} event - Event object
 */
const validateEventStructure = (event) => {
  expect(event).toHaveProperty('id');
  expect(event).toHaveProperty('brandId');
  expect(event).toHaveProperty('templateId');
  expect(event).toHaveProperty('data');
  expect(event).toHaveProperty('createdAt');
  expect(event).toHaveProperty('slug');
};

/**
 * Validates EVENT_CONTRACT.md v1.0 canonical event shape
 *
 * @param {Object} event - Event object in canonical format
 */
const validateEventContractV1 = (event) => {
  // Required envelope fields
  expect(event).toHaveProperty('id');
  expect(event).toHaveProperty('brandId');
  expect(event).toHaveProperty('templateId');
  expect(event).toHaveProperty('name');
  expect(event).toHaveProperty('status');
  expect(event).toHaveProperty('createdAt');
  expect(event).toHaveProperty('slug');
  expect(event).toHaveProperty('links');

  // Validate status is one of valid values
  expect(['draft', 'published', 'cancelled', 'completed']).toContain(event.status);

  // Validate links
  expect(event.links).toHaveProperty('publicUrl');
  expect(event.links).toHaveProperty('posterUrl');
  expect(event.links).toHaveProperty('displayUrl');
  expect(event.links).toHaveProperty('reportUrl');
};

/**
 * Validates SectionConfig format per EVENT_CONTRACT.md
 *
 * @param {Object} section - Section config object
 */
const validateSectionConfig = (section) => {
  expect(section).toHaveProperty('enabled');
  expect(section).toHaveProperty('title');
  expect(section).toHaveProperty('content');
  expect(typeof section.enabled).toBe('boolean');
};

/**
 * Validates CTALabel format per EVENT_CONTRACT.md
 *
 * @param {Object} cta - CTA label object
 */
const validateCTALabel = (cta) => {
  expect(cta).toHaveProperty('key');
  expect(cta).toHaveProperty('label');
  expect(cta).toHaveProperty('url');
  expect(typeof cta.key).toBe('string');
  expect(typeof cta.label).toBe('string');
};

/**
 * Validates Sponsor format (hydrated) per EVENT_CONTRACT.md
 *
 * @param {Object} sponsor - Sponsor object
 */
const validateSponsor = (sponsor) => {
  expect(sponsor).toHaveProperty('id');
  expect(sponsor).toHaveProperty('name');
  expect(typeof sponsor.id).toBe('string');
  expect(typeof sponsor.name).toBe('string');
};

/**
 * Validates event links
 *
 * @param {Object} links - Links object
 */
const validateEventLinks = (links) => {
  expect(links).toHaveProperty('publicUrl');
  expect(links).toHaveProperty('posterUrl');
  expect(links).toHaveProperty('displayUrl');

  // Validate all are valid URLs
  Object.values(links).forEach(url => {
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });
};

/**
 * Validates analytics structure
 *
 * @param {Object} analytics - Analytics object
 */
const validateAnalyticsStructure = (analytics) => {
  expect(analytics).toHaveProperty('totals');
  expect(analytics).toHaveProperty('bySurface');
  expect(analytics).toHaveProperty('bySponsor');
  expect(analytics).toHaveProperty('byToken');

  // Validate totals
  expect(analytics.totals).toHaveProperty('impressions');
  expect(analytics.totals).toHaveProperty('clicks');
  expect(analytics.totals).toHaveProperty('dwellSec');
};

/**
 * Error code constants (matching Code.gs)
 */
const ERROR_CODES = Object.freeze({
  BAD_INPUT: 'BAD_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  CONTRACT: 'CONTRACT'
});

/**
 * Validates all error codes are defined
 */
const validateErrorCodes = () => {
  const codes = Object.keys(ERROR_CODES);
  codes.forEach(code => {
    expect(ERROR_CODES[code]).toBe(code);
  });
};

/**
 * Creates a mock success response
 *
 * @param {*} value - Response value
 * @param {Object} options - Additional options (etag, notModified)
 */
const createMockSuccessResponse = (value, options = {}) => ({
  ok: true,
  value,
  ...options
});

/**
 * Creates a mock error response
 *
 * @param {string} code - Error code
 * @param {string} message - Error message
 */
const createMockErrorResponse = (code, message) => ({
  ok: false,
  code,
  message
});

/**
 * Sleep utility for async tests
 *
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 *
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} initialDelay - Initial delay in ms
 */
const retryWithBackoff = async (fn, maxAttempts = 3, initialDelay = 100) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/**
 * Generate unique test ID
 */
const generateTestId = () => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Date helpers
 */
const dateHelpers = {
  /**
   * Get ISO date string for N days from now
   */
  daysFromNow: (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  },

  /**
   * Get ISO date string for N days ago
   */
  daysAgo: (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  },

  /**
   * Get current ISO date string
   */
  today: () => {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Get tomorrow's ISO date string
   */
  tomorrow: () => {
    return dateHelpers.daysFromNow(1);
  },

  /**
   * Get yesterday's ISO date string
   */
  yesterday: () => {
    return dateHelpers.daysAgo(1);
  }
};

/**
 * Multi-brand test helpers
 *
 * BRANDS is imported from config/brand-config.js (single source of truth)
 */
const brandHelpers = {
  /**
   * Valid brand IDs from centralized config
   * @see config/brand-config.js
   */
  BRANDS,

  /**
   * Get a random brand ID
   */
  randomBrand: () => {
    return BRANDS[Math.floor(Math.random() * BRANDS.length)];
  },

  /**
   * Get a different brand ID (for cross-brand tests)
   */
  differentBrand: (currentBrand) => {
    const others = BRANDS.filter(t => t !== currentBrand);
    return others[Math.floor(Math.random() * others.length)];
  },

  /**
   * Get brand configuration (spreadsheetId, adminKey, etc.)
   * Delegates to brand-config.js for full per-brand support
   */
  getBrandConfig: (brandId) => {
    try {
      const { getBrandConfig } = require('../config/brand-config');
      return getBrandConfig(brandId);
    } catch {
      // Fallback if brand-config not available
      return {
        brandId: brandId || 'root',
        spreadsheetId: process.env.SPREADSHEET_ID || '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ',
        adminKey: process.env.ADMIN_KEY || null,
        baseUrl: process.env.BASE_URL || 'https://eventangle.com',
        hasAdminKey: !!process.env.ADMIN_KEY,
        hasDedicatedSpreadsheet: false,
        isConfigured: !!process.env.ADMIN_KEY
      };
    }
  },

  /**
   * Get configured brands (those with admin keys)
   */
  getConfiguredBrands: () => {
    try {
      const { getConfiguredBrands } = require('../config/brand-config');
      return getConfiguredBrands();
    } catch {
      return process.env.ADMIN_KEY ? ['root'] : [];
    }
  },

  /**
   * Create test matrix for parameterized brand tests
   * Usage: describe.each(brandHelpers.createTestMatrix())('Brand: %s', (brandId, config) => { ... })
   */
  createTestMatrix: (options = {}) => {
    try {
      const { createBrandTestMatrix } = require('../config/brand-config');
      return createBrandTestMatrix(options);
    } catch {
      // Fallback: just root brand
      return [['root', brandHelpers.getBrandConfig('root')]];
    }
  }
};

module.exports = {
  // Envelope validation
  validateEnvelope,
  validateSuccessEnvelope,
  validateErrorEnvelope,

  // Structure validation (legacy)
  validateEventStructure,
  validateEventLinks,
  validateAnalyticsStructure,

  // EVENT_CONTRACT.md v1.0 validation
  validateEventContractV1,
  validateSectionConfig,
  validateCTALabel,
  validateSponsor,

  // Error codes
  ERROR_CODES,
  validateErrorCodes,

  // Mock responses
  createMockSuccessResponse,
  createMockErrorResponse,

  // Async utilities
  sleep,
  retryWithBackoff,

  // ID generation
  generateTestId,

  // Date helpers
  dateHelpers,

  // Brand helpers
  brandHelpers
};
