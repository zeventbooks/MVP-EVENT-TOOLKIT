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
    '**/tests/triangle/**/contract/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '/tests/smoke/'
  ],
  // Coverage thresholds disabled for Apps Script project
  // (code runs in Google's sandbox, not locally testable)
  // coverageThreshold: {
  //   global: {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70
  //   }
  // }
};
