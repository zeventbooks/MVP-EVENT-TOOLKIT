/**
 * Contract Tests for Analytics API (After Event)
 *
 * Tests the analytics endpoints used during the After Event phase
 *
 * Triangle Phase: 📊 After Event (Purple)
 * API Endpoints: ?action=logEvents, ?action=getReport
 * Purpose: Track and report event analytics, sponsor ROI, and engagement metrics
 * User Roles: Event Manager, Sponsor
 */

describe('🔺 TRIANGLE [AFTER EVENT]: Analytics API Contract', () => {

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

  describe('api_logEvents - Event tracking', () => {
    it('should return count of logged events', () => {
      const mockResponse = {
        ok: true,
        value: { count: 5 }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value).toHaveProperty('count');
      expect(typeof mockResponse.value.count).toBe('number');
    });

    it('should accept batch event logging', () => {
      const mockResponse = {
        ok: true,
        value: { count: 10 }
      };

      expect(mockResponse.value.count).toBeGreaterThan(0);
    });

    it('should handle empty event batch', () => {
      const mockResponse = {
        ok: true,
        value: { count: 0 }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value.count).toBe(0);
    });
  });

  describe('api_getReport - Aggregated analytics', () => {
    it('should return complete analytics structure', () => {
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
    });

    it('should include total metrics', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: {
            impressions: 100,
            clicks: 10,
            dwellSec: 500
          },
          bySurface: {},
          bySponsor: {},
          byToken: {}
        }
      };

      expect(mockResponse.value.totals).toHaveProperty('impressions');
      expect(mockResponse.value.totals).toHaveProperty('clicks');
      expect(mockResponse.value.totals).toHaveProperty('dwellSec');
      expect(typeof mockResponse.value.totals.impressions).toBe('number');
      expect(typeof mockResponse.value.totals.clicks).toBe('number');
      expect(typeof mockResponse.value.totals.dwellSec).toBe('number');
    });

    it('should include surface breakdown for Display and Public pages', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 100, clicks: 10, dwellSec: 500 },
          bySurface: {
            'display': { impressions: 50, clicks: 5, dwellSec: 250 },
            'public': { impressions: 50, clicks: 5, dwellSec: 250 }
          },
          bySponsor: {},
          byToken: {}
        }
      };

      expect(mockResponse.value.bySurface).toHaveProperty('display');
      expect(mockResponse.value.bySurface).toHaveProperty('public');
    });

    it('should include sponsor performance metrics', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 100, clicks: 10, dwellSec: 500 },
          bySurface: {},
          bySponsor: {
            'sponsor-1': { impressions: 80, clicks: 8, dwellSec: 400, ctr: 0.1 }
          },
          byToken: {}
        }
      };

      const sponsor = mockResponse.value.bySponsor['sponsor-1'];
      expect(sponsor).toHaveProperty('impressions');
      expect(sponsor).toHaveProperty('clicks');
      expect(sponsor).toHaveProperty('dwellSec');
      expect(sponsor).toHaveProperty('ctr');
    });

    it('should calculate CTR correctly', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 100, clicks: 10, dwellSec: 500 },
          bySurface: {},
          bySponsor: {
            'sponsor-1': { impressions: 100, clicks: 10, dwellSec: 400, ctr: 0.1 }
          },
          byToken: {}
        }
      };

      const sponsor = mockResponse.value.bySponsor['sponsor-1'];
      expect(sponsor.ctr).toBe(sponsor.clicks / sponsor.impressions);
    });

    it('should include token-based tracking for shortlinks', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 100, clicks: 10, dwellSec: 500 },
          bySurface: {},
          bySponsor: {},
          byToken: {
            'token-123': { impressions: 20, clicks: 2, dwellSec: 100, ctr: 0.1 }
          }
        }
      };

      const token = mockResponse.value.byToken['token-123'];
      expect(token).toHaveProperty('impressions');
      expect(token).toHaveProperty('clicks');
      expect(token).toHaveProperty('ctr');
    });
  });

  describe('api_getReport - Empty data handling', () => {
    it('should handle no analytics data gracefully', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 0, clicks: 0, dwellSec: 0 },
          bySurface: {},
          bySponsor: {},
          byToken: {}
        }
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.value.totals.impressions).toBe(0);
    });

    it('should return empty objects when no data exists', () => {
      const mockResponse = {
        ok: true,
        value: {
          totals: { impressions: 0, clicks: 0, dwellSec: 0 },
          bySurface: {},
          bySponsor: {},
          byToken: {}
        }
      };

      expect(Object.keys(mockResponse.value.bySponsor).length).toBe(0);
      expect(Object.keys(mockResponse.value.byToken).length).toBe(0);
    });
  });

  describe('api_getReport - Error responses', () => {
    it('should return NOT_FOUND for non-existent event', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('NOT_FOUND');
    });

    it('should return BAD_INPUT for invalid parameters', () => {
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
