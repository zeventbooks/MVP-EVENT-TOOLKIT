/**
 * Worker Module Exports
 *
 * Barrel file for exporting all worker modules.
 *
 * @module worker
 * @see Story 1.2 - Implement sheetsClient.ts for Workers
 * @see Story 1.3 - Port api_status + Simple Read-Only api_listEvents
 * @see Story 2.1 - Worker getPublicBundle from Sheets
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

// API Handlers (Story 2.1 - Public Bundle)
export {
  handleGetPublicBundle,
  parseEventIdFromPath,
  type PublicBundleEnv,
  type PublicBundleResponse,
  type PublicBundleNotModifiedResponse,
  type PublicBundleErrorResponse,
} from './handlers';

// Mappers (Story 2.1)
export {
  // Types
  type LifecyclePhaseValue,
  type LifecyclePhaseInfo,
  type BrandConfigForApi,
  type EventLinks,
  type EventQR,
  type EventCTA,
  type EventCTAs,
  type ScheduleItem,
  type StandingsItem,
  type Bracket,
  type SponsorPlacements,
  type Sponsor,
  type EventMedia,
  type ExternalData,
  type EventSettings,
  type PublicEvent,
  type PublicBundleValue,

  // Constants
  LIFECYCLE_PHASE,
  LIFECYCLE_LABELS,
  BRAND_CONFIG,
  VALID_BRANDS,
  DEFAULT_BRAND,
  EVENT_COL,

  // Functions
  isValidBrand,
  getBrandConfigForApi,
  computeLifecyclePhase,
  filterSponsorsForPublic,
  generatePublicBundleEtag,
  generateContentEtag,
  parseEventRow,
  buildPublicBundleValue,
  buildPublicBundleResponse,
} from './mappers';
