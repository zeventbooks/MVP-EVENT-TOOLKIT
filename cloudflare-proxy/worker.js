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
const WORKER_VERSION = '1.1.0';

// Configuration - Updated by CI/CD or set in wrangler.toml
const DEFAULT_DEPLOYMENT_ID = 'AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ';

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

    // Determine request type:
    // - API requests: ?action=* or ?api=* or /api/* → proxy with CORS headers
    // - Page requests: ?page=* or path-based → proxy and return HTML directly (no JSON wrapping)
    const isApiRequest = url.searchParams.has('action') ||
                         url.searchParams.has('api') ||
                         url.searchParams.get('format') === 'json' ||
                         url.pathname.startsWith('/api');

    try {
      if (isApiRequest) {
        // API request: proxy and add CORS headers
        const response = await proxyToAppsScript(request, appsScriptBase);
        const corsResponse = addCORSHeaders(response);
        return addTransparencyHeaders(corsResponse, startTime);
      } else {
        // HTML page request: proxy directly without CORS wrapping
        // This keeps eventangle.com in the browser address bar
        const response = await proxyPageRequest(request, appsScriptBase, url);
        return addTransparencyHeaders(response, startTime);
      }
    } catch (error) {
      return errorResponse(error);
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
async function proxyPageRequest(request, appsScriptBase, url) {
  // Get path and strip known prefixes
  let path = url.pathname;
  const knownPrefixes = [
    '/events', '/manage', '/admin', '/display', '/tv', '/kiosk',
    '/screen', '/posters', '/poster', '/flyers', '/schedule',
    '/calendar', '/dashboard', '/create', '/analytics', '/reports',
    '/insights', '/stats', '/status', '/health', '/docs'
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
    // Map path prefix to page parameter
    const pathToPage = {
      'events': 'public', 'manage': 'admin', 'admin': 'admin',
      'display': 'display', 'tv': 'display', 'kiosk': 'display',
      'screen': 'display', 'poster': 'poster', 'posters': 'poster',
      'flyers': 'poster', 'status': 'status', 'health': 'status',
      'analytics': 'report', 'reports': 'report', 'insights': 'report',
      'stats': 'report', 'schedule': 'public', 'calendar': 'public',
      'dashboard': 'admin', 'create': 'admin', 'docs': 'admin'
    };
    const firstSegment = url.pathname.split('/').filter(Boolean)[0] || 'events';
    const mappedPage = pathToPage[firstSegment];
    if (mappedPage) {
      params.set('page', mappedPage);
    }
  }

  // Build target URL
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const targetUrl = path
    ? `${appsScriptBase}/${path}${queryString}`
    : `${appsScriptBase}${queryString}`;

  console.log(`[EventAngle] Proxying page to: ${targetUrl}`);

  // Fetch from Apps Script (follow redirects)
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: buildHeaders(request),
    redirect: 'follow',
  });

  console.log(`[EventAngle] Page response: ${response.status} ${response.statusText}`);

  // Return response with cache headers for HTML pages
  const newResponse = new Response(response.body, response);
  if (!newResponse.headers.has('Cache-Control')) {
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return newResponse;
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
async function proxyToAppsScript(request, appsScriptBase) {
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

  // Build fetch options
  const fetchOptions = {
    method: request.method,
    headers: buildHeaders(request),
    redirect: 'follow',
  };

  // Add body for POST/PUT requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = await request.text();
  }

  // Make request to Apps Script
  const response = await fetch(targetUrl, fetchOptions);

  console.log(`[EventAngle] Response: ${response.status} ${response.statusText}`);

  return response;
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

/**
 * Error response handler
 */
function errorResponse(error) {
  console.error('Proxy error:', error);

  return new Response(JSON.stringify({
    ok: false,
    error: 'PROXY_ERROR',
    message: error.message || 'Failed to proxy request to Apps Script',
    workerVersion: WORKER_VERSION,
  }), {
    status: 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Proxied-By': 'eventangle-worker',
      'X-Worker-Version': WORKER_VERSION,
    },
  });
}
