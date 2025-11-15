/**
 * Test Environment Configuration
 *
 * Supports testing against multiple deployment targets:
 * - Google Apps Script (production)
 * - Hostinger (proxy/CDN)
 * - Local development
 */

const ENVIRONMENTS = {
  // Google Apps Script - Production deployment
  googleAppsScript: {
    name: 'Google Apps Script',
    baseUrl: process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    description: 'Direct Google Apps Script deployment (Production)',
    tenants: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Google Apps Script - QA deployment
  qaAppsScript: {
    name: 'QA Apps Script',
    baseUrl: process.env.QA_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_QA_SCRIPT_ID/exec',
    description: 'Direct Google Apps Script deployment (QA)',
    tenants: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Hostinger - Production domain
  hostinger: {
    name: 'Hostinger',
    baseUrl: process.env.HOSTINGER_URL || 'https://zeventbooks.com',
    description: 'Hostinger custom domain (Production)',
    tenants: {
      root: 'root',
      abc: 'abc',
      cbc: 'cbc',
      cbl: 'cbl'
    }
  },

  // Hostinger - QA domain
  qaHostinger: {
    name: 'QA Hostinger',
    baseUrl: process.env.QA_HOSTINGER_URL || 'https://qa.zeventbooks.com',
    description: 'Hostinger custom domain (QA)',
    tenants: {
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
    tenants: {
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
    return { ...ENVIRONMENTS.hostinger }; // Default to Hostinger
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
      tenants: ENVIRONMENTS.hostinger.tenants
    };
  } catch (error) {
    // If URL parsing fails, return custom environment
    console.warn(`⚠️  Invalid BASE_URL format: ${baseUrl}`);
    return {
      name: 'Custom',
      baseUrl: baseUrl,
      description: 'Custom environment (invalid URL)',
      tenants: ENVIRONMENTS.hostinger.tenants
    };
  }
}

/**
 * Get tenant-specific URLs for testing
 * @param {string} tenant - Tenant ID
 * @param {string} page - Page name (admin, status, display, etc.)
 */
function getTenantUrl(tenant = 'root', page = 'status') {
  const env = getCurrentEnvironment();
  return `${env.baseUrl}?p=${page}&tenant=${tenant}`;
}

/**
 * Get all tenant URLs for a specific page
 * @param {string} page - Page name
 */
function getAllTenantUrls(page = 'status') {
  const env = getCurrentEnvironment();
  const urls = {};

  Object.keys(env.tenants).forEach(tenant => {
    urls[tenant] = getTenantUrl(tenant, page);
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
  console.log('\nTenant URLs (status page):');
  Object.keys(env.tenants).forEach(tenant => {
    console.log(`  ${tenant}: ${getTenantUrl(tenant, 'status')}`);
  });
  console.log('\nTenant URLs (admin page):');
  Object.keys(env.tenants).forEach(tenant => {
    console.log(`  ${tenant}: ${getTenantUrl(tenant, 'admin')}`);
  });
  console.log('==============================================\n');
}

module.exports = {
  ENVIRONMENTS,
  getCurrentEnvironment,
  getTenantUrl,
  getAllTenantUrls,
  printEnvironmentInfo
};
