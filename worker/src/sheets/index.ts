/**
 * Sheets Module Exports
 *
 * Barrel file for exporting all sheets-related modules.
 *
 * @module sheets
 * @see Story 3.2 - Port createEvent to Worker
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
