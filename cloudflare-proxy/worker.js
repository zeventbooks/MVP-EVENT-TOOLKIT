/**
 * Cloudflare Worker - Transparent Google Apps Script Proxy
 *
 * This worker provides a TRANSPARENT proxy to Google Apps Script:
 * - Custom domain support (e.g., eventangle.com/events)
 * - CORS headers for API cross-origin requests
 * - Friendly URL routing (/events/abc/manage → exec/abc/manage)
 * - Query string preservation (?page=admin passes through)
 * - Transparency headers for debugging (X-Proxied-By, X-Worker-Version)
 * - Error handling and retry logic
 *
 * TRANSPARENCY PRINCIPLE:
 * All requests are PROXIED, not redirected. The worker adds diagnostic headers
 * but does NOT modify response bodies. This ensures:
 * - https://www.eventangle.com stays in the browser address bar
 * - No script.google.com URL is ever user-facing
 * - Response content is identical to direct GAS access
 *
 * Request routing:
 * - HTML page routes (?page=*) → Proxy to GAS, return HTML directly
 * - API routes (?action=* or ?api=*) → Proxy to GAS with CORS headers
 *
 * Deployment modes (see wrangler.toml):
 * - env.events: Only /events* paths (RECOMMENDED for production)
 * - env.production: Full site (eventangle.com/*)
 * - env.api-only: API subdomain only
 *
 * Example flows (env.events - /events* route):
 * - eventangle.com/events → exec → Public.html (default)
 * - eventangle.com/events?page=admin → exec?page=admin → Admin.html
 * - eventangle.com/events?page=display → exec?page=display → Display.html
 * - eventangle.com/events?page=poster → exec?page=poster → Poster.html
 * - eventangle.com/events?page=public → exec?page=public → Public.html
 * - eventangle.com/events?page=report → exec?page=report → Report.html
 * - eventangle.com/events?page=status → exec?page=status → Status JSON
 *
 * Apps Script receives paths via e.pathInfo array.
 * See docs/FRIENDLY_URLS.md for complete URL mapping.
 *
 * Configuration via wrangler.toml:
 * - GAS_DEPLOYMENT_BASE_URL: Full Apps Script exec URL (preferred)
 * - DEPLOYMENT_ID: Apps Script deployment ID (fallback)
 */

// Worker version - used for transparency headers and debugging
const WORKER_VERSION = '1.5.0';

// Timeout for upstream requests (ms)
const UPSTREAM_TIMEOUT_MS = 30000;

// =============================================================================
// CANONICAL ROUTES - Single Source of Truth
// =============================================================================
// Only these routes are supported externally. Unknown routes return 404.
// This prevents mis-routing and ensures predictable behavior.

/**
 * Canonical page routes (?page=X or path-based)
 * Maps to HTML pages served by Google Apps Script
 */
const CANONICAL_PAGES = Object.freeze({
  'admin': 'admin',
  'display': 'display',
  'poster': 'poster',
  'public': 'public',
  'report': 'report',
  'status': 'status',
  'ping': 'ping',
  'diagnostics': 'diagnostics',
  'shared-report': 'report',  // Alias
  'test': 'test'              // Test page
});

/**
 * Canonical shorthand routes (?p=X)
 * Short aliases for common operations
 */
const CANONICAL_P_ROUTES = Object.freeze({
  'events': 'public',    // ?p=events -> public page
  'status': 'status',    // ?p=status -> status JSON
  'r': 'redirect',       // ?p=r -> shortlink redirect (handled by GAS)
  'redirect': 'redirect', // ?p=redirect -> shortlink redirect
  'api': 'api'           // ?p=api -> API request (legacy format)
});

/**
 * Canonical API actions (?action=X)
 * Whitelisted API endpoints
 */
const CANONICAL_API_ACTIONS = Object.freeze([
  // Public API endpoints
  'api_status',
  'api_statusPure',
  'api_events',
  'api_eventById',
  'api_sponsors',
  // Admin API endpoints (require auth)
  'api_createEvent',
  'api_updateEvent',
  'api_deleteEvent',
  'api_uploadImage',
  // Display/Kiosk API
  'api_displayData',
  'api_nextEvent',
  // Poster API
  'api_posterData',
  // Report API
  'api_reportData',
  'api_analytics',
  // Legacy action names (used by smoke tests and older clients)
  // These map to api_* functions in the GAS backend
  'list',              // -> api_list (events, sponsors)
  'getPublicBundle',   // -> api_getPublicBundle
  'getSponsorReportQr', // -> api_getSponsorReportQr
  'getSharedAnalytics', // -> api_getSharedAnalytics
  'getSharedReportBundle' // -> api_getSharedReportBundle
]);

