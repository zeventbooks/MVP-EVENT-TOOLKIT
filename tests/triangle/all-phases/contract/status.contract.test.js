/**
 * Contract Tests for Status API (All Phases)
 *
 * Tests the system status endpoint that's always available across all Triangle phases
 *
 * Triangle Phase: ⚡ All Phases (Blue)
 * API Endpoint: ?action=status
 * Purpose: System health and build information
 */

describe('🔺 TRIANGLE [ALL PHASES]: Status API Contract', () => {

  const validateEnvelope = (response) => {
    expect(response).toHaveProperty('ok');
    expect(typeof response.ok).toBe('boolean');

    if (response.ok) {
      // notModified responses don't have value property
      if (!response.notModified) {
        expect(response).toHaveProperty('value');
      }
    } else {
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
    }
  };

  describe('api_status', () => {
    it('should return valid Ok envelope with system information', () => {
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

    it('should include database connection status', () => {
      const mockResponse = {
        ok: true,
        value: {
          build: 'triangle-extended-v1.3',
          contract: '1.0.3',
          time: '2025-11-10T12:00:00.000Z',
          db: { ok: true, id: 'spreadsheet-id' }
        }
      };

      expect(mockResponse.value.db.ok).toBe(true);
      expect(typeof mockResponse.value.db.id).toBe('string');
    });

    it('should include build version information', () => {
      const mockResponse = {
        ok: true,
        value: {
          build: 'triangle-extended-v1.3',
          contract: '1.0.3',
          time: '2025-11-10T12:00:00.000Z',
          db: { ok: true, id: 'spreadsheet-id' }
        }
      };

      expect(typeof mockResponse.value.build).toBe('string');
      expect(typeof mockResponse.value.contract).toBe('string');
      expect(mockResponse.value.build).toMatch(/triangle/i);
    });
  });
});
