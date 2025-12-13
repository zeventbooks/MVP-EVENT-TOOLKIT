/**
 * Worker Module Exports
 *
 * Barrel file for exporting all worker modules.
 *
 * @module worker
 * @see Story 1.1 - Create Central Worker Router
 * @see Story 1.2 - Implement sheetsClient.ts for Workers
 * @see Story 1.3 - Port api_status + Simple Read-Only api_listEvents
 * @see Story 2.1 - Worker getPublicBundle from Sheets
 * @see Story 2.2 - Worker getAdminBundle from Sheets
 * @see Story 3.1 - Define Admin Auth Model for Worker API
 * @see Story 3.2 - Port createEvent to Worker
 * @see Story 3.3 - Port recordResult to Worker
 */

// Central Router (Story 1.1)
export {
  handleRequest,
  ROUTER_VERSION,
  type RouterEnv,
} from './router';

// Structured Logger (Story 1.1)
export {
  RouterLogger,
  createLogger,
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
} from './logger';

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
  type AuthErrorCode as GoogleAuthErrorCode,
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

// API Handlers (Story 2.2 - Admin Bundle)
export {
  handleGetAdminBundle,
  parseAdminEventIdFromPath,
  type AdminBundleEnv,
  type AdminBundleResponse,
  type AdminBundleNotModifiedResponse,
  type AdminBundleErrorResponse,
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

// Mappers (Story 2.2 - Admin Bundle)
export {
  // Types
  type AdminTemplate,
  type AdminBrandConfig,
  type EventDiagnostics,
  type AdminSponsor,
  type AdminBundleValue,

  // Constants
  TEMPLATES,
  BRAND_TEMPLATE_CONFIG,

  // Functions
  getAdminBrandConfig,
  getTemplatesForBrand,
  buildEventDiagnostics,
  mapSponsorsForAdmin,
  generateAdminBundleEtag,
  buildAdminBundleValue,
  buildAdminBundleResponse,
} from './mappers';

// Admin Authentication (Story 3.1)
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
} from './auth';

// API Handlers (Story 3.2 - Admin Create Event)
export {
  handleAdminCreateEvent,
  type AdminCreateEventEnv,
  type CreateEventRequestBody,
  type AdminCreateEventResponse,
  type AdminCreateEventErrorResponse,
} from './handlers';

// API Handlers (Story 3.3 - Admin Record Result)
export {
  handleAdminRecordResult,
  parseEventIdFromResultPath,
  type AdminRecordResultEnv,
  type RecordResultRequestBody,
  type AdminRecordResultResponse,
  type AdminRecordResultErrorResponse,
} from './handlers';

// Sheets Module (Story 3.2 - Event Writer)
export {
  // Functions
  generateEventId,
  generateEventTag,
  toSlug,
  slugExists,
  generateUniqueSlug,
  generateUniqueSlugFromRows,
  generateIdempotencyKey,
  findDuplicateEvent,
  createEvent,

  // Types
  type CreateEventInput,
  type CreatedEvent,
  type CreateEventResult,

  // Constants (aliased to avoid conflict with mappers/EVENT_COL)
  EVENT_COL as SHEETS_EVENT_COL,
} from './sheets';

// Sheets Module (Story 3.3 - Result Writer)
export {
  // Functions
  findEventById,
  mergeResultUpdates,
  saveEventRow,
  recordResult,
  updateSchedule,
  updateStandings,
  updateBracket,

  // Types (Note: ScheduleItem, StandingsItem, Bracket exported from ./mappers above)
  type BracketMatch,
  type RecordResultInput,
  type EventData,
  type LoadEventResult,
  type RecordResultResult,
} from './sheets';

// Sheets Module (Story 3.3 - Analytics Writer)
export {
  // Functions
  getEnvironmentString,
  isValidSurface,
  isValidMetric,
  sanitizeSpreadsheetValue,
  buildAnalyticsRow,
  logAnalyticsEvent,
  logAnalyticsEvents,
  logResultUpdate,

  // Types
  type AnalyticsWriterEnv,
  type AnalyticsLogInput,
  type AnalyticsLogResult,
  type AnalyticsBatchLogResult,
  type Surface,
  type Metric,

  // Constants
  ANALYTICS_COL,
  ANALYTICS_SOURCE,
  ANALYTICS_ENV,
  VALID_SURFACES,
  VALID_METRICS,
} from './sheets';
