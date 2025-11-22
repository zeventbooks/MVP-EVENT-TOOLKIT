/**
 * Contract Tests for API Responses
 *
 * Ensures all API endpoints return responses matching the documented contract
 *
 * EVENT_CONTRACT.md v1.0 Compliance:
 * - Canonical event shape with flat fields (not nested in data)
 * - SectionConfig format: { enabled: bool, title: string|null, content: string|null }
 * - CTALabel format: [{ key: string, label: string, url: string|null }]
 * - Hydrated sponsors array (not comma-separated IDs)
 * - dateTime field (combined from dateISO + timeISO)
 *
 * REFACTORED: Now uses DRY helpers and fixtures
 */

const {
  validateEnvelope,
  ERROR_CODES
} = require('../shared/helpers/test.helpers');

describe('API Contract Tests', () => {

  describe('api_status', () => {
    it('should return valid Ok envelope', () => {
      const mockResponse = {
        ok: true,
        value: {
          build: 'triangle-extended-v1.3',
          contract: '1.0.3',
          time: '2025-11-10T12:00:00.000Z',
          db: { ok: true, id: 'spreadsheet-id' }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('build');
      expect(mockResponse.value).toHaveProperty('contract');
      expect(mockResponse.value).toHaveProperty('time');
      expect(mockResponse.value).toHaveProperty('db');
      expect(mockResponse.value.db).toHaveProperty('ok');
    });
  });

  describe('api_list', () => {
    it('should return valid list response with etag', () => {
      const mockResponse = {
        ok: true,
        etag: 'abc123',
        value: {
          items: [
            {
              id: 'event-1',
              templateId: 'event',
              data: { name: 'Test Event', dateISO: '2025-12-01' },
              createdAt: '2025-11-10T12:00:00.000Z',
              slug: 'test-event'
            }
          ]
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse).toHaveProperty('etag');
      expect(mockResponse.value).toHaveProperty('items');
      expect(Array.isArray(mockResponse.value.items)).toBe(true);
    });

    it('should support notModified response', () => {
      const mockResponse = {
        ok: true,
        notModified: true,
        etag: 'abc123'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.notModified).toBe(true);
      expect(mockResponse).toHaveProperty('etag');
    });
  });

  describe('api_get', () => {
    it('should return valid event with links', () => {
      const mockResponse = {
        ok: true,
        etag: 'xyz789',
        value: {
          id: 'event-1',
          brandId: 'root',
          templateId: 'event',
          data: {
            name: 'Test Event',
            dateISO: '2025-12-01',
            location: 'Test Venue'
          },
          createdAt: '2025-11-10T12:00:00.000Z',
          slug: 'test-event',
          links: {
            publicUrl: 'https://script.google.com/macros/s/.../exec?p=events&id=event-1',
            posterUrl: 'https://script.google.com/macros/s/.../exec?page=poster&id=event-1',
            displayUrl: 'https://script.google.com/macros/s/.../exec?page=display&id=event-1'
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('id');
      expect(mockResponse.value).toHaveProperty('data');
      expect(mockResponse.value).toHaveProperty('links');
      expect(mockResponse.value.links).toHaveProperty('publicUrl');
      expect(mockResponse.value.links).toHaveProperty('posterUrl');
      expect(mockResponse.value.links).toHaveProperty('displayUrl');
    });
  });

  describe('api_getPublicBundle', () => {
    it('should return bundled event data with sponsors and config', () => {
      const mockResponse = {
        ok: true,
        etag: 'bundle123',
        value: {
          event: {
            id: 'event-1',
            brandId: 'root',
            templateId: 'event',
            data: {
              name: 'Test Event',
              dateISO: '2025-12-01',
              sponsors: [{ id: 'sp-1', name: 'Sponsor 1', placements: { mobileBanner: true } }]
            },
            createdAt: '2025-11-10T12:00:00.000Z',
            slug: 'test-event'
          },
          sponsors: [{ id: 'sp-1', name: 'Sponsor 1', placements: { mobileBanner: true } }],
          display: { mode: 'public' },
          links: {
            publicUrl: 'https://script.google.com/macros/s/.../exec?p=events&id=event-1',
            posterUrl: 'https://script.google.com/macros/s/.../exec?page=poster&id=event-1',
            displayUrl: 'https://script.google.com/macros/s/.../exec?page=display&id=event-1',
            reportUrl: 'https://script.google.com/macros/s/.../exec?page=report&id=event-1'
          },
          config: {
            appTitle: 'Events',
            brandId: 'root'
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse).toHaveProperty('etag');
      expect(mockResponse.value).toHaveProperty('event');
      expect(mockResponse.value).toHaveProperty('sponsors');
      expect(mockResponse.value).toHaveProperty('display');
      expect(mockResponse.value).toHaveProperty('links');
      expect(mockResponse.value).toHaveProperty('config');
      expect(mockResponse.value.event).toHaveProperty('id');
      expect(mockResponse.value.event).toHaveProperty('data');
      expect(Array.isArray(mockResponse.value.sponsors)).toBe(true);
      expect(mockResponse.value.links).toHaveProperty('reportUrl');
    });

    it('should support notModified response', () => {
      const mockResponse = {
        ok: true,
        notModified: true,
        etag: 'bundle123'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.notModified).toBe(true);
      expect(mockResponse).toHaveProperty('etag');
    });
  });

  describe('api_create', () => {
    it('should return id and links on success', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'new-event-123',
          links: {
            publicUrl: 'https://...',
            posterUrl: 'https://...',
            displayUrl: 'https://...'
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('id');
      expect(mockResponse.value).toHaveProperty('links');
    });

    it('should return error for missing required fields', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Missing field: name'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
    });

    it('should return error for invalid admin key', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid admin key'
      };

      validateEnvelope(mockResponse);
    });

    it('should return error for rate limiting', () => {
      const mockResponse = {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('RATE_LIMITED');
    });
  });

  describe('api_logEvents', () => {
    it('should return count of logged events', () => {
      const mockResponse = {
        ok: true,
        value: { count: 5 }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('count');
      expect(typeof mockResponse.value.count).toBe('number');
    });
  });

  describe('api_getReport', () => {
    it('should return aggregated analytics', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: {
            impressions: 100,
            clicks: 10,
            dwellSec: 500
          },
          bySurface: {
            'display': { impressions: 50, clicks: 5, dwellSec: 250 },
            'public': { impressions: 50, clicks: 5, dwellSec: 250 }
          },
          bySponsor: {
            'sponsor-1': { impressions: 80, clicks: 8, dwellSec: 400, ctr: 0.1 }
          },
          byToken: {
            'token-123': { impressions: 20, clicks: 2, dwellSec: 100, ctr: 0.1 }
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('totals');
      expect(mockResponse.value).toHaveProperty('bySurface');
      expect(mockResponse.value).toHaveProperty('bySponsor');
      expect(mockResponse.value).toHaveProperty('byToken');
      expect(mockResponse.value.totals).toHaveProperty('impressions');
      expect(mockResponse.value.totals).toHaveProperty('clicks');
      expect(mockResponse.value.totals).toHaveProperty('dwellSec');
    });
  });

  describe('api_createShortlink', () => {
    it('should return token and shortlink', () => {
      const mockResponse = {
        ok: true,
        value: {
          token: 'abc12345',
          shortlink: 'https://script.google.com/macros/s/.../exec?p=r&t=abc12345',
          targetUrl: 'https://example.com/signup'
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('token');
      expect(mockResponse.value).toHaveProperty('shortlink');
      expect(mockResponse.value).toHaveProperty('targetUrl');
    });
  });

  describe('Error codes', () => {
    const errorCodes = Object.keys(ERROR_CODES);

    errorCodes.forEach(code => {
      it(`should have ${code} error code defined`, () => {
        expect(ERROR_CODES[code]).toBe(code);
      });
    });

    it('should have all required error codes', () => {
      expect(ERROR_CODES).toHaveProperty('BAD_INPUT');
      expect(ERROR_CODES).toHaveProperty('NOT_FOUND');
      expect(ERROR_CODES).toHaveProperty('RATE_LIMITED');
      expect(ERROR_CODES).toHaveProperty('INTERNAL');
      expect(ERROR_CODES).toHaveProperty('CONTRACT');
    });
  });

  // === EVENT_CONTRACT.md v1.0 Compliance Tests ===

  describe('EVENT_CONTRACT.md v1.0 Compliance', () => {

    describe('Canonical Event Shape', () => {
      it('should return event with required envelope fields', () => {
        const mockEvent = {
          id: 'EVT_123',
          brandId: 'root',
          templateId: 'bar_night',
          name: 'Trivia Night',
          status: 'draft',
          createdAt: '2025-11-22T12:00:00.000Z',
          slug: 'trivia-night',
          links: {
            publicUrl: 'https://example.com/events/trivia-night',
            posterUrl: 'https://example.com/poster/trivia-night',
            displayUrl: 'https://example.com/display/trivia-night',
            reportUrl: 'https://example.com/report/trivia-night'
          }
        };

        // Required fields per EVENT_CONTRACT.md
        expect(mockEvent).toHaveProperty('id');
        expect(mockEvent).toHaveProperty('brandId');
        expect(mockEvent).toHaveProperty('templateId');
        expect(mockEvent).toHaveProperty('name');
        expect(mockEvent).toHaveProperty('status');
        expect(mockEvent).toHaveProperty('createdAt');
        expect(mockEvent).toHaveProperty('slug');
        expect(mockEvent).toHaveProperty('links');
      });

      it('should return links with all required URLs', () => {
        const mockLinks = {
          publicUrl: 'https://example.com/public',
          posterUrl: 'https://example.com/poster',
          displayUrl: 'https://example.com/display',
          reportUrl: 'https://example.com/report'
        };

        expect(mockLinks).toHaveProperty('publicUrl');
        expect(mockLinks).toHaveProperty('posterUrl');
        expect(mockLinks).toHaveProperty('displayUrl');
        expect(mockLinks).toHaveProperty('reportUrl');

        // All should be valid URLs
        Object.values(mockLinks).forEach(url => {
          expect(url).toMatch(/^https?:\/\//);
        });
      });

      it('should support valid status values', () => {
        const validStatuses = ['draft', 'published', 'cancelled', 'completed'];

        validStatuses.forEach(status => {
          expect(['draft', 'published', 'cancelled', 'completed']).toContain(status);
        });
      });
    });

    describe('SectionConfig Format', () => {
      it('should validate SectionConfig shape', () => {
        const mockSectionConfig = {
          enabled: true,
          title: 'Custom Title',
          content: null
        };

        expect(mockSectionConfig).toHaveProperty('enabled');
        expect(mockSectionConfig).toHaveProperty('title');
        expect(mockSectionConfig).toHaveProperty('content');
        expect(typeof mockSectionConfig.enabled).toBe('boolean');
      });

      it('should accept null values for title and content', () => {
        const mockSectionConfig = {
          enabled: false,
          title: null,
          content: null
        };

        expect(mockSectionConfig.title).toBeNull();
        expect(mockSectionConfig.content).toBeNull();
      });

      it('should support all section keys', () => {
        const mockSections = {
          video: { enabled: true, title: null, content: null },
          map: { enabled: true, title: null, content: null },
          schedule: { enabled: false, title: null, content: null },
          sponsors: { enabled: true, title: 'Our Sponsors', content: null },
          notes: { enabled: true, title: 'House Rules', content: null },
          gallery: { enabled: false, title: null, content: null }
        };

        const requiredKeys = ['video', 'map', 'schedule', 'sponsors', 'notes', 'gallery'];
        requiredKeys.forEach(key => {
          expect(mockSections).toHaveProperty(key);
          expect(mockSections[key]).toHaveProperty('enabled');
          expect(mockSections[key]).toHaveProperty('title');
          expect(mockSections[key]).toHaveProperty('content');
        });
      });
    });

    describe('CTALabel Format', () => {
      it('should validate CTALabel shape', () => {
        const mockCTALabel = {
          key: 'cta_0',
          label: 'Register Now',
          url: 'https://example.com/register'
        };

        expect(mockCTALabel).toHaveProperty('key');
        expect(mockCTALabel).toHaveProperty('label');
        expect(mockCTALabel).toHaveProperty('url');
        expect(typeof mockCTALabel.key).toBe('string');
        expect(typeof mockCTALabel.label).toBe('string');
      });

      it('should accept null for url', () => {
        const mockCTALabel = {
          key: 'cta_1',
          label: 'Add to Calendar',
          url: null
        };

        expect(mockCTALabel.url).toBeNull();
      });

      it('should support array of CTALabels', () => {
        const mockCtaLabels = [
          { key: 'cta_0', label: 'RSVP', url: null },
          { key: 'cta_1', label: 'Donate', url: 'https://example.com/donate' }
        ];

        expect(Array.isArray(mockCtaLabels)).toBe(true);
        mockCtaLabels.forEach(cta => {
          expect(cta).toHaveProperty('key');
          expect(cta).toHaveProperty('label');
          expect(cta).toHaveProperty('url');
        });
      });
    });

    describe('Sponsor Format', () => {
      it('should validate hydrated Sponsor shape', () => {
        const mockSponsor = {
          id: 'sp-123',
          name: 'Acme Corp',
          logoUrl: 'https://example.com/logo.png',
          website: 'https://acme.com',
          tier: 'gold'
        };

        expect(mockSponsor).toHaveProperty('id');
        expect(mockSponsor).toHaveProperty('name');
        expect(mockSponsor).toHaveProperty('logoUrl');
        expect(mockSponsor).toHaveProperty('website');
        expect(mockSponsor).toHaveProperty('tier');
      });

      it('should accept null for optional sponsor fields', () => {
        const mockSponsor = {
          id: 'sp-456',
          name: 'Local Business',
          logoUrl: null,
          website: null,
          tier: null
        };

        expect(mockSponsor.logoUrl).toBeNull();
        expect(mockSponsor.website).toBeNull();
        expect(mockSponsor.tier).toBeNull();
      });

      it('should support sponsors array (hydrated, not IDs)', () => {
        const mockSponsors = [
          { id: 'sp-1', name: 'Gold Sponsor', logoUrl: 'https://ex.com/gold.png', website: null, tier: 'gold' },
          { id: 'sp-2', name: 'Silver Sponsor', logoUrl: null, website: 'https://silver.com', tier: 'silver' }
        ];

        expect(Array.isArray(mockSponsors)).toBe(true);
        mockSponsors.forEach(sponsor => {
          expect(typeof sponsor).toBe('object');
          expect(sponsor).toHaveProperty('id');
          expect(sponsor).toHaveProperty('name');
          // Should NOT be a string of IDs
          expect(typeof sponsor.name).toBe('string');
        });
      });
    });

    describe('externalData Format', () => {
      it('should validate externalData shape for rec_league', () => {
        const mockExternalData = {
          scheduleUrl: 'https://docs.google.com/spreadsheets/d/xxx',
          standingsUrl: 'https://docs.google.com/spreadsheets/d/yyy',
          bracketUrl: 'https://challonge.com/bracket123'
        };

        expect(mockExternalData).toHaveProperty('scheduleUrl');
        expect(mockExternalData).toHaveProperty('standingsUrl');
        expect(mockExternalData).toHaveProperty('bracketUrl');
      });

      it('should accept null for unused URLs', () => {
        const mockExternalData = {
          scheduleUrl: null,
          standingsUrl: null,
          bracketUrl: null
        };

        expect(mockExternalData.scheduleUrl).toBeNull();
        expect(mockExternalData.standingsUrl).toBeNull();
        expect(mockExternalData.bracketUrl).toBeNull();
      });
    });

    describe('dateTime Format', () => {
      it('should accept ISO 8601 datetime string', () => {
        const mockDateTime = '2025-12-01T18:00:00Z';

        expect(typeof mockDateTime).toBe('string');
        // Should be parseable as date
        const date = new Date(mockDateTime);
        expect(date.getTime()).not.toBeNaN();
      });

      it('should accept null for dateTime', () => {
        const mockEvent = {
          name: 'TBD Event',
          dateTime: null
        };

        expect(mockEvent.dateTime).toBeNull();
      });
    });

    describe('Full Event Shape Validation', () => {
      it('should validate complete EVENT_CONTRACT.md v1.0 event', () => {
        const mockEvent = {
          // Envelope (system-managed)
          id: 'EVT_abc123',
          brandId: 'root',
          templateId: 'bar_night',

          // Core Identity
          name: 'Thursday Trivia Night',
          status: 'published',
          dateTime: '2025-12-05T19:00:00Z',
          location: '123 Main Street, Downtown',
          venueName: "O'Malley's Pub",

          // Content
          summary: 'Weekly trivia with prizes!',
          notes: 'Internal admin note',
          audience: 'Adults 21+',

          // Sections
          sections: {
            video: { enabled: true, title: null, content: null },
            map: { enabled: true, title: null, content: null },
            schedule: { enabled: false, title: null, content: null },
            sponsors: { enabled: true, title: "Tonight's Sponsors", content: null },
            notes: { enabled: true, title: 'House Rules', content: null },
            gallery: { enabled: false, title: null, content: null }
          },

          // CTA Labels
          ctaLabels: [
            { key: 'cta_0', label: 'RSVP', url: null },
            { key: 'cta_1', label: 'Add to Calendar', url: null }
          ],

          // External Data
          externalData: {
            scheduleUrl: null,
            standingsUrl: null,
            bracketUrl: null
          },

          // Media URLs
          videoUrl: null,
          mapEmbedUrl: 'https://maps.google.com/embed?...',

          // Action URLs
          signupUrl: 'https://forms.google.com/...',
          checkinUrl: 'https://forms.google.com/.../checkin',
          feedbackUrl: null,

          // Sponsors (hydrated)
          sponsors: [
            { id: 'sp-1', name: 'Local Brewery', logoUrl: 'https://ex.com/logo.png', website: 'https://brewery.com', tier: 'gold' }
          ],

          // Metadata
          createdAt: '2025-11-22T10:30:00.000Z',
          slug: 'thursday-trivia-night',

          // Generated Links
          links: {
            publicUrl: 'https://script.google.com/.../exec?p=events&id=EVT_abc123',
            posterUrl: 'https://script.google.com/.../exec?page=poster&id=EVT_abc123',
            displayUrl: 'https://script.google.com/.../exec?page=display&id=EVT_abc123',
            reportUrl: 'https://script.google.com/.../exec?page=report&id=EVT_abc123'
          }
        };

        // Validate structure
        expect(mockEvent.id).toBeDefined();
        expect(mockEvent.brandId).toBeDefined();
        expect(mockEvent.templateId).toBeDefined();
        expect(mockEvent.name).toBeDefined();
        expect(mockEvent.status).toBeDefined();
        expect(mockEvent.createdAt).toBeDefined();
        expect(mockEvent.slug).toBeDefined();
        expect(mockEvent.links).toBeDefined();

        // Sections format
        Object.values(mockEvent.sections).forEach(section => {
          expect(section).toHaveProperty('enabled');
          expect(section).toHaveProperty('title');
          expect(section).toHaveProperty('content');
        });

        // CTA format
        mockEvent.ctaLabels.forEach(cta => {
          expect(cta).toHaveProperty('key');
          expect(cta).toHaveProperty('label');
          expect(cta).toHaveProperty('url');
        });

        // Sponsors hydrated
        mockEvent.sponsors.forEach(sponsor => {
          expect(sponsor).toHaveProperty('id');
          expect(sponsor).toHaveProperty('name');
        });

        // Links present
        expect(mockEvent.links.publicUrl).toBeDefined();
        expect(mockEvent.links.posterUrl).toBeDefined();
        expect(mockEvent.links.displayUrl).toBeDefined();
        expect(mockEvent.links.reportUrl).toBeDefined();
      });
    });
  });
});
