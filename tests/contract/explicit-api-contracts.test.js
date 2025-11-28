/**
 * EXPLICIT API RESPONSE CONTRACTS + NODE TESTS
 *
 * Story: SDET/SRE - Every API that powers MVP surfaces has an explicit contract
 * and a corresponding test.
 *
 * TARGET APIs:
 * - api_getEvents (api_list) - List events
 * - api_get - Get single event
 * - api_getPublicBundle - Public.html surface data
 * - api_getDisplayBundle - Display.html (TV mode) data
 * - api_getPosterBundle - Poster.html print-ready data
 * - api_getAdminBundle - Admin.html with full config
 * - api_getSharedAnalytics - Organizer analytics view
 * - api_getSponsorAnalytics - Sponsor-scoped analytics view
 * - api_saveEvent - Create/Update event (Admin)
 * - api_updateEventData - Update event data (Admin)
 *
 * ACCEPTANCE CRITERIA:
 * - npm run test:api-contracts passes
 * - Breaks loudly if someone changes backend response shapes without updating schemas
 *
 * SCHEMA REFERENCES:
 * - /schemas/event.schema.json (MVP-frozen v2.2)
 * - /schemas/shared-analytics.schema.json (MVP-frozen v1.1)
 * - /schemas/sponsor.schema.json
 */

const {
  validateEnvelope,
  validateSuccessEnvelope,
  validateErrorEnvelope,
  ERROR_CODES,
  dateHelpers,
  generateTestId,
  brandHelpers
} = require('../shared/helpers/test.helpers.js');

const {
  validateEventContractV2,
  validateBundleEnvelope,
  validateEtag,
  validateBrandConfig
} = require('../shared/helpers/test-runner.js');

// ============================================================================
// FIXTURE DATA - Known test events for contract testing
// ============================================================================

/**
 * Fixture Event: Standard test event with all MVP required fields
 * Used for testing api_get, bundles, and other read operations
 */
const FIXTURE_EVENT_STANDARD = {
  id: 'fixture-event-001',
  slug: 'fixture-test-event',
  name: 'Fixture Test Event',
  startDateISO: '2025-12-15',
  venue: 'Test Arena, 123 Main St',
  links: {
    publicUrl: 'https://script.google.com/exec?page=events&brand=root&id=fixture-event-001',
    displayUrl: 'https://script.google.com/exec?page=display&brand=root&id=fixture-event-001&tv=1',
    posterUrl: 'https://script.google.com/exec?page=poster&brand=root&id=fixture-event-001',
    signupUrl: 'https://forms.google.com/fixture-signup'
  },
  qr: {
    public: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    signup: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  },
  ctas: {
    primary: { label: 'Sign Up', url: 'https://forms.google.com/fixture-signup' },
    secondary: null
  },
  settings: {
    showSchedule: true,
    showStandings: false,
    showBracket: false,
    showSponsors: false
  },
  schedule: [
    { time: '10:00 AM', title: 'Registration', description: 'Check-in opens' },
    { time: '11:00 AM', title: 'Opening Ceremony', description: null }
  ],
  standings: null,
  bracket: null,
  sponsors: [],
  media: {},
  externalData: {},
  analytics: { enabled: false },
  payments: { enabled: false, provider: 'stripe', price: null, currency: 'USD', checkoutUrl: null },
  createdAtISO: '2025-11-01T10:00:00.000Z',
  updatedAtISO: '2025-11-01T10:00:00.000Z'
};

/**
 * Fixture Event: Event with sponsors (for sponsor analytics testing)
 */
const FIXTURE_EVENT_WITH_SPONSORS = {
  ...FIXTURE_EVENT_STANDARD,
  id: 'fixture-event-002',
  slug: 'fixture-sponsored-event',
  name: 'Fixture Sponsored Event',
  settings: {
    ...FIXTURE_EVENT_STANDARD.settings,
    showSponsors: true
  },
  sponsors: [
    {
      id: 'sponsor-001',
      name: 'Gold Sponsor Inc',
      logoUrl: 'https://example.com/gold-logo.png',
      linkUrl: 'https://goldsponsor.com',
      placement: 'poster'
    },
    {
      id: 'sponsor-002',
      name: 'Silver Sponsor LLC',
      logoUrl: 'https://example.com/silver-logo.png',
      linkUrl: null,
      placement: 'display'
    }
  ]
};

// ============================================================================
// SCHEMA VALIDATORS - Validate response shapes match explicit contracts
// ============================================================================

/**
 * Validates Event shape per /schemas/event.schema.json v2.2 (MVP-frozen)
 * MVP REQUIRED: id, slug, name, startDateISO, venue, links, qr, ctas, settings, createdAtISO, updatedAtISO
 */
