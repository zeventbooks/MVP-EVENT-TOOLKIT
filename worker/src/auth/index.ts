/**
 * Authentication Module Exports
 *
 * Barrel file for exporting all authentication modules.
 *
 * @module auth
 * @see Story 3.1 - Define Admin Auth Model for Worker API
 */

// Admin Authentication
export {
  // Functions
  checkAdminAuth,
  requireAdminAuth,
  createAuthErrorResponse,
  isAuthConfigured,
  isAdminRoute,
  guardAdminRoute,
  logAuthAttempt,

  // Types
  type AdminAuthEnv,
  type AuthResult,
  type AuthContext,
  type AuthErrorCode,
  type AdminAuthErrorResponse,

  // Constants
  AUTH_ERROR_MESSAGES,
  AUTH_STATUS_CODES,
} from './adminAuth';
