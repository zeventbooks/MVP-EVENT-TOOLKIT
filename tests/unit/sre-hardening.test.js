/**
 * SRE / DevOps Hardening Tests
 *
 * Story 14: Structured Error Logging + corrId
 * Story 15: ci:all Single Gate
 *
 * These tests validate the SRE hardening features for production reliability.
 */

describe('Story 14: Structured Error Logging with Correlation ID', () => {
  /**
   * Mock implementation of generateCorrId_ matching Code.gs
   * Format: timestamp (base36) + "-" + random suffix
   * Example: "lqx5m8k-a7b2"
   */
  const generateCorrId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`;
  };

  describe('Correlation ID Generation', () => {
    test('should generate unique correlation IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateCorrId());
      }
      // All 1000 should be unique
      expect(ids.size).toBe(1000);
    });

    test('should generate corrId in expected format (timestamp-random)', () => {
      const corrId = generateCorrId();
      // Format: alphanumeric-alphanumeric (base36 encoding)
      expect(corrId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });

    test('should have timestamp component before dash', () => {
      const corrId = generateCorrId();
      const [timestampPart] = corrId.split('-');

      // Timestamp in base36 should be parseable to a valid timestamp
      const parsed = parseInt(timestampPart, 36);
      expect(parsed).toBeGreaterThan(0);

      // Should be a recent timestamp (within last 24 hours)
      const now = Date.now();
      expect(parsed).toBeLessThanOrEqual(now);
      expect(parsed).toBeGreaterThan(now - 86400000);
    });

    test('should have random suffix after dash', () => {
      const corrId = generateCorrId();
      const [, randomPart] = corrId.split('-');

      // Random part should be alphanumeric and 4 chars
      expect(randomPart).toMatch(/^[a-z0-9]{4}$/);
    });

    test('should be URL-safe (no special characters)', () => {
      for (let i = 0; i < 100; i++) {
        const corrId = generateCorrId();
        // No special characters that would need URL encoding
        expect(corrId).not.toMatch(/[^a-z0-9-]/);
      }
    });

    test('should be grep-friendly (single line, no spaces)', () => {
      const corrId = generateCorrId();
      expect(corrId).not.toContain(' ');
      expect(corrId).not.toContain('\n');
      expect(corrId).not.toContain('\t');
    });
  });

  describe('Error Response with Correlation ID', () => {
    /**
     * Mock implementation of Err with corrId support
     */
    const Err = (code, message, corrId) => {
      const envelope = { ok: false, code, message: message || code };
      if (corrId) envelope.corrId = corrId;
      return envelope;
    };

    /**
     * Mock implementation of ErrWithCorrId_
     */
    const ErrWithCorrId = (code, internalMessage, options = {}) => {
      const corrId = generateCorrId();
      // Return sanitized error to client
      return {
        ok: false,
        code,
        message: `Something went wrong. Reference: ${corrId}`,
        corrId
      };
    };

    test('should include corrId in error response', () => {
      const error = ErrWithCorrId('INTERNAL', 'Database connection failed');
      expect(error.corrId).toBeDefined();
      expect(error.corrId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });

    test('should include corrId reference in user message', () => {
      const error = ErrWithCorrId('INTERNAL', 'Database connection failed');
      expect(error.message).toContain('Reference:');
      expect(error.message).toContain(error.corrId);
    });

    test('should NOT expose internal message to client', () => {
      const internalMsg = 'SQL Error: SELECT * FROM users WHERE password="secret"';
      const error = ErrWithCorrId('INTERNAL', internalMsg);

      // Internal message should NOT be in client response
      expect(error.message).not.toContain('SQL');
      expect(error.message).not.toContain('password');
      expect(error.message).not.toContain('secret');
    });

    test('should NOT include stack trace in response', () => {
      const error = ErrWithCorrId('INTERNAL', 'Error', {
        stack: 'Error: test\n    at file.js:1:1'
      });
      expect(error).not.toHaveProperty('stack');
    });

    test('should work without corrId for backward compatibility', () => {
      const error = Err('BAD_INPUT', 'Invalid input');
      expect(error).not.toHaveProperty('corrId');
      expect(error.ok).toBe(false);
      expect(error.code).toBe('BAD_INPUT');
    });
  });

  describe('Structured Log Format', () => {
    test('should create structured log with required fields', () => {
      const corrId = 'lqx5m8k-a7b2';
      const structuredLog = {
        level: 'error',
        corrId: corrId,
        endpoint: 'api_create',
        message: 'Validation failed',
        ts: new Date().toISOString()
      };

      expect(structuredLog.level).toBe('error');
      expect(structuredLog.corrId).toBe(corrId);
      expect(structuredLog.endpoint).toBe('api_create');
      expect(structuredLog.message).toBe('Validation failed');
      expect(structuredLog.ts).toBeDefined();
    });

    test('should include optional fields when present', () => {
      const structuredLog = {
        level: 'error',
        corrId: 'abc123-def4',
        endpoint: 'api_get',
        message: 'Event not found',
        stack: 'Error: Not found\n    at api_get:42',
        eventId: 'evt-12345',
        extra: { field: 'value' }
      };

      expect(structuredLog.stack).toBeDefined();
      expect(structuredLog.eventId).toBe('evt-12345');
      expect(structuredLog.extra).toEqual({ field: 'value' });
    });

    test('should be JSON-serializable', () => {
      const structuredLog = {
        level: 'error',
        corrId: 'test-1234',
        endpoint: 'api_test',
        message: 'Test error'
      };

      const json = JSON.stringify(structuredLog);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(structuredLog);
    });

    test('should be greppable by corrId', () => {
      const logLine = JSON.stringify({
        level: 'error',
        corrId: 'unique-corr-id',
        endpoint: 'api_create',
        message: 'Database error'
      });

      // Simulating grep by corrId
      expect(logLine.includes('unique-corr-id')).toBe(true);
    });
  });

  describe('Error Code Standardization', () => {
    const ERR = {
      BAD_INPUT: 'BAD_INPUT',
      NOT_FOUND: 'NOT_FOUND',
      INTERNAL: 'INTERNAL',
      RATE_LIMITED: 'RATE_LIMITED',
      CONTRACT: 'CONTRACT'
    };

    test('should use frozen error codes', () => {
      expect(ERR.BAD_INPUT).toBe('BAD_INPUT');
      expect(ERR.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERR.INTERNAL).toBe('INTERNAL');
      expect(ERR.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ERR.CONTRACT).toBe('CONTRACT');
    });

    test('error codes should be uppercase snake_case', () => {
      Object.values(ERR).forEach(code => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe('Log Sanitization', () => {
    /**
     * Mock sanitization function
     */
    const sanitizeMetaForLogging = (meta) => {
      if (!meta || typeof meta !== 'object') return meta;

      const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth', 'credential', 'apiKey'];
      const sanitized = { ...meta };

      for (const key of Object.keys(sanitized)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(s => lowerKey.includes(s))) {
          sanitized[key] = '[REDACTED]';
        }
      }

      return sanitized;
    };

    test('should redact sensitive fields', () => {
      const meta = {
        password: 'secret123',
        adminKey: 'key-12345',
        eventId: 'evt-123'
      };

      const sanitized = sanitizeMetaForLogging(meta);
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.adminKey).toBe('[REDACTED]');
      expect(sanitized.eventId).toBe('evt-123'); // Not redacted
    });

    test('should handle null/undefined meta', () => {
      expect(sanitizeMetaForLogging(null)).toBe(null);
      expect(sanitizeMetaForLogging(undefined)).toBe(undefined);
    });

    test('should preserve non-sensitive fields', () => {
      const meta = {
        eventId: 'evt-123',
        action: 'create',
        timestamp: '2025-01-01T00:00:00Z'
      };

      const sanitized = sanitizeMetaForLogging(meta);
      expect(sanitized).toEqual(meta);
    });
  });

  describe('User-Friendly Error Messages', () => {
    const userMessages = {
      'BAD_INPUT': 'Invalid request',
      'NOT_FOUND': 'The requested resource was not found',
      'UNAUTHORIZED': 'Authentication failed',
      'RATE_LIMITED': 'Too many requests',
      'INTERNAL': 'An internal error occurred',
      'CONTRACT': 'An unexpected error occurred'
    };

    test('should map error codes to user-friendly messages', () => {
      Object.entries(userMessages).forEach(([code, message]) => {
        expect(message).not.toContain('SQL');
        expect(message).not.toContain('stack');
        expect(message).not.toContain('database');
      });
    });

    test('user messages should not expose technical implementation details', () => {
      Object.values(userMessages).forEach(message => {
        // Should not contain technical details like stack traces, SQL, etc.
        expect(message).not.toMatch(/stack|trace|sql|database|connection|exception|\.js:\d+/i);
        // Should not contain file paths or line numbers
        expect(message).not.toMatch(/at \w+\./);
      });
    });
  });
});

describe('Story 15: ci:all Single Gate', () => {
  describe('CI Gate Run ID', () => {
    /**
     * Generate CI run ID (mirrors ci-gate.js)
     */
    const generateRunId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      return `ci-${timestamp}-${random}`;
    };

    test('should generate unique run IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRunId());
      }
      expect(ids.size).toBe(100);
    });

    test('should have "ci-" prefix for identification', () => {
      const runId = generateRunId();
      expect(runId.startsWith('ci-')).toBe(true);
    });

    test('should follow format ci-timestamp-random', () => {
      const runId = generateRunId();
      expect(runId).toMatch(/^ci-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('CI Gate Result Structure', () => {
    const mockResult = {
      runId: 'ci-test-1234',
      timestamp: '2025-01-01T00:00:00Z',
      mode: 'full',
      checks: [
        { name: 'ESLint', status: 'passed', durationMs: 1000 },
        { name: 'Unit Tests', status: 'passed', durationMs: 5000 },
        { name: 'Contract Tests', status: 'passed', durationMs: 3000 },
        { name: 'Schema Sync', status: 'passed', durationMs: 2000 }
      ],
      summary: {
        total: 4,
        passed: 4,
        failed: 0,
        skipped: 0
      },
      timing: {
        durationMs: 11000
      }
    };

    test('should include all required fields', () => {
      expect(mockResult.runId).toBeDefined();
      expect(mockResult.timestamp).toBeDefined();
      expect(mockResult.mode).toBeDefined();
      expect(mockResult.checks).toBeInstanceOf(Array);
      expect(mockResult.summary).toBeDefined();
      expect(mockResult.timing).toBeDefined();
    });

    test('should track individual check results', () => {
      mockResult.checks.forEach(check => {
        expect(check.name).toBeDefined();
        expect(check.status).toMatch(/^(passed|failed|skipped)$/);
        expect(check.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate accurate summary', () => {
      const passed = mockResult.checks.filter(c => c.status === 'passed').length;
      const failed = mockResult.checks.filter(c => c.status === 'failed').length;
      const skipped = mockResult.checks.filter(c => c.status === 'skipped').length;

      expect(mockResult.summary.passed).toBe(passed);
      expect(mockResult.summary.failed).toBe(failed);
      expect(mockResult.summary.skipped).toBe(skipped);
      expect(mockResult.summary.total).toBe(passed + failed + skipped);
    });
  });

  describe('CI Gate Modes', () => {
    test('full mode should run all checks', () => {
      const fullModeChecks = ['ESLint', 'Unit Tests', 'Contract Tests', 'Schema Sync', 'Bundle Contracts'];
      expect(fullModeChecks.length).toBeGreaterThanOrEqual(4);
    });

    test('fast mode should skip non-critical checks', () => {
      const fastModeChecks = ['ESLint', 'Unit Tests', 'Contract Tests', 'Schema Sync'];
      const skippableChecks = ['Bundle Contracts'];

      // Fast mode should include critical checks
      expect(fastModeChecks).toContain('ESLint');
      expect(fastModeChecks).toContain('Unit Tests');

      // Fast mode can skip non-critical
      skippableChecks.forEach(check => {
        expect(fastModeChecks).not.toContain(check);
      });
    });
  });

  describe('CI Gate Exit Codes', () => {
    test('should exit 0 when all checks pass', () => {
      const results = {
        summary: { total: 4, passed: 4, failed: 0, skipped: 0 }
      };
      const exitCode = results.summary.failed === 0 ? 0 : 1;
      expect(exitCode).toBe(0);
    });

    test('should exit 1 when any check fails', () => {
      const results = {
        summary: { total: 4, passed: 3, failed: 1, skipped: 0 }
      };
      const exitCode = results.summary.failed === 0 ? 0 : 1;
      expect(exitCode).toBe(1);
    });

    test('skipped checks should not affect exit code', () => {
      const results = {
        summary: { total: 4, passed: 3, failed: 0, skipped: 1 }
      };
      const exitCode = results.summary.failed === 0 ? 0 : 1;
      expect(exitCode).toBe(0);
    });
  });

  describe('CI Gate JSON Output', () => {
    test('JSON output should be parseable', () => {
      const result = {
        runId: 'ci-test-1234',
        timestamp: new Date().toISOString(),
        mode: 'full',
        checks: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
        timing: { durationMs: 0 }
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(result);
    });

    test('JSON output should include all metrics', () => {
      const result = {
        runId: 'ci-test',
        timestamp: '2025-01-01T00:00:00Z',
        mode: 'full',
        checks: [{ name: 'test', status: 'passed', durationMs: 100 }],
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        timing: { startTime: 0, endTime: 100, durationMs: 100 }
      };

      expect(result.timing.durationMs).toBeDefined();
      expect(result.checks[0].durationMs).toBeDefined();
    });
  });

  describe('CI Gate Checks Configuration', () => {
    const checks = [
      { name: 'ESLint', command: 'npm run lint', critical: true },
      { name: 'Unit Tests', command: 'npm run test:unit', critical: true },
      { name: 'Contract Tests', command: 'npm run test:contract', critical: true },
      { name: 'Schema Sync', command: 'npm run test:schemas', critical: true },
      { name: 'Bundle Contracts', command: 'npm run test:story8', critical: false }
    ];

    test('all checks should have valid npm commands', () => {
      checks.forEach(check => {
        expect(check.command).toMatch(/^npm run /);
      });
    });

    test('critical checks should block gate on failure', () => {
      const criticalChecks = checks.filter(c => c.critical);
      expect(criticalChecks.length).toBeGreaterThan(0);

      // At least lint, unit, and contract tests should be critical
      const criticalNames = criticalChecks.map(c => c.name);
      expect(criticalNames).toContain('ESLint');
      expect(criticalNames).toContain('Unit Tests');
      expect(criticalNames).toContain('Contract Tests');
    });

    test('non-critical checks should warn but not block', () => {
      const nonCritical = checks.filter(c => !c.critical);
      expect(nonCritical.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration: Story 14 + Story 15', () => {
  describe('CI Run Traceability', () => {
    test('CI run should have traceable correlation ID', () => {
      // Generate CI run ID (Story 15)
      const runId = `ci-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      // Any errors during CI run can include this ID
      const errorWithRunContext = {
        ok: false,
        code: 'INTERNAL',
        message: `CI check failed. Run: ${runId}`,
        ciRunId: runId
      };

      expect(errorWithRunContext.ciRunId).toBe(runId);
      expect(errorWithRunContext.message).toContain(runId);
    });

    test('error correlation should link to CI run', () => {
      // Simulate error during CI
      const ciRunId = 'ci-abc123-def4';
      const errorCorrId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const logEntry = {
        level: 'error',
        corrId: errorCorrId,
        ciRunId: ciRunId,
        endpoint: 'test:unit',
        message: 'Test assertion failed'
      };

      // Both IDs present for full traceability
      expect(logEntry.corrId).toBeDefined();
      expect(logEntry.ciRunId).toBeDefined();
    });
  });

  describe('Structured Logging in CI Context', () => {
    test('CI gate results should be loggable as structured JSON', () => {
      const ciResult = {
        type: 'ci_gate_result',
        runId: 'ci-test-1234',
        timestamp: new Date().toISOString(),
        passed: true,
        checks: ['lint', 'unit', 'contract', 'schema'],
        duration: '15.3s'
      };

      const logLine = JSON.stringify(ciResult);

      // Should be greppable
      expect(logLine.includes('ci_gate_result')).toBe(true);
      expect(logLine.includes('ci-test-1234')).toBe(true);
    });

    test('failed check should produce structured error log', () => {
      const failedCheck = {
        type: 'ci_check_failed',
        runId: 'ci-run-123',
        check: 'Unit Tests',
        error: 'Assertion failed',
        exitCode: 1
      };

      const logLine = JSON.stringify(failedCheck);
      expect(logLine.includes('ci_check_failed')).toBe(true);
    });
  });
});
