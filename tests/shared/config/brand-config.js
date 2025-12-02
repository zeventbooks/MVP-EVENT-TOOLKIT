/**
 * Per-Brand Test Configuration
 *
 * Provides brand-specific configuration for tests, mirroring the
 * per-brand spreadsheet support in src/mvp/Config.gs
 *
 * Environment Variables:
 *   SPREADSHEET_ID       - Shared spreadsheet for all brands (fallback)
 *   SPREADSHEET_ID_ROOT  - Dedicated spreadsheet for root brand
 *   SPREADSHEET_ID_ABC   - Dedicated spreadsheet for ABC brand
 *   SPREADSHEET_ID_CBC   - Dedicated spreadsheet for CBC brand
 *   SPREADSHEET_ID_CBL   - Dedicated spreadsheet for CBL brand
 *
 *   ADMIN_KEY            - Shared admin key for all brands (fallback)
 *   ADMIN_KEY_ROOT       - Dedicated admin key for root brand
 *   ADMIN_KEY_ABC        - Dedicated admin key for ABC brand
 *   ADMIN_KEY_CBC        - Dedicated admin key for CBC brand
 *   ADMIN_KEY_CBL        - Dedicated admin key for CBL brand
 *
 * Priority: Brand-specific > Shared > Default
 */

const { getEnvironment, BRANDS: ENV_BRANDS } = require('../../../config/environments');

// Default spreadsheet ID (matches Config.gs DEFAULT_SPREADSHEET_ID)
const DEFAULT_SPREADSHEET_ID = '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ';

// All valid brand IDs
const BRANDS = Object.freeze(['root', 'abc', 'cbc', 'cbl']);

/**
 * Get configuration for a specific brand
 *
 * @param {string} brandId - Brand ID (root, abc, cbc, cbl)
 * @returns {Object} Brand configuration
 */
function getBrandConfig(brandId) {
  if (!brandId || !BRANDS.includes(brandId)) {
    brandId = 'root';
  }

  const upperBrand = brandId.toUpperCase();

  // Get spreadsheet ID with priority: brand-specific > shared > default
  const spreadsheetId =
    process.env[`SPREADSHEET_ID_${upperBrand}`] ||
    process.env.SPREADSHEET_ID ||
    DEFAULT_SPREADSHEET_ID;

  // Get admin key with priority: brand-specific > shared
  const adminKey =
    process.env[`ADMIN_KEY_${upperBrand}`] ||
    process.env.ADMIN_KEY ||
    null;

  // Get base URL from environment config (canonical source)
  let baseUrl;
  try {
    const env = getEnvironment();
    baseUrl = env?.baseUrl || process.env.BASE_URL || 'https://www.eventangle.com';
  } catch {
    baseUrl = process.env.BASE_URL || 'https://www.eventangle.com';
  }

  return {
    brandId,
    spreadsheetId,
    adminKey,
    baseUrl,
    hasAdminKey: !!adminKey,
    hasDedicatedSpreadsheet: !!process.env[`SPREADSHEET_ID_${upperBrand}`],
    isConfigured: !!adminKey && !!spreadsheetId
  };
}

/**
 * Get configurations for all brands
 *
 * @returns {Object} Map of brand ID to configuration
 */
function getAllBrandConfigs() {
  const configs = {};
  BRANDS.forEach(brandId => {
    configs[brandId] = getBrandConfig(brandId);
  });
  return configs;
}

/**
 * Get list of brands that are fully configured (have admin key)
 *
 * @returns {string[]} Array of configured brand IDs
 */
function getConfiguredBrands() {
  return BRANDS.filter(brandId => getBrandConfig(brandId).hasAdminKey);
}

/**
 * Get list of brands with dedicated spreadsheets
 *
 * @returns {string[]} Array of brand IDs with dedicated spreadsheets
 */
function getBrandsWithDedicatedSpreadsheets() {
  return BRANDS.filter(brandId => getBrandConfig(brandId).hasDedicatedSpreadsheet);
}

/**
 * Check if a brand is configured for testing
 *
 * @param {string} brandId - Brand ID to check
 * @returns {boolean} True if brand has admin key configured
 */
function isBrandConfigured(brandId) {
  return getBrandConfig(brandId).hasAdminKey;
}

/**
 * Run a test function for each brand
 * Useful for parameterized testing across all brands
 *
 * @param {Function} testFn - Test function(brandConfig) to run
 * @param {Object} options - Options
 * @param {boolean} options.onlyConfigured - Only run for brands with admin keys
 * @param {string[]} options.brands - Specific brands to run for
 */
function forEachBrand(testFn, options = {}) {
  const { onlyConfigured = false, brands = null } = options;

  let brandsToTest = brands || BRANDS;

  if (onlyConfigured) {
    brandsToTest = brandsToTest.filter(brandId =>
      getBrandConfig(brandId).hasAdminKey
    );
  }

  return brandsToTest.map(brandId => ({
    brandId,
    config: getBrandConfig(brandId),
    run: () => testFn(getBrandConfig(brandId))
  }));
}

/**
 * Create test matrix for Jest describe.each or it.each
 *
 * @param {Object} options - Options
 * @param {boolean} options.onlyConfigured - Only include configured brands
 * @returns {Array} Array of [brandId, config] tuples for .each()
 */
function createBrandTestMatrix(options = {}) {
  const { onlyConfigured = false } = options;

  let brandsToTest = [...BRANDS];

  if (onlyConfigured) {
    brandsToTest = brandsToTest.filter(brandId =>
      getBrandConfig(brandId).hasAdminKey
    );
  }

  return brandsToTest.map(brandId => [brandId, getBrandConfig(brandId)]);
}

/**
 * Print brand configuration summary (for debugging)
 */
function printBrandConfigSummary() {
  console.log('\n=== Brand Test Configuration ===\n');

  console.log('Environment:');
  console.log(`  BASE_URL: ${process.env.BASE_URL || '(not set)'}`);
  console.log(`  SPREADSHEET_ID (shared): ${process.env.SPREADSHEET_ID || '(not set)'}`);
  console.log(`  ADMIN_KEY (shared): ${process.env.ADMIN_KEY ? '****' : '(not set)'}`);
  console.log('');

  console.log('Per-Brand Configuration:');
  BRANDS.forEach(brandId => {
    const config = getBrandConfig(brandId);
    const spreadsheetStatus = config.hasDedicatedSpreadsheet ? 'dedicated' : 'shared';
    const adminStatus = config.hasAdminKey ? '****' : '(not set)';
    console.log(`  ${brandId.toUpperCase()}:`);
    console.log(`    Spreadsheet: ${config.spreadsheetId.substring(0, 20)}... (${spreadsheetStatus})`);
    console.log(`    Admin Key: ${adminStatus}`);
  });

  console.log('');
  console.log(`Configured brands: ${getConfiguredBrands().join(', ') || 'none'}`);
  console.log(`Brands with dedicated spreadsheets: ${getBrandsWithDedicatedSpreadsheets().join(', ') || 'none'}`);
  console.log('\n=== End Configuration ===\n');
}

module.exports = {
  // Constants
  BRANDS,
  DEFAULT_SPREADSHEET_ID,

  // Configuration getters
  getBrandConfig,
  getAllBrandConfigs,
  getConfiguredBrands,
  getBrandsWithDedicatedSpreadsheets,
  isBrandConfigured,

  // Test utilities
  forEachBrand,
  createBrandTestMatrix,

  // Debug
  printBrandConfigSummary
};
