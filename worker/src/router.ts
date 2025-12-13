/**
 * Central Worker Router
 *
 * Unified Cloudflare Worker router that handles all request routing,
 * eliminating GAS doGet as the router. This is the new source of truth
 * for all request handling.
 *
 * Routes:
 * - /api/* - API endpoints (JSON responses)
 * - /public, /events, /schedule, /calendar - Public page
 * - /admin, /manage, /dashboard, /create - Admin page
 * - /display, /tv, /kiosk, /screen - Display page
 * - /poster, /posters, /flyers - Poster page
 * - /report, /analytics, /reports, /insights - Report page
 * - Unknown routes - 404 JSON response
 *
 * @module router
 * @see Story 1.1 - Create Central Worker Router
 * @see Story 2.2 - Replace getPublicBundle Worker Implementation
 * @see Story 2.3 - Replace getAdminBundle Worker Implementation
 */

import { RouterLogger, createLogger } from './logger';
import { handleStatus, type StatusEnv } from './handlers/status';
import { handleListEvents } from './handlers/eventsList';
import { handleGetPublicBundle } from './handlers/publicBundle';
import { handleGetAdminBundle } from './handlers/adminBundle';
import { handleAdminCreateEvent } from './handlers/adminCreateEvent';
import { handleAdminRecordResult } from './handlers/adminRecordResult';
import { guardAdminRoute, type AdminAuthEnv } from './auth';

// =============================================================================
// Constants
// =============================================================================

/**
 * Router version - incremented with each significant change
 * 1.1.0 - Initial router (Story 1.1)
 * 1.2.0 - Wired up publicBundle and adminBundle handlers (Story 2.2)
 * 1.3.0 - Wired up events list handler for Admin migration (Story 2.3)
 * 1.4.0 - Added admin createEvent endpoint (Story 3.2)
 * 1.5.0 - Added admin recordResult endpoint (Story 3.3)
 */
export const ROUTER_VERSION = '1.5.0';

/**
 * Valid brands for routing
 */
const VALID_BRANDS = ['root', 'abc', 'cbc', 'cbl'] as const;
type Brand = (typeof VALID_BRANDS)[number];

/**
 * HTML page types that the router can serve
 */
type PageType = 'public' | 'admin' | 'display' | 'poster' | 'report';

/**
 * Route aliases mapping paths to page types
 */
const HTML_ROUTE_MAP: Record<string, PageType> = {
  // Public page aliases
  '/public': 'public',
  '/events': 'public',
  '/schedule': 'public',
  '/calendar': 'public',

  // Admin page aliases
  '/admin': 'admin',
  '/manage': 'admin',
  '/dashboard': 'admin',
  '/create': 'admin',

  // Display page aliases
  '/display': 'display',
  '/tv': 'display',
  '/kiosk': 'display',
  '/screen': 'display',

  // Poster page aliases
  '/poster': 'poster',
  '/posters': 'poster',
  '/flyers': 'poster',

  // Report page aliases
  '/report': 'report',
  '/analytics': 'report',
  '/reports': 'report',
  '/insights': 'report',
};

// =============================================================================
// Types
// =============================================================================

/**
 * Worker environment bindings
 */
export interface RouterEnv extends StatusEnv, AdminAuthEnv {
  /** Worker environment (staging, production) */
  WORKER_ENV?: string;
  /** Build version for tracking */
  WORKER_BUILD_VERSION?: string;
  /** Debug level (debug, info, warn, error) */
  DEBUG_LEVEL?: string;
  /** Google Sheets spreadsheet ID */
  SHEETS_SPREADSHEET_ID?: string;
  /** Google service account email */
  GOOGLE_CLIENT_EMAIL?: string;
  /** Google service account private key */
  GOOGLE_PRIVATE_KEY?: string;
}

/**
 * Route match result
 */
interface RouteMatch {
  type: 'api' | 'page' | 'not_found';
  handler?: string;
  pageType?: PageType;
  brand?: Brand;
  eventId?: string;
  params?: Record<string, string>;
}

