/**
 * TestRunner - Backend Function Validation Utility
 *
 * Provides a structured way to validate backend (GAS) functions
 * with contract verification, test matrices, and comprehensive reporting.
 *
 * Usage:
 *   const runner = new TestRunner({ baseUrl, adminKey, brandId });
 *   const results = await runner.runTestMatrix(testMatrix);
 *   runner.printReport();
 */

const {
  validateEnvelope,
  validateSuccessEnvelope,
  validateErrorEnvelope,
  ERROR_CODES,
  dateHelpers,
  generateTestId
} = require('./test.helpers.js');

/**
 * Test case definition for matrix testing
 * @typedef {Object} TestCase
 * @property {string} name - Test case name
 * @property {string} description - What this test validates
 * @property {Object} input - Input payload for the API
 * @property {Object} expected - Expected outcome
 * @property {boolean} expected.ok - Expected success/failure
 * @property {string} [expected.code] - Expected error code (if ok=false)
 * @property {Function} [expected.validator] - Custom validator function
 * @property {string[]} [expected.requiredFields] - Fields that must exist in value
 * @property {string} [tags] - Tags for filtering (e.g., 'smoke', 'regression')
 */

/**
 * Test matrix definition
 * @typedef {Object} TestMatrix
 * @property {string} endpoint - API endpoint/action name
 * @property {string} description - What this endpoint does
 * @property {TestCase[]} cases - Array of test cases
 */

/**
 * Test result
 * @typedef {Object} TestResult
 * @property {string} name - Test case name
 * @property {string} endpoint - API endpoint tested
 * @property {boolean} passed - Whether test passed
 * @property {number} duration - Duration in ms
 * @property {string} [error] - Error message if failed
 * @property {Object} [response] - Actual API response
 * @property {Object} [expected] - Expected outcome
 */

