/**
 * Event Fixtures for Testing
 *
 * Shared event data for all test types across Triangle phases
 */

const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
const TENANT_ID = process.env.TENANT_ID || 'root';

/**
 * Generate a unique timestamp-based event name
 */
const generateEventName = (prefix = 'Test Event') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix} ${timestamp}`;
};

/**
 * Generate a unique event ID
 */
const generateEventId = () => {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Event Builder - Creates events with builder pattern to avoid timestamp collisions
 */
class EventBuilder {
  constructor() {
    this.event = {
      name: generateEventName('Test Event'),
      dateISO: '2025-12-15',
      location: 'Test Venue',
      description: 'This is a test event for automated testing.',
    };
  }

  withName(name) {
    this.event.name = name;
    return this;
  }

  withDate(dateISO) {
    this.event.dateISO = dateISO;
    return this;
  }

  withLocation(location) {
    this.event.location = location;
    return this;
  }

  withDescription(description) {
    this.event.description = description;
    return this;
  }

  withTime(timeStart, timeEnd) {
    this.event.timeStart = timeStart;
    this.event.timeEnd = timeEnd;
    return this;
  }

  withAddress(address) {
    this.event.address = address;
    return this;
  }

  withSponsors(sponsors) {
    this.event.sponsors = sponsors;
    return this;
  }

  withForms(forms) {
    this.event.registrationUrl = forms.registrationUrl;
    this.event.checkinUrl = forms.checkinUrl;
    this.event.walkinUrl = forms.walkinUrl;
    this.event.surveyUrl = forms.surveyUrl;
    return this;
  }

  withDisplay(mode, urls, interval = 15000) {
    this.event.displayMode = mode;
    this.event.displayUrls = urls;
    this.event.displayInterval = interval;
    return this;
  }

  withMap(mapUrl) {
    this.event.mapUrl = mapUrl;
    return this;
  }

  withStatus(status) {
    this.event.status = status;
    return this;
  }

  build() {
    return { ...this.event };
  }
}

/**
 * Factory function for basic event (minimal required fields)
 * Returns a NEW instance each time to avoid timestamp collisions
 */
const createBasicEvent = (overrides = {}) => ({
  name: generateEventName('Basic Event'),
  dateISO: '2025-12-15',
  location: 'Test Venue',
  description: 'This is a test event for automated testing.',
  ...overrides
});

/**
 * Factory function for complete event (all fields)
 * Returns a NEW instance each time
 */
const createCompleteEvent = (overrides = {}) => ({
  name: generateEventName('Complete Event'),
  dateISO: '2025-12-20',
  timeStart: '18:00',
  timeEnd: '22:00',
  location: 'Complete Test Venue',
  address: '123 Test Street, Test City, TC 12345',
  description: 'This is a complete test event with all fields populated.',

  // Sponsor configuration
  sponsors: [
    { name: 'Platinum Sponsor', tier: 'platinum', logo: 'https://via.placeholder.com/300x100/FFD700/000000?text=Platinum' },
    { name: 'Gold Sponsor', tier: 'gold', logo: 'https://via.placeholder.com/300x100/C0C0C0/000000?text=Gold' }
  ],

  // Form URLs
  registrationUrl: 'https://docs.google.com/forms/d/e/REGISTRATION/viewform',
  checkinUrl: 'https://docs.google.com/forms/d/e/CHECKIN/viewform',
  walkinUrl: 'https://docs.google.com/forms/d/e/WALKIN/viewform',
  surveyUrl: 'https://docs.google.com/forms/d/e/SURVEY/viewform',

  // Display configuration
  displayMode: 'dynamic',
  displayUrls: [
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://player.vimeo.com/video/148751763'
  ],

  // Map configuration
  mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.215121057468!2d-73.98656668459377!3d40.74844097932847!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQ0JzU0LjQiTiA3M8KwNTknMTEuNiJX!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus',
  ...overrides
});

/**
 * Factory function for event with sponsors (Before Event phase)
 */
const createEventWithSponsors = (overrides = {}) => ({
  name: generateEventName('Sponsored Event'),
  dateISO: '2025-12-25',
  location: 'Sponsored Venue',
  description: 'Event with multiple sponsor tiers',
  sponsors: [
    {
      name: 'Platinum Corp',
      tier: 'platinum',
      logo: 'https://via.placeholder.com/300x100/FFD700/000000?text=Platinum+Corp',
      website: 'https://platinum-corp.example.com'
    },
    {
      name: 'Gold Industries',
      tier: 'gold',
      logo: 'https://via.placeholder.com/300x100/C0C0C0/000000?text=Gold+Industries',
      website: 'https://gold-industries.example.com'
    },
    {
      name: 'Silver Solutions',
      tier: 'silver',
      logo: 'https://via.placeholder.com/300x100/CD7F32/000000?text=Silver+Solutions',
      website: 'https://silver-solutions.example.com'
    }
  ],
  ...overrides
});

/**
 * Factory function for event with display configuration (During Event phase)
 */
const createEventWithDisplay = (overrides = {}) => ({
  name: generateEventName('Display Event'),
  dateISO: '2025-12-30',
  location: 'Display Venue',
  description: 'Event with TV display configuration',
  displayMode: 'dynamic',
  displayUrls: [
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://player.vimeo.com/video/148751763',
    'https://example.com/custom-content'
  ],
  displayInterval: 15000, // 15 seconds
  ...overrides
});

/**
 * Factory function for past event (After Event phase - for analytics)
 */
const createPastEvent = (overrides = {}) => ({
  name: generateEventName('Past Event'),
  dateISO: '2025-01-01',
  location: 'Past Venue',
  description: 'Event that has already occurred',
  status: 'completed',
  ...overrides
});

// DEPRECATED: Use factory functions instead (e.g., createBasicEvent())
// These are kept for backwards compatibility but will cause timestamp collisions
const basicEvent = createBasicEvent();
const completeEvent = createCompleteEvent();
const eventWithSponsors = createEventWithSponsors();
const eventWithDisplay = createEventWithDisplay();
const pastEvent = createPastEvent();

/**
 * Event API response envelope
 */
const createEventResponse = (eventData, id = null) => ({
  ok: true,
  value: {
    id: id || generateEventId(),
    tenantId: TENANT_ID,
    templateId: 'event',
    data: eventData,
    createdAt: new Date().toISOString(),
    slug: eventData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    links: {
      publicUrl: `${BASE_URL}?p=events&id=${id || 'EVENT_ID'}`,
      posterUrl: `${BASE_URL}?page=poster&id=${id || 'EVENT_ID'}`,
      displayUrl: `${BASE_URL}?page=display&id=${id || 'EVENT_ID'}`,
      reportUrl: `${BASE_URL}?page=report&id=${id || 'EVENT_ID'}`
    }
  }
});

/**
 * Event list response
 */
const createEventListResponse = (events = []) => ({
  ok: true,
  etag: `etag-${Date.now()}`,
  value: {
    items: events.map((event, index) => ({
      id: event.id || generateEventId(),
      tenantId: TENANT_ID,
      templateId: 'event',
      data: event,
      createdAt: new Date(Date.now() - index * 86400000).toISOString(),
      slug: event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    }))
  }
});

/**
 * Invalid event fixtures (for validation testing)
 */
const invalidEvents = {
  missingName: {
    dateISO: '2025-12-15',
    location: 'Test Venue'
  },
  missingDate: {
    name: 'Event Without Date',
    location: 'Test Venue'
  },
  missingLocation: {
    name: 'Event Without Location',
    dateISO: '2025-12-15'
  },
  invalidDate: {
    name: 'Invalid Date Event',
    dateISO: 'not-a-date',
    location: 'Test Venue'
  },
  emptyName: {
    name: '',
    dateISO: '2025-12-15',
    location: 'Test Venue'
  }
};

module.exports = {
  // Generators
  generateEventName,
  generateEventId,

  // Builder Pattern (RECOMMENDED)
  EventBuilder,

  // Factory Functions (RECOMMENDED - use these instead of deprecated constants)
  createBasicEvent,
  createCompleteEvent,
  createEventWithSponsors,
  createEventWithDisplay,
  createPastEvent,

  // DEPRECATED fixtures (use factory functions instead)
  basicEvent,
  completeEvent,
  eventWithSponsors,
  eventWithDisplay,
  pastEvent,

  // Response builders
  createEventResponse,
  createEventListResponse,

  // Invalid data
  invalidEvents,

  // Constants
  BASE_URL,
  TENANT_ID
};