/**
 * Standard API error response
 */
interface ApiErrorResponse {
  ok: false;
  status: number;
  error: string;
  path?: string;
  timestamp: string;
}

// =============================================================================
// Route Matching
// =============================================================================

/**
 * Extract brand from path (e.g., /abc/events -> 'abc')
 */
function extractBrand(pathname: string): { brand: Brand; remainingPath: string } {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length > 0 && VALID_BRANDS.includes(segments[0] as Brand)) {
    return {
      brand: segments[0] as Brand,
      remainingPath: '/' + segments.slice(1).join('/'),
    };
  }

  return {
    brand: 'root',
    remainingPath: pathname,
  };
}

/**
 * Match a request URL to a route
 */
function matchRoute(url: URL): RouteMatch {
  const { brand, remainingPath } = extractBrand(url.pathname);

  // Normalize path (remove trailing slash, handle empty path)
  const normalizedPath = remainingPath === '' ? '/' : remainingPath.replace(/\/$/, '');

  // Check for API routes
  if (normalizedPath.startsWith('/api/')) {
    const apiPath = normalizedPath.slice(4); // Remove '/api' prefix

    // /api/status - health check endpoint
    if (apiPath === '/status' || apiPath === '/status/') {
      return { type: 'api', handler: 'status', brand };
    }

    // /api/events - events list
    if (apiPath === '/events' || apiPath === '/events/') {
      return { type: 'api', handler: 'events', brand };
    }

    // /api/events/:id - single event
    const eventMatch = apiPath.match(/^\/events\/([^/]+)$/);
    if (eventMatch) {
      return { type: 'api', handler: 'event', brand, eventId: eventMatch[1] };
    }

    // /api/events/:id/publicBundle - public bundle
    const publicBundleMatch = apiPath.match(/^\/events\/([^/]+)\/publicBundle$/);
    if (publicBundleMatch) {
      return { type: 'api', handler: 'publicBundle', brand, eventId: publicBundleMatch[1] };
    }

    // /api/events/:id/adminBundle - admin bundle
    const adminBundleMatch = apiPath.match(/^\/events\/([^/]+)\/adminBundle$/);
    if (adminBundleMatch) {
      return { type: 'api', handler: 'adminBundle', brand, eventId: adminBundleMatch[1] };
    }

    // /api/events/:id/displayBundle - display bundle
    const displayBundleMatch = apiPath.match(/^\/events\/([^/]+)\/displayBundle$/);
    if (displayBundleMatch) {
      return { type: 'api', handler: 'displayBundle', brand, eventId: displayBundleMatch[1] };
    }

    // /api/events/:id/posterBundle - poster bundle
    const posterBundleMatch = apiPath.match(/^\/events\/([^/]+)\/posterBundle$/);
    if (posterBundleMatch) {
      return { type: 'api', handler: 'posterBundle', brand, eventId: posterBundleMatch[1] };
    }

    // /api/admin/events - create event (Story 3.2)
    if (apiPath === '/admin/events' || apiPath === '/admin/events/') {
      return { type: 'api', handler: 'adminCreateEvent', brand };
    }

    // /api/admin/events/:id/results - record result (Story 3.3)
    const adminResultsMatch = apiPath.match(/^\/admin\/events\/([^/]+)\/results$/);
    if (adminResultsMatch) {
      return { type: 'api', handler: 'adminRecordResult', brand, eventId: adminResultsMatch[1] };
    }

    // Unknown API route - return 404
    return { type: 'not_found', brand };
  }

  // Check for HTML page routes
  const pageType = HTML_ROUTE_MAP[normalizedPath];
  if (pageType) {
    return { type: 'page', pageType, brand };
  }

  // Root path - default to public page
  if (normalizedPath === '/') {
    return { type: 'page', pageType: 'public', brand };
  }

  // Unknown route
  return { type: 'not_found', brand };
}

// =============================================================================
// Response Builders
// =============================================================================

/**
 * Create a standard 404 response
 */
