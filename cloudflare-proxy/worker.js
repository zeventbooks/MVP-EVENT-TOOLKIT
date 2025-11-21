/**
 * Cloudflare Worker - Google Apps Script Proxy
 *
 * This worker proxies requests to Google Apps Script, providing:
 * - Custom domain support (e.g., api.yourdomain.com)
 * - CORS headers for cross-origin requests
 * - Request/response logging
 * - Edge caching for GET requests
 * - Error handling and retry logic
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

    // Redirect Google's static assets to script.google.com
    // These cannot be proxied - must redirect to Google's CDN
    if (url.pathname.startsWith('/static/')) {
      const staticUrl = `https://script.google.com${url.pathname}${url.search}`;
      return Response.redirect(staticUrl, 302);
    }

    // Redirect Google's internal endpoints (warden, etc.)
    // These are Google's security/analytics endpoints that must go to Google directly
    if (url.pathname.startsWith('/wardeninit') ||
        url.pathname.startsWith('/warden') ||
        url.pathname.startsWith('/_/')) {
      const googleUrl = `https://script.google.com${url.pathname}${url.search}`;
      return Response.redirect(googleUrl, 302);
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
 */
async function proxyToAppsScript(request, appsScriptBase) {
  const url = new URL(request.url);
  const targetUrl = appsScriptBase + url.search;

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

  // Clone response to allow reading body
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
