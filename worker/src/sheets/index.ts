/**
 * Sheets Module Exports
 *
 * Barrel file for exporting all sheets-related modules.
 *
 * @module sheets
 * @see Story 3.2 - Port createEvent to Worker
 * @see Story 3.3 - Port recordResult to Worker
 */

// Event Writer (Story 3.2)
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

  // Constants
  EVENT_COL,
} from './eventWriter';

// Result Writer (Story 3.3)
export {
  // Functions
  findEventById,
  mergeResultUpdates,
  saveEventRow,
  recordResult,
  updateSchedule,
  updateStandings,
  updateBracket,

  // Types
  type ScheduleItem,
  type StandingsItem,
  type BracketMatch,
  type Bracket,
  type RecordResultInput,
  type EventData,
  type LoadEventResult,
  type RecordResultResult,
} from './resultWriter';

// Analytics Writer (Story 3.3)
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
} from './analyticsWriter';