/**
 * Canonical friendly URL path segments
 * Maps first path segment to page parameter
 */
const CANONICAL_PATH_TO_PAGE = Object.freeze({
  // Public page aliases
  'events': 'public',
  'schedule': 'public',
  'calendar': 'public',
  // Admin page aliases
  'manage': 'admin',
  'admin': 'admin',
  'dashboard': 'admin',
  'create': 'admin',
  'docs': 'admin',
  // Display page aliases
  'display': 'display',
  'tv': 'display',
  'kiosk': 'display',
  'screen': 'display',
  // Poster page aliases
  'poster': 'poster',
  'posters': 'poster',
  'flyers': 'poster',
  // Report page aliases
  'analytics': 'report',
  'reports': 'report',
  'insights': 'report',
  'stats': 'report',
  // Status/health aliases
  'status': 'status',
  'health': 'status',
  'ping': 'ping',
  // API path
  'api': 'api'
});

/**
 * Valid brands (path prefixes like /abc/events)
 */
const VALID_BRANDS = Object.freeze(['root', 'abc', 'cbc', 'cbl']);

/**
 * Check if a page parameter is valid
 */
function isValidPage(page) {
  return page && Object.hasOwn(CANONICAL_PAGES, page);
}

/**
 * Check if a ?p= shorthand is valid
 */
function isValidPRoute(p) {
  return p && Object.hasOwn(CANONICAL_P_ROUTES, p);
}

/**
 * Check if an action parameter is valid
 */
function isValidAction(action) {
  return action && CANONICAL_API_ACTIONS.includes(action);
}

/**
 * Check if a path segment maps to a known page
 */
function isValidPathSegment(segment) {
  return segment && (
    Object.hasOwn(CANONICAL_PATH_TO_PAGE, segment) ||
    VALID_BRANDS.includes(segment)
  );
}

// Error tracking endpoint (optional - set via env variable)
// Falls back to console.error if not configured

// Configuration - Updated by CI/CD or set in wrangler.toml
const DEFAULT_DEPLOYMENT_ID = 'AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ';

/**
 * Generate a correlation ID for error tracking
 * Format: err_YYYYMMDDHHMMSS_RAND
 */
function generateCorrId() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `err_${timestamp}_${rand}`;
}

/**
 * Generate branded HTML error page for graceful degradation
 * @param {Object} options - Error page options
 * @param {string} options.title - Error title
 * @param {string} options.message - User-friendly error message
 * @param {string} options.hint - Additional hint/instruction
 * @param {string} options.corrId - Correlation ID for support
 * @param {string} options.pageType - Page type (admin, public, display, poster)
 * @param {number} options.statusCode - HTTP status code
 * @returns {string} HTML string
 */
