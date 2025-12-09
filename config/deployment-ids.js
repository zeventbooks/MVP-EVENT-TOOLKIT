/**
 * Deployment IDs Configuration - Single Source of Truth
 *
 * This module defines all Google Apps Script deployment identifiers
 * in a standardized, environment-prefixed naming convention.
 *
 * Naming Convention:
 *   STAGING_* - Staging environment (stg.eventangle.com)
 *   PROD_*    - Production environment (www.eventangle.com)
 *
 * ID Types:
 *   *_SCRIPT_ID      - Apps Script project ID (for clasp, never changes)
 *   *_DEPLOYMENT_ID  - Web app deployment ID (changes with each deployment)
 *   *_WEB_APP_URL    - Executable URL (https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec)
 *   *_GAS_EDIT_URL   - Project editor URL (for development access)
 *
 * @module config/deployment-ids
 */

// =============================================================================
// STAGING ENVIRONMENT - stg.eventangle.com
// =============================================================================

/**
 * Staging Google Apps Script project ID
 * This is the permanent project identifier - never changes
 * Used by clasp for deployment operations
 */
const STAGING_SCRIPT_ID = '1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ';

/**
 * Staging deployment ID
 * Changes with each new web app deployment
 * Updated automatically by CI/CD after successful deployment
 * Can be overridden via STAGING_DEPLOYMENT_ID environment variable
 */
const STAGING_DEPLOYMENT_ID = process.env.STAGING_DEPLOYMENT_ID ||
  'AKfycbwFneYCpkio7wCn7y08eDUb2PRCPc2Tdtbv20L4AbEHvuCvoqY9ks7-ONL0pzPPw4Hm';

/**
 * Staging web app executable URL
 * Constructed from deployment ID - this is the runtime URL
 */
const STAGING_WEB_APP_URL = `https://script.google.com/macros/s/${STAGING_DEPLOYMENT_ID}/exec`;

/**
 * Staging project editor URL
 * Direct link to the Apps Script project editor
 */
const STAGING_GAS_EDIT_URL = `https://script.google.com/u/1/home/projects/${STAGING_SCRIPT_ID}/edit`;

// =============================================================================
// PRODUCTION ENVIRONMENT - www.eventangle.com
// =============================================================================

/**
 * Production Google Apps Script project ID
 * This is the permanent project identifier - never changes
 * Used by clasp for deployment operations
 */
const PROD_SCRIPT_ID = '1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l';

/**
 * Production deployment ID
 * Changes with each new web app deployment
 * Updated automatically by CI/CD after successful deployment
 * Can be overridden via PROD_DEPLOYMENT_ID environment variable
 */
const PROD_DEPLOYMENT_ID = process.env.PROD_DEPLOYMENT_ID ||
  'AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw';

/**
 * Production web app executable URL
 * Constructed from deployment ID - this is the runtime URL
 */
const PROD_WEB_APP_URL = `https://script.google.com/macros/s/${PROD_DEPLOYMENT_ID}/exec`;

/**
 * Production project editor URL
 * Direct link to the Apps Script project editor
 */
const PROD_GAS_EDIT_URL = `https://script.google.com/u/1/home/projects/${PROD_SCRIPT_ID}/edit`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get deployment configuration for a specific environment
 * @param {'staging'|'production'} env - Environment name
 * @returns {Object} Deployment configuration object
 */
function getDeploymentConfig(env) {
  const configs = {
    staging: {
      scriptId: STAGING_SCRIPT_ID,
      deploymentId: STAGING_DEPLOYMENT_ID,
      webAppUrl: STAGING_WEB_APP_URL,
      gasEditUrl: STAGING_GAS_EDIT_URL,
      envPrefix: 'STAGING'
    },
    production: {
      scriptId: PROD_SCRIPT_ID,
      deploymentId: PROD_DEPLOYMENT_ID,
      webAppUrl: PROD_WEB_APP_URL,
      gasEditUrl: PROD_GAS_EDIT_URL,
      envPrefix: 'PROD'
    }
  };

  return configs[env] || configs.staging;
}

/**
 * Build web app URL from a deployment ID
 * @param {string} deploymentId - The deployment ID
 * @returns {string} Full web app executable URL
 */
function buildWebAppUrl(deploymentId) {
  return `https://script.google.com/macros/s/${deploymentId}/exec`;
}

/**
 * Build project editor URL from a script ID
 * @param {string} scriptId - The script ID
 * @returns {string} Full project editor URL
 */
function buildGasEditUrl(scriptId) {
  return `https://script.google.com/u/1/home/projects/${scriptId}/edit`;
}

/**
 * Validate a deployment ID format
 * @param {string} id - Deployment ID to validate
 * @returns {boolean} True if valid format
 */
function isValidDeploymentId(id) {
  return typeof id === 'string' && id.startsWith('AKfycb') && id.length > 50;
}

/**
 * Validate a script ID format
 * @param {string} id - Script ID to validate
 * @returns {boolean} True if valid format
 */
function isValidScriptId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{40,60}$/.test(id);
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  // Staging identifiers
  STAGING_SCRIPT_ID,
  STAGING_DEPLOYMENT_ID,
  STAGING_WEB_APP_URL,
  STAGING_GAS_EDIT_URL,

  // Production identifiers
  PROD_SCRIPT_ID,
  PROD_DEPLOYMENT_ID,
  PROD_WEB_APP_URL,
  PROD_GAS_EDIT_URL,

  // Helper functions
  getDeploymentConfig,
  buildWebAppUrl,
  buildGasEditUrl,
  isValidDeploymentId,
  isValidScriptId,

  // Legacy aliases for backward compatibility
  // These map old names to new standardized names
  PRODUCTION_DEPLOYMENT_ID: PROD_DEPLOYMENT_ID,
  PRODUCTION_SCRIPT_ID: PROD_SCRIPT_ID,
  GAS_PRODUCTION_URL: PROD_WEB_APP_URL,
  GAS_STAGING_URL: STAGING_WEB_APP_URL
};
