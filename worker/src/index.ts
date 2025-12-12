/**
 * Worker Module Exports
 *
 * Barrel file for exporting all worker modules.
 *
 * @module worker
 * @see Story 1.2 - Implement sheetsClient.ts for Workers
 * @see Story 1.3 - Port api_status + Simple Read-Only api_listEvents
 */

// Google Authentication
export {
  getAccessToken,
  hasCredentials,
  validateCredentials,
  clearTokenCache,
  logAuthError,
  AuthError,
  AUTH_ERROR_CODES,
  type GoogleAuthEnv,
  type AuthErrorCode,
} from './googleAuth';

// Google Sheets Client
export {
  getSheetValues,
  batchGetRanges,
  appendRow,
  updateRow,
  isConfigured,
  healthCheck,
  createUpstreamSafeError,
  logSheetsClientError,
  SheetsError,
  SHEETS_ERROR_CODES,
  type SheetsEnv,
  type SheetsErrorCode,
  type SheetValues,
  type ReadOptions,
  type WriteOptions,
  type BatchGetResult,
  type UpdateResult,
  type AppendResult,
} from './sheetsClient';

// API Handlers (Story 1.3)
export {
  handleStatus,
  createSheetsDownResponse,
  handleListEvents,
  type StatusEnv,
  type StatusResponse,
  type StatusErrorResponse,
  type EventsEnv,
  type EventSummary,
  type EventFull,
  type EventsListResponse,
  type EventsErrorResponse,
} from './handlers';
