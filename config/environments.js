/**
 * Environment Configuration - Single Source of Truth
 *
 * This module defines the canonical environment URLs and brand defaults for
 * dev, staging, and production environments. All Node tests, Playwright tests,
 * and contract tests should import from this module.
 *
 * Environment Priority:
 *   1. Environment variables (BASE_URL, TEST_ENV)
 *   2. Default values defined here
 *
 * Usage:
 *   const { getBaseUrl, getEnvironment, ENVIRONMENTS } = require('../config/environments');
 *   const BASE_URL = getBaseUrl(); // Returns current environment URL
 *
 * @module config/environments
 */

// =============================================================================
// Deployment IDs (sync with cloudflare-proxy/wrangler.toml)
// =============================================================================

/**
 * Production Google Apps Script deployment ID
 * Update this when creating new GAS deployments
 */
const PRODUCTION_DEPLOYMENT_ID = 'AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ';

/**
 * Staging Google Apps Script deployment ID
 * Set via STAGING_DEPLOYMENT_ID env var or use placeholder
 */
const STAGING_DEPLOYMENT_ID = process.env.STAGING_DEPLOYMENT_ID || 'STAGING_DEPLOYMENT_ID_PLACEHOLDER';

// =============================================================================
// Environment URLs - Single Source of Truth
// =============================================================================

/**
 * Production URL - eventangle.com via Cloudflare Workers
 * This is the customer-facing production environment.
 */
const PRODUCTION_URL = 'https://www.eventangle.com';

/**
 * Staging URL - stg.eventangle.com via Cloudflare Workers
 * DEFAULT for all test commands. Safe sandbox for testing.
 */
const STAGING_URL = 'https://stg.eventangle.com';

/**
 * QA URL - zeventbooks.com via Cloudflare Workers
 * Secondary testing environment.
 */
const QA_URL = 'https://zeventbooks.com';

/**
 * Local development URL
 */
const LOCAL_URL = 'http://localhost:3000';

/**
 * Direct Google Apps Script URL (for debugging)
 */
const GAS_PRODUCTION_URL = `https://script.google.com/macros/s/${PRODUCTION_DEPLOYMENT_ID}/exec`;
const GAS_STAGING_URL = `https://script.google.com/macros/s/${STAGING_DEPLOYMENT_ID}/exec`;

// =============================================================================
// Brand Configuration
// =============================================================================

/**
 * All valid brand IDs
 * Must match BRANDS array in src/mvp/Config.gs
 */
const BRANDS = Object.freeze(['root', 'abc', 'cbc', 'cbl']);

/**
 * Default brand for testing
 */
const DEFAULT_BRAND = 'root';

// =============================================================================
// Environment Definitions
// =============================================================================

/**
 * Environment configuration map
 * Each environment includes its base URL, description, and available brands.
 */
const ENVIRONMENTS = Object.freeze({
  /**
   * Production - Customer-facing via Cloudflare
   * URL: https://www.eventangle.com
   * Deploy: CI only (git push to main)
   */
  production: {
    name: 'Production',
    baseUrl: PRODUCTION_URL,
    description: 'Production via Cloudflare Workers (eventangle.com)',
    gasUrl: GAS_PRODUCTION_URL,
    deploymentId: PRODUCTION_DEPLOYMENT_ID,
    brands: BRANDS,
    isDefault: false
  },

  /**
   * Staging - Safe sandbox for testing (DEFAULT)
   * URL: https://stg.eventangle.com
   * Deploy: npm run deploy:staging
   */
  staging: {
    name: 'Staging',
    baseUrl: STAGING_URL,
    description: 'Staging via Cloudflare Workers (stg.eventangle.com)',
    gasUrl: GAS_STAGING_URL,
    deploymentId: STAGING_DEPLOYMENT_ID,
    brands: BRANDS,
    isDefault: true
  },

  /**
   * QA - Secondary testing environment
   * URL: https://zeventbooks.com
   */
  qa: {
    name: 'QA',
    baseUrl: QA_URL,
    description: 'QA environment via Cloudflare Workers (zeventbooks.com)',
    brands: BRANDS,
    isDefault: false
  },

  /**
   * Local - Development server
   * URL: http://localhost:3000
   */
  local: {
    name: 'Local Development',
    baseUrl: LOCAL_URL,
    description: 'Local development server',
    brands: BRANDS,
    isDefault: false
  },

  /**
   * Google Apps Script - Direct access (debugging)
   * URL: https://script.google.com/macros/s/{ID}/exec
   */
  googleAppsScript: {
    name: 'Google Apps Script (Direct)',
    baseUrl: GAS_PRODUCTION_URL,
    description: 'Direct Google Apps Script (bypasses Cloudflare proxy)',
    deploymentId: PRODUCTION_DEPLOYMENT_ID,
    brands: BRANDS,
    isDefault: false
  }
});

