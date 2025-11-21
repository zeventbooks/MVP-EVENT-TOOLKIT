/**
 * Coverage Matrix - Playwright Validation
 *
 * This spec validates that documented E2E test coverage exists.
 * It serves as executable documentation for Stage 2 tests.
 *
 * Run as part of smoke tests to catch coverage drift early.
 *
 * @see /tests/FEATURE_COVERAGE_MATRIX.md
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const TESTS_ROOT = path.join(__dirname, '..', '..');
const E2E_ROOT = path.join(__dirname, '..');

test.describe('Feature Coverage Matrix - E2E Validation', () => {

  test.describe('What We Test - Playwright (Stage 2)', () => {

    test('Event lifecycle E2E tests exist', async () => {
      // Admin page tests
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/admin-page.spec.js'))).toBe(true);

      // Admin flows
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/admin-flows.spec.js'))).toBe(true);

      // Events CRUD API
      expect(fs.existsSync(path.join(E2E_ROOT, 'api/events-crud-api.spec.js'))).toBe(true);

      // Public page
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/public-page.spec.js'))).toBe(true);

      // Customer flows
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/customer-flows.spec.js'))).toBe(true);
    });

    test('Sponsor system E2E tests exist', async () => {
      // Sponsor API
      expect(fs.existsSync(path.join(E2E_ROOT, 'api/sponsors-crud-api.spec.js'))).toBe(true);

      // Sponsor flows
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/sponsor-flows.spec.js'))).toBe(true);

      // Display page (sponsor areas)
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/display-page.spec.js'))).toBe(true);
    });

    test('Data propagation E2E tests exist', async () => {
      // Triangle framework propagation
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/triangle-framework.spec.js'))).toBe(true);

      // Poster maps integration
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/poster-maps-integration.spec.js'))).toBe(true);
    });

    test('Security E2E tests exist', async () => {
      // Security smoke
      expect(fs.existsSync(path.join(E2E_ROOT, '1-smoke/security-smoke.spec.js'))).toBe(true);

      // Authentication
      expect(fs.existsSync(path.join(E2E_ROOT, 'authentication.spec.js'))).toBe(true);
    });

    test('Multi-brand E2E tests exist', async () => {
      // Brand branding
      expect(fs.existsSync(path.join(E2E_ROOT, '1-smoke/brand-branding.spec.js'))).toBe(true);

      // Multi-brand API
      expect(fs.existsSync(path.join(E2E_ROOT, 'api/multi-brand-api.spec.js'))).toBe(true);
    });

    test('Shared reporting E2E tests exist', async () => {
      // Shared reporting flows
      expect(fs.existsSync(path.join(E2E_ROOT, '3-flows/shared-reporting.spec.js'))).toBe(true);

      // Portfolio analytics API
      expect(fs.existsSync(path.join(E2E_ROOT, 'api/portfolio-analytics-api.spec.js'))).toBe(true);
    });

    test('All pages have E2E tests', async () => {
      // Admin
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/admin-page.spec.js'))).toBe(true);

      // Display
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/display-page.spec.js'))).toBe(true);

      // Public
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/public-page.spec.js'))).toBe(true);

      // Poster
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/poster-page.spec.js'))).toBe(true);

      // Sponsor
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/sponsor-page.spec.js'))).toBe(true);

      // Config
      expect(fs.existsSync(path.join(E2E_ROOT, '2-pages/config-page.spec.js'))).toBe(true);
    });

    test('User journey scenarios exist', async () => {
      // First-time admin
      expect(fs.existsSync(path.join(E2E_ROOT, 'scenarios/scenario-1-first-time-admin.spec.js'))).toBe(true);

      // Mobile user
      expect(fs.existsSync(path.join(E2E_ROOT, 'scenarios/scenario-2-mobile-user.spec.js'))).toBe(true);

      // TV display
      expect(fs.existsSync(path.join(E2E_ROOT, 'scenarios/scenario-3-tv-display.spec.js'))).toBe(true);
    });
  });

  test.describe('What We Dont Test Yet - Documented Gaps', () => {

    test('Portfolio dashboard - documented as deferred', async () => {
      // Full portfolio dashboard E2E is deferred
      const portfolioDashboard = path.join(E2E_ROOT, '3-flows/portfolio-dashboard.spec.js');
      expect(fs.existsSync(portfolioDashboard)).toBe(false);
    });

    test('Multi-language E2E - documented as deferred', async () => {
      // Comprehensive i18n E2E is deferred
      const i18nFlows = path.join(E2E_ROOT, '3-flows/multi-language-flows.spec.js');
      expect(fs.existsSync(i18nFlows)).toBe(false);
    });

    test('Edge brands E2E - documented as deferred', async () => {
      // Non-root brand E2E is deferred
      const edgeBrands = path.join(E2E_ROOT, '3-flows/edge-brands.spec.js');
      expect(fs.existsSync(edgeBrands)).toBe(false);
    });

    test('Load testing - documented as deferred', async () => {
      // Load/stress testing is deferred
      const loadTests = path.join(E2E_ROOT, 'performance/load-testing.spec.js');
      expect(fs.existsSync(loadTests)).toBe(false);
    });
  });

  test.describe('Coverage Matrix Document', () => {

    test('FEATURE_COVERAGE_MATRIX.md exists and is valid', async () => {
      const matrixPath = path.join(TESTS_ROOT, 'FEATURE_COVERAGE_MATRIX.md');
      expect(fs.existsSync(matrixPath)).toBe(true);

      const matrix = fs.readFileSync(matrixPath, 'utf8');

      // Must document what we test
      expect(matrix).toContain('## What We Test');

      // Must document gaps
      expect(matrix).toContain('## What We Don\'t Test');

      // Must list core features
      expect(matrix).toContain('Event');
      expect(matrix).toContain('Sponsor');
      expect(matrix).toContain('Admin');
      expect(matrix).toContain('Display');
      expect(matrix).toContain('Public');

      // Must document test layers
      expect(matrix).toContain('Jest');
      expect(matrix).toContain('Playwright');
    });
  });
});