function create404Response(path: string, logger: RouterLogger): Response {
  logger.notFound(path);

  const body: ApiErrorResponse = {
    ok: false,
    status: 404,
    error: 'Not Found',
    path,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Router-Version': ROUTER_VERSION,
      'X-Request-Id': logger.getRequestId(),
    },
  });
}

/**
 * Create a 500 error response
 */
function create500Response(error: Error, logger: RouterLogger): Response {
  logger.error('Internal server error', error);

  const body: ApiErrorResponse = {
    ok: false,
    status: 500,
    error: 'Internal Server Error',
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Router-Version': ROUTER_VERSION,
      'X-Request-Id': logger.getRequestId(),
    },
  });
}

/**
 * Create a 405 Method Not Allowed response
 */
function create405Response(method: string, path: string, logger: RouterLogger): Response {
  logger.warn(`Method not allowed: ${method} ${path}`);

  const body: ApiErrorResponse = {
    ok: false,
    status: 405,
    error: 'Method Not Allowed',
    path,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Allow': 'GET, POST, PUT, DELETE, OPTIONS',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Router-Version': ROUTER_VERSION,
      'X-Request-Id': logger.getRequestId(),
    },
  });
}

/**
 * Add standard response headers
 */
function addStandardHeaders(response: Response, logger: RouterLogger): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Router-Version', ROUTER_VERSION);
  headers.set('X-Request-Id', logger.getRequestId());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Add CORS headers for API responses
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// =============================================================================
// API Handlers
// =============================================================================

/**
 * Handle /api/status endpoint
 */
async function handleApiStatus(
  _request: Request,
  env: RouterEnv,
  logger: RouterLogger
): Promise<Response> {
  const startTime = Date.now();

  try {
    const response = await handleStatus(env);
    const durationMs = Date.now() - startTime;

    logger.apiRequest('GET', '/api/status', response.status, durationMs);

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle /api/status', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

/**
 * Handle events list request
 * @see Story 1.3 - Port api_status + Simple Read-Only api_listEvents
 * @see Story 2.3 - Admin UI reads events from Worker
 */
async function handleApiEvents(
  request: Request,
  env: RouterEnv,
  logger: RouterLogger,
  brand: Brand
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Add brand to URL if not already present
    const url = new URL(request.url);
    if (!url.searchParams.has('brand')) {
      url.searchParams.set('brand', brand);
    }

    // Create modified request with brand param
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
    });

    const response = await handleListEvents(modifiedRequest, env);
    const durationMs = Date.now() - startTime;

    logger.apiRequest('GET', '/api/events', response.status, durationMs, { brand });

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle events list', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

/**
 * Placeholder for single event handler
 */
async function handleApiEvent(
  _request: Request,
  _env: RouterEnv,
  logger: RouterLogger,
  brand: Brand,
  eventId: string
): Promise<Response> {
  // TODO: Implement event fetch
  const body = {
    ok: true,
    status: 200,
    backend: 'worker',
    brand,
    eventId,
    event: null,
    message: 'Event endpoint placeholder',
    timestamp: new Date().toISOString(),
  };

  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  logger.apiRequest('GET', `/api/events/${eventId}`, 200, undefined, { brand, eventId });

  return addStandardHeaders(response, logger);
}

/**
 * Handle public bundle request
 * @see Story 2.1 - Worker getPublicBundle from Sheets
 */
async function handleApiPublicBundle(
  request: Request,
  env: RouterEnv,
  logger: RouterLogger,
  brand: Brand,
  eventId: string
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Add brand to URL if not already present
    const url = new URL(request.url);
    if (!url.searchParams.has('brand')) {
      url.searchParams.set('brand', brand);
    }

    // Create modified request with brand param
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
    });

    const response = await handleGetPublicBundle(modifiedRequest, env, eventId);
    const durationMs = Date.now() - startTime;

    logger.apiRequest('GET', `/api/events/${eventId}/publicBundle`, response.status, durationMs, {
      brand,
      eventId,
      bundleType: 'publicBundle',
    });

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle publicBundle', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

/**
 * Handle admin bundle request
 * @see Story 2.2 - Worker getAdminBundle from Sheets
 */
