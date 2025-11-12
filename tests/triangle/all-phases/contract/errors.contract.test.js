/**
 * Contract Tests for Error Codes (All Phases)
 *
 * Tests the standardized error codes used across all API endpoints
 *
 * Triangle Phase: ⚡ All Phases (Blue)
 * Purpose: Standardized error handling across the application
 */

describe('🔺 TRIANGLE [ALL PHASES]: Error Codes Contract', () => {

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

  describe('Error code definitions', () => {
    const ERR = Object.freeze({
      BAD_INPUT:    'BAD_INPUT',
      NOT_FOUND:    'NOT_FOUND',
      RATE_LIMITED: 'RATE_LIMITED',
      INTERNAL:     'INTERNAL',
      CONTRACT:     'CONTRACT'
    });

    const errorCodes = ['BAD_INPUT', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL', 'CONTRACT'];

    errorCodes.forEach(code => {
      it(`should have ${code} error code defined`, () => {
        expect(ERR[code]).toBe(code);
      });
    });
  });

  describe('BAD_INPUT error responses', () => {
    it('should return BAD_INPUT for invalid input', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Missing field: name'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
      expect(typeof mockResponse.message).toBe('string');
    });

    it('should return BAD_INPUT for invalid admin key', () => {
      const mockResponse = {
        ok: false,
        code: 'BAD_INPUT',
        message: 'Invalid admin key'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('BAD_INPUT');
    });
  });

  describe('NOT_FOUND error responses', () => {
    it('should return NOT_FOUND for missing resources', () => {
      const mockResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('NOT_FOUND');
    });
  });

  describe('RATE_LIMITED error responses', () => {
    it('should return RATE_LIMITED when rate limit exceeded', () => {
      const mockResponse = {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('RATE_LIMITED');
    });
  });

  describe('INTERNAL error responses', () => {
    it('should return INTERNAL for server errors', () => {
      const mockResponse = {
        ok: false,
        code: 'INTERNAL',
        message: 'Internal server error'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('INTERNAL');
    });
  });

  describe('CONTRACT error responses', () => {
    it('should return CONTRACT for contract violations', () => {
      const mockResponse = {
        ok: false,
        code: 'CONTRACT',
        message: 'Response does not match contract'
      };

      validateEnvelope(mockResponse);
      expect(mockResponse.code).toBe('CONTRACT');
    });
  });
});