// =============================================================================
// Environment Detection & Helpers
// =============================================================================

/**
 * Get the default environment (staging for safety)
 * @returns {Object} Default environment configuration
 */
function getDefaultEnvironment() {
  return process.env.USE_PRODUCTION === 'true'
    ? { ...ENVIRONMENTS.production }
    : { ...ENVIRONMENTS.staging };
}

/**
 * Detect environment from a URL
 * @param {string} url - URL to analyze
 * @returns {Object|null} Matching environment or null
 */
function detectEnvironmentFromUrl(url) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (hostname === 'stg.eventangle.com' || hostname === 'api-stg.eventangle.com') {
      return { ...ENVIRONMENTS.staging, baseUrl: url };
    }

    if (hostname === 'eventangle.com' || hostname === 'www.eventangle.com') {
      return { ...ENVIRONMENTS.production, baseUrl: url };
    }

    if (hostname === 'zeventbooks.com' || hostname === 'www.zeventbooks.com' || hostname === 'qa.zeventbooks.com') {
      return { ...ENVIRONMENTS.qa, baseUrl: url };
    }

    if (hostname === 'script.google.com') {
      return { ...ENVIRONMENTS.googleAppsScript, baseUrl: url };
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { ...ENVIRONMENTS.local, baseUrl: url };
    }

    // Unknown URL - create custom environment
    return {
      name: 'Custom',
      baseUrl: url,
      description: 'Custom environment',
      brands: BRANDS,
      isDefault: false
    };
  } catch (error) {
    console.warn(`Invalid URL format: ${url}`);
    return null;
  }
}

/**
 * Get the current environment based on environment variables
 *
 * Priority:
 *   1. TEST_ENV explicitly set -> use that environment
 *   2. BASE_URL set -> detect environment from URL
 *   3. USE_PRODUCTION=true -> production
 *   4. Default -> staging (safe sandbox)
 *
 * @returns {Object} Current environment configuration
 */
function getEnvironment() {
  const testEnv = process.env.TEST_ENV;
  const baseUrl = process.env.BASE_URL || process.env.APP_URL;

  // If TEST_ENV is explicitly set, use that environment
  if (testEnv && ENVIRONMENTS[testEnv]) {
    const env = { ...ENVIRONMENTS[testEnv] };
    // Override with BASE_URL if provided
    if (baseUrl) {
      env.baseUrl = baseUrl;
    }
    return env;
  }

  // If BASE_URL is set, detect environment from it
  if (baseUrl) {
    const detected = detectEnvironmentFromUrl(baseUrl);
    if (detected) {
      return detected;
    }
  }

  // Default to staging (safe sandbox) or production if explicitly requested
  return getDefaultEnvironment();
}

/**
 * Get the base URL for the current environment
 * This is the primary function tests should use.
 *
 * @returns {string} Base URL for API requests
 */
function getBaseUrl() {
  return getEnvironment().baseUrl;
}

/**
 * Get URL for a specific brand and page using friendly URL patterns
 *
 * @param {string} brand - Brand ID (root, abc, cbc, cbl)
 * @param {string} page - Page name (status, manage, events, display, etc.)
 * @returns {string} Full URL for the brand/page
 */