function generateErrorPage(options) {
  const {
    title = 'Temporary Issue',
    message = 'We\'re experiencing a temporary problem loading this page.',
    hint = 'Please refresh the page or try again in a minute.',
    corrId = '',
    pageType = 'public',
    statusCode = 503
  } = options;

  // Page-specific styling based on context
  const isTV = pageType === 'display';
  const bgColor = isTV ? '#111' : '#f8fafc';
  const textColor = isTV ? '#f0f0f0' : '#1e293b';
  const mutedColor = isTV ? '#9ca3af' : '#64748b';
  const accentColor = '#f59e0b'; // Warning yellow
  const cardBg = isTV ? '#1a1a1a' : '#ffffff';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EventAngle - ${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      line-height: 1.6;
    }
    .error-container {
      background: ${cardBg};
      border-radius: 16px;
      padding: 48px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,${isTV ? '0.4' : '0.1'});
      ${isTV ? 'border: 1px solid #333;' : ''}
    }
    .error-icon {
      font-size: ${isTV ? '80px' : '64px'};
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
    h1 {
      font-size: ${isTV ? '2rem' : '1.75rem'};
      color: ${accentColor};
      margin-bottom: 16px;
      font-weight: 600;
    }
    .message {
      font-size: ${isTV ? '1.25rem' : '1.1rem'};
      color: ${textColor};
      margin-bottom: 12px;
    }
    .hint {
      font-size: ${isTV ? '1rem' : '0.95rem'};
      color: ${mutedColor};
      margin-bottom: 24px;
    }
    .btn-retry {
      display: inline-block;
      background: ${accentColor};
      color: #000;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: ${isTV ? '1.1rem' : '1rem'};
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-retry:hover {
      background: #d97706;
      transform: translateY(-2px);
    }
    .btn-retry:active {
      transform: translateY(0);
    }
    .corr-id {
      margin-top: 24px;
      font-size: 0.75rem;
      color: ${mutedColor};
      font-family: monospace;
      opacity: 0.7;
    }
    .auto-refresh {
      margin-top: 16px;
      font-size: 0.85rem;
      color: ${mutedColor};
    }
    .countdown {
      font-weight: 600;
      color: ${accentColor};
    }
  </style>
</head>
<body>
  <div class="error-container" role="alert">
    <div class="error-icon">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${escapeHtml(message)}</p>
    <p class="hint">${escapeHtml(hint)}</p>
    <button class="btn-retry" onclick="location.reload()">🔄 Try Again</button>
    ${isTV ? '<p class="auto-refresh">Auto-refreshing in <span class="countdown" id="countdown">30</span>s</p>' : ''}
    ${corrId ? `<p class="corr-id">Reference: ${escapeHtml(corrId)}</p>` : ''}
  </div>
  ${isTV ? `
  <script>
    // Auto-refresh for TV displays
    let seconds = 30;
    const countdownEl = document.getElementById('countdown');
    setInterval(() => {
      seconds--;
      if (countdownEl) countdownEl.textContent = seconds;
      if (seconds <= 0) location.reload();
    }, 1000);
  </script>
  ` : ''}
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate 404 Not Found HTML page
 * @param {Object} options - Error page options
 * @param {string} options.path - The requested path
 * @param {string} options.corrId - Correlation ID for support
 * @returns {string} HTML string
 */
function generate404Page(options) {
  const { path = '/', corrId = '' } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EventAngle - Page Not Found</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      line-height: 1.6;
    }
    .error-container {
      background: #ffffff;
      border-radius: 16px;
      padding: 48px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    }
    .error-code {
      font-size: 96px;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.75rem;
      color: #1e293b;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .message {
      font-size: 1.1rem;
      color: #64748b;
      margin-bottom: 12px;
    }
    .path {
      font-family: monospace;
      background: #f1f5f9;
      padding: 8px 16px;
      border-radius: 8px;
      color: #475569;
      margin: 16px 0;
      word-break: break-all;
    }
    .hint {
      font-size: 0.95rem;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .btn-home {
      display: inline-block;
      background: #3b82f6;
      color: #fff;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-home:hover {
      background: #2563eb;
      transform: translateY(-2px);
    }
    .corr-id {
      margin-top: 24px;
      font-size: 0.75rem;
      color: #94a3b8;
      font-family: monospace;
      opacity: 0.7;
    }
    .valid-routes {
      text-align: left;
      margin: 24px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .valid-routes h3 {
      font-size: 0.9rem;
      color: #64748b;
      margin-bottom: 8px;
    }
    .valid-routes ul {
      list-style: none;
      font-size: 0.85rem;
      color: #475569;
    }
    .valid-routes li {
      padding: 4px 0;
    }
    .valid-routes code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="error-container" role="alert">
    <div class="error-code">404</div>
    <h1>Page Not Found</h1>
    <p class="message">The page you're looking for doesn't exist or has been moved.</p>
    <div class="path">${escapeHtml(path)}</div>
    <div class="valid-routes">
      <h3>Valid pages:</h3>
      <ul>
        <li><code>/events</code> - Public events</li>
        <li><code>/admin</code> - Event management</li>
        <li><code>/display</code> - TV/Kiosk display</li>
        <li><code>/poster</code> - Poster generator</li>
        <li><code>/status</code> - Health check</li>
      </ul>
    </div>
    <a href="/events" class="btn-home">Go to Events</a>
    ${corrId ? `<p class="corr-id">Reference: ${escapeHtml(corrId)}</p>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Generate 404 JSON error response for API requests
 * @param {Object} options - Error options
 * @param {string} options.path - The requested path
 * @param {string} options.action - The invalid action requested
 * @param {string} options.corrId - Correlation ID
 * @returns {Object} JSON object
 */
function generate404Json(options) {
  const { path = '/', action = null, corrId = '' } = options;

  return {
    ok: false,
    code: 'NOT_FOUND',
    message: action
      ? `Unknown API action: ${action}`
      : `Route not found: ${path}`,
    corrId,
    workerVersion: WORKER_VERSION,
    validActions: action ? CANONICAL_API_ACTIONS.slice(0, 5).concat(['...']) : undefined
  };
}

/**
 * Create 404 response based on request type
 * @param {URL} url - The request URL
 * @param {boolean} isApiRequest - Whether this is an API request
 * @param {string} corrId - Correlation ID
 * @returns {Response} 404 response
 */
function create404Response(url, isApiRequest, corrId) {
  const path = url.pathname + url.search;

  if (isApiRequest) {
    const action = url.searchParams.get('action');
    const json = generate404Json({ path, action, corrId });

    return new Response(JSON.stringify(json), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-By': 'eventangle-worker',
        'X-Worker-Version': WORKER_VERSION,
        'X-Error-CorrId': corrId,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  const html = generate404Page({ path, corrId });

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Proxied-By': 'eventangle-worker',
      'X-Worker-Version': WORKER_VERSION,
      'X-Error-CorrId': corrId,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Validate the incoming request and return validation result
 * @param {URL} url - The request URL
 * @returns {Object} { valid: boolean, reason?: string, isApiRequest: boolean }
 */
function validateRoute(url) {
  const page = url.searchParams.get('page');
  const p = url.searchParams.get('p');
  const action = url.searchParams.get('action');
  const pathname = url.pathname;

  // Check for API request indicators
  const isApiRequest = url.searchParams.has('action') ||
                       url.searchParams.has('api') ||
                       url.searchParams.get('format') === 'json' ||
                       pathname.startsWith('/api');

  // If ?action= is present, validate it
  if (action) {
    if (!isValidAction(action)) {
      return { valid: false, reason: `Unknown action: ${action}`, isApiRequest: true };
    }
    return { valid: true, isApiRequest: true };
  }

  // If ?page= is present, validate it
  if (page) {
    if (!isValidPage(page)) {
      return { valid: false, reason: `Unknown page: ${page}`, isApiRequest };
    }
    return { valid: true, isApiRequest };
  }

  // If ?p= is present, validate it
  if (p) {
    if (!isValidPRoute(p)) {
      return { valid: false, reason: `Unknown p route: ${p}`, isApiRequest };
    }
    return { valid: true, isApiRequest };
  }

  // Validate path-based routing
  const segments = pathname.split('/').filter(Boolean);

  // Empty path or root - defaults to events (public)
  if (segments.length === 0) {
    return { valid: true, isApiRequest };
  }

  const firstSegment = segments[0].toLowerCase();

  // Check if first segment is valid
  if (!isValidPathSegment(firstSegment)) {
    return { valid: false, reason: `Unknown path: ${pathname}`, isApiRequest };
  }

  // If first segment is a brand, validate second segment (if present)
  if (VALID_BRANDS.includes(firstSegment) && segments.length > 1) {
    const secondSegment = segments[1].toLowerCase();
    if (!Object.hasOwn(CANONICAL_PATH_TO_PAGE, secondSegment)) {
      return { valid: false, reason: `Unknown path: ${pathname}`, isApiRequest };
    }
  }

  return { valid: true, isApiRequest };
}

/**
 * Log error details for diagnostics
 * @param {Object} env - Worker environment
 * @param {Object} errorDetails - Error information to log
 */
async function logError(env, errorDetails) {
  // Always log to console for Cloudflare dashboard
  console.error('[EventAngle Error]', JSON.stringify(errorDetails));

  // If DIAG endpoint is configured, send error there
  // This allows integration with external monitoring (e.g., logging to GAS DIAG sheet)
  if (env.ERROR_LOG_ENDPOINT) {
    try {
      await fetch(env.ERROR_LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'cloudflare-worker',
          version: WORKER_VERSION,
          ...errorDetails,
          timestamp: new Date().toISOString()
        })
      });
    } catch (logErr) {
      console.error('[EventAngle] Failed to send error to logging endpoint:', logErr.message);
    }
  }
}

/**
 * Determine page type from URL for error page styling
 */
function getPageType(url) {
  const pathname = url.pathname.toLowerCase();
  const page = url.searchParams.get('page');

  if (page) {
    if (['display', 'tv', 'kiosk'].includes(page)) return 'display';
    if (['admin', 'manage'].includes(page)) return 'admin';
    if (['poster', 'flyer'].includes(page)) return 'poster';
    if (['report', 'analytics'].includes(page)) return 'report';
    return 'public';
  }

  if (pathname.includes('/display') || pathname.includes('/tv') || pathname.includes('/kiosk')) return 'display';
  if (pathname.includes('/admin') || pathname.includes('/manage')) return 'admin';
  if (pathname.includes('/poster') || pathname.includes('/flyer')) return 'poster';
  if (pathname.includes('/report') || pathname.includes('/analytics')) return 'report';

  return 'public';
}

/**
 * Create graceful degradation response for upstream failures
 */
function createGracefulErrorResponse(error, url, isApiRequest, corrId) {
  const pageType = getPageType(url);
  const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
  const is5xx = error.status >= 500;

  if (isApiRequest) {
    // API requests get JSON error response
    return new Response(JSON.stringify({
      ok: false,
      code: isTimeout ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE',
      message: isTimeout
        ? 'The request took too long to complete. Please try again.'
        : 'We\'re experiencing a temporary issue. Please try again in a moment.',
      corrId,
      workerVersion: WORKER_VERSION
    }), {
      status: isTimeout ? 504 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-By': 'eventangle-worker',
        'X-Worker-Version': WORKER_VERSION,
        'X-Error-CorrId': corrId,
        'Retry-After': '30'
      }
    });
  }

  // HTML page requests get branded error page
  const html = generateErrorPage({
    title: isTimeout ? 'Taking Too Long' : 'Temporary Issue',
    message: isTimeout
      ? 'The page is taking longer than expected to load.'
      : 'We\'re experiencing a temporary problem loading this page.',
    hint: 'Please refresh or try again in a minute. If the problem persists, contact support.',
    corrId,
    pageType,
    statusCode: isTimeout ? 504 : 503
  });

  return new Response(html, {
    status: isTimeout ? 504 : 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Proxied-By': 'eventangle-worker',
      'X-Worker-Version': WORKER_VERSION,
      'X-Error-CorrId': corrId,
      'Retry-After': '30',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    // Use GAS_DEPLOYMENT_BASE_URL if available (preferred), otherwise build from DEPLOYMENT_ID
    const appsScriptBase = env.GAS_DEPLOYMENT_BASE_URL ||
      `https://script.google.com/macros/s/${env.DEPLOYMENT_ID || DEFAULT_DEPLOYMENT_ID}/exec`;

    const url = new URL(request.url);

    // Redirect Google's static assets to script.google.com
    // These cannot be proxied - must redirect to Google's CDN
    if (url.pathname.startsWith('/static/')) {
      const staticUrl = `https://script.google.com${url.pathname}${url.search}`;
      return Response.redirect(staticUrl, 302);
    }

    // Handle Google's internal endpoints (warden, jserror, etc.)
    // These are Google's security/analytics endpoints used for bot detection and error reporting.
    // When proxying through a custom domain, Google's client-side scripts
    // validate that the posting URI is a Google domain. Since we're on a custom
    // domain, we return a stub success response to prevent errors.
    // This is safe because these are for Google's internal telemetry, not user authentication.
    if (url.pathname.startsWith('/wardeninit') ||
        url.pathname.startsWith('/warden') ||
        url.pathname.startsWith('/jserror') ||
        url.pathname.startsWith('/_/')) {
      // Return a minimal success response that satisfies the warden client
      // The warden system expects a response but doesn't require specific data
      // when the main application doesn't need bot detection features
      return new Response(')]}\'\n[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Proxied-By': 'eventangle-worker',
          'X-Worker-Version': WORKER_VERSION,
        },
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const corsResponse = handleCORS();
      // Add transparency headers to CORS response
      corsResponse.headers.set('X-Proxied-By', 'eventangle-worker');
      corsResponse.headers.set('X-Worker-Version', WORKER_VERSION);
      return corsResponse;
    }

    // ==========================================================================
    // /api/* - Frontend API endpoints (fetch-based transport)
    // ==========================================================================
    // Supports two patterns:
    //
    // 1. Legacy RPC: POST /api/rpc with body { method: 'api_list', payload: {...} }
    //    - Preserves backward compatibility with existing SDK calls
    //
    // 2. Path-based: POST /api/<path> with body {...payload}
    //    - New pattern: /api/events/list, /api/getPublicBundle
    //    - Maps to GAS action: events/list -> list, getPublicBundle -> getPublicBundle
    //
    // Response: JSON from GAS backend
    //
    if (url.pathname.startsWith('/api/') && request.method === 'POST') {
      try {
        const response = await handleApiRequest(request, appsScriptBase, env, url);
        return addTransparencyHeaders(addCORSHeaders(response), startTime);
      } catch (error) {
        const corrId = generateCorrId();
        ctx.waitUntil(logError(env, {
          corrId,
          type: 'api_error',
          error: error.message,
          url: url.pathname,
          duration: Date.now() - startTime
        }));
        return createGracefulErrorResponse(error, url, true, corrId);
      }
    }

    // ==========================================================================
    // ROUTE VALIDATION - Reject unknown routes with 404
    // ==========================================================================
    const validation = validateRoute(url);

    if (!validation.valid) {
      const corrId = generateCorrId();

      // Log the invalid route attempt
      ctx.waitUntil(logError(env, {
        corrId,
        type: 'invalid_route',
        reason: validation.reason,
        url: url.pathname + url.search,
        isApiRequest: validation.isApiRequest
      }));

      console.log(`[EventAngle] 404 - ${validation.reason}`);
      return create404Response(url, validation.isApiRequest, corrId);
    }

    // Determine request type:
    // - API requests: ?action=* or ?api=* or /api/* → proxy with CORS headers
    // - Page requests: ?page=* or path-based → proxy and return HTML directly (no JSON wrapping)
    const isApiRequest = validation.isApiRequest;

    try {
      let response;

      if (isApiRequest) {
        // API request: proxy and add CORS headers
        response = await proxyToAppsScript(request, appsScriptBase, env);
      } else {
        // HTML page request: proxy directly without CORS wrapping
        // This keeps eventangle.com in the browser address bar
        response = await proxyPageRequest(request, appsScriptBase, url, env);
      }

      // Check for upstream 5xx errors and provide graceful degradation
      if (response.status >= 500) {
        const corrId = generateCorrId();

        // Log the upstream error
        ctx.waitUntil(logError(env, {
          corrId,
          type: 'upstream_5xx',
          status: response.status,
          statusText: response.statusText,
          url: url.pathname + url.search,
          isApiRequest,
          duration: Date.now() - startTime
        }));

        // Return graceful error response instead of raw 5xx
        return createGracefulErrorResponse(
          { status: response.status, message: `Upstream returned ${response.status}` },
          url,
          isApiRequest,
          corrId
        );
      }

      // Success path: add CORS headers for API requests and transparency headers
      if (isApiRequest) {
        response = addCORSHeaders(response);
      }
      return addTransparencyHeaders(response, startTime);

    } catch (error) {
      const corrId = generateCorrId();
      const isTimeout = error.name === 'AbortError';

      // Log the error with context
      ctx.waitUntil(logError(env, {
        corrId,
        type: isTimeout ? 'timeout' : 'proxy_error',
        error: error.message,
        stack: error.stack?.slice(0, 500),
        url: url.pathname + url.search,
        isApiRequest,
        duration: Date.now() - startTime
      }));

      // Return graceful degradation response
      return createGracefulErrorResponse(error, url, isApiRequest, corrId);
    }
  },
};

/**
 * Proxy HTML page request to Google Apps Script
 *
 * This function fetches HTML pages from Apps Script and returns them directly.
 * Unlike API requests, page requests don't get CORS headers (they're not cross-origin).
 * The HTML is returned as-is, keeping the user on eventangle.com.
 *
 * Supported page parameters:
 * - ?page=admin → Admin.html (event management)
 * - ?page=public → Public.html (public event listing)
 * - ?page=display → Display.html (TV/kiosk display)
 * - ?page=poster → Poster.html (printable poster)
 * - ?page=report → Report.html (analytics report)
 * - ?page=status → Status JSON (health check)
 *
 * Path-to-page mapping for friendly URLs:
 * - /events, /manage, /admin → page=admin
 * - /display, /tv, /kiosk → page=display
 * - /status, /health → page=status
 */
async function proxyPageRequest(request, appsScriptBase, url, env) {
  // Get path and strip known prefixes
  let path = url.pathname;
  const knownPrefixes = [
    '/events', '/manage', '/admin', '/display', '/tv', '/kiosk',
    '/screen', '/posters', '/poster', '/flyers', '/schedule',
    '/calendar', '/dashboard', '/create', '/analytics', '/reports',
    '/insights', '/stats', '/status', '/health', '/ping', '/docs'
  ];

  for (const prefix of knownPrefixes) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      path = path.slice(prefix.length);
      break;
    }
  }
  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  // Build query params, adding page= if not present
  const params = new URLSearchParams(url.search);
  if (!params.has('page')) {
    // Use canonical path-to-page mapping (defined at top of file)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0] || 'events';
    const mappedPage = CANONICAL_PATH_TO_PAGE[firstSegment];
    if (mappedPage && mappedPage !== 'api') {
      params.set('page', mappedPage);
    }
  }

  // Build target URL
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const targetUrl = path
    ? `${appsScriptBase}/${path}${queryString}`
    : `${appsScriptBase}${queryString}`;

  console.log(`[EventAngle] Proxying page to: ${targetUrl}`);

  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutMs = env.UPSTREAM_TIMEOUT_MS ? parseInt(env.UPSTREAM_TIMEOUT_MS) : UPSTREAM_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Fetch from Apps Script (follow redirects) with timeout
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: buildHeaders(request),
      redirect: 'follow',
      signal: controller.signal
    });

    console.log(`[EventAngle] Page response: ${response.status} ${response.statusText}`);

    // Return response with cache headers for HTML pages
    const newResponse = new Response(response.body, response);
    if (!newResponse.headers.has('Cache-Control')) {
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    return newResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Proxy API request to Google Apps Script
 *
 * This function forwards the request to Apps Script, supporting both:
 * 1. Path-based routing (friendly URLs): /events/manage → exec/manage
 * 2. Query-param routing: ?page=admin → exec?page=admin
 *
 * Path handling:
 * - Strips '/events' prefix if present (for env.events deployment)
 * - Preserves remaining path for Apps Script's e.pathInfo
 * - Preserves query string
 *
 * Examples (env.events - /events* route):
 *   /events → exec (pathInfo: [])
 *   /events/manage → exec/manage (pathInfo: ['manage'])
 *   /events/abc/events → exec/abc/events (pathInfo: ['abc', 'events'])
 *   /events?page=admin → exec?page=admin (pathInfo: [], params: {page:'admin'})
 *
 * Examples (env.production - /* route):
 *   /manage → exec/manage (pathInfo: ['manage'])
 *   /abc/events → exec/abc/events (pathInfo: ['abc', 'events'])
 */
async function proxyToAppsScript(request, appsScriptBase, env) {
  const url = new URL(request.url);

  // Get path and strip '/events' prefix if present (for env.events route)
  let path = url.pathname;
  if (path.startsWith('/events')) {
    path = path.slice('/events'.length); // Remove '/events' prefix
  }
  // Ensure path doesn't start with double slash
  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  // Build target URL: base + path + query
  // Apps Script receives path via e.pathInfo array
  const targetUrl = path
    ? `${appsScriptBase}/${path}${url.search}`
    : `${appsScriptBase}${url.search}`;

  console.log(`[EventAngle] Proxying to: ${targetUrl}`);

  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutMs = env.UPSTREAM_TIMEOUT_MS ? parseInt(env.UPSTREAM_TIMEOUT_MS) : UPSTREAM_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build fetch options
    const fetchOptions = {
      method: request.method,
      headers: buildHeaders(request),
      redirect: 'follow',
      signal: controller.signal
    };

    // Add body for POST/PUT requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text();
    }

    // Make request to Apps Script
    const response = await fetch(targetUrl, fetchOptions);

    console.log(`[EventAngle] Response: ${response.status} ${response.statusText}`);

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle API request from frontend (unified handler)
 *
 * Supports two patterns:
 * 1. Legacy RPC: POST /api/rpc with { method: 'api_list', payload: {...} }
 * 2. Path-based: POST /api/<path> with {...payload}
 *
 * @param {Request} request - The incoming request
 * @param {string} appsScriptBase - GAS exec URL
 * @param {object} env - Worker environment
 * @param {URL} url - Parsed request URL
 * @returns {Response} JSON response from GAS
 */
async function handleApiRequest(request, appsScriptBase, env, url) {
  const pathname = url.pathname;
  const origin = url.origin;

  // Check if this is the legacy /api/rpc endpoint
  if (pathname === '/api/rpc') {
    return handleRpcRequest(request, appsScriptBase, env, origin);
  }

  // Path-based routing: /api/<path> -> action=<path>
  // Examples:
  //   /api/events/list -> action=list
  //   /api/getPublicBundle -> action=getPublicBundle
  //   /api/status -> action=status

  // Parse the path after /api/
  const apiPath = pathname.slice('/api/'.length);

  if (!apiPath) {
    return new Response(JSON.stringify({
      ok: false,
      code: 'BAD_INPUT',
      message: 'Missing API path'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse request body as payload
  let payload = {};
  try {
    const bodyText = await request.text();
    if (bodyText) {
      payload = JSON.parse(bodyText);
    }
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      code: 'BAD_INPUT',
      message: 'Invalid JSON in request body'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Convert path to action
  // 'events/list' -> 'list' (last segment)
  // 'getPublicBundle' -> 'getPublicBundle' (single segment)
  const pathSegments = apiPath.split('/').filter(Boolean);
  const action = pathSegments[pathSegments.length - 1] || apiPath;

  // Build the GAS request body
  const gasBody = {
    action,
    ...payload
  };

  // Add request ID header if present
  const requestId = request.headers.get('X-Request-Id');

  console.log(`[EventAngle] API: ${pathname} -> action=${action}${requestId ? ` (${requestId})` : ''}`);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutMs = env.UPSTREAM_TIMEOUT_MS ? parseInt(env.UPSTREAM_TIMEOUT_MS) : UPSTREAM_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Forward to GAS doPost
    const response = await fetch(appsScriptBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': origin || 'https://eventangle.com',
        'User-Agent': request.headers.get('user-agent') || 'EventAngle-Worker',
        ...(requestId ? { 'X-Request-Id': requestId } : {})
      },
      body: JSON.stringify(gasBody),
      redirect: 'follow',
      signal: controller.signal
    });

    console.log(`[EventAngle] API response: ${response.status}`);

    const responseText = await response.text();

    return new Response(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle RPC request from frontend (legacy endpoint)
 *
 * This replaces google.script.run for API calls, enabling friendly URLs.
 * The frontend sends: { method: 'api_list', payload: { brandId: 'root', ... } }
 * We forward to GAS doPost as: { action: 'list', brandId: 'root', ... }
 *
 * @param {Request} request - The incoming request
 * @param {string} appsScriptBase - GAS exec URL
 * @param {object} env - Worker environment
 * @param {string} origin - Request origin for CORS
 * @returns {Response} JSON response from GAS
 */
async function handleRpcRequest(request, appsScriptBase, env, origin) {
  // Parse the RPC request body
  const rpcBody = await request.json();
  const { method, payload = {} } = rpcBody;

  if (!method) {
    return new Response(JSON.stringify({
      ok: false,
      code: 'BAD_INPUT',
      message: 'Missing method in RPC request'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Convert method name to action (strip api_ prefix for REST compatibility)
  // api_list -> list, api_getPublicBundle -> getPublicBundle
  const action = method.startsWith('api_') ? method.slice(4) : method;

  // Build the GAS request body
  const gasBody = {
    action,
    ...payload
  };

  console.log(`[EventAngle] RPC: ${method} -> action=${action}`);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutMs = env.UPSTREAM_TIMEOUT_MS ? parseInt(env.UPSTREAM_TIMEOUT_MS) : UPSTREAM_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Forward to GAS doPost
    const response = await fetch(appsScriptBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Pass through origin for CORS validation in GAS
        'Origin': origin || 'https://eventangle.com',
        // Forward user-agent for analytics
        'User-Agent': request.headers.get('user-agent') || 'EventAngle-Worker'
      },
      body: JSON.stringify(gasBody),
      redirect: 'follow',
      signal: controller.signal
    });

    console.log(`[EventAngle] RPC response: ${response.status}`);

    // Return the response (GAS returns JSON)
    const responseText = await response.text();

    return new Response(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build headers for Apps Script request
 */
function buildHeaders(request) {
  const headers = new Headers();

  // Forward relevant headers
  const forwardHeaders = [
    'content-type',
    'accept',
    'accept-language',
    'user-agent',
  ];

  forwardHeaders.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  // Set default content-type for POST
  if (request.method === 'POST' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

/**
 * Handle CORS preflight requests
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(response) {
  const newResponse = new Response(response.body, response);

  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Add cache control for API responses
  if (!newResponse.headers.has('Cache-Control')) {
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return newResponse;
}

/**
 * Add transparency headers to response
 * These headers help with debugging and monitoring without modifying response body
 */
function addTransparencyHeaders(response, startTime) {
  const newResponse = new Response(response.body, response);

  // Transparency headers for debugging
  newResponse.headers.set('X-Proxied-By', 'eventangle-worker');
  newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

  // Timing header (if start time provided)
  if (startTime) {
    const duration = Date.now() - startTime;
    newResponse.headers.set('X-Proxy-Duration-Ms', duration.toString());
  }

  return newResponse;
}

// Note: errorResponse replaced by createGracefulErrorResponse for better UX
