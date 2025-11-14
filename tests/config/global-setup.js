/**
 * Playwright Global Setup
 * Runs once before all tests
 */

const { printEnvironmentInfo } = require('./environments');

module.exports = async () => {
  // Print environment configuration
  printEnvironmentInfo();
};