async function handleApiAdminBundle(
  request: Request,
  env: RouterEnv,
  logger: RouterLogger,
  brand: Brand,
  eventId: string
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Add brand to URL if not already present
    const url = new URL(request.url);
    if (!url.searchParams.has('brand')) {
      url.searchParams.set('brand', brand);
    }

    // Create modified request with brand param
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
    });

    const response = await handleGetAdminBundle(modifiedRequest, env, eventId);
    const durationMs = Date.now() - startTime;

    logger.apiRequest('GET', `/api/events/${eventId}/adminBundle`, response.status, durationMs, {
      brand,
      eventId,
      bundleType: 'adminBundle',
    });

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle adminBundle', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

/**
 * Placeholder for display/poster bundle handlers
 * @see Story 2.3, Story 2.4
 */
async function handleApiDisplayPosterBundle(
  _request: Request,
  _env: RouterEnv,
  logger: RouterLogger,
  brand: Brand,
  eventId: string,
  bundleType: string
): Promise<Response> {
  // TODO: Implement display/poster bundle fetch in Story 2.3, 2.4
  const body = {
    ok: true,
    status: 200,
    backend: 'worker',
    brand,
    eventId,
    bundleType,
    bundle: null,
    message: `${bundleType} endpoint placeholder - implement in Story 2.3/2.4`,
    timestamp: new Date().toISOString(),
  };

  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  logger.apiRequest('GET', `/api/events/${eventId}/${bundleType}`, 200, undefined, {
    brand,
    eventId,
    bundleType,
  });

  return addStandardHeaders(response, logger);
}

/**
 * Handle admin create event request
 * POST /api/admin/events
 * @see Story 3.2 - Port createEvent to Worker
 */
async function handleApiAdminCreateEvent(
  request: Request,
  env: RouterEnv,
  logger: RouterLogger,
  brand: Brand
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Add brand to URL if not already present (for handler to extract)
    const url = new URL(request.url);
    if (!url.searchParams.has('brand')) {
      url.searchParams.set('brand', brand);
    }

    // Create modified request with brand param
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const response = await handleAdminCreateEvent(modifiedRequest, env);
    const durationMs = Date.now() - startTime;

    logger.apiRequest(request.method, '/api/admin/events', response.status, durationMs, {
      brand,
      operation: 'createEvent',
    });

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle admin createEvent', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

/**
 * Handle admin record result request
 * POST /api/admin/events/:id/results
 * @see Story 3.3 - Port recordResult to Worker
 */
async function handleApiAdminRecordResult(
  request: Request,
  env: RouterEnv,
  logger: RouterLogger,
  brand: Brand,
  eventId: string
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Add brand to URL if not already present (for handler to extract)
    const url = new URL(request.url);
    if (!url.searchParams.has('brand')) {
      url.searchParams.set('brand', brand);
    }

    // Create modified request with brand param
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const response = await handleAdminRecordResult(modifiedRequest, env);
    const durationMs = Date.now() - startTime;

    logger.apiRequest(request.method, `/api/admin/events/${eventId}/results`, response.status, durationMs, {
      brand,
      eventId,
      operation: 'recordResult',
    });

    return addStandardHeaders(response, logger);
  } catch (error) {
    logger.error('Failed to handle admin recordResult', error);
    return create500Response(error instanceof Error ? error : new Error(String(error)), logger);
  }
}

// =============================================================================
// Page Handlers
// =============================================================================

/**
 * Placeholder for HTML page handler
 * Will serve embedded templates or proxy to GAS based on configuration
 */