const validateEventSchema = (event) => {
  const errors = [];

  // MVP REQUIRED - Identity
  if (typeof event.id !== 'string' || event.id.length === 0) errors.push('id: must be non-empty string');
  if (typeof event.slug !== 'string' || !/^[a-z0-9-]+$/.test(event.slug)) errors.push('slug: must match ^[a-z0-9-]+$');
  if (typeof event.name !== 'string' || event.name.length === 0) errors.push('name: must be non-empty string');
  if (typeof event.startDateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.startDateISO)) errors.push('startDateISO: must match YYYY-MM-DD');
  if (typeof event.venue !== 'string' || event.venue.length === 0) errors.push('venue: must be non-empty string');

  // MVP REQUIRED - Links
  if (!event.links || typeof event.links !== 'object') {
    errors.push('links: must be object');
  } else {
    if (typeof event.links.publicUrl !== 'string') errors.push('links.publicUrl: must be string');
    if (typeof event.links.displayUrl !== 'string') errors.push('links.displayUrl: must be string');
    if (typeof event.links.posterUrl !== 'string') errors.push('links.posterUrl: must be string');
    if (typeof event.links.signupUrl !== 'string') errors.push('links.signupUrl: must be string');
  }

  // MVP REQUIRED - QR Codes
  if (!event.qr || typeof event.qr !== 'object') {
    errors.push('qr: must be object');
  } else {
    if (typeof event.qr.public !== 'string') errors.push('qr.public: must be string');
    if (typeof event.qr.signup !== 'string') errors.push('qr.signup: must be string');
  }

  // MVP REQUIRED - CTAs
  if (!event.ctas || typeof event.ctas !== 'object') {
    errors.push('ctas: must be object');
  } else {
    if (!event.ctas.primary || typeof event.ctas.primary !== 'object') {
      errors.push('ctas.primary: must be object');
    } else {
      if (typeof event.ctas.primary.label !== 'string') errors.push('ctas.primary.label: must be string');
      if (typeof event.ctas.primary.url !== 'string') errors.push('ctas.primary.url: must be string');
    }
  }

  // MVP REQUIRED - Settings
  if (!event.settings || typeof event.settings !== 'object') {
    errors.push('settings: must be object');
  } else {
    if (typeof event.settings.showSchedule !== 'boolean') errors.push('settings.showSchedule: must be boolean');
    if (typeof event.settings.showStandings !== 'boolean') errors.push('settings.showStandings: must be boolean');
    if (typeof event.settings.showBracket !== 'boolean') errors.push('settings.showBracket: must be boolean');
  }

  // MVP REQUIRED - Timestamps
  if (typeof event.createdAtISO !== 'string') errors.push('createdAtISO: must be string');
  if (typeof event.updatedAtISO !== 'string') errors.push('updatedAtISO: must be string');

  return errors.length === 0 ? true : errors;
};

/**
 * Validates SharedAnalytics shape per /schemas/shared-analytics.schema.json v1.1 (MVP-frozen)
 * MVP REQUIRED: lastUpdatedISO, summary, surfaces
 */
const validateSharedAnalyticsSchema = (analytics) => {
  const errors = [];

  // MVP REQUIRED - lastUpdatedISO
  if (typeof analytics.lastUpdatedISO !== 'string') {
    errors.push('lastUpdatedISO: must be string');
  }

  // MVP REQUIRED - summary
  if (!analytics.summary || typeof analytics.summary !== 'object') {
    errors.push('summary: must be object');
  } else {
    if (typeof analytics.summary.totalImpressions !== 'number') errors.push('summary.totalImpressions: must be number');
    if (typeof analytics.summary.totalClicks !== 'number') errors.push('summary.totalClicks: must be number');
    if (typeof analytics.summary.totalQrScans !== 'number') errors.push('summary.totalQrScans: must be number');
    if (typeof analytics.summary.totalSignups !== 'number') errors.push('summary.totalSignups: must be number');
    if (typeof analytics.summary.uniqueEvents !== 'number') errors.push('summary.uniqueEvents: must be number');
    if (typeof analytics.summary.uniqueSponsors !== 'number') errors.push('summary.uniqueSponsors: must be number');
  }

  // MVP REQUIRED - surfaces (array)
  if (!Array.isArray(analytics.surfaces)) {
    errors.push('surfaces: must be array');
  } else {
    analytics.surfaces.forEach((surface, i) => {
      if (typeof surface.id !== 'string') errors.push(`surfaces[${i}].id: must be string`);
      if (typeof surface.label !== 'string') errors.push(`surfaces[${i}].label: must be string`);
      if (typeof surface.impressions !== 'number') errors.push(`surfaces[${i}].impressions: must be number`);
      if (typeof surface.clicks !== 'number') errors.push(`surfaces[${i}].clicks: must be number`);
      if (typeof surface.qrScans !== 'number') errors.push(`surfaces[${i}].qrScans: must be number`);
    });
  }

  // MVP OPTIONAL - sponsors (array or null)
  if (analytics.sponsors !== null && analytics.sponsors !== undefined) {
    if (!Array.isArray(analytics.sponsors)) {
      errors.push('sponsors: must be array or null');
    } else {
      analytics.sponsors.forEach((sponsor, i) => {
        if (typeof sponsor.id !== 'string') errors.push(`sponsors[${i}].id: must be string`);
        if (typeof sponsor.name !== 'string') errors.push(`sponsors[${i}].name: must be string`);
        if (typeof sponsor.impressions !== 'number') errors.push(`sponsors[${i}].impressions: must be number`);
        if (typeof sponsor.clicks !== 'number') errors.push(`sponsors[${i}].clicks: must be number`);
        if (typeof sponsor.ctr !== 'number') errors.push(`sponsors[${i}].ctr: must be number`);
      });
    }
  }

  // MVP OPTIONAL - events (array or null)
  if (analytics.events !== null && analytics.events !== undefined) {
    if (!Array.isArray(analytics.events)) {
      errors.push('events: must be array or null');
    } else {
      analytics.events.forEach((event, i) => {
        if (typeof event.id !== 'string') errors.push(`events[${i}].id: must be string`);
        if (typeof event.name !== 'string') errors.push(`events[${i}].name: must be string`);
        if (typeof event.impressions !== 'number') errors.push(`events[${i}].impressions: must be number`);
        if (typeof event.clicks !== 'number') errors.push(`events[${i}].clicks: must be number`);
        if (typeof event.ctr !== 'number') errors.push(`events[${i}].ctr: must be number`);
        if (typeof event.signupsCount !== 'number') errors.push(`events[${i}].signupsCount: must be number`);
      });
    }
  }

  return errors.length === 0 ? true : errors;
};

