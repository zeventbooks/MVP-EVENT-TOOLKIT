/**
 * Worker Handlers Exports
 *
 * Barrel file for exporting all API handlers.
 *
 * @module handlers
 * @see Story 1.3 - Port api_status + Simple Read-Only api_listEvents
 * @see Story 2.1 - Worker getPublicBundle from Sheets
 * @see Story 2.2 - Worker getAdminBundle from Sheets
 * @see Story 3.2 - Port createEvent to Worker
 * @see Story 3.3 - Port recordResult to Worker
 */

// Status Handler
export {
  handleStatus,
  createSheetsDownResponse,
  type StatusEnv,
  type StatusResponse,
  type StatusErrorResponse,
} from './status';

// Events List Handler
export {
  handleListEvents,
  type EventsEnv,
  type EventSummary,
  type EventFull,
  type EventsListResponse,
  type EventsErrorResponse,
} from './eventsList';

// Public Bundle Handler (Story 2.1)
export {
  handleGetPublicBundle,
  parseEventIdFromPath,
  type PublicBundleEnv,
  type PublicBundleResponse,
  type PublicBundleNotModifiedResponse,
  type PublicBundleErrorResponse,
} from './publicBundle';

// Admin Bundle Handler (Story 2.2)
export {
  handleGetAdminBundle,
  parseAdminEventIdFromPath,
  type AdminBundleEnv,
  type AdminBundleResponse,
  type AdminBundleNotModifiedResponse,
  type AdminBundleErrorResponse,
} from './adminBundle';

// Admin Create Event Handler (Story 3.2)
export {
  handleAdminCreateEvent,
  type AdminCreateEventEnv,
  type CreateEventRequestBody,
  type AdminCreateEventResponse,
  type AdminCreateEventErrorResponse,
} from './adminCreateEvent';

// Admin Record Result Handler (Story 3.3)
export {
  handleAdminRecordResult,
  parseEventIdFromResultPath,
  type AdminRecordResultEnv,
  type RecordResultRequestBody,
  type AdminRecordResultResponse,
  type AdminRecordResultErrorResponse,
} from './adminRecordResult';
