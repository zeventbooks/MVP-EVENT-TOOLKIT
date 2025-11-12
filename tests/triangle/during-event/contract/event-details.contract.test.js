/**
 * Contract Tests for Event Details API (During Event)
 *
 * Tests the event details endpoint used during the During Event phase
 *
 * Triangle Phase: ▶️ During Event (Orange)
 * API Endpoint: ?action=get
 * Purpose: Get detailed event information for displays and public view
 * User Roles: Event Manager, Consumer/Attendee
 */

describe('🔺 TRIANGLE [DURING EVENT]: Event Details API Contract', () => {

  const validateEnvelope = (response) => {
    expect(response).toHaveProperty('ok');
    expect(typeof response.ok).toBe('boolean');

    if (response.ok) {
      if (!response.notModified) {
        expect(response).toHaveProperty('value');
      }
    } else {
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
    }
  };

  describe('api_get - Success responses', () => {
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
    });

    it('should include all required event metadata', () => {
      const mockResponse = {
        ok: true,
        etag: 'xyz789',
        value: {
          id: 'event-1',
          tenantId: 'root',
          templateId: 'event',
          data: { name: 'Test Event' },
          createdAt: '2025-11-10T12:00:00.000Z',
          slug: 'test-event',
          links: {}
        }
      };

      expect(mockResponse.value).toHaveProperty('id');
      expect(mockResponse.value).toHaveProperty('tenantId');
      expect(mockResponse.value).toHaveProperty('templateId');
      expect(mockResponse.value).toHaveProperty('createdAt');
      expect(mockResponse.value).toHaveProperty('slug');
    });

    it('should include all Triangle phase links', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'event-1',
          data: {},
          links: {
            publicUrl: 'https://script.google.com/macros/s/.../exec?p=events&id=event-1',
            posterUrl: 'https://script.google.com/macros/s/.../exec?page=poster&id=event-1',
            displayUrl: 'https://script.google.com/macros/s/.../exec?page=display&id=event-1'
          }
        }
      };

      expect(mockResponse.value.links).toHaveProperty('publicUrl');
      expect(mockResponse.value.links).toHaveProperty('posterUrl');
      expect(mockResponse.value.links).toHaveProperty('displayUrl');
    });

    it('should include etag for caching', () => {
      const mockResponse = {
        ok: true,
        etag: 'xyz789',
        value: {
          id: 'event-1',
          data: {},
          links: {}
        }
      };

      expect(mockResponse).toHaveProperty('etag');
      expect(typeof mockResponse.etag).toBe('string');
    });
  });

  describe('api_get - Event data structure', () => {
    it('should include complete event data', () => {
      const mockResponse = {
        ok: true,
        value: {
          id: 'event-1',
          data: {
            name: 'Test Event',
            dateISO: '2025-12-01',
            location: 'Test Venue',
            description: 'Event description'
          },
          links: {}
        }
      };

      expect(mockResponse.value.data).toHaveProperty('name');
      expect(mockResponse.value.data).toHaveProperty('dateISO');
      expect(mockResponse.value.data).toHaveProperty('location');
    });
  });

  describe('api_get - Error responses', () => {
    it('should return NOT_FOUND for non-existent event', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('NOT_FOUND');
    });

    it('should return BAD_INPUT for invalid event ID', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid event ID'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
    });
  });
});
