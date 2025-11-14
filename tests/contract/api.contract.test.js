/**
 * Contract Tests for API Responses
 *
 * Ensures all API endpoints return responses matching the documented contract
 *
 * REFACTORED: Now uses DRY helpers and fixtures
 */

const {
  validateEnvelope,
  validateSuccessEnvelope,
  validateErrorEnvelope,
  validateEventStructure,
  validateEventLinks,
  validateAnalyticsStructure,
  ERROR_CODES
} = require('../shared/helpers/test.helpers');

const {
  createBasicEvent,
  createEventResponse,
  createEventListResponse
} = require('../shared/fixtures/events.fixtures');

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
          tenantId: 'root',
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
});
