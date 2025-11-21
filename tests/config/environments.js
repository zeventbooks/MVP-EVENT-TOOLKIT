/**
 * Test Environment Configuration
 *
 * Supports testing against multiple deployment targets:
 * - Cloudflare/zeventbooks.com (production) - DEFAULT for testing
 * - Google Apps Script (direct)
 * - Local development
 *
 * Environment Variables:
 * - APP_URL: Application URL for Playwright browser tests (default: zeventbooks.com)
 * - BASE_URL: API base URL (defaults to APP_URL if not set)
 * - TEST_ENV: Environment name override (production, staging, googleAppsScript)
 */

// Default production URL (Cloudflare Workers / custom domain)
const DEFAULT_APP_URL = 'https://zeventbooks.com';

// Apps Script deployment ID (for direct testing if needed)
const DEFAULT_DEPLOYMENT_ID = 'AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw';

// Resolve APP_URL with fallback chain
const APP_URL = process.env.APP_URL || process.env.BASE_URL || DEFAULT_APP_URL;

const ENVIRONMENTS = {
  // Cloudflare / zeventbooks.com - Production (DEFAULT)
  production: {
    name: 'Production',
    baseUrl: APP_URL,
    description: 'Production via Cloudflare Workers (zeventbooks.com)',
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

  // Hostinger - QA domain
  qaHostinger: {
    name: 'QA Hostinger',
    baseUrl: process.env.QA_HOSTINGER_URL || 'https://zeventbooks.com',
    description: 'Hostinger custom domain (QA) - Currently pointing to zeventbooks.com',
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

    // Check for QA environments first (more specific)
    if (hostname === 'qa.zeventbooks.com') {
      return {
        ...ENVIRONMENTS.qaHostinger,
        baseUrl: baseUrl // Use actual BASE_URL
      };
    }

    if (hostname === 'zeventbooks.com' || hostname === 'www.zeventbooks.com') {
      return {
        ...ENVIRONMENTS.hostinger,
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
      brands: ENVIRONMENTS.hostinger.brands
    };
  } catch (error) {
    // If URL parsing fails, return custom environment
    console.warn(`⚠️  Invalid BASE_URL format: ${baseUrl}`);
    return {
      name: 'Custom',
      baseUrl: baseUrl,
      description: 'Custom environment (invalid URL)',
      brands: ENVIRONMENTS.hostinger.brands
    };
  }
}

/**
 * Get brand-specific URLs for testing
 * @param {string} brand - Brand ID
 * @param {string} page - Page name (admin, status, display, etc.)
 */
function getBrandUrl(brand = 'root', page = 'status') {
  const env = getCurrentEnvironment();
  return `${env.baseUrl}?page=${page}&brand=${brand}`;
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

module.exports = {
  ENVIRONMENTS,
  getCurrentEnvironment,
  getBrandUrl,
  getAllBrandUrls,
  printEnvironmentInfo
};