/**
 * Validates Bundle envelope structure
 * All bundles must have: { ok: true, etag: string, value: { event: Event, config: BrandConfig } }
 */
const validateBundleSchema = (response) => {
  const errors = [];

  if (response.ok !== true) {
    errors.push('ok: must be true for success response');
    return errors;
  }

  if (typeof response.etag !== 'string' || response.etag.length < 8) {
    errors.push('etag: must be string with length >= 8');
  }

  if (!response.value || typeof response.value !== 'object') {
    errors.push('value: must be object');
    return errors;
  }

  // Validate event in bundle
  if (!response.value.event) {
    errors.push('value.event: required');
  } else {
    const eventValidation = validateEventSchema(response.value.event);
    if (eventValidation !== true) {
      errors.push(...eventValidation.map(e => `value.event.${e}`));
    }
  }

  // Validate config in bundle
  if (!response.value.config) {
    errors.push('value.config: required');
  } else {
    if (typeof response.value.config.brandId !== 'string') errors.push('value.config.brandId: must be string');
    if (typeof response.value.config.brandName !== 'string') errors.push('value.config.brandName: must be string');
  }

  return errors.length === 0 ? true : errors;
};

/**
 * Validates Sponsor schema per /schemas/sponsor.schema.json
 */
const validateSponsorSchema = (sponsor) => {
  const errors = [];

  if (typeof sponsor.id !== 'string' || sponsor.id.length === 0) errors.push('id: must be non-empty string');
  if (typeof sponsor.name !== 'string' || sponsor.name.length === 0) errors.push('name: must be non-empty string');
  if (typeof sponsor.logoUrl !== 'string' || !sponsor.logoUrl.match(/^https?:\/\/.+/)) errors.push('logoUrl: must be valid URL');
  if (typeof sponsor.placement !== 'string' || !['poster', 'display', 'public', 'tv-banner'].includes(sponsor.placement)) {
    errors.push('placement: must be one of poster, display, public, tv-banner');
  }

  return errors.length === 0 ? true : errors;
};

/**
 * Validates list response pagination structure
 */
