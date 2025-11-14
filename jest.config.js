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
