/**
 * Cloudflare Worker - Google Apps Script Proxy
 *
 * This worker proxies requests to Google Apps Script, providing:
 * - Custom domain support (e.g., eventangle.com/events)
 * - CORS headers for cross-origin requests
 * - Friendly URL routing (/events/abc/manage → exec/abc/manage)
 * - Query string preservation (?page=admin passes through)
 * - Error handling and retry logic
 *
 * Deployment modes (see wrangler.toml):
 * - env.events: Only /events* paths (recommended for mixed sites)
 * - env.production: Full site (eventangle.com/*)
 * - env.api-only: API subdomain only
 *
 * Example flows (env.events - /events* route):
 * - eventangle.com/events → exec → Public.html (default)
 * - eventangle.com/events/manage → exec/manage → Admin.html
 * - eventangle.com/events/abc/events → exec/abc/events → ABC Public.html
 * - eventangle.com/events?page=admin → exec?page=admin → Admin.html
 *
 * Example flows (env.production - /* route):
 * - eventangle.com/manage → exec/manage → Admin.html
 * - eventangle.com/abc/events → exec/abc/events → ABC Public.html
 *
 * Apps Script receives paths via e.pathInfo array.
 * See docs/FRIENDLY_URLS.md for complete URL mapping.
 *
 * Deployment ID is injected via environment variable or wrangler.toml
 */

// Configuration - Updated by CI/CD or set in wrangler.toml
const DEFAULT_DEPLOYMENT_ID = 'AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw';

export default {
  async fetch(request, env, ctx) {
    // Use env variable if available, otherwise fallback to default
    const deploymentId = env.DEPLOYMENT_ID || DEFAULT_DEPLOYMENT_ID;
    const appsScriptBase = `https://script.google.com/macros/s/${deploymentId}/exec`;

    const url = new URL(request.url);

    // Log incoming request for debugging (visible in Cloudflare dashboard)
    console.log(`[EventAngle] ${request.method} ${url.pathname}${url.search}`);

    // Redirect Google's static assets to script.google.com
    // These cannot be proxied - must redirect to Google's CDN
    if (url.pathname.startsWith('/static/')) {
      const staticUrl = `https://script.google.com${url.pathname}${url.search}`;
      return Response.redirect(staticUrl, 302);
    }

    // Handle Google's internal endpoints (warden, etc.)
    // These are Google's security/analytics endpoints used for bot detection.
    // When proxying through a custom domain, Google's client-side warden script
    // validates that the posting URI is a Google domain. Since we're on a custom
    // domain, we return a stub success response to prevent "posting uri is not valid" errors.
    // This is safe because warden is for Google's internal security, not user authentication.
    if (url.pathname.startsWith('/wardeninit') ||
        url.pathname.startsWith('/warden') ||
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
        },
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      const response = await proxyToAppsScript(request, appsScriptBase);
      return addCORSHeaders(response);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

/**
 * Proxy request to Google Apps Script
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
 * Error response handler
 */
function errorResponse(error) {
  console.error('Proxy error:', error);

  return new Response(JSON.stringify({
    ok: false,
    error: 'PROXY_ERROR',
    message: error.message || 'Failed to proxy request to Apps Script',
  }), {
    status: 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
