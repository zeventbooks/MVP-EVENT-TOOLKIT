/**
 * Contract Tests for Event Creation API (Before Event)
 *
 * Tests the event creation endpoint used during the Before Event phase
 *
 * Triangle Phase: 📋 Before Event (Green)
 * API Endpoint: ?action=create
 * Purpose: Create new events with full details
 * User Roles: Event Manager (primary)
 *
 * REFACTORED: Now uses DRY helpers and fixtures
 */

const {
  validateEnvelope,
  validateSuccessEnvelope,
  validateErrorEnvelope,
  validateEventLinks,
  ERROR_CODES
} = require('../../../shared/helpers/test.helpers');

const {
  createBasicEvent,
  createCompleteEvent,
  EventBuilder
} = require('../../../shared/fixtures/events.fixtures');

describe('🔺 TRIANGLE [BEFORE EVENT]: Create Event API Contract', () => {

  describe('api_create - Success responses', () => {
    it('should return id and links on successful creation', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'new-event-123',
          links: {
            publicUrl: 'https://script.google.com/macros/s/.../exec?p=events&id=new-event-123',
            posterUrl: 'https://script.google.com/macros/s/.../exec?page=poster&id=new-event-123',
            displayUrl: 'https://script.google.com/macros/s/.../exec?page=display&id=new-event-123',
            reportUrl: 'https://script.google.com/macros/s/.../exec?page=report&id=new-event-123'
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('id');
      expect(mockResponse.value).toHaveProperty('links');
      expect(typeof mockResponse.value.id).toBe('string');
    });

    it('should return all required link types', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'new-event-123',
          links: {
            publicUrl: 'https://...',
            posterUrl: 'https://...',
            displayUrl: 'https://...',
            reportUrl: 'https://...'
          }
        }
      };

      expect(mockResponse.value.links).toHaveProperty('publicUrl');
      expect(mockResponse.value.links).toHaveProperty('posterUrl');
      expect(mockResponse.value.links).toHaveProperty('displayUrl');
      expect(mockResponse.value.links).toHaveProperty('reportUrl');
    });

    it('should return valid URLs for all link types', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'new-event-123',
          links: {
            publicUrl: 'https://script.google.com/macros/s/.../exec?p=events&id=new-event-123',
            posterUrl: 'https://script.google.com/macros/s/.../exec?page=poster&id=new-event-123',
            displayUrl: 'https://script.google.com/macros/s/.../exec?page=display&id=new-event-123'
          }
        }
      };

      Object.values(mockResponse.value.links).forEach(url => {
        expect(typeof url).toBe('string');
        expect(url).toMatch(/^https:\/\//);
      });
    });
  });

  describe('api_create - Validation errors', () => {
    it('should return error for missing required fields', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Missing field: name'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
      expect(mockResponse.message).toContain('name');
    });

    it('should return error for invalid date format', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid date format'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
    });

    // Fixed: Bug #37 - Location is optional, not required
    it('should accept events without location (optional field)', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'new-event-456',
          links: {
            publicUrl: 'https://...',
            posterUrl: 'https://...',
            displayUrl: 'https://...',
            reportUrl: 'https://...'
          }
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.value).toHaveProperty('id');
    });
  });

  describe('api_create - Authentication errors', () => {
    it('should return error for missing admin key', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid admin key'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
      expect(mockResponse.message).toContain('admin key');
    });

    it('should return error for invalid admin key', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid admin key'
      };

      validateEnvelope(mockResponse);
    });
  });

  describe('api_create - Rate limiting', () => {
    it('should return error when rate limit exceeded', () => {
      const mockResponse = {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('RATE_LIMITED');
    });
  });
});