async function handlePage(
  _request: Request,
  _env: RouterEnv,
  logger: RouterLogger,
  pageType: PageType,
  brand: Brand
): Promise<Response> {
  // TODO: Implement HTML serving in Story 1.x
  // For now, return a simple placeholder indicating the route was matched
  const body = `<!DOCTYPE html>
<html>
<head>
  <title>EventAngle - ${pageType}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <h1>EventAngle ${pageType.charAt(0).toUpperCase() + pageType.slice(1)}</h1>
  <p>Brand: ${brand}</p>
  <p>This is a placeholder page. Full implementation coming in subsequent stories.</p>
  <p>Router Version: ${ROUTER_VERSION}</p>
</body>
</html>`;

  logger.routeResolved(`/${pageType}`, pageType, 200, undefined, { brand });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Router-Version': ROUTER_VERSION,
      'X-Request-Id': logger.getRequestId(),
      'X-Page-Type': pageType,
      'X-Brand': brand,
    },
  });
}

// =============================================================================
// Main Router
// =============================================================================

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions(request: Request, logger: RouterLogger): Response {
  const url = new URL(request.url);
  logger.debug(`CORS preflight: ${url.pathname}`);

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'X-Router-Version': ROUTER_VERSION,
      'X-Request-Id': logger.getRequestId(),
    },
  });
}

/**
 * Main request handler - the central router entry point
 *
 * This function is the new source of truth for all request routing,
 * replacing GAS doGet as the router.
 */
export async function handleRequest(
  request: Request,
  env: RouterEnv
): Promise<Response> {
  // Create logger for this request
  const logger = createLogger(env);

  // Use CF-Ray header as request ID if available
  const cfRay = request.headers.get('cf-ray');
  if (cfRay) {
    logger.setRequestId(cfRay);
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  logger.incomingRequest(method, url.toString());

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request, logger);
    }

    // Story 3.1: Check admin authentication for protected routes
    // This guards all admin endpoints (/api/admin/*, /api/events/:id/adminBundle, etc.)
    const authError = guardAdminRoute(request, env);
    if (authError) {
      logger.warn(`Admin auth failed for ${url.pathname}`);
      return addCorsHeaders(authError);
    }

    // Match the route
    const match = matchRoute(url);
    const startTime = Date.now();

    // Handle based on route type
    switch (match.type) {
      case 'api': {
        // API routes - return JSON
        let response: Response;

        switch (match.handler) {
          case 'status':
            response = await handleApiStatus(request, env, logger);
            break;

          case 'events':
            response = await handleApiEvents(request, env, logger, match.brand || 'root');
            break;

          case 'event':
            response = await handleApiEvent(
              request,
              env,
              logger,
              match.brand || 'root',
              match.eventId!
            );
            break;

          case 'publicBundle':
            response = await handleApiPublicBundle(
              request,
              env,
              logger,
              match.brand || 'root',
              match.eventId!
            );
            break;

          case 'adminBundle':
            response = await handleApiAdminBundle(
              request,
              env,
              logger,
              match.brand || 'root',
              match.eventId!
            );
            break;

          case 'displayBundle':
          case 'posterBundle':
            response = await handleApiDisplayPosterBundle(
              request,
              env,
              logger,
              match.brand || 'root',
              match.eventId!,
              match.handler
            );
            break;

          case 'adminCreateEvent':
            response = await handleApiAdminCreateEvent(
              request,
              env,
              logger,
              match.brand || 'root'
            );
            break;

          case 'adminRecordResult':
            response = await handleApiAdminRecordResult(
              request,
              env,
              logger,
              match.brand || 'root',
              match.eventId!
            );
            break;

          default:
            response = create404Response(url.pathname, logger);
        }

        return addCorsHeaders(response);
      }

      case 'page': {
        // HTML page routes
        if (method !== 'GET' && method !== 'HEAD') {
          return create405Response(method, url.pathname, logger);
        }

        return handlePage(request, env, logger, match.pageType!, match.brand || 'root');
      }

      case 'not_found':
      default: {
        return addCorsHeaders(create404Response(url.pathname, logger));
      }
    }
  } catch (error) {
    return addCorsHeaders(
      create500Response(error instanceof Error ? error : new Error(String(error)), logger)
    );
  }
}

// =============================================================================
// Worker Export
// =============================================================================

/**
 * Cloudflare Worker fetch handler
 *
 * This is the main entry point for the Worker.
 */
export default {
  async fetch(request: Request, env: RouterEnv, _ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};