function getBrandUrl(brand = 'root', page = 'status') {
  const env = getEnvironment();
  const pageAliasMap = {
    'admin': 'manage',
    'public': 'events'
  };
  const alias = pageAliasMap[page] || page;
  const path = brand === 'root' ? `/${alias}` : `/${brand}/${alias}`;
  return `${env.baseUrl}${path}`;
}

/**
 * Get all brand URLs for a specific page
 *
 * @param {string} page - Page name
 * @returns {Object} Map of brand ID to URL
 */
function getAllBrandUrls(page = 'status') {
  const urls = {};
  BRANDS.forEach(brand => {
    urls[brand] = getBrandUrl(brand, page);
  });
  return urls;
}

/**
 * Check if current environment is Google Apps Script (direct)
 * @returns {boolean} True if testing against GAS directly
 */
function isGoogleAppsScript() {
  const env = getEnvironment();
  try {
    const url = new URL(env.baseUrl);
    return url.hostname === 'script.google.com';
  } catch {
    return false;
  }
}

/**
 * Check if current environment is production (eventangle.com)
 * @returns {boolean} True if testing against production
 */
function isProduction() {
  const env = getEnvironment();
  try {
    const url = new URL(env.baseUrl);
    return url.hostname === 'eventangle.com' || url.hostname === 'www.eventangle.com';
  } catch {
    return false;
  }
}

/**
 * Check if current environment is staging
 * @returns {boolean} True if testing against staging
 */
function isStaging() {
  const env = getEnvironment();
  try {
    const url = new URL(env.baseUrl);
    return url.hostname === 'stg.eventangle.com';
  } catch {
    return false;
  }
}

/**
 * Build URL with query parameters
 *
 * @param {Object} params - Query parameters
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

/**
 * Print environment configuration (for debugging/CI logs)
 */
function printEnvironmentInfo() {
  const env = getEnvironment();
  console.log('\n==============================================');
  console.log('Environment Configuration');
  console.log('==============================================');
  console.log(`Environment: ${env.name}`);
  console.log(`Description: ${env.description}`);
  console.log(`Base URL: ${env.baseUrl}`);
  console.log(`Is Default: ${env.isDefault}`);
  console.log(`Brands: ${env.brands.join(', ')}`);
  console.log('\nBrand URLs (status page):');
  BRANDS.forEach(brand => {
    console.log(`  ${brand}: ${getBrandUrl(brand, 'status')}`);
  });
  console.log('==============================================\n');
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  // Environment map
  ENVIRONMENTS,

  // Brand constants
  BRANDS,
  DEFAULT_BRAND,

  // URL constants
  PRODUCTION_URL,
  STAGING_URL,
  QA_URL,
  LOCAL_URL,
  GAS_PRODUCTION_URL,
  GAS_STAGING_URL,

  // Deployment IDs
  PRODUCTION_DEPLOYMENT_ID,
  STAGING_DEPLOYMENT_ID,

  // Primary functions for tests
  getEnvironment,
  getBaseUrl,
  getBrandUrl,
  getAllBrandUrls,
  getUrlWithParams,

  // Environment detection helpers
  isGoogleAppsScript,
  isProduction,
  isStaging,
  detectEnvironmentFromUrl,

  // Debugging
  printEnvironmentInfo,

  // Legacy aliases (for backward compatibility with test code)
  getCurrentEnvironment: getEnvironment,
  APP_URL: getBaseUrl(),
  DEFAULT_GAS_URL: GAS_PRODUCTION_URL,
  DEFAULT_DEPLOYMENT_ID: PRODUCTION_DEPLOYMENT_ID,
  DEFAULT_PRODUCTION_URL: PRODUCTION_URL,
  DEFAULT_STAGING_URL: STAGING_URL,
  CANONICAL_EVENTS_URL: `${PRODUCTION_URL}/events`,
  CANONICAL_STAGING_URL: `${STAGING_URL}/events`,
  isEventangle: isProduction
};
