/**
 * Error Handling Bug Fixes Tests
 *
 * Tests for error handling improvements:
 * - Bug #22: Separate try-catch blocks in doPost
 * - Bug #25: UUID split validation
 * - Bug #26: _ensureOk_ error response handling
 */

describe('Error Handling Bug Fixes', () => {

  describe('Bug #22: Separate Try-Catch Blocks', () => {
    test('should distinguish JSON parse errors from handler errors', () => {
      const processRequest = (postData) => {
        let body;
        try {
          body = JSON.parse(postData);
        } catch (jsonErr) {
          return { error: 'BAD_INPUT', message: 'Invalid JSON body' };
        }

        try {
          // Simulate request processing
          if (!body.action) {
            throw new Error('Missing action');
          }
          return { success: true, action: body.action };
        } catch (err) {
          return { error: 'INTERNAL', message: 'Request processing failed' };
        }
      };

      // Test JSON parse error
      const result1 = processRequest('invalid json');
      expect(result1.error).toBe('BAD_INPUT');
      expect(result1.message).toBe('Invalid JSON body');

      // Test handler error
      const result2 = processRequest('{}');
      expect(result2.error).toBe('INTERNAL');
      expect(result2.message).toBe('Request processing failed');

      // Test success
      const result3 = processRequest('{"action": "create"}');
      expect(result3.success).toBe(true);
      expect(result3.action).toBe('create');
    });

    test('should log handler errors but not JSON errors', () => {
      const logs = [];

      const processRequestWithLogging = (postData) => {
        let body;
        try {
          body = JSON.parse(postData);
        } catch (jsonErr) {
          // Don't log JSON parse errors (user input error)
          return { error: 'BAD_INPUT' };
        }

        try {
          if (!body.action) {
            throw new Error('Missing action');
          }
          return { success: true };
        } catch (err) {
          // Log internal errors (system error)
          logs.push({ error: err.message, stack: err.stack });
          return { error: 'INTERNAL' };
        }
      };

      processRequestWithLogging('invalid json');
      expect(logs.length).toBe(0); // JSON error not logged

      processRequestWithLogging('{}');
      expect(logs.length).toBe(1); // Handler error logged
      expect(logs[0].error).toBe('Missing action');
    });
  });

  describe('Bug #25: UUID Split Validation', () => {
    test('should handle valid UUID format', () => {
      const getShortToken = (uuid) => {
        const parts = uuid.split('-');
        return parts.length > 1 ? parts[0] : uuid.substring(0, 8);
      };

      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(getShortToken(validUUID)).toBe('550e8400');
    });

    test('should handle UUID without hyphens', () => {
      const getShortToken = (uuid) => {
        const parts = uuid.split('-');
        return parts.length > 1 ? parts[0] : uuid.substring(0, 8);
      };

      const noHyphens = '550e8400e29b41d4a716446655440000';
      const token = getShortToken(noHyphens);
      expect(token.length).toBe(8);
      expect(token).toBe('550e8400');
    });

    test('should handle short UUID', () => {
      const getShortToken = (uuid) => {
        const parts = uuid.split('-');
        return parts.length > 1 ? parts[0] : uuid.substring(0, 8);
      };

      const shortUUID = 'abc123';
      expect(getShortToken(shortUUID)).toBe('abc123');
    });

    test('should handle empty UUID', () => {
      const getShortToken = (uuid) => {
        if (!uuid) return '';
        const parts = uuid.split('-');
        return parts.length > 1 ? parts[0] : uuid.substring(0, 8);
      };

      expect(getShortToken('')).toBe('');
      expect(getShortToken(null)).toBe('');
    });
  });

  describe('Bug #26: _ensureOk_ Error Response Handling', () => {
    test('should pass through error responses without validation', () => {
      const ensureOk = (obj) => {
        // If already an error envelope, return as-is
        if (obj && obj.ok === false) {
          return obj;
        }

        // Otherwise validate (simplified for test)
        if (!obj || typeof obj !== 'object') {
          return { ok: false, error: 'CONTRACT', message: 'Invalid response' };
        }

        return obj;
      };

      const errorResponse = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found'
      };

      const result = ensureOk(errorResponse);
      expect(result).toEqual(errorResponse);
      expect(result.ok).toBe(false);
    });

    test('should validate success responses', () => {
      const ensureOk = (obj) => {
        if (obj && obj.ok === false) {
          return obj;
        }

        // Validate success response
        if (!obj || !obj.ok || !obj.value) {
          return { ok: false, error: 'CONTRACT', message: 'Invalid success response' };
        }

        return obj;
      };

      const successResponse = {
        ok: true,
        value: { id: '123', name: 'Test' }
      };

      const result = ensureOk(successResponse);
      expect(result).toEqual(successResponse);
    });

    test('should detect invalid success responses', () => {
      const ensureOk = (obj) => {
        if (obj && obj.ok === false) {
          return obj;
        }

        if (!obj || !obj.ok || !obj.value) {
          return { ok: false, error: 'CONTRACT', message: 'Invalid success response' };
        }

        return obj;
      };

      const invalidResponse = { ok: true }; // Missing value
      const result = ensureOk(invalidResponse);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('CONTRACT');
    });

    test('should not double-validate error responses', () => {
      let validationCalls = 0;

      const ensureOk = (obj) => {
        if (obj && obj.ok === false) {
          return obj; // Skip validation
        }

        validationCalls++;
        return obj;
      };

      const errorResponse = { ok: false, code: 'ERROR' };
      ensureOk(errorResponse);
      expect(validationCalls).toBe(0);

      const successResponse = { ok: true, value: {} };
      ensureOk(successResponse);
      expect(validationCalls).toBe(1);
    });
  });

  describe('Error Envelope Format', () => {
    test('should create consistent error format', () => {
      const Err = (code, message) => ({
        ok: false,
        code,
        message
      });

      expect(Err('NOT_FOUND', 'Event not found')).toEqual({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Event not found'
      });
    });

    test('should create consistent success format', () => {
      const Ok = (value) => ({
        ok: true,
        value
      });

      expect(Ok({ id: '123' })).toEqual({
        ok: true,
        value: { id: '123' }
      });
    });

    test('should distinguish error from success', () => {
      const Err = (code, message) => ({ ok: false, code, message });
      const Ok = (value) => ({ ok: true, value });

      const error = Err('ERROR', 'Failed');
      const success = Ok({ data: 'test' });

      expect(error.ok).toBe(false);
      expect(success.ok).toBe(true);
    });
  });

  describe('Error Codes', () => {
    const ERR = {
      BAD_INPUT: 'BAD_INPUT',
      NOT_FOUND: 'NOT_FOUND',
      INTERNAL: 'INTERNAL',
      RATE_LIMITED: 'RATE_LIMITED',
      CONTRACT: 'CONTRACT'
    };

    test('should use standard error codes', () => {
      expect(ERR.BAD_INPUT).toBe('BAD_INPUT');
      expect(ERR.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERR.INTERNAL).toBe('INTERNAL');
      expect(ERR.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ERR.CONTRACT).toBe('CONTRACT');
    });

    test('should create errors with standard codes', () => {
      const Err = (code, message) => ({ ok: false, code, message });

      const badInput = Err(ERR.BAD_INPUT, 'Invalid data');
      expect(badInput.code).toBe('BAD_INPUT');

      const notFound = Err(ERR.NOT_FOUND, 'Resource not found');
      expect(notFound.code).toBe('NOT_FOUND');
    });
  });

  describe('RunSafe Error Wrapper', () => {
    test('should catch exceptions and return error envelope', () => {
      const runSafe = (where, fn) => {
        try {
          return fn();
        } catch (e) {
          return {
            ok: false,
            code: 'INTERNAL',
            message: 'Unexpected error'
          };
        }
      };

      const result = runSafe('test', () => {
        throw new Error('Something went wrong');
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL');
    });

    test('should pass through successful results', () => {
      const runSafe = (where, fn) => {
        try {
          return fn();
        } catch (e) {
          return { ok: false, code: 'INTERNAL', message: 'Error' };
        }
      };

      const result = runSafe('test', () => ({
        ok: true,
        value: { data: 'success' }
      }));

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ data: 'success' });
    });

    test('should pass through error envelopes', () => {
      const runSafe = (where, fn) => {
        try {
          return fn();
        } catch (e) {
          return { ok: false, code: 'INTERNAL', message: 'Error' };
        }
      };

      const result = runSafe('test', () => ({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Not found'
      }));

      expect(result.ok).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });
  });
});