class TestRunner {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {string} [config.adminKey] - Admin key for authenticated requests
   * @param {string} [config.brandId='root'] - Default brand ID
   * @param {boolean} [config.verbose=false] - Log detailed output
   * @param {Function} [config.requestFn] - Custom request function (for Playwright)
   */
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.adminKey = config.adminKey;
    this.brandId = config.brandId || 'root';
    this.verbose = config.verbose || false;
    this.requestFn = config.requestFn;
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Make an API request
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} - API response
   */
  async request(payload) {
    if (this.requestFn) {
      // Use provided request function (Playwright)
      const response = await this.requestFn.post(this.baseUrl, {
        data: payload
      });
      return response.json();
    }

    // Default fetch implementation
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  /**
   * Run a single test case
   * @param {string} endpoint - API endpoint
   * @param {TestCase} testCase - Test case definition
   * @returns {Promise<TestResult>}
   */
  async runTestCase(endpoint, testCase) {
    const startTime = Date.now();
    const result = {
      name: testCase.name,
      endpoint,
      passed: false,
      duration: 0,
      error: null,
      response: null,
      expected: testCase.expected
    };

    try {
      // Build request payload
      const payload = {
        action: endpoint,
        brandId: testCase.input.brandId || this.brandId,
        ...testCase.input
      };

      // Add admin key if needed
      if (testCase.input.adminKey === undefined && this.adminKey) {
        payload.adminKey = this.adminKey;
      }

      if (this.verbose) {
        console.log(`  Running: ${testCase.name}`);
        console.log(`    Input:`, JSON.stringify(payload, null, 2));
      }

      // Make request
      const response = await this.request(payload);
      result.response = response;

      // Validate envelope structure
      validateEnvelope(response);

      // Check expected outcome
      if (testCase.expected.ok !== undefined) {
        if (response.ok !== testCase.expected.ok) {
          throw new Error(
            `Expected ok=${testCase.expected.ok}, got ok=${response.ok}. ` +
            `Response: ${JSON.stringify(response)}`
          );
        }
      }

      // Check error code
      if (!response.ok && testCase.expected.code) {
        if (response.code !== testCase.expected.code) {
          throw new Error(
            `Expected code=${testCase.expected.code}, got code=${response.code}`
          );
        }
      }

      // Check required fields
      if (response.ok && testCase.expected.requiredFields) {
        for (const field of testCase.expected.requiredFields) {
          if (!this._hasNestedProperty(response.value, field)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }

      // Run custom validator
      if (testCase.expected.validator) {
        const validationResult = testCase.expected.validator(response);
        if (validationResult !== true && validationResult !== undefined) {
          throw new Error(validationResult || 'Custom validation failed');
        }
      }

      result.passed = true;

    } catch (error) {
      result.error = error.message;
      result.passed = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Check if object has nested property (e.g., 'value.event.id')
   */
  _hasNestedProperty(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, part)) {
        return false;
      }
      current = current[part];
    }
    return true;
  }

  /**
   * Run a test matrix
   * @param {TestMatrix} matrix - Test matrix definition
   * @param {Object} [options] - Run options
   * @param {string[]} [options.tags] - Only run tests with these tags
   * @param {string} [options.filter] - Only run tests matching this name pattern
   * @returns {Promise<TestResult[]>}
   */
  async runTestMatrix(matrix, options = {}) {
    const results = [];

    console.log(`\n📋 Testing: ${matrix.endpoint}`);
    console.log(`   ${matrix.description}`);
    console.log(`   ${matrix.cases.length} test cases\n`);

    for (const testCase of matrix.cases) {
      // Apply filters
      if (options.tags && testCase.tags) {
        const hasTag = options.tags.some(t => testCase.tags.includes(t));
        if (!hasTag) continue;
      }

      if (options.filter && !testCase.name.includes(options.filter)) {
        continue;
      }

      const result = await this.runTestCase(matrix.endpoint, testCase);
      results.push(result);

      // Print result
      const icon = result.passed ? '✓' : '✗';
      const color = result.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`   ${color}${icon}\x1b[0m ${testCase.name} (${result.duration}ms)`);

      if (!result.passed && this.verbose) {
        console.log(`      Error: ${result.error}`);
      }
    }

    this.results.push(...results);
    return results;
  }

  /**
   * Run multiple test matrices
   * @param {TestMatrix[]} matrices - Array of test matrices
   * @param {Object} [options] - Run options
   * @returns {Promise<TestResult[]>}
   */
  async runAllMatrices(matrices, options = {}) {
    this.startTime = Date.now();
    this.results = [];

    for (const matrix of matrices) {
      await this.runTestMatrix(matrix, options);
    }

    this.endTime = Date.now();
    return this.results;
  }

  /**
   * Get test summary statistics
   */
  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const duration = this.endTime - this.startTime;

    // Group by endpoint
    const byEndpoint = {};
    for (const result of this.results) {
      if (!byEndpoint[result.endpoint]) {
        byEndpoint[result.endpoint] = { passed: 0, failed: 0 };
      }
      if (result.passed) {
        byEndpoint[result.endpoint].passed++;
      } else {
        byEndpoint[result.endpoint].failed++;
      }
    }

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total * 100).toFixed(1) : 0,
      duration,
      byEndpoint
    };
  }

  /**
   * Print test report
   */
  printReport() {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST REPORT');
    console.log('='.repeat(60));

    console.log(`\nTotal:    ${summary.total}`);
    console.log(`Passed:   \x1b[32m${summary.passed}\x1b[0m`);
    console.log(`Failed:   \x1b[31m${summary.failed}\x1b[0m`);
    console.log(`Pass Rate: ${summary.passRate}%`);
    console.log(`Duration: ${summary.duration}ms`);

    console.log('\nBy Endpoint:');
    for (const [endpoint, stats] of Object.entries(summary.byEndpoint)) {
      const status = stats.failed === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`  ${status} ${endpoint}: ${stats.passed}/${stats.passed + stats.failed}`);
    }

    // Print failed tests
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('\n\x1b[31mFailed Tests:\x1b[0m');
      for (const test of failedTests) {
        console.log(`  ✗ ${test.endpoint} > ${test.name}`);
        console.log(`    Error: ${test.error}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return summary;
  }

  /**
   * Assert test results for CI
   */
  assertAllPassed() {
    const summary = this.getSummary();
    if (summary.failed > 0) {
      throw new Error(`${summary.failed} test(s) failed`);
    }
  }
}

// ============================================================================
// CONTRACT VALIDATORS
// ============================================================================

/**
 * Validates EVENT_CONTRACT.md v2.0 canonical event shape
 */
const validateEventContractV2 = (event) => {
  const errors = [];

  // IDENTITY (MVP REQUIRED)
  if (!event.id) errors.push('Missing id');
  if (!event.slug) errors.push('Missing slug');
  if (!event.name) errors.push('Missing name');
  if (!event.startDateISO) errors.push('Missing startDateISO');
  if (!event.venue) errors.push('Missing venue');

  // LINKS (MVP REQUIRED)
  if (!event.links) {
    errors.push('Missing links');
  } else {
    if (!event.links.publicUrl) errors.push('Missing links.publicUrl');
    if (!event.links.displayUrl) errors.push('Missing links.displayUrl');
    if (!event.links.posterUrl) errors.push('Missing links.posterUrl');
    if (!event.links.signupUrl && event.links.signupUrl !== '') errors.push('Missing links.signupUrl');
  }

  // QR CODES (MVP REQUIRED)
  if (!event.qr) {
    errors.push('Missing qr');
  } else {
    if (!event.qr.public) errors.push('Missing qr.public');
    if (!event.qr.signup) errors.push('Missing qr.signup');
  }

  // CTA BLOCK (MVP REQUIRED)
  if (!event.ctas) {
    errors.push('Missing ctas');
  } else {
    if (!event.ctas.primary) errors.push('Missing ctas.primary');
    if (event.ctas.primary && typeof event.ctas.primary.label !== 'string') {
      errors.push('Missing ctas.primary.label');
    }
  }

  // SETTINGS (MVP REQUIRED)
  if (!event.settings) {
    errors.push('Missing settings');
  } else {
    // MVP Required settings
    if (typeof event.settings.showSchedule !== 'boolean') errors.push('Missing settings.showSchedule');
    if (typeof event.settings.showStandings !== 'boolean') errors.push('Missing settings.showStandings');
    if (typeof event.settings.showBracket !== 'boolean') errors.push('Missing settings.showBracket');

    // MVP Optional settings - validate type if present (must be boolean)
    // These match event.schema.json Settings and ApiSchemas.gs _settings
    const optionalSettings = [
      'showSponsors',
      'showVideo',
      'showMap',
      'showGallery',
      'showSponsorBanner',
      'showSponsorStrip',
      'showLeagueStrip',
      'showQRSection'
    ];

    optionalSettings.forEach(setting => {
      if (event.settings[setting] !== undefined && typeof event.settings[setting] !== 'boolean') {
        errors.push(`settings.${setting} must be boolean if present`);
      }
    });
  }

  // METADATA (MVP REQUIRED)
  if (!event.createdAtISO) errors.push('Missing createdAtISO');
  if (!event.updatedAtISO) errors.push('Missing updatedAtISO');

  if (errors.length > 0) {
    return `Event contract validation failed: ${errors.join(', ')}`;
  }
  return true;
};

/**
 * Validates bundle envelope structure
 */
const validateBundleEnvelope = (response) => {
  if (!response.ok) {
    return `Bundle request failed: ${response.code} - ${response.message}`;
  }

  if (!response.value) {
    return 'Bundle missing value';
  }

  if (!response.value.event) {
    return 'Bundle missing event';
  }

  // Validate event within bundle
  return validateEventContractV2(response.value.event);
};

/**
 * Validates etag format
 */
const validateEtag = (response) => {
  if (!response.etag) {
    return 'Missing etag';
  }
  if (typeof response.etag !== 'string' || response.etag.length < 8) {
    return 'Invalid etag format';
  }
  return true;
};

/**
 * Validates brand config structure
 */
const validateBrandConfig = (config) => {
  const errors = [];

  if (!config.brandId) errors.push('Missing brandId');
  if (!config.brandName) errors.push('Missing brandName');

  if (errors.length > 0) {
    return `Brand config validation failed: ${errors.join(', ')}`;
  }
  return true;
};

/**
 * Validates sponsor structure
 */
const validateSponsorContract = (sponsor) => {
  const errors = [];

  if (!sponsor.id) errors.push('Missing sponsor.id');
  if (!sponsor.name) errors.push('Missing sponsor.name');

  if (errors.length > 0) {
    return `Sponsor validation failed: ${errors.join(', ')}`;
  }
  return true;
};

// ============================================================================
// TEST MATRIX BUILDERS
// ============================================================================

/**
 * Build test matrix for success cases
 */
const buildSuccessMatrix = (endpoint, description, cases) => ({
  endpoint,
  description,
  cases: cases.map(c => ({
    ...c,
    expected: { ok: true, ...c.expected }
  }))
});

/**
 * Build test matrix for error cases
 */
const buildErrorMatrix = (endpoint, description, cases) => ({
  endpoint,
  description,
  cases: cases.map(c => ({
    ...c,
    expected: { ok: false, ...c.expected }
  }))
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  TestRunner,

  // Contract validators
  validateEventContractV2,
  validateBundleEnvelope,
  validateEtag,
  validateBrandConfig,
  validateSponsorContract,

  // Matrix builders
  buildSuccessMatrix,
  buildErrorMatrix,

  // Re-export helpers
  ERROR_CODES,
  dateHelpers,
  generateTestId
};
