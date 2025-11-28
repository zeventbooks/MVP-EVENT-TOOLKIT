/**
 * Jest Configuration for Unit and Contract Tests
 *
 * These tests DO NOT require BASE_URL environment variable:
 * - Unit tests use mocks and test logic in isolation
 * - Contract tests validate response structures using mock data
 * - All tests can run with default configuration values
 *
 * For E2E/API tests that require BASE_URL, see playwright.config.js
 */

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '*.gs',
    '!node_modules/**',
    '!coverage/**',
    '!tests/**',
    '!jest.config.js',
    '!playwright.config.js'
  ],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/contract/**/*.test.js',
    '**/tests/triangle/**/contract/**/*.test.js',
    '**/tests/api/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '/tests/smoke/'
  ],
  reporters: [
    'default',
    './tests/shared/jest-history-reporter.js'
  ],
  // Coverage thresholds enabled (conservative initial values)
  // Mock Google Apps Script APIs in tests to achieve coverage
  coverageThreshold: {
    global: {
      branches: 50,      // Start conservative, increase gradually
      functions: 50,
      lines: 60,
      statements: 60
    }
  }
};
