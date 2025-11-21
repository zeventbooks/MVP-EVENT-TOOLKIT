/**
 * Coverage Matrix Validation
 *
 * This test file validates that the documented feature coverage exists.
 * It serves as executable documentation - if a test file is removed,
 * this spec will fail, reminding us to update FEATURE_COVERAGE_MATRIX.md
 *
 * @see /tests/FEATURE_COVERAGE_MATRIX.md
 */

const fs = require('fs');
const path = require('path');

const TESTS_ROOT = path.join(__dirname, '..');

describe('Feature Coverage Matrix', () => {

  describe('What We Test - Jest (Stage 1)', () => {

    describe('Event Lifecycle', () => {
      test('Event creation validation exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/validation.test.js'))).toBe(true);
      });

      test('Form handling exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/forms.test.js'))).toBe(true);
      });

      test('Event list contract exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'triangle/during-event/contract/events-list.contract.test.js'))).toBe(true);
      });

      test('Event details contract exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'triangle/during-event/contract/event-details.contract.test.js'))).toBe(true);
      });
    });

    describe('Sponsor System', () => {
      test('Sponsor utilities exist', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/sponsor-utils.test.js'))).toBe(true);
      });

      test('Shared reporting exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/shared-reporting.test.js'))).toBe(true);
      });
    });

    describe('Data Propagation', () => {
      test('All endpoints contract exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'contract/all-endpoints.contract.test.js'))).toBe(true);
      });
    });

    describe('Security & Validation', () => {
      test('Security tests exist', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/security.test.js'))).toBe(true);
      });

      test('Backend sanitization exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/backend.test.js'))).toBe(true);
      });

      test('JWT security contract exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'contract/jwt-security.contract.test.js'))).toBe(true);
      });

      test('Rate limiting exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/rate-limiting.test.js'))).toBe(true);
      });
    });

    describe('Multi-Brand', () => {
      test('Multi-brand tests exist', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/multi-brand.test.js'))).toBe(true);
      });

      test('Config tests exist', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'unit/config.test.js'))).toBe(true);
      });
    });

    describe('Shared Reporting', () => {
      test('Analytics contract exists', () => {
        expect(fs.existsSync(path.join(TESTS_ROOT, 'triangle/after-event/contract/analytics.contract.test.js'))).toBe(true);
      });
    });
  });

  describe('What We Dont Test Yet - Documented Gaps', () => {

    // These tests document what is NOT tested - they pass when the gaps exist
    // When a gap is filled, update FEATURE_COVERAGE_MATRIX.md and this file

    test('Portfolio analytics - documented as deferred', () => {
      // Full portfolio dashboard is deferred
      // When implemented, add test file and update matrix
      const portfolioE2E = path.join(TESTS_ROOT, 'e2e/3-flows/portfolio-dashboard.spec.js');
      expect(fs.existsSync(portfolioE2E)).toBe(false);
    });

    test('Multi-language validation - documented as deferred', () => {
      // Comprehensive i18n testing is deferred
      const i18nTests = path.join(TESTS_ROOT, 'unit/i18n-validation.test.js');
      expect(fs.existsSync(i18nTests)).toBe(false);
    });

    test('Edge brands - documented as deferred', () => {
      // Non-root brand testing is deferred
      const edgeBrands = path.join(TESTS_ROOT, 'e2e/3-flows/edge-brands.spec.js');
      expect(fs.existsSync(edgeBrands)).toBe(false);
    });
  });

  describe('Coverage Matrix Document Integrity', () => {

    test('FEATURE_COVERAGE_MATRIX.md exists', () => {
      expect(fs.existsSync(path.join(TESTS_ROOT, 'FEATURE_COVERAGE_MATRIX.md'))).toBe(true);
    });

    test('Matrix document contains required sections', () => {
      const matrix = fs.readFileSync(path.join(TESTS_ROOT, 'FEATURE_COVERAGE_MATRIX.md'), 'utf8');

      // Required sections
      expect(matrix).toContain('## What We Test');
      expect(matrix).toContain('## What We Don\'t Test');
      expect(matrix).toContain('### Event Lifecycle');
      expect(matrix).toContain('### Sponsor System');
      expect(matrix).toContain('### Data Propagation');
      expect(matrix).toContain('### Security & Validation');
    });

    test('Matrix documents MVP features', () => {
      const matrix = fs.readFileSync(path.join(TESTS_ROOT, 'FEATURE_COVERAGE_MATRIX.md'), 'utf8');

      // MVP features must be documented
      expect(matrix).toContain('Event creation');
      expect(matrix).toContain('Sponsor');
      expect(matrix).toContain('Admin');
      expect(matrix).toContain('Display');
      expect(matrix).toContain('Public');
    });
  });
});