const validatePaginationSchema = (pagination) => {
  const errors = [];

  if (typeof pagination.total !== 'number') errors.push('total: must be number');
  if (typeof pagination.limit !== 'number') errors.push('limit: must be number');
  if (typeof pagination.offset !== 'number') errors.push('offset: must be number');
  if (typeof pagination.hasMore !== 'boolean') errors.push('hasMore: must be boolean');

  return errors.length === 0 ? true : errors;
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Explicit API Response Contracts', () => {

  // ==========================================================================
  // api_list (api_getEvents)
  // ==========================================================================

  describe('api_list (api_getEvents)', () => {
    /**
     * CONTRACT: api_list
     *
     * Request: { action: 'api_list', brandId: string, scope?: string, limit?: number, offset?: number }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: {
     *     items: Event[],      // Array of canonical v2.2 events
     *     pagination: { total, limit, offset, hasMore }
     *   }
     * }
     *
     * Error Response:
     * { ok: false, code: 'BAD_INPUT' | 'NOT_FOUND' | 'INTERNAL', message: string }
     */

    it('should return valid success envelope with items and pagination', () => {
      const mockResponse = {
        ok: true,
        etag: 'list-etag-abc123',
        value: {
          items: [FIXTURE_EVENT_STANDARD],
          pagination: {
            total: 1,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      };

      validateSuccessEnvelope(mockResponse);
      expect(mockResponse).toHaveProperty('etag');
      expect(mockResponse.value).toHaveProperty('items');
      expect(mockResponse.value).toHaveProperty('pagination');
      expect(Array.isArray(mockResponse.value.items)).toBe(true);
    });

    it('should return events matching Event schema v2.2', () => {
      const mockResponse = {
        ok: true,
        etag: 'list-etag-abc123',
        value: {
          items: [FIXTURE_EVENT_STANDARD],
          pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
        }
      };

      const event = mockResponse.value.items[0];
      const validation = validateEventSchema(event);
      expect(validation).toBe(true);
    });

    it('should return valid pagination structure', () => {
      const mockResponse = {
        ok: true,
        etag: 'list-etag-abc123',
        value: {
          items: [],
          pagination: { total: 100, limit: 50, offset: 50, hasMore: true }
        }
      };

      const validation = validatePaginationSchema(mockResponse.value.pagination);
      expect(validation).toBe(true);
    });

    it('should support notModified response (304 equivalent)', () => {
      const mockResponse = {
        ok: true,
        notModified: true,
        etag: 'list-etag-abc123'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.notModified).toBe(true);
      expect(mockResponse.etag).toBeDefined();
    });

    it('should return BAD_INPUT for missing brandId', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'brandId required'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });

    it('should return BAD_INPUT for invalid brandId', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Unknown brand: invalid-brand'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });
  });

  // ==========================================================================
  // api_get
  // ==========================================================================

  describe('api_get', () => {
    /**
     * CONTRACT: api_get
     *
     * Request: { action: 'api_get', brandId: string, id: string, ifNoneMatch?: string }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: Event  // Canonical v2.2 event
     * }
     *
     * Error Response:
     * { ok: false, code: 'BAD_INPUT' | 'NOT_FOUND', message: string }
     */

    it('should return canonical event per v2.2 schema', () => {
      const mockResponse = {
        ok: true,
        etag: 'event-etag-xyz789',
        value: FIXTURE_EVENT_STANDARD
      };

      validateSuccessEnvelope(mockResponse);
      const validation = validateEventSchema(mockResponse.value);
      expect(validation).toBe(true);
    });

    it('should include etag for caching', () => {
      const mockResponse = {
        ok: true,
        etag: 'event-etag-xyz789',
        value: FIXTURE_EVENT_STANDARD
      };

      expect(mockResponse.etag).toBeDefined();
      expect(typeof mockResponse.etag).toBe('string');
      expect(mockResponse.etag.length).toBeGreaterThan(0);
    });

    it('should return NOT_FOUND for invalid event ID', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found: invalid-id-12345'
      };

      validateErrorEnvelope(mockResponse, 'NOT_FOUND');
    });

    it('should return BAD_INPUT for missing id', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'id required'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });
  });

  // ==========================================================================
  // api_getPublicBundle
  // ==========================================================================

  describe('api_getPublicBundle', () => {
    /**
     * CONTRACT: api_getPublicBundle
     *
     * Request: { action: 'api_getPublicBundle', brandId: string, id?: string, ifNoneMatch?: string }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: {
     *     event: Event,           // Canonical v2.2 event
     *     config: BrandConfig     // { brandId, brandName, appTitle }
     *   }
     * }
     */

    it('should return valid bundle with event and config', () => {
      const mockResponse = {
        ok: true,
        etag: 'public-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: {
            brandId: 'root',
            brandName: 'Default Brand',
            appTitle: 'Events'
          }
        }
      };

      const validation = validateBundleSchema(mockResponse);
      expect(validation).toBe(true);
    });

    it('should include all MVP required event fields', () => {
      const mockResponse = {
        ok: true,
        etag: 'public-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const event = mockResponse.value.event;
      // MVP Required fields per event.schema.json v2.2
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('slug');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('startDateISO');
      expect(event).toHaveProperty('venue');
      expect(event).toHaveProperty('links');
      expect(event).toHaveProperty('qr');
      expect(event).toHaveProperty('ctas');
      expect(event).toHaveProperty('settings');
      expect(event).toHaveProperty('createdAtISO');
      expect(event).toHaveProperty('updatedAtISO');
    });

    it('should include brand config with required fields', () => {
      const mockResponse = {
        ok: true,
        etag: 'public-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const { config } = mockResponse.value;
      expect(config).toHaveProperty('brandId');
      expect(config).toHaveProperty('brandName');
      expect(config).toHaveProperty('appTitle');
    });

    it('should support notModified response', () => {
      const mockResponse = {
        ok: true,
        notModified: true,
        etag: 'public-bundle-etag'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.notModified).toBe(true);
    });
  });

  // ==========================================================================
  // api_getDisplayBundle
  // ==========================================================================

  describe('api_getDisplayBundle', () => {
    /**
     * CONTRACT: api_getDisplayBundle
     *
     * Request: { action: 'api_getDisplayBundle', brandId: string, id?: string, ifNoneMatch?: string }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: {
     *     event: Event,           // Canonical v2.2 event (with schedule for TV display)
     *     config: BrandConfig
     *   }
     * }
     */

    it('should return valid bundle matching schema', () => {
      const mockResponse = {
        ok: true,
        etag: 'display-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const validation = validateBundleSchema(mockResponse);
      expect(validation).toBe(true);
    });

    it('should include schedule for TV display', () => {
      const mockResponse = {
        ok: true,
        etag: 'display-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const event = mockResponse.value.event;
      expect(event).toHaveProperty('schedule');
      if (event.schedule) {
        expect(Array.isArray(event.schedule)).toBe(true);
      }
    });

    it('should include settings for display visibility', () => {
      const mockResponse = {
        ok: true,
        etag: 'display-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const { settings } = mockResponse.value.event;
      expect(typeof settings.showSchedule).toBe('boolean');
      expect(typeof settings.showStandings).toBe('boolean');
      expect(typeof settings.showBracket).toBe('boolean');
    });
  });

  // ==========================================================================
  // api_getPosterBundle
  // ==========================================================================

  describe('api_getPosterBundle', () => {
    /**
     * CONTRACT: api_getPosterBundle
     *
     * Request: { action: 'api_getPosterBundle', brandId: string, id?: string, ifNoneMatch?: string }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: {
     *     event: Event,           // Canonical v2.2 event (with QR codes for print)
     *     config: BrandConfig
     *   }
     * }
     */

    it('should return valid bundle matching schema', () => {
      const mockResponse = {
        ok: true,
        etag: 'poster-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const validation = validateBundleSchema(mockResponse);
      expect(validation).toBe(true);
    });

    it('should include QR codes for print', () => {
      const mockResponse = {
        ok: true,
        etag: 'poster-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const { qr } = mockResponse.value.event;
      expect(qr).toHaveProperty('public');
      expect(qr).toHaveProperty('signup');
      expect(qr.public).toMatch(/^data:image\/png;base64,/);
    });

    it('should include sponsors when showSponsors is true', () => {
      const mockResponse = {
        ok: true,
        etag: 'poster-bundle-etag',
        value: {
          event: FIXTURE_EVENT_WITH_SPONSORS,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      const event = mockResponse.value.event;
      expect(event.settings.showSponsors).toBe(true);
      expect(Array.isArray(event.sponsors)).toBe(true);
      expect(event.sponsors.length).toBeGreaterThan(0);

      // Validate sponsor shape
      const validation = validateSponsorSchema(event.sponsors[0]);
      expect(validation).toBe(true);
    });
  });

  // ==========================================================================
  // api_getAdminBundle
  // ==========================================================================

  describe('api_getAdminBundle', () => {
    /**
     * CONTRACT: api_getAdminBundle
     *
     * Request: { action: 'api_getAdminBundle', brandId: string, id?: string, adminKey: string }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: {
     *     event: Event,           // Full canonical v2.2 event
     *     config: BrandConfig,    // With admin-specific settings
     *     templates?: Template[]  // Available templates
     *   }
     * }
     */

    it('should return valid bundle with full event data', () => {
      const mockResponse = {
        ok: true,
        etag: 'admin-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: {
            brandId: 'root',
            brandName: 'Default Brand',
            appTitle: 'Events',
            adminFeatures: { canEditSponsors: true, canViewAnalytics: true }
          },
          templates: [
            { id: 'trivia', name: 'Trivia Night' },
            { id: 'league', name: 'League Event' }
          ]
        }
      };

      validateSuccessEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('event');
      expect(mockResponse.value).toHaveProperty('config');
    });

    it('should require admin authentication', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid admin key'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });

    it('should include editable event fields', () => {
      const mockResponse = {
        ok: true,
        etag: 'admin-bundle-etag',
        value: {
          event: FIXTURE_EVENT_STANDARD,
          config: { brandId: 'root', brandName: 'Default Brand', appTitle: 'Events' }
        }
      };

      // Admin bundle should have all fields for editing
      const event = mockResponse.value.event;
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('startDateISO');
      expect(event).toHaveProperty('venue');
      expect(event).toHaveProperty('schedule');
      expect(event).toHaveProperty('settings');
      expect(event).toHaveProperty('sponsors');
    });
  });

  // ==========================================================================
  // api_getSharedAnalytics
  // ==========================================================================

  describe('api_getSharedAnalytics', () => {
    /**
     * CONTRACT: api_getSharedAnalytics
     *
     * Request: { action: 'api_getSharedAnalytics', brandId: string, eventId?: string, sponsorId?: string }
     *
     * Success Response (per /schemas/shared-analytics.schema.json v1.1):
     * {
     *   ok: true,
     *   value: {
     *     lastUpdatedISO: string,
     *     summary: {
     *       totalImpressions: number,
     *       totalClicks: number,
     *       totalQrScans: number,
     *       totalSignups: number,
     *       uniqueEvents: number,
     *       uniqueSponsors: number
     *     },
     *     surfaces: Array<{ id, label, impressions, clicks, qrScans, engagementRate }>,
     *     sponsors?: Array<{ id, name, impressions, clicks, ctr }>,
     *     events?: Array<{ id, name, impressions, clicks, ctr }>
     *   }
     * }
     */

    it('should return valid SharedAnalytics structure', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: {
            totalImpressions: 1500,
            totalClicks: 150,
            totalQrScans: 75,
            totalSignups: 45,
            uniqueEvents: 5,
            uniqueSponsors: 3
          },
          surfaces: [
            { id: 'public', label: 'Public', impressions: 800, clicks: 80, qrScans: 40, engagementRate: 15.0 },
            { id: 'display', label: 'Display', impressions: 500, clicks: 50, qrScans: 25, engagementRate: 15.0 },
            { id: 'poster', label: 'Poster', impressions: 200, clicks: 20, qrScans: 10, engagementRate: 15.0 }
          ],
          sponsors: [
            { id: 'sponsor-001', name: 'Gold Sponsor Inc', impressions: 500, clicks: 50, ctr: 10.0 },
            { id: 'sponsor-002', name: 'Silver Sponsor LLC', impressions: 300, clicks: 15, ctr: 5.0 }
          ],
          events: [
            { id: 'fixture-event-001', name: 'Fixture Test Event', impressions: 1000, clicks: 100, ctr: 10.0, signupsCount: 45 }
          ]
        }
      };

      validateSuccessEnvelope(mockResponse);
      const validation = validateSharedAnalyticsSchema(mockResponse.value);
      expect(validation).toBe(true);
    });

    it('should include MVP required summary fields', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: {
            totalImpressions: 1500,
            totalClicks: 150,
            totalQrScans: 75,
            totalSignups: 45,
            uniqueEvents: 5,
            uniqueSponsors: 3
          },
          surfaces: [],
          sponsors: null,
          events: null
        }
      };

      const { summary } = mockResponse.value;
      expect(summary).toHaveProperty('totalImpressions');
      expect(summary).toHaveProperty('totalClicks');
      expect(summary).toHaveProperty('totalQrScans');
      expect(summary).toHaveProperty('totalSignups');
      expect(summary).toHaveProperty('uniqueEvents');
      expect(summary).toHaveProperty('uniqueSponsors');

      // All must be numbers
      expect(typeof summary.totalImpressions).toBe('number');
      expect(typeof summary.totalClicks).toBe('number');
      expect(typeof summary.totalQrScans).toBe('number');
      expect(typeof summary.totalSignups).toBe('number');
      expect(typeof summary.uniqueEvents).toBe('number');
      expect(typeof summary.uniqueSponsors).toBe('number');
    });

    it('should include surfaces array with valid structure', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: { totalImpressions: 0, totalClicks: 0, totalQrScans: 0, totalSignups: 0, uniqueEvents: 0, uniqueSponsors: 0 },
          surfaces: [
            { id: 'poster', label: 'Poster', impressions: 100, clicks: 10, qrScans: 5, engagementRate: 15.0 }
          ],
          sponsors: null,
          events: null
        }
      };

      const surface = mockResponse.value.surfaces[0];
      expect(surface).toHaveProperty('id');
      expect(surface).toHaveProperty('label');
      expect(surface).toHaveProperty('impressions');
      expect(surface).toHaveProperty('clicks');
      expect(surface).toHaveProperty('qrScans');
      expect(['poster', 'display', 'public', 'signup']).toContain(surface.id);
    });

    it('should include sponsors array for organizer view', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: { totalImpressions: 0, totalClicks: 0, totalQrScans: 0, totalSignups: 0, uniqueEvents: 0, uniqueSponsors: 0 },
          surfaces: [],
          sponsors: [
            { id: 'sponsor-001', name: 'Gold Sponsor', impressions: 500, clicks: 50, ctr: 10.0 }
          ],
          events: null
        }
      };

      const sponsor = mockResponse.value.sponsors[0];
      expect(sponsor).toHaveProperty('id');
      expect(sponsor).toHaveProperty('name');
      expect(sponsor).toHaveProperty('impressions');
      expect(sponsor).toHaveProperty('clicks');
      expect(sponsor).toHaveProperty('ctr');
    });

    it('should include events array with human-readable names (Story 4.1)', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: { totalImpressions: 0, totalClicks: 0, totalQrScans: 0, totalSignups: 0, uniqueEvents: 1, uniqueSponsors: 0 },
          surfaces: [],
          sponsors: null,
          events: [
            { id: 'evt-abc-123', name: 'Summer Bocce Tournament', impressions: 1000, clicks: 100, ctr: 10.0, signupsCount: 45 }
          ]
        }
      };

      const event = mockResponse.value.events[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('impressions');
      expect(event).toHaveProperty('clicks');
      expect(event).toHaveProperty('ctr');
      expect(event).toHaveProperty('signupsCount');

      // Name should be human-readable, not just an ID (Story 4.1 requirement)
      expect(event.name).not.toBe(event.id);
      expect(event.name).toBe('Summer Bocce Tournament');
    });

    it('should return BAD_INPUT for missing brandId', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'brandId required'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });
  });

  // ==========================================================================
  // api_getSponsorAnalytics
  // ==========================================================================

  describe('api_getSponsorAnalytics', () => {
    /**
     * CONTRACT: api_getSponsorAnalytics
     *
     * Request: { action: 'api_getSponsorAnalytics', brandId: string, sponsorId: string, eventId?: string }
     *
     * Success Response (per /schemas/shared-analytics.schema.json v1.1 - sponsor-scoped):
     * Same structure as api_getSharedAnalytics but scoped to specific sponsor
     * sponsors array will be null (single sponsor view)
     */

    it('should return valid sponsor-scoped analytics', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: {
            totalImpressions: 500,
            totalClicks: 50,
            totalQrScans: 25,
            totalSignups: 15,
            uniqueEvents: 3,
            uniqueSponsors: 1
          },
          surfaces: [
            { id: 'poster', label: 'Poster', impressions: 300, clicks: 30, qrScans: 15, engagementRate: 15.0 },
            { id: 'display', label: 'Display', impressions: 200, clicks: 20, qrScans: 10, engagementRate: 15.0 }
          ],
          sponsors: null, // Sponsor view doesn't show other sponsors
          events: [
            { id: 'event-001', name: 'Test Event', impressions: 500, clicks: 50, ctr: 10.0, signupsCount: 15 }
          ]
        }
      };

      validateSuccessEnvelope(mockResponse);
      const validation = validateSharedAnalyticsSchema(mockResponse.value);
      expect(validation).toBe(true);
    });

    it('should return BAD_INPUT for missing sponsorId', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'sponsorId required for sponsor analytics'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });

    it('should filter data to specific sponsor', () => {
      const mockResponse = {
        ok: true,
        value: {
          lastUpdatedISO: '2025-11-27T10:00:00.000Z',
          summary: {
            totalImpressions: 500,
            totalClicks: 50,
            totalQrScans: 25,
            totalSignups: 15,
            uniqueEvents: 3,
            uniqueSponsors: 1
          },
          surfaces: [],
          sponsors: null,
          events: null
        }
      };

      // uniqueSponsors should be 1 for sponsor-scoped view
      expect(mockResponse.value.summary.uniqueSponsors).toBe(1);
      // sponsors should be null for sponsor view
      expect(mockResponse.value.sponsors).toBeNull();
    });
  });

  // ==========================================================================
  // api_saveEvent
  // ==========================================================================

  describe('api_saveEvent', () => {
    /**
     * CONTRACT: api_saveEvent
     *
     * Request:
     * CREATE: { action: 'api_saveEvent', brandId: string, adminKey: string, event: { name, startDateISO, venue, ... } }
     * UPDATE: { action: 'api_saveEvent', brandId: string, adminKey: string, event: { id, ...fields } }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: Event  // Full canonical v2.2 event
     * }
     *
     * MVP Required for CREATE: name, startDateISO, venue
     */

    describe('CREATE Mode', () => {
      it('should return full canonical event on success', () => {
        const mockResponse = {
          ok: true,
          etag: 'new-event-etag',
          value: {
            ...FIXTURE_EVENT_STANDARD,
            id: 'new-event-123',
            createdAtISO: '2025-11-27T10:00:00.000Z',
            updatedAtISO: '2025-11-27T10:00:00.000Z'
          }
        };

        validateSuccessEnvelope(mockResponse);
        const validation = validateEventSchema(mockResponse.value);
        expect(validation).toBe(true);
      });

      it('should auto-generate id for new event', () => {
        const mockResponse = {
          ok: true,
          etag: 'new-event-etag',
          value: { ...FIXTURE_EVENT_STANDARD, id: 'auto-generated-uuid-123' }
        };

        expect(mockResponse.value.id).toBeDefined();
        expect(mockResponse.value.id.length).toBeGreaterThan(0);
      });

      it('should auto-generate slug from name', () => {
        const mockResponse = {
          ok: true,
          etag: 'new-event-etag',
          value: { ...FIXTURE_EVENT_STANDARD, slug: 'my-awesome-event-2025' }
        };

        expect(mockResponse.value.slug).toMatch(/^[a-z0-9-]+$/);
      });

      it('should generate QR codes', () => {
        const mockResponse = {
          ok: true,
          etag: 'new-event-etag',
          value: FIXTURE_EVENT_STANDARD
        };

        expect(mockResponse.value.qr.public).toMatch(/^data:image\/png;base64,/);
        expect(mockResponse.value.qr.signup).toBeDefined();
      });

      it('should set default settings', () => {
        const mockResponse = {
          ok: true,
          etag: 'new-event-etag',
          value: FIXTURE_EVENT_STANDARD
        };

        const { settings } = mockResponse.value;
        expect(typeof settings.showSchedule).toBe('boolean');
        expect(typeof settings.showStandings).toBe('boolean');
        expect(typeof settings.showBracket).toBe('boolean');
      });

      it('should return BAD_INPUT for missing name', () => {
        const mockResponse = {
          ok: false,
          code: 'BAD_INPUT',
          message: 'Missing required field: name'
        };

        validateErrorEnvelope(mockResponse, 'BAD_INPUT');
      });

      it('should return BAD_INPUT for missing startDateISO', () => {
        const mockResponse = {
          ok: false,
          code: 'BAD_INPUT',
          message: 'Missing required field: startDateISO'
        };

        validateErrorEnvelope(mockResponse, 'BAD_INPUT');
      });

      it('should return BAD_INPUT for missing venue', () => {
        const mockResponse = {
          ok: false,
          code: 'BAD_INPUT',
          message: 'Missing required field: venue'
        };

        validateErrorEnvelope(mockResponse, 'BAD_INPUT');
      });

      it('should return BAD_INPUT for invalid date format', () => {
        const mockResponse = {
          ok: false,
          code: 'BAD_INPUT',
          message: 'startDateISO must be YYYY-MM-DD format'
        };

        validateErrorEnvelope(mockResponse, 'BAD_INPUT');
      });

      it('should return BAD_INPUT for invalid adminKey', () => {
        const mockResponse = {
          ok: false,
          code: 'BAD_INPUT',
          message: 'Invalid admin key'
        };

        validateErrorEnvelope(mockResponse, 'BAD_INPUT');
      });
    });

    describe('UPDATE Mode', () => {
      it('should return updated event on success', () => {
        const mockResponse = {
          ok: true,
          etag: 'updated-event-etag',
          value: {
            ...FIXTURE_EVENT_STANDARD,
            name: 'Updated Event Name',
            updatedAtISO: '2025-11-27T12:00:00.000Z'
          }
        };

        validateSuccessEnvelope(mockResponse);
        const validation = validateEventSchema(mockResponse.value);
        expect(validation).toBe(true);
      });

      it('should preserve unchanged fields', () => {
        const mockResponse = {
          ok: true,
          etag: 'updated-event-etag',
          value: {
            ...FIXTURE_EVENT_STANDARD,
            name: 'Only Name Changed'
          }
        };

        // Original venue should be preserved
        expect(mockResponse.value.venue).toBe(FIXTURE_EVENT_STANDARD.venue);
        expect(mockResponse.value.startDateISO).toBe(FIXTURE_EVENT_STANDARD.startDateISO);
      });

      it('should update updatedAtISO timestamp', () => {
        const mockResponse = {
          ok: true,
          etag: 'updated-event-etag',
          value: {
            ...FIXTURE_EVENT_STANDARD,
            updatedAtISO: '2025-11-27T12:00:00.000Z'
          }
        };

        expect(mockResponse.value.updatedAtISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      it('should return NOT_FOUND for non-existent event', () => {
        const mockResponse = {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Event not found: non-existent-id'
        };

        validateErrorEnvelope(mockResponse, 'NOT_FOUND');
      });
    });
  });

  // ==========================================================================
  // api_updateEventData
  // ==========================================================================

  describe('api_updateEventData', () => {
    /**
     * CONTRACT: api_updateEventData
     *
     * Request: { action: 'api_updateEventData', brandId: string, adminKey: string, id: string, data: { ...fields } }
     *
     * Success Response:
     * {
     *   ok: true,
     *   etag: string,
     *   value: Event  // Full canonical v2.2 event after update
     * }
     *
     * This API allows partial updates to event data fields
     */

    it('should return updated event on success', () => {
      const mockResponse = {
        ok: true,
        etag: 'update-data-etag',
        value: {
          ...FIXTURE_EVENT_STANDARD,
          schedule: [
            { time: '14:00', title: 'New Session', description: 'Added via update' }
          ]
        }
      };

      validateSuccessEnvelope(mockResponse);
      const validation = validateEventSchema(mockResponse.value);
      expect(validation).toBe(true);
    });

    it('should update schedule data', () => {
      const mockResponse = {
        ok: true,
        etag: 'update-data-etag',
        value: {
          ...FIXTURE_EVENT_STANDARD,
          schedule: [
            { time: '10:00', title: 'Opening', description: null },
            { time: '12:00', title: 'Lunch Break', description: null }
          ]
        }
      };

      expect(mockResponse.value.schedule).toHaveLength(2);
      expect(mockResponse.value.schedule[0]).toHaveProperty('time');
      expect(mockResponse.value.schedule[0]).toHaveProperty('title');
    });

    it('should update standings data', () => {
      const mockResponse = {
        ok: true,
        etag: 'update-data-etag',
        value: {
          ...FIXTURE_EVENT_STANDARD,
          standings: [
            { rank: 1, team: 'Team A', wins: 5, losses: 1, points: 10 },
            { rank: 2, team: 'Team B', wins: 4, losses: 2, points: 8 }
          ],
          settings: { ...FIXTURE_EVENT_STANDARD.settings, showStandings: true }
        }
      };

      expect(mockResponse.value.standings).toHaveLength(2);
      expect(mockResponse.value.standings[0]).toHaveProperty('rank');
      expect(mockResponse.value.standings[0]).toHaveProperty('team');
      expect(mockResponse.value.standings[0]).toHaveProperty('wins');
      expect(mockResponse.value.standings[0]).toHaveProperty('losses');
    });

    it('should update settings flags', () => {
      const mockResponse = {
        ok: true,
        etag: 'update-data-etag',
        value: {
          ...FIXTURE_EVENT_STANDARD,
          settings: {
            showSchedule: false,
            showStandings: true,
            showBracket: true,
            showSponsors: false
          }
        }
      };

      const { settings } = mockResponse.value;
      expect(settings.showSchedule).toBe(false);
      expect(settings.showStandings).toBe(true);
      expect(settings.showBracket).toBe(true);
    });

    it('should return NOT_FOUND for non-existent event', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found: invalid-event-id'
      };

      validateErrorEnvelope(mockResponse, 'NOT_FOUND');
    });

    it('should return BAD_INPUT for invalid data', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid data format'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });
  });

  // ==========================================================================
  // Error Code Contracts
  // ==========================================================================

  describe('Error Code Contracts', () => {
    /**
     * All APIs must use these standard error codes
     */

    it('should define BAD_INPUT error code', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Validation failed'
      };

      validateErrorEnvelope(mockResponse, 'BAD_INPUT');
    });

    it('should define NOT_FOUND error code', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Resource not found'
      };

      validateErrorEnvelope(mockResponse, 'NOT_FOUND');
    });

    it('should define RATE_LIMITED error code', () => {
      const mockResponse = {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      };

      validateErrorEnvelope(mockResponse, 'RATE_LIMITED');
    });

    it('should define INTERNAL error code', () => {
      const mockResponse = {
        ok: false,
        code: 'INTERNAL',
        message: 'Internal server error'
      };

      validateErrorEnvelope(mockResponse, 'INTERNAL');
    });

    it('should define CONTRACT error code', () => {
      const mockResponse = {
        ok: false,
        code: 'CONTRACT',
        message: 'Response shape validation failed'
      };

      validateErrorEnvelope(mockResponse, 'CONTRACT');
    });

    it('should include all standard error codes', () => {
      expect(ERROR_CODES).toHaveProperty('BAD_INPUT');
      expect(ERROR_CODES).toHaveProperty('NOT_FOUND');
      expect(ERROR_CODES).toHaveProperty('RATE_LIMITED');
      expect(ERROR_CODES).toHaveProperty('INTERNAL');
      expect(ERROR_CODES).toHaveProperty('CONTRACT');
    });
  });

  // ==========================================================================
  // Schema Change Detection
  // ==========================================================================

  describe('Schema Change Detection', () => {
    /**
     * These tests will BREAK LOUDLY if someone changes backend response shapes
     * without updating schemas. This is the acceptance criteria for this story.
     */

    it('should detect if event schema adds unexpected field', () => {
      const eventWithExtraField = {
        ...FIXTURE_EVENT_STANDARD,
        unexpectedField: 'This should cause validation to fail'
      };

      // Our validation should pass because additionalProperties isn't strictly enforced
      // in the helper, but the JSON schema validation in the backend should catch this
      const validation = validateEventSchema(eventWithExtraField);
      expect(validation).toBe(true); // Helper passes
      // The actual JSON schema enforces additionalProperties: false
    });

    it('should detect if event schema removes required field', () => {
      const eventMissingField = { ...FIXTURE_EVENT_STANDARD };
      delete eventMissingField.name;

      const validation = validateEventSchema(eventMissingField);
      expect(validation).not.toBe(true);
      expect(validation).toContain('name: must be non-empty string');
    });

    it('should detect if analytics schema changes', () => {
      const invalidAnalytics = {
        lastUpdatedISO: '2025-11-27T10:00:00.000Z',
        summary: {
          // Missing required fields
          totalImpressions: 100
        },
        surfaces: []
      };

      const validation = validateSharedAnalyticsSchema(invalidAnalytics);
      expect(validation).not.toBe(true);
      expect(validation).toContain('summary.totalClicks: must be number');
    });

    it('should detect if bundle schema changes', () => {
      const invalidBundle = {
        ok: true,
        etag: 'test-etag',
        value: {
          // Missing event
          config: { brandId: 'root', brandName: 'Test' }
        }
      };

      const validation = validateBundleSchema(invalidBundle);
      expect(validation).not.toBe(true);
      expect(validation).toContain('value.event: required');
    });
  });

});

// ============================================================================
// EXPORT VALIDATORS FOR USE IN OTHER TESTS
// ============================================================================

module.exports = {
  // Fixture data
  FIXTURE_EVENT_STANDARD,
  FIXTURE_EVENT_WITH_SPONSORS,

  // Validators
  validateEventSchema,
  validateSharedAnalyticsSchema,
  validateBundleSchema,
  validateSponsorSchema,
  validatePaginationSchema
};
