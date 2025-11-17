/**
 * Playwright Global Setup
 * Runs once before all tests
 */

const { printEnvironmentInfo } = require('./environments');

// Register shared Playwright guards (login wall detection, etc.) before tests run
require('../shared/register-login-wall-guard');

module.exports = async () => {
  // Print environment configuration
  printEnvironmentInfo();
};
