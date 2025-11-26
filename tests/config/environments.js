/**
 * Test Environment Configuration
 *
 * BASE_URL-Aware Test Configuration
 * =================================
 * Tests can run against different environments without code changes:
 *
 * Production (eventangle.com):
 *   BASE_URL="https://www.eventangle.com" npm run test:smoke
 *
 * GAS Webapp (direct):
 *   BASE_URL="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec" npm run test:smoke
 *
 * Default (no BASE_URL set):
 *   Uses eventangle.com (production via Cloudflare Workers)
 *
 * Environment Variables:
 *   - BASE_URL: Primary URL override (recommended)
 *   - APP_URL: Alias for BASE_URL (deprecated, use BASE_URL)
 *   - TEST_ENV: Environment name (production, googleAppsScript, qa, staging, local)
 *   - GOOGLE_SCRIPT_URL: Direct GAS URL override
 */

// Priority: BASE_URL > APP_URL > default
const APP_URL = process.env.BASE_URL || process.env.APP_URL || 'https://eventangle.com';

// Apps Script deployment ID (for direct testing bypass)
const DEFAULT_DEPLOYMENT_ID = 'AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw';

const ENVIRONMENTS = {
  // Cloudflare / eventangle.com - Production (DEFAULT)
  production: {
    name: 'Production',
    baseUrl: APP_URL,
    description: 'Production via Cloudflare Workers (eventangle.com)',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // API subdomain (Cloudflare)
  api: {
    name: 'API',
    baseUrl: process.env.API_URL || 'https://api.zeventbooks.com',
    description: 'API subdomain via Cloudflare Workers',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Google Apps Script - Direct access (for debugging)
  googleAppsScript: {
    name: 'Google Apps Script',
    baseUrl: process.env.GOOGLE_SCRIPT_URL || `https://script.google.com/macros/s/${DEFAULT_DEPLOYMENT_ID}/exec`,
    description: 'Direct Google Apps Script (bypass proxy)',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Staging environment
  staging: {
    name: 'Staging',
    baseUrl: process.env.STAGING_URL || 'https://staging.zeventbooks.com',
    description: 'Staging environment via Cloudflare Workers',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // QA environment (zeventbooks.com via Cloudflare)
  qa: {
    name: 'QA',
    baseUrl: process.env.QA_URL || 'https://zeventbooks.com',
    description: 'QA environment via Cloudflare Workers (zeventbooks.com)',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Local development
  local: {
    name: 'Local Development',
    baseUrl: process.env.LOCAL_URL || 'http://localhost:3000',
    description: 'Local development server',
    brands: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  }
};

/**
 * Get the current environment based on BASE_URL or ENV variables
 */
function getCurrentEnvironment() {
  const baseUrl = process.env.BASE_URL;
  const envName = process.env.TEST_ENV;

  // If TEST_ENV is explicitly set, use that
  if (envName && ENVIRONMENTS[envName]) {
    const env = { ...ENVIRONMENTS[envName] };
    // Override with BASE_URL if provided
    if (baseUrl) {
      env.baseUrl = baseUrl;
    }
    return env;
  }

  // Auto-detect based on BASE_URL
  if (!baseUrl) {
    // Default to production (zeventbooks.com via Cloudflare)
    return { ...ENVIRONMENTS.production };
  }

  // Parse URL securely to prevent substring injection attacks
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;

    // Check for production domain (eventangle.com)
    if (hostname === 'eventangle.com' || hostname === 'www.eventangle.com') {
      return {
        ...ENVIRONMENTS.production,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    // Check for QA environments (zeventbooks.com via Cloudflare)
    if (hostname === 'qa.zeventbooks.com') {
      return {
        ...ENVIRONMENTS.qa,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    if (hostname === 'zeventbooks.com' || hostname === 'www.zeventbooks.com') {
      return {
        ...ENVIRONMENTS.qa,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    if (hostname === 'script.google.com') {
      // Try to detect if it's QA based on deployment ID (if provided via env)
      if (process.env.IS_QA === 'true' || envName === 'qaAppsScript') {
        return {
          ...ENVIRONMENTS.qaAppsScript,
          baseUrl: baseUrl
        };
      }
      return {
        ...ENVIRONMENTS.googleAppsScript,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return {
        ...ENVIRONMENTS.local,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    // Unknown environment - use BASE_URL as-is
    return {
      name: 'Custom',
      baseUrl: baseUrl,
      description: 'Custom environment',
      brands: ENVIRONMENTS.production.brands
    };
  } catch (error) {
    // If URL parsing fails, return custom environment
    console.warn(`⚠️  Invalid BASE_URL format: ${baseUrl}`);
    return {
      name: 'Custom',
      baseUrl: baseUrl,
      description: 'Custom environment (invalid URL)',
      brands: ENVIRONMENTS.production.brands
    };
  }
}

/**
 * Get brand-specific URLs for testing using friendly URL patterns
 * @param {string} brand - Brand ID
 * @param {string} page - Page name (status, manage, events, display, etc.)
 */
function getBrandUrl(brand = 'root', page = 'status') {
  const env = getCurrentEnvironment();
  // Map page names to friendly URL aliases
  const pageAliasMap = {
    'admin': 'manage',
    'public': 'events',
    // Other pages use their name directly
  };
  const alias = pageAliasMap[page] || page;
  // Friendly URL pattern: /{alias} for root, /{brand}/{alias} for others
  const path = brand === 'root' ? `/${alias}` : `/${brand}/${alias}`;
  return `${env.baseUrl}${path}`;
}

/**
 * Get all brand URLs for a specific page
 * @param {string} page - Page name
 */
function getAllBrandUrls(page = 'status') {
  const env = getCurrentEnvironment();
  const urls = {};

  Object.keys(env.brands).forEach(brand => {
    urls[brand] = getBrandUrl(brand, page);
  });

  return urls;
}

/**
 * Print environment configuration (for debugging)
 */
function printEnvironmentInfo() {
  const env = getCurrentEnvironment();
  console.log('\n==============================================');
  console.log('🌍 Test Environment Configuration');
  console.log('==============================================');
  console.log(`Environment: ${env.name}`);
  console.log(`Description: ${env.description}`);
  console.log(`Base URL: ${env.baseUrl}`);
  console.log('\nBrand URLs (status page):');
  Object.keys(env.brands).forEach(brand => {
    console.log(`  ${brand}: ${getBrandUrl(brand, 'status')}`);
  });
  console.log('\nBrand URLs (admin page):');
  Object.keys(env.brands).forEach(brand => {
    console.log(`  ${brand}: ${getBrandUrl(brand, 'admin')}`);
  });
  console.log('==============================================\n');
}

/**
 * Get the base URL for tests
 * This is the single source of truth - all tests should use this
 * @returns {string} The base URL
 */
function getBaseUrl() {
  return getCurrentEnvironment().baseUrl;
}

/**
 * Check if the current environment is Google Apps Script
 * @returns {boolean} True if testing against GAS directly
 */
function isGoogleAppsScript() {
  const env = getCurrentEnvironment();
  try {
    const url = new URL(env.baseUrl);
    return url.hostname === 'script.google.com';
  } catch {
    return false;
  }
}

/**
 * Check if the current environment is eventangle.com (production)
 * @returns {boolean} True if testing against eventangle.com
 */
function isEventangle() {
  const env = getCurrentEnvironment();
  try {
    const url = new URL(env.baseUrl);
    return url.hostname === 'eventangle.com' || url.hostname === 'www.eventangle.com';
  } catch {
    return false;
  }
}

/**
 * Get URL with query parameters for the current environment
 * Handles different URL patterns for GAS vs Cloudflare
 * @param {object} params - Query parameters
 * @returns {string} Full URL with parameters
 */
function getUrlWithParams(params = {}) {
  const baseUrl = getBaseUrl();
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

module.exports = {
  ENVIRONMENTS,
  getCurrentEnvironment,
  getBrandUrl,
  getAllBrandUrls,
  printEnvironmentInfo,
  // New exports for centralized BASE_URL access
  getBaseUrl,
  isGoogleAppsScript,
  isEventangle,
  getUrlWithParams,
  // Expose the resolved APP_URL for backward compatibility
  APP_URL
};
