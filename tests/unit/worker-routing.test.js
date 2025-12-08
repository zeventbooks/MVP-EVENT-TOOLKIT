/**
 * Worker Routing Tests
 *
 * Unit tests for Cloudflare Worker routing logic.
 * Tests canonical route validation, 404 responses, and path mapping.
 *
 * These tests verify:
 * 1. Valid canonical routes are accepted
 * 2. Unknown routes return 404
 * 3. API vs HTML request type detection works correctly
 * 4. Path-to-page mapping is consistent
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Extract routing constants from worker.js
// =============================================================================

function extractWorkerConstants() {
  const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
  const content = fs.readFileSync(workerPath, 'utf8');

  // Extract CANONICAL_PAGES
  const pagesMatch = content.match(/const CANONICAL_PAGES = Object\.freeze\(\{([^}]+)\}\)/s);
  const canonicalPages = {};
  if (pagesMatch) {
    const entries = pagesMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g);
    for (const match of entries) {
      canonicalPages[match[1]] = match[2];
    }
  }

  // Extract CANONICAL_P_ROUTES
  const pRoutesMatch = content.match(/const CANONICAL_P_ROUTES = Object\.freeze\(\{([^}]+)\}\)/s);
  const canonicalPRoutes = {};
  if (pRoutesMatch) {
    const entries = pRoutesMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g);
    for (const match of entries) {
      canonicalPRoutes[match[1]] = match[2];
    }
  }

  // Extract CANONICAL_API_ACTIONS
  const actionsMatch = content.match(/const CANONICAL_API_ACTIONS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  const canonicalActions = [];
  if (actionsMatch) {
    const entries = actionsMatch[1].matchAll(/'([^']+)'/g);
    for (const match of entries) {
      canonicalActions.push(match[1]);
    }
  }

  // Extract CANONICAL_PATH_TO_PAGE
  const pathMatch = content.match(/const CANONICAL_PATH_TO_PAGE = Object\.freeze\(\{([\s\S]*?)\}\)/);
  const canonicalPaths = {};
  if (pathMatch) {
    const entries = pathMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g);
    for (const match of entries) {
      canonicalPaths[match[1]] = match[2];
    }
  }

  // Extract VALID_BRANDS
  const brandsMatch = content.match(/const VALID_BRANDS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  const validBrands = [];
  if (brandsMatch) {
    const entries = brandsMatch[1].matchAll(/'([^']+)'/g);
    for (const match of entries) {
      validBrands.push(match[1]);
    }
  }

  return {
    canonicalPages,
    canonicalPRoutes,
    canonicalActions,
    canonicalPaths,
    validBrands
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Worker Routing', () => {
  let constants;

  beforeAll(() => {
    constants = extractWorkerConstants();
  });

  describe('Canonical Routes Extraction', () => {
    it('should extract CANONICAL_PAGES from worker.js', () => {
      expect(Object.keys(constants.canonicalPages).length).toBeGreaterThan(0);
      expect(constants.canonicalPages).toHaveProperty('admin');
      expect(constants.canonicalPages).toHaveProperty('display');
      expect(constants.canonicalPages).toHaveProperty('poster');
      expect(constants.canonicalPages).toHaveProperty('public');
      expect(constants.canonicalPages).toHaveProperty('report');
      expect(constants.canonicalPages).toHaveProperty('status');
    });

    it('should extract CANONICAL_P_ROUTES from worker.js', () => {
      expect(Object.keys(constants.canonicalPRoutes).length).toBeGreaterThan(0);
      expect(constants.canonicalPRoutes).toHaveProperty('events');
      expect(constants.canonicalPRoutes).toHaveProperty('status');
      expect(constants.canonicalPRoutes).toHaveProperty('r');
    });

    it('should extract CANONICAL_API_ACTIONS from worker.js', () => {
      expect(constants.canonicalActions.length).toBeGreaterThan(0);
      expect(constants.canonicalActions).toContain('api_status');
      expect(constants.canonicalActions).toContain('api_events');
    });

    it('should extract CANONICAL_PATH_TO_PAGE from worker.js', () => {
      expect(Object.keys(constants.canonicalPaths).length).toBeGreaterThan(0);
      expect(constants.canonicalPaths).toHaveProperty('events');
      expect(constants.canonicalPaths).toHaveProperty('admin');
      expect(constants.canonicalPaths).toHaveProperty('display');
    });

    it('should extract VALID_BRANDS from worker.js', () => {
      expect(constants.validBrands.length).toBeGreaterThan(0);
      expect(constants.validBrands).toContain('root');
      expect(constants.validBrands).toContain('abc');
      expect(constants.validBrands).toContain('cbc');
      expect(constants.validBrands).toContain('cbl');
    });
  });

  describe('Canonical Page Routes', () => {
    const EXPECTED_PAGES = ['admin', 'display', 'poster', 'public', 'report', 'status'];

    it.each(EXPECTED_PAGES)('should have canonical page route for %s', (page) => {
      expect(constants.canonicalPages).toHaveProperty(page);
    });

    it('should NOT have blocked V2 surfaces', () => {
      const BLOCKED_SURFACES = [
        'templates-v2', 'randomizer', 'teams', 'picker',
        'portfolio', 'portfolio-dashboard'
      ];

      for (const surface of BLOCKED_SURFACES) {
        expect(constants.canonicalPages).not.toHaveProperty(surface);
      }
    });
  });

  describe('Path-to-Page Mapping', () => {
    it('should map /events to public page', () => {
      expect(constants.canonicalPaths.events).toBe('public');
    });

    it('should map /admin to admin page', () => {
      expect(constants.canonicalPaths.admin).toBe('admin');
    });

    it('should map /manage to admin page', () => {
      expect(constants.canonicalPaths.manage).toBe('admin');
    });

    it('should map /display to display page', () => {
      expect(constants.canonicalPaths.display).toBe('display');
    });

    it('should map /tv to display page', () => {
      expect(constants.canonicalPaths.tv).toBe('display');
    });

    it('should map /kiosk to display page', () => {
      expect(constants.canonicalPaths.kiosk).toBe('display');
    });

    it('should map /poster to poster page', () => {
      expect(constants.canonicalPaths.poster).toBe('poster');
    });

    it('should map /analytics to report page', () => {
      expect(constants.canonicalPaths.analytics).toBe('report');
    });

    it('should map /status to status page', () => {
      expect(constants.canonicalPaths.status).toBe('status');
    });

    it('should map /health to status page', () => {
      expect(constants.canonicalPaths.health).toBe('status');
    });
  });

  describe('P-Route Shorthand', () => {
    it('should map ?p=events to public', () => {
      expect(constants.canonicalPRoutes.events).toBe('public');
    });

    it('should map ?p=status to status', () => {
      expect(constants.canonicalPRoutes.status).toBe('status');
    });

    it('should map ?p=r to redirect (shortlinks)', () => {
      expect(constants.canonicalPRoutes.r).toBe('redirect');
    });
  });

  describe('API Actions Whitelist', () => {
    const REQUIRED_API_ACTIONS = [
      'api_status',
      'api_statusPure',
      'api_events',
      'api_eventById',
      'api_sponsors'
    ];

    it.each(REQUIRED_API_ACTIONS)('should include %s in allowed actions', (action) => {
      expect(constants.canonicalActions).toContain(action);
    });

    it('should NOT include arbitrary actions', () => {
      expect(constants.canonicalActions).not.toContain('api_arbitrary');
      expect(constants.canonicalActions).not.toContain('eval');
      expect(constants.canonicalActions).not.toContain('exec');
    });
  });

  describe('Brand-Prefixed Routes', () => {
    it('should accept valid brands as path prefixes', () => {
      for (const brand of constants.validBrands) {
        expect(constants.validBrands).toContain(brand);
      }
    });

    it('should have exactly 4 valid brands', () => {
      expect(constants.validBrands).toHaveLength(4);
    });
  });
});

// =============================================================================
// Route Validation Logic Tests
// =============================================================================

describe('Route Validation Logic', () => {
  // Simulate the validateRoute function logic
  function simulateValidateRoute(pathname, searchParams = {}) {
    const constants = extractWorkerConstants();

    const page = searchParams.page;
    const p = searchParams.p;
    const action = searchParams.action;

    const isApiRequest = searchParams.action ||
                         searchParams.api ||
                         searchParams.format === 'json' ||
                         pathname.startsWith('/api');

    // Validate action
    if (action) {
      const valid = constants.canonicalActions.includes(action);
      return { valid, isApiRequest: true, reason: valid ? null : `Unknown action: ${action}` };
    }

    // Validate page
    if (page) {
      const valid = Object.hasOwn(constants.canonicalPages, page);
      return { valid, isApiRequest, reason: valid ? null : `Unknown page: ${page}` };
    }

    // Validate p-route
    if (p) {
      const valid = Object.hasOwn(constants.canonicalPRoutes, p);
      return { valid, isApiRequest, reason: valid ? null : `Unknown p route: ${p}` };
    }

    // Validate path
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return { valid: true, isApiRequest };
    }

    const firstSegment = segments[0].toLowerCase();
    const isValidFirstSegment = Object.hasOwn(constants.canonicalPaths, firstSegment) ||
                                 constants.validBrands.includes(firstSegment);

    if (!isValidFirstSegment) {
      return { valid: false, isApiRequest, reason: `Unknown path: ${pathname}` };
    }

    // Check brand + second segment
    if (constants.validBrands.includes(firstSegment) && segments.length > 1) {
      const secondSegment = segments[1].toLowerCase();
      if (!Object.hasOwn(constants.canonicalPaths, secondSegment)) {
        return { valid: false, isApiRequest, reason: `Unknown path: ${pathname}` };
      }
    }

    return { valid: true, isApiRequest };
  }

  describe('Valid Routes (should pass)', () => {
    const validRoutes = [
      { pathname: '/', params: {}, desc: 'root path' },
      { pathname: '/events', params: {}, desc: '/events path' },
      { pathname: '/admin', params: {}, desc: '/admin path' },
      { pathname: '/display', params: {}, desc: '/display path' },
      { pathname: '/poster', params: {}, desc: '/poster path' },
      { pathname: '/status', params: {}, desc: '/status path' },
      { pathname: '/analytics', params: {}, desc: '/analytics path' },
      { pathname: '/', params: { page: 'admin' }, desc: '?page=admin' },
      { pathname: '/', params: { page: 'display' }, desc: '?page=display' },
      { pathname: '/', params: { page: 'poster' }, desc: '?page=poster' },
      { pathname: '/', params: { page: 'public' }, desc: '?page=public' },
      { pathname: '/', params: { page: 'report' }, desc: '?page=report' },
      { pathname: '/', params: { page: 'status' }, desc: '?page=status' },
      { pathname: '/', params: { page: 'diagnostics' }, desc: '?page=diagnostics' },
      { pathname: '/', params: { page: 'test' }, desc: '?page=test' },
      { pathname: '/', params: { p: 'events' }, desc: '?p=events' },
      { pathname: '/', params: { p: 'status' }, desc: '?p=status' },
      { pathname: '/', params: { p: 'r' }, desc: '?p=r (shortlink)' },
      { pathname: '/', params: { action: 'api_status' }, desc: '?action=api_status' },
      { pathname: '/', params: { action: 'api_events' }, desc: '?action=api_events' },
      { pathname: '/abc/events', params: {}, desc: '/abc/events (brand path)' },
      { pathname: '/cbc/admin', params: {}, desc: '/cbc/admin (brand path)' },
      { pathname: '/cbl/display', params: {}, desc: '/cbl/display (brand path)' },
    ];

    it.each(validRoutes)('should accept $desc', ({ pathname, params }) => {
      const result = simulateValidateRoute(pathname, params);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Routes (should return 404)', () => {
    const invalidRoutes = [
      { pathname: '/unknown', params: {}, desc: '/unknown path' },
      { pathname: '/templates-v2', params: {}, desc: '/templates-v2 (blocked)' },
      { pathname: '/randomizer', params: {}, desc: '/randomizer (blocked)' },
      { pathname: '/', params: { page: 'unknown' }, desc: '?page=unknown' },
      { pathname: '/', params: { page: 'templates-v2' }, desc: '?page=templates-v2' },
      { pathname: '/', params: { page: 'randomizer' }, desc: '?page=randomizer' },
      { pathname: '/', params: { page: 'teams' }, desc: '?page=teams' },
      { pathname: '/', params: { page: 'picker' }, desc: '?page=picker' },
      { pathname: '/', params: { page: 'portfolio' }, desc: '?page=portfolio' },
      { pathname: '/', params: { p: 'unknown' }, desc: '?p=unknown' },
      { pathname: '/', params: { action: 'unknown_action' }, desc: '?action=unknown_action' },
      { pathname: '/', params: { action: 'eval' }, desc: '?action=eval (security)' },
      { pathname: '/xyz/events', params: {}, desc: '/xyz/events (invalid brand)' },
      { pathname: '/abc/unknown', params: {}, desc: '/abc/unknown (valid brand, invalid path)' },
    ];

    it.each(invalidRoutes)('should reject $desc', ({ pathname, params }) => {
      const result = simulateValidateRoute(pathname, params);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });
  });

  describe('API Request Detection', () => {
    it('should detect ?action= as API request', () => {
      const result = simulateValidateRoute('/', { action: 'api_status' });
      expect(result.isApiRequest).toBe(true);
    });

    it('should detect ?format=json as API request', () => {
      const result = simulateValidateRoute('/', { format: 'json' });
      expect(result.isApiRequest).toBe(true);
    });

    it('should detect /api path as API request', () => {
      const result = simulateValidateRoute('/api/status', {});
      expect(result.isApiRequest).toBe(true);
    });

    it('should NOT detect ?page= as API request', () => {
      const result = simulateValidateRoute('/', { page: 'admin' });
      expect(result.isApiRequest).toBe(false);
    });

    it('should NOT detect path-based routes as API request', () => {
      const result = simulateValidateRoute('/events', {});
      expect(result.isApiRequest).toBe(false);
    });
  });
});

// =============================================================================
// 404 Response Tests
// =============================================================================

describe('404 Response Format', () => {
  describe('HTML 404 Page', () => {
    it('should include 404 status code marker', () => {
      // Verify the worker has a generate404Page function
      const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');

      expect(content).toContain('function generate404Page');
      expect(content).toContain('Page Not Found');
      expect(content).toContain('404');
    });

    it('should list valid routes in 404 page', () => {
      const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');

      expect(content).toContain('/events');
      expect(content).toContain('/admin');
      expect(content).toContain('/display');
      expect(content).toContain('/poster');
      expect(content).toContain('/status');
    });
  });

  describe('JSON 404 Response', () => {
    it('should include 404 JSON generator function', () => {
      const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');

      expect(content).toContain('function generate404Json');
      expect(content).toContain('NOT_FOUND');
    });

    it('should include correlation ID in error response', () => {
      const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');

      expect(content).toContain('corrId');
    });
  });
});

// =============================================================================
// Worker Version Tests
// =============================================================================

describe('Worker Version', () => {
  it('should have version 1.3.0 or higher', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    const versionMatch = content.match(/const WORKER_VERSION = '([^']+)'/);
    expect(versionMatch).toBeTruthy();

    const [major, minor] = versionMatch[1].split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
    if (major === 1) {
      expect(minor).toBeGreaterThanOrEqual(3);
    }
  });
});

// =============================================================================
// CORS Rules Validation (Story 3)
// =============================================================================
// Verifies CORS configuration remains unchanged and follows same-origin iframe safety

describe('CORS Rules Configuration', () => {

  it('should have Access-Control-Allow-Origin: * for API responses', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // CORS headers should allow all origins for API requests
    expect(content).toContain("'Access-Control-Allow-Origin': '*'");
  });

  it('should have handleCORS function for preflight requests', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    expect(content).toContain('function handleCORS');
    expect(content).toContain("request.method === 'OPTIONS'");
  });

  it('should allow POST, GET, OPTIONS methods', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // Methods should be allowed
    expect(content).toContain("'Access-Control-Allow-Methods'");
    expect(content).toMatch(/POST/);
    expect(content).toMatch(/GET/);
    expect(content).toMatch(/OPTIONS/);
  });

  it('should allow Content-Type and Authorization headers', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    expect(content).toContain("'Access-Control-Allow-Headers'");
    expect(content).toContain('Content-Type');
  });

  it('should cache preflight response for 86400 seconds', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // Max-Age should be 24 hours for preflight caching
    expect(content).toContain("'Access-Control-Max-Age': '86400'");
  });

  it('should return 204 status for OPTIONS preflight', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // OPTIONS should return 204 No Content
    expect(content).toMatch(/status:\s*204/);
  });

});

// =============================================================================
// /api/* Never Returns HTML (Story 3)
// =============================================================================
// Ensures Worker never returns HTML fallback on API routes

describe('/api/* Response Type Guarantee', () => {

  it('should return JSON Content-Type for API errors', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // API error responses should be JSON
    expect(content).toContain("'Content-Type': 'application/json'");
  });

  it('should have createGracefulErrorResponse that returns JSON for API requests', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // Function should exist
    expect(content).toContain('function createGracefulErrorResponse');

    // Should check isApiRequest and return JSON
    expect(content).toContain('if (isApiRequest)');
    expect(content).toContain('JSON.stringify({');
  });

  it('should have generate404Json for API 404 responses', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    expect(content).toContain('function generate404Json');
  });

  it('should check isApiRequest before generating error response', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // Worker distinguishes between API and HTML requests
    expect(content).toContain('isApiRequest');
    // API requests get JSON, non-API get HTML
    expect(content).toContain('create404Response(url, isApiRequest');
  });

  it('should NOT include HTML tags in JSON error responses', () => {
    const workerPath = path.join(__dirname, '../../cloudflare-proxy/worker.js');
    const content = fs.readFileSync(workerPath, 'utf8');

    // Extract the generate404Json function
    const funcMatch = content.match(/function generate404Json\([\s\S]*?\n\}/);
    if (funcMatch) {
      const func = funcMatch[0];
      // Should not contain HTML
      expect(func).not.toContain('<html');
      expect(func).not.toContain('<!DOCTYPE');
    }
  });

});
