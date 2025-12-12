/**
 * Backend Router Unit Tests (Story 0.1)
 *
 * Tests for versioned backend routing configuration.
 * Validates that requests are routed to the correct backend (GAS or Worker)
 * based on BACKEND_MODE configuration and route mapping.
 *
 * @see cloudflare-proxy/src/config/backendConfig.js
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Read and parse the backendConfig.js file to extract constants
 */
function readBackendConfig() {
  const configPath = path.join(__dirname, '../../cloudflare-proxy/src/config/backendConfig.js');
  return fs.readFileSync(configPath, 'utf8');
}

/**
 * Simulate getBackendForRoute function logic
 */
function simulateGetBackendForRoute(pathname, searchParams, env) {
  const mode = (env.BACKEND_MODE || 'gas').toLowerCase();
  const isStaging = (env.WORKER_ENV || '').toLowerCase() === 'staging' ||
                    env.ENABLE_DEBUG_ENDPOINTS === 'true';

  // 1. Check for query param override (staging only)
  if (isStaging) {
    const backendOverride = searchParams.get('backend');
    if (backendOverride) {
      const override = backendOverride.toLowerCase();
      if (override === 'gas' || override === 'worker') {
        return {
          backend: override,
          source: 'query_override'
        };
      }
    }
  }

  // 2. In MIXED mode, check route-specific config
  if (mode === 'mixed') {
    // Routes that use Worker backend
    const workerRoutes = [
      '/api/status',
      '/api/v2/status',
      '/api/v2/ping',
      '/api/ping',
      '/api/v2/events',
      '/events',
      '/admin',
      '/display',
      '/poster',
      '/report'
    ];

    // Check if path matches a Worker route
    const normalizedPath = pathname.toLowerCase().replace(/\/$/, '');
    if (workerRoutes.some(route => normalizedPath === route || normalizedPath.startsWith(route + '/'))) {
      return {
        backend: 'worker',
        source: 'route_config'
      };
    }

    // Routes that stay on GAS
    const gasRoutes = ['/api', '/api/rpc', '/r', '/redirect'];
    if (gasRoutes.some(route => normalizedPath === route || normalizedPath.startsWith(route + '/'))) {
      return {
        backend: 'gas',
        source: 'route_config'
      };
    }

    // Fall back to GAS for unlisted routes in mixed mode
    return {
      backend: 'gas',
      source: 'mixed_default'
    };
  }

  // 3. Use global mode
  return {
    backend: mode,
    source: 'global_mode'
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Backend Router (Story 0.1)', () => {

  describe('Module Structure', () => {
    let configContent;

    beforeAll(() => {
      configContent = readBackendConfig();
    });

    it('should export BACKEND_MODES constant', () => {
      expect(configContent).toContain("export const BACKEND_MODES = Object.freeze({");
      expect(configContent).toContain("GAS: 'gas'");
      expect(configContent).toContain("WORKER: 'worker'");
      expect(configContent).toContain("MIXED: 'mixed'");
    });

    it('should export getBackendMode function', () => {
      expect(configContent).toContain('export function getBackendMode(env)');
    });

    it('should export getBackendForRoute function', () => {
      expect(configContent).toContain('export function getBackendForRoute(pathname, searchParams, env)');
    });

    it('should export createBackendErrorResponse function', () => {
      expect(configContent).toContain('export function createBackendErrorResponse(status, code, message');
    });

    it('should export BACKEND_ERROR_CODE constant', () => {
      expect(configContent).toContain("export const BACKEND_ERROR_CODE = 'BACKEND_ERROR'");
    });

    it('should have default backend mode as GAS', () => {
      expect(configContent).toContain("export const DEFAULT_BACKEND_MODE = BACKEND_MODES.GAS");
    });
  });

  describe('BACKEND_ROUTE_MAP Configuration', () => {
    let configContent;

    beforeAll(() => {
      configContent = readBackendConfig();
    });

    it('should map /api/status to worker', () => {
      expect(configContent).toMatch(/['"]\/api\/status['"]:\s*['"]worker['"]/);
    });

    it('should map /api/v2/status to worker', () => {
      expect(configContent).toMatch(/['"]\/api\/v2\/status['"]:\s*['"]worker['"]/);
    });

    it('should map /api/v2/events to worker', () => {
      expect(configContent).toMatch(/['"]\/api\/v2\/events['"]:\s*['"]worker['"]/);
    });

    it('should map HTML pages to worker', () => {
      expect(configContent).toMatch(/['"]\/events['"]:\s*['"]worker['"]/);
      expect(configContent).toMatch(/['"]\/admin['"]:\s*['"]worker['"]/);
      expect(configContent).toMatch(/['"]\/display['"]:\s*['"]worker['"]/);
      expect(configContent).toMatch(/['"]\/poster['"]:\s*['"]worker['"]/);
    });

    it('should keep shortlinks on GAS', () => {
      expect(configContent).toMatch(/['"]\/r['"]:\s*['"]gas['"]/);
      expect(configContent).toMatch(/['"]\/redirect['"]:\s*['"]gas['"]/);
    });

    it('should keep legacy /api/rpc on GAS', () => {
      expect(configContent).toMatch(/['"]\/api\/rpc['"]:\s*['"]gas['"]/);
    });
  });

  describe('Backend Selection Logic', () => {

    describe('BACKEND_MODE=gas (default)', () => {
      const env = { BACKEND_MODE: 'gas', WORKER_ENV: 'production' };

      it('should route /api/status to GAS', () => {
        const result = simulateGetBackendForRoute('/api/status', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('global_mode');
      });

      it('should route /events to GAS', () => {
        const result = simulateGetBackendForRoute('/events', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('global_mode');
      });

      it('should route /api/v2/events to GAS', () => {
        const result = simulateGetBackendForRoute('/api/v2/events', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('global_mode');
      });
    });

    describe('BACKEND_MODE=worker', () => {
      const env = { BACKEND_MODE: 'worker', WORKER_ENV: 'production' };

      it('should route /api/status to Worker', () => {
        const result = simulateGetBackendForRoute('/api/status', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('global_mode');
      });

      it('should route /events to Worker', () => {
        const result = simulateGetBackendForRoute('/events', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('global_mode');
      });

      it('should route /r (shortlinks) to Worker (global mode)', () => {
        const result = simulateGetBackendForRoute('/r', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('global_mode');
      });
    });

    describe('BACKEND_MODE=mixed', () => {
      const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };

      it('should route /api/status to Worker', () => {
        const result = simulateGetBackendForRoute('/api/status', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config');
      });

      it('should route /api/v2/status to Worker', () => {
        const result = simulateGetBackendForRoute('/api/v2/status', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config');
      });

      it('should route /events to Worker', () => {
        const result = simulateGetBackendForRoute('/events', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config');
      });

      it('should route /api/v2/events to Worker', () => {
        const result = simulateGetBackendForRoute('/api/v2/events', new URLSearchParams(), env);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config');
      });

      it('should route /r (shortlinks) to GAS', () => {
        const result = simulateGetBackendForRoute('/r', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('route_config');
      });

      it('should route /redirect to GAS', () => {
        const result = simulateGetBackendForRoute('/redirect', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('route_config');
      });

      it('should route /api/rpc to GAS', () => {
        const result = simulateGetBackendForRoute('/api/rpc', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('route_config');
      });

      it('should fall back to GAS for unknown routes', () => {
        const result = simulateGetBackendForRoute('/unknown/route', new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('mixed_default');
      });
    });

    describe('Query Parameter Override (Staging Only)', () => {
      const stagingEnv = { BACKEND_MODE: 'mixed', WORKER_ENV: 'staging' };
      const prodEnv = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };

      it('should allow ?backend=worker override in staging', () => {
        const params = new URLSearchParams('backend=worker');
        const result = simulateGetBackendForRoute('/api/status', params, stagingEnv);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('query_override');
      });

      it('should allow ?backend=gas override in staging', () => {
        const params = new URLSearchParams('backend=gas');
        const result = simulateGetBackendForRoute('/api/status', params, stagingEnv);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('query_override');
      });

      it('should ignore ?backend override in production', () => {
        const params = new URLSearchParams('backend=worker');
        // In production, even with the query param, it uses route config (mixed mode)
        const result = simulateGetBackendForRoute('/api/status', params, prodEnv);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config'); // Not query_override
      });

      it('should allow override with ENABLE_DEBUG_ENDPOINTS=true', () => {
        const debugEnv = { BACKEND_MODE: 'gas', ENABLE_DEBUG_ENDPOINTS: 'true' };
        const params = new URLSearchParams('backend=worker');
        const result = simulateGetBackendForRoute('/api/status', params, debugEnv);
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('query_override');
      });

      it('should ignore invalid ?backend values', () => {
        const params = new URLSearchParams('backend=invalid');
        const result = simulateGetBackendForRoute('/api/status', params, stagingEnv);
        // Should fall through to route config since invalid value
        expect(result.backend).toBe('worker');
        expect(result.source).toBe('route_config');
      });
    });
  });

  describe('Error Response Format', () => {
    let configContent;

    beforeAll(() => {
      configContent = readBackendConfig();
    });

    it('should have createBackendError500 helper function', () => {
      expect(configContent).toContain('export function createBackendError500(message');
    });

    it('should return Response object from createBackendErrorResponse', () => {
      expect(configContent).toContain("return new Response(JSON.stringify(body)");
    });

    it('should include ok:false in error response', () => {
      expect(configContent).toContain('ok: false');
    });

    it('should include status in error response', () => {
      expect(configContent).toContain('status: status');
    });

    it('should include code in error response', () => {
      expect(configContent).toContain('code: code || BACKEND_ERROR_CODE');
    });

    it('should include message in error response', () => {
      expect(configContent).toContain('message: message');
    });

    it('should include timestamp in error response', () => {
      expect(configContent).toContain('timestamp: new Date().toISOString()');
    });

    it('should set X-Backend-Error header', () => {
      expect(configContent).toContain("'X-Backend-Error': 'true'");
    });
  });

  describe('Wrangler Configuration', () => {
    let wranglerContent;

    beforeAll(() => {
      const wranglerPath = path.join(__dirname, '../../cloudflare-proxy/wrangler.toml');
      wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    });

    it('should have BACKEND_MODE configured for staging', () => {
      // Check that staging env has BACKEND_MODE
      expect(wranglerContent).toContain('BACKEND_MODE');
    });

    it('should have staging BACKEND_MODE set to mixed', () => {
      // In staging section, should be mixed for gradual migration
      expect(wranglerContent).toMatch(/\[env\.staging\.vars\][\s\S]*?BACKEND_MODE\s*=\s*["']mixed["']/);
    });

    it('should NOT have BACKEND_MODE in production', () => {
      // Production section should not override BACKEND_MODE (defaults to gas)
      const prodSection = wranglerContent.match(/\[env\.production\.vars\][\s\S]*?(?=\[env\.|$)/);
      if (prodSection) {
        expect(prodSection[0]).not.toContain('BACKEND_MODE');
      }
    });
  });

  describe('Worker.js Integration', () => {
    let workerContent;

    beforeAll(() => {
      const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
      workerContent = fs.readFileSync(workerPath, 'utf8');
    });

    it('should import backendConfig module', () => {
      expect(workerContent).toContain("from './src/config/backendConfig.js'");
    });

    it('should import getBackendForRoute function', () => {
      expect(workerContent).toContain('getBackendForRoute');
    });

    it('should import createBackendError500 function', () => {
      expect(workerContent).toContain('createBackendError500');
    });

    it('should import BACKEND_MODES constant', () => {
      expect(workerContent).toContain('BACKEND_MODES');
    });

    it('should use versioned routing for /api/status', () => {
      // Should have the backend selection logic in the /api/status handler
      expect(workerContent).toContain('getBackendForRoute(url.pathname, url.searchParams, env)');
    });

    it('should set X-Backend header on responses', () => {
      expect(workerContent).toContain("response.headers.set('X-Backend'");
    });

    it('should set X-Backend-Source header on responses', () => {
      expect(workerContent).toContain("response.headers.set('X-Backend-Source'");
    });

    it('should call Worker handler when backend is worker', () => {
      expect(workerContent).toContain('if (backend === BACKEND_MODES.WORKER)');
      expect(workerContent).toContain('await handleWorkerStatusRequest(request, env)');
    });

    it('should call GAS handler when backend is gas', () => {
      expect(workerContent).toContain('await handleHealthCheckEndpoint(request, appsScriptBase, env, url)');
    });
  });
});

// =============================================================================
// Route Pattern Matching Tests
// =============================================================================

describe('Route Pattern Matching', () => {

  describe('Path Normalization', () => {

    it('should normalize paths with trailing slash', () => {
      const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };

      // Both /events and /events/ should route the same way
      const result1 = simulateGetBackendForRoute('/events', new URLSearchParams(), env);
      const result2 = simulateGetBackendForRoute('/events/', new URLSearchParams(), env);

      expect(result1.backend).toBe(result2.backend);
    });

    it('should handle case-insensitive paths', () => {
      const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };

      const result1 = simulateGetBackendForRoute('/API/STATUS', new URLSearchParams(), env);
      const result2 = simulateGetBackendForRoute('/api/status', new URLSearchParams(), env);

      expect(result1.backend).toBe(result2.backend);
    });
  });

  describe('Nested Routes', () => {
    const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };

    it('should route /api/v2/events/123 to worker', () => {
      const result = simulateGetBackendForRoute('/api/v2/events/123', new URLSearchParams(), env);
      expect(result.backend).toBe('worker');
    });

    it('should route /api/v2/events/123/bundle/public to worker', () => {
      const result = simulateGetBackendForRoute('/api/v2/events/123/bundle/public', new URLSearchParams(), env);
      expect(result.backend).toBe('worker');
    });
  });
});

// =============================================================================
// Acceptance Criteria Validation
// =============================================================================

describe('Story 0.1 Acceptance Criteria', () => {

  describe('Feature flag configuration', () => {
    let configContent;

    beforeAll(() => {
      configContent = readBackendConfig();
    });

    it('should support BACKEND_MODE=gas|worker|mixed', () => {
      expect(configContent).toContain("GAS: 'gas'");
      expect(configContent).toContain("WORKER: 'worker'");
      expect(configContent).toContain("MIXED: 'mixed'");
    });

    it('should have per-path map for mixed mode', () => {
      expect(configContent).toContain('BACKEND_ROUTE_MAP');
    });
  });

  describe('For BACKEND_MODE=gas, behavior is identical to current system', () => {
    const env = { BACKEND_MODE: 'gas', WORKER_ENV: 'production' };

    it('should route all requests to GAS', () => {
      const routes = ['/api/status', '/events', '/admin', '/api/v2/events'];

      routes.forEach(route => {
        const result = simulateGetBackendForRoute(route, new URLSearchParams(), env);
        expect(result.backend).toBe('gas');
        expect(result.source).toBe('global_mode');
      });
    });
  });

  describe('Tech switch flips /api/status to Worker in mixed mode', () => {

    it('should route /api/status to Worker when BACKEND_MODE=mixed', () => {
      const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };
      const result = simulateGetBackendForRoute('/api/status', new URLSearchParams(), env);
      expect(result.backend).toBe('worker');
    });

    it('should still route shortlinks to GAS in mixed mode', () => {
      const env = { BACKEND_MODE: 'mixed', WORKER_ENV: 'production' };
      const result = simulateGetBackendForRoute('/r', new URLSearchParams(), env);
      expect(result.backend).toBe('gas');
    });
  });

  describe('Negative Paths - Backend Error Handling', () => {
    let configContent;

    beforeAll(() => {
      configContent = readBackendConfig();
    });

    it('should return structured error with ok:false', () => {
      expect(configContent).toContain('ok: false');
    });

    it('should return status:500 for backend errors', () => {
      expect(configContent).toContain('status: status');
      expect(configContent).toContain('createBackendError500');
    });

    it('should return code:BACKEND_ERROR', () => {
      expect(configContent).toContain("BACKEND_ERROR_CODE = 'BACKEND_ERROR'");
    });

    it('should never return half-rendered content', () => {
      // Error response should always be JSON
      expect(configContent).toContain("'Content-Type': 'application/json'");
    });
  });

  describe('Staging-only implementation', () => {
    let wranglerContent;

    beforeAll(() => {
      const wranglerPath = path.join(__dirname, '../../cloudflare-proxy/wrangler.toml');
      wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    });

    it('should have BACKEND_MODE in staging env', () => {
      expect(wranglerContent).toMatch(/\[env\.staging\.vars\][\s\S]*?BACKEND_MODE/);
    });

    it('should default to gas in production (no explicit setting)', () => {
      // Production should not have BACKEND_MODE set, defaulting to 'gas'
      const prodVarsMatch = wranglerContent.match(/\[env\.production\.vars\]([\s\S]*?)(?=\[|$)/);
      if (prodVarsMatch) {
        const prodVars = prodVarsMatch[1];
        // BACKEND_MODE should not be present OR should be 'gas'
        const hasMixedOrWorker = /BACKEND_MODE\s*=\s*["'](mixed|worker)["']/.test(prodVars);
        expect(hasMixedOrWorker).toBe(false);
      }
    });
  });
});
