// === Zeventbook Production-Grade Backend ===
// Build: triangle-prod-v1.2
//
// =============================================================================
// MVP SCOPE LOCK - Focus Group Critical
// =============================================================================
// MVP Surfaces (6 total - see docs/MVP_SURFACES.md):
//   ✅ Admin.html        ?page=admin
//   ✅ Public.html       ?page=public (default)
//   ✅ Display.html      ?page=display
//   ✅ Poster.html       ?page=poster
//   ✅ Sponsor.html      ?page=sponsor
//   ✅ SharedReport.html ?page=report
//
// Non-MVP (v2+ experimental):
//   ❌ ApiDocs, Diagnostics, Test, Signup, PlannerCards, ConfigHtml
//
// DO NOT add new surfaces without updating docs/MVP_SURFACES.md
// =============================================================================

// === Constants / Envelopes / Errors =======================================
const ERR = Object.freeze({
  BAD_INPUT:   'BAD_INPUT',
  NOT_FOUND:   'NOT_FOUND',
  RATE_LIMITED:'RATE_LIMITED',
  INTERNAL:    'INTERNAL',
  CONTRACT:    'CONTRACT'
});
const Ok  = (value={}) => ({ ok:true,  value });
const Err = (code, message) => ({ ok:false, code, message: message||code });

// Fixed: Bug #48 - Sanitize error messages to prevent information disclosure
/**
 * Creates a user-friendly error response while logging detailed information internally
 * @param {string} code - Error code (ERR.*)
 * @param {string} internalMessage - Detailed internal message (logged, not shown to user)
 * @param {object} logDetails - Additional details to log
 * @param {string} where - Function name for logging context
 * @returns {object} Error envelope with sanitized message
 */
function UserFriendlyErr_(code, internalMessage, logDetails = {}, where = 'API') {
  // Log full details internally
  diag_('error', where, internalMessage, logDetails);

  // Map error codes to generic user-facing messages
  const userMessages = {
    'BAD_INPUT': 'Invalid request. Please check your input and try again.',
    'NOT_FOUND': 'The requested resource was not found.',
    'UNAUTHORIZED': 'Authentication failed. Please verify your credentials.',
    'RATE_LIMITED': 'Too many requests. Please try again later.',
    'INTERNAL': 'An internal error occurred. Please try again later.',
    'CONTRACT': 'An unexpected error occurred. Please contact support.'
  };

  // Return sanitized error to user
  const sanitizedMessage = userMessages[code] || 'An error occurred. Please try again.';
  return Err(code, sanitizedMessage);
}

// === Schema validation (runtime contracts) =================================
function schemaCheck(schema, obj, where='') {
  if (schema.type === 'object' && obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(schema.props || {})) {
      if (v.required && !(k in obj)) {
        diag_('error', where||'schemaCheck', 'Missing required field', {field: k});
        throw new Error(`Missing required field: ${k}`);
      }
      if (k in obj && v.type && typeof obj[k] !== v.type) {
        diag_('error', where||'schemaCheck', 'Type mismatch', {field: k, expected: v.type, got: typeof obj[k]});
        throw new Error(`Type mismatch for ${k}: expected ${v.type}, got ${typeof obj[k]}`);
      }
    }
  } else if (schema.type === 'array' && Array.isArray(obj)) {
    // Arrays are valid
  } else if (schema.type && typeof obj !== schema.type) {
    diag_('error', where||'schemaCheck', 'Schema type mismatch', {expected: schema.type, got: typeof obj});
    throw new Error(`Schema type mismatch: expected ${schema.type}, got ${typeof obj}`);
  }
  return true;
}

// Response schemas
const SC_OK = {type: 'object', props: {ok: {type: 'boolean', required: true}}};
const SC_LIST = {type: 'object', props: {ok: {type: 'boolean', required: true}, value: {type: 'object'}}};
const SC_GET = {type: 'object', props: {ok: {type: 'boolean', required: true}, value: {type: 'object'}}};
const SC_STATUS = {type: 'object', props: {ok: {type: 'boolean', required: true}, value: {type: 'object'}}};

// Fixed: Bug #26 - Check if obj is error response before schema validation
function _ensureOk_(label, schema, obj) {
  // If already an error envelope, return as-is without validation
  if (obj && obj.ok === false) {
    return obj;
  }

  try {
    schemaCheck(schema, obj, label);
    return obj;
  } catch(e) {
    diag_('error', label, 'Contract violation', {error: String(e), obj});
    return Err(ERR.CONTRACT, `Contract violation in ${label}: ${e.message}`);
  }
}

// === Logger (append-only with caps) =======================================
const DIAG_SHEET='DIAG', DIAG_MAX=3000, DIAG_PER_DAY=800;

/**
 * Diagnostic logging with spreadsheet ID support for web app context
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} where - Function/location name
 * @param {string} msg - Log message
 * @param {object} meta - Optional metadata object
 * @param {string} spreadsheetId - Optional spreadsheet ID (uses root brand if not provided)
 */
// Delegate to SecurityMiddleware for consistent sanitization across codebase
function sanitizeMetaForLogging_(meta) {
  return SecurityMiddleware_sanitizeMetaForLogging(meta);
}

function diag_(level, where, msg, meta, spreadsheetId){
  try{
    // If spreadsheet ID not provided, try to get from root brand
    if (!spreadsheetId) {
      const rootBrand = findBrand_('root');
      if (rootBrand && rootBrand.store && rootBrand.store.spreadsheetId) {
        spreadsheetId = rootBrand.store.spreadsheetId;
      }
    }

    // Fall back to getActive() only if no spreadsheet ID available (UI context)
    const ss = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActive();

    let sh = ss.getSheetByName(DIAG_SHEET);
    if(!sh){
      sh = ss.insertSheet(DIAG_SHEET);
      sh.appendRow(['ts','level','where','msg','meta']);
      sh.setFrozenRows(1);
    }

    // Fixed: Bug #17 - Sanitize metadata before logging
    const sanitizedMeta = sanitizeMetaForLogging_(meta);
    sh.appendRow([new Date().toISOString(), level, where, msg, sanitizedMeta ? JSON.stringify(sanitizedMeta) : '']);

    // Fixed: Bug #47 - Add error handling for cleanup operations
    try {
      // Hard cap cleanup - Fixed: Bug #8
      const last = sh.getLastRow();
      if(last > DIAG_MAX){
        const rowsToDelete = last - DIAG_MAX;
        if (rowsToDelete > 0) {
          sh.deleteRows(2, rowsToDelete);
        }
      }

      // Fixed: Bug #42 - Use counter instead of random for deterministic cleanup
      // Run cleanup every 50 log entries instead of random 10% chance
      const cache = CacheService.getScriptCache();
      const cleanupCounterKey = 'diag_cleanup_counter';
      const counter = parseInt(cache.get(cleanupCounterKey) || '0', 10) + 1;
      cache.put(cleanupCounterKey, String(counter), 3600);

      const shouldCleanup = (counter % 50 === 0); // Every 50th log entry
      if(shouldCleanup && last > DIAG_PER_DAY){
        const today = (new Date()).toISOString().slice(0,10);
        const lastRow = sh.getLastRow();
        // Fixed: Bug #23 - Check if sheet has more than just header
        if (lastRow > 1) {
          const ts = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();
          const idx = ts.map((t, i) => String(t).startsWith(today) ? i + 2 : null).filter(Boolean);
          if(idx.length > DIAG_PER_DAY){
            const rowsToDelete = idx.length - DIAG_PER_DAY;
            if (rowsToDelete > 0) {
              sh.deleteRows(idx[0], rowsToDelete);
            }
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Diagnostic cleanup failed:', cleanupErr);
      // Continue execution - don't fail logging due to cleanup error
    }
  } catch(e) {
    console.error('diag_ failed:', e, {level, where, msg, meta});
  }
}

function runSafe(where, fn){
  try{ return fn(); }
  catch(e){
    diag_('error',where,'Exception',{err:String(e),stack:e&&e.stack});
    return Err(ERR.INTERNAL,'Unexpected error');
  }
}

// === CSRF Protection =======================================================
// Fixed: Bug #4 - Add CSRF token generation and validation

function generateCSRFToken_() {
  const token = Utilities.getUuid();
  const cache = CacheService.getUserCache();
  cache.put('csrf_' + token, '1', 3600); // 1 hour expiry
  return token;
}

function validateCSRFToken_(token) {
  if (!token || typeof token !== 'string') return false;

  // Fixed: Bug #4 - Use LockService for atomic check-and-remove to prevent race condition
  const lock = LockService.getUserLock();
  try {
    // Acquire lock with 5 second timeout
    if (!lock.tryLock(5000)) {
      diag_('warn', 'validateCSRFToken_', 'Failed to acquire lock', { token: token.substring(0, 8) + '...' });
      return false;
    }

    const cache = CacheService.getUserCache();
    const valid = cache.get('csrf_' + token);

    if (valid) {
      cache.remove('csrf_' + token); // One-time use (now atomic)
      return true;
    }
    return false;
  } finally {
    // Always release lock
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock might have expired, ignore
    }
  }
}

// === Router ================================================================
// MVP Routes: admin, public (default), display, poster, sponsor, report/analytics
// Non-MVP Routes: docs/api, test, diagnostics, signup, config, planner, sponsor-roi
// See docs/MVP_SURFACES.md for scope definition
// ===========================================================================
function doGet(e){
  const pageParam = (e?.parameter?.page || e?.parameter?.p || '').toString();
  const actionParam = (e?.parameter?.action || '').toString();
  const hostHeader = (e?.headers?.host || e?.parameter?.host || '').toString();
  let brand= findBrandByHost_(hostHeader) || findBrand_('root');

  // Allow brand parameter to override default brand
  if (e?.parameter?.brand) {
    const overrideBrand = findBrand_(e.parameter.brand);
    if (overrideBrand) {
      brand = overrideBrand;
    }
  }

  // Demo mode detection (for testing, UAT, demos, and screenshots)
  const demoMode = (e?.parameter?.demo === 'true' || e?.parameter?.test === 'true');

  // ===== Customer-Friendly URL Routing =====
  // Supports patterns like:
  //   /abc/events → brand=abc, page=public
  //   /abc/manage → brand=abc, page=admin, mode=advanced
  //   /events → brand=root, page=public
  //   /display → brand=root, page=display
  const pathInfo = (e?.pathInfo || '').toString().replace(/^\/+|\/+$/g, '');

  if (pathInfo) {
    const pathParts = pathInfo.split('/').filter(p => p);

    // Check if first part is a brand ID
    let brandFromPath = null;
    let aliasFromPath = null;

    if (pathParts.length >= 2) {
      // Pattern: /{brand}/{alias}
      const possibleBrand = findBrand_(pathParts[0]);
      if (possibleBrand) {
        brandFromPath = possibleBrand;
        aliasFromPath = pathParts[1];
      }
    }

    if (!brandFromPath && pathParts.length >= 1) {
      // Pattern: /{alias} (use default brand)
      aliasFromPath = pathParts[0];
    }

    // Resolve alias to page configuration
    if (aliasFromPath) {
      const aliasConfig = resolveUrlAlias_(aliasFromPath, brandFromPath?.id || brand.id);

      if (aliasConfig) {
        // API endpoints should return JSON/special content, not HTML pages
        // Handle these directly instead of routing through routePage_()
        const resolvedPage = aliasConfig.page;

        // Handle API-like pages that return JSON
        if (resolvedPage === 'status') {
          const brandParam = (e?.parameter?.brand || brand.id || 'root').toString();
          const status = api_status(brandParam);
          return ContentService.createTextOutput(JSON.stringify(status, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
        }

        if (resolvedPage === 'setup' || resolvedPage === 'setupcheck') {
          const brandParam = (e?.parameter?.brand || brand.id || 'root').toString();
          const setupResult = api_setupCheck(brandParam);
          return ContentService.createTextOutput(JSON.stringify(setupResult, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
        }

        if (resolvedPage === 'permissions' || resolvedPage === 'checkpermissions') {
          const brandParam = (e?.parameter?.brand || brand.id || 'root').toString();
          const permissionResult = api_checkPermissions(brandParam);
          return ContentService.createTextOutput(JSON.stringify(permissionResult, null, 2))
            .setMimeType(ContentService.MimeType.JSON);
        }

        // Handle API docs page (returns HTML, but special)
        if (resolvedPage === 'api' || resolvedPage === 'docs') {
          return HtmlService.createHtmlOutputFromFile('ApiDocs')
            .setTitle('API Documentation - MVP Event Toolkit')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
        }

        // Standard HTML page routing
        // Override brand if specified in path
        if (brandFromPath) {
          brand = brandFromPath;
        }

        const resolvedMode = aliasConfig.mode;

        // Continue routing with resolved values
        return routePage_(
          e,
          resolvedPage,
          brand,
          demoMode,
          { mode: resolvedMode, fromAlias: true, alias: aliasFromPath }
        );
      }
    }
  }

  // REST API Routes (for custom frontends)
  if (actionParam) {
    return handleRestApiGet_(e, actionParam, brand);
  }

  // Shortlink redirect route
  if (pageParam === 'r' || pageParam === 'redirect') {
    const token = (e?.parameter?.t || e?.parameter?.token || '').toString();
    return handleRedirect_(token);
  }

  // API Documentation page
  if (pageParam === 'docs' || pageParam === 'api') {
    // Fixed: Bug #31 - Add security headers
    return HtmlService.createHtmlOutputFromFile('ApiDocs')
      .setTitle('API Documentation - MVP Event Toolkit')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
  }

  // Status endpoint
  if (pageParam === 'status') {
    const brandParam = (e?.parameter?.brand || 'root').toString();
    const status = api_status(brandParam);
    return ContentService.createTextOutput(JSON.stringify(status, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Setup check endpoint - comprehensive diagnostics for first-time setup
  if (pageParam === 'setup' || pageParam === 'setupcheck') {
    const brandParam = (e?.parameter?.brand || 'root').toString();
    const setupResult = api_setupCheck(brandParam);
    return ContentService.createTextOutput(JSON.stringify(setupResult, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Permission check endpoint - quick diagnostic for permission issues
  if (pageParam === 'permissions' || pageParam === 'checkpermissions') {
    const brandParam = (e?.parameter?.brand || 'root').toString();
    const permissionResult = api_checkPermissions(brandParam);
    return ContentService.createTextOutput(JSON.stringify(permissionResult, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const path = (e?.pathInfo || '').toString().replace(/^\/+|\/+$/g,'');
  const scope = (e?.parameter?.p || e?.parameter?.scope || 'events').toString();
  const allowed = brand.scopesAllowed?.length ? brand.scopesAllowed : ['events','leagues','tournaments'];

  if (!allowed.includes(scope)){
    const first = allowed[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&brand=${brand.id}">`);
  }

  // Page routing - MVP surfaces are: admin, public (default), display, poster, sponsor, report/analytics
  // Non-MVP routes (v2+): test, diagnostics, signup, config, planner, sponsor-roi
  let page = (pageParam==='admin' || pageParam==='wizard' || pageParam==='planner' || pageParam==='poster' || pageParam==='test' || pageParam==='display' || pageParam==='report' || pageParam==='analytics' || pageParam==='diagnostics' || pageParam==='sponsor' || pageParam==='sponsor-roi' || pageParam==='signup' || pageParam==='config') ? pageParam : 'public';

  // Route using helper function
  return routePage_(e, page, brand, demoMode, { mode: e?.parameter?.mode });
}

/**
 * Route to a specific page with brand and options
 * Centralizes page routing logic for both query params and friendly URLs
 *
 * @param {object} e - Request event object
 * @param {string} page - Page to route to
 * @param {object} brand - Brand configuration
 * @param {boolean} demoMode - Demo mode flag
 * @param {object} options - Additional routing options (mode, fromAlias, etc.)
 * @returns {HtmlOutput} - Rendered page
 */
function routePage_(e, page, brand, demoMode, options = {}) {
  // Admin variant routing - three intentional modes:
  //   - AdminWizard.html (default): Simplified event creation wizard for quick setup
  //   - Admin.html (mode=advanced): Full admin dashboard with lifecycle, stats, analytics
  //   - AdminEnhanced.html (mode=enhanced): Enhanced UI with component libraries (experimental)
  // Access via: /manage, /admin, /dashboard → defaults to wizard
  //             /manage?mode=advanced → full admin dashboard
  //             /manage?mode=enhanced → enhanced components mode
  if (page === 'admin') {
    const mode = options.mode || '';
    if (mode === 'enhanced') {
      page = 'admin-enhanced';
    } else if (mode !== 'advanced') {
      page = 'wizard'; // Default to wizard (simple mode)
    }
  }

  const scope = (e?.parameter?.p || e?.parameter?.scope || 'events').toString();
  const allowed = brand.scopesAllowed?.length ? brand.scopesAllowed : ['events','leagues','tournaments'];

  if (!allowed.includes(scope) && page === 'public'){
    const first = allowed[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&brand=${brand.id}">`);
  }

  const tpl = HtmlService.createTemplateFromFile(pageFile_(page));
  // Fixed: Bug #35 - Sanitize template variables to prevent injection
  tpl.appTitle = sanitizeInput_(`${brand.name} · ${scope}`, 200);
  tpl.brandId = sanitizeId_(brand.id) || brand.id;
  tpl.scope = sanitizeInput_(scope, 50);
  tpl.execUrl = ScriptApp.getService().getUrl();
  tpl.ZEB = ZEB;
  tpl.demoMode = demoMode; // Pass demo mode flag to templates
  tpl.brand = brand; // Pass brand object for template consistency

  // Pass friendly URL info if routed via alias
  if (options.fromAlias) {
    tpl.friendlyUrl = true;
    tpl.urlAlias = options.alias || '';
  }

  // Set global template context for include() function to use
  // This allows included templates to access these variables
  global_setTemplateContext_({
    appTitle: tpl.appTitle,
    brandId: tpl.brandId,
    scope: tpl.scope,
    execUrl: tpl.execUrl,
    ZEB: tpl.ZEB,
    demoMode: tpl.demoMode,
    brand: tpl.brand,
    friendlyUrl: tpl.friendlyUrl || false,
    urlAlias: tpl.urlAlias || ''
  });

  // Fixed: Bug #31 - Add security headers
  return tpl.evaluate()
    .setTitle(`${tpl.appTitle} · ${page}${demoMode ? ' (Demo)' : ''}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// === REST API Handler for POST requests ===================================
function doPost(e){
  // Fixed: Bug #22 - Separate try-catch blocks for better error reporting
  let body;
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch(jsonErr) {
    return jsonResponse_(Err(ERR.BAD_INPUT, 'Invalid JSON body'));
  }

  try {
    // Fixed: Bug #16 - Validate request origin to prevent unauthorized access
    const origin = e.parameter?.origin || e.headers?.origin || e.headers?.referer;
    if (!isAllowedOrigin_(origin, e.headers)) {
      diag_('warn', 'doPost', 'Unauthorized origin or missing auth headers', {origin});
      return jsonResponse_(Err(ERR.BAD_INPUT, 'Unauthorized origin or missing authentication headers'));
    }

    const action = body.action || e.parameter?.action || '';
    const brand= findBrandByHost_(e?.headers?.host) || findBrand_('root');

    // Fixed: Bug #4 - CSRF protection for state-changing operations
    const stateChangingActions = ['create', 'update', 'delete', 'updateEventData', 'createShortlink', 'createFormFromTemplate', 'generateFormShortlink'];
    if (stateChangingActions.includes(action)) {
      if (!validateCSRFToken_(body.csrfToken)) {
        return jsonResponse_(Err(ERR.BAD_INPUT, 'Invalid or missing CSRF token. Please refresh the page and try again.'));
      }
    }

    return handleRestApiPost_(e, action, body, brand);
  } catch(err) {
    diag_('error', 'doPost', 'Request handler failed', {error: String(err), stack: err?.stack});
    return jsonResponse_(Err(ERR.INTERNAL, 'Request processing failed'));
  }
}

// === REST API GET Handler (read-only operations) ==========================
function handleRestApiGet_(e, action, brand) {
  const brandId = e.parameter.brand || brand.id;
  const scope = e.parameter.scope || 'events';
  const etag = e.parameter.etag || '';
  const id = e.parameter.id || '';

  // Public endpoints (no auth required)
  if (action === 'status') {
    return jsonResponse_(api_status(brandId));
  }

  // Fixed: Bug #4 - CSRF token generation endpoint
  if (action === 'generateCSRFToken') {
    const token = generateCSRFToken_();
    return jsonResponse_(Ok({ csrfToken: token }));
  }

  if (action === 'config') {
    return jsonResponse_(api_getConfig({brandId, scope, ifNoneMatch: etag}));
  }

  if (action === 'list') {
    return jsonResponse_(api_list({brandId, scope, ifNoneMatch: etag}));
  }

  if (action === 'get') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_get({brandId, scope, id, ifNoneMatch: etag}));
  }

  // Public bundle endpoints (no auth required)
  if (action === 'getPublicBundle') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_getPublicBundle({brandId, scope, id, ifNoneMatch: etag}));
  }

  if (action === 'getDisplayBundle') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_getDisplayBundle({brandId, scope, id, ifNoneMatch: etag}));
  }

  if (action === 'getPosterBundle') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_getPosterBundle({brandId, scope, id, ifNoneMatch: etag}));
  }

  if (action === 'getSponsorBundle') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_getSponsorBundle({brandId, scope, id, ifNoneMatch: etag}));
  }

  if (action === 'getSharedReportBundle') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_getSharedReportBundle({brandId, scope, id, ifNoneMatch: etag}));
  }

  return jsonResponse_(Err(ERR.BAD_INPUT, `Unknown action: ${action}`));
}

// === REST API POST Handler (write operations, require auth) ===============
function handleRestApiPost_(e, action, body, brand) {
  const brandId = body.brandId || e.parameter?.brand || brand.id;
  const scope = body.scope || e.parameter?.scope || 'events';

  // Special case: token generation uses old auth flow
  if (action === 'generateToken') {
    return jsonResponse_(api_generateToken({
      brandId,
      adminKey: body.adminKey,
      expiresIn: body.expiresIn,
      scope
    }));
  }

  // Check authorization using multi-method authentication
  const authCheck = authenticateRequest_(e, body, brandId);
  if (!authCheck.ok) {
    return jsonResponse_(authCheck);
  }

  const authenticatedBrand = authCheck.value.brand;
  const adminKey = body.adminKey || getAdminSecret_(authenticatedBrand.id); // For backward compatibility

  // Route to appropriate API function
  if (action === 'create') {
    return jsonResponse_(api_create({
      brandId,
      adminKey,
      scope,
      templateId: body.templateId,
      data: body.data
    }));
  }

  if (action === 'update') {
    return jsonResponse_(api_updateEventData({
      brandId,
      adminKey,
      scope,
      id: body.id,
      data: body.data
    }));
  }

  if (action === 'logEvents') {
    return jsonResponse_(api_logEvents({
      items: body.items || []
    }));
  }

  if (action === 'getReport') {
    return jsonResponse_(api_getReport({
      brandId,
      adminKey,
      id: body.eventId || '',  // Fixed: Changed eventId to id to match api_getReport
      startDate: body.startDate || '',
      endDate: body.endDate || ''
    }));
  }

  // Admin Bundle - optimized bundle for Admin.html surface
  if (action === 'getAdminBundle') {
    return jsonResponse_(api_getAdminBundle({
      brandId,
      adminKey,
      scope,
      id: body.id || body.eventId || '',
      ifNoneMatch: body.ifNoneMatch || ''
    }));
  }

  if (action === 'createShortlink') {
    return jsonResponse_(api_createShortlink({
      brandId,
      adminKey,
      targetUrl: body.targetUrl,
      eventId: body.eventId || '',
      sponsorId: body.sponsorId || '',
      surface: body.surface || ''
    }));
  }

  if (action === 'listFormTemplates') {
    return jsonResponse_(api_listFormTemplates());
  }

  if (action === 'createFormFromTemplate') {
    return jsonResponse_(api_createFormFromTemplate({
      brandId,
      adminKey,
      templateType: body.templateType,
      eventName: body.eventName || '',
      eventId: body.eventId || ''
    }));
  }

  if (action === 'generateFormShortlink') {
    return jsonResponse_(api_generateFormShortlink({
      brandId,
      adminKey,
      formUrl: body.formUrl,
      formType: body.formType || '',
      eventId: body.eventId || ''
    }));
  }

  // Brand Portfolio Analytics (Parent Organizations)
  if (action === 'api_getPortfolioSponsorReport') {
    return jsonResponse_(api_getPortfolioSponsorReport({
      brandId,
      adminKey,
      sponsorId: body.sponsorId || '',
      options: body.options || {}
    }));
  }

  if (action === 'api_getPortfolioSummary') {
    return jsonResponse_(api_getPortfolioSummary({
      brandId,
      adminKey
    }));
  }

  if (action === 'api_getPortfolioSponsors') {
    return jsonResponse_(api_getPortfolioSponsors({
      brandId,
      adminKey
    }));
  }

  // Sponsor Configuration Endpoints
  if (action === 'getSponsorSettings' || action === 'api_getSponsorSettings') {
    return jsonResponse_(api_getSponsorSettings({
      brandId
    }));
  }

  if (action === 'validateSponsorPlacements' || action === 'api_validateSponsorPlacements') {
    return jsonResponse_(api_validateSponsorPlacements({
      brandId,
      sponsors: body.sponsors || []
    }));
  }

  // Sponsor ROI Dashboard (High-Value Feature)
  if (action === 'getSponsorROI' || action === 'api_getSponsorROI') {
    return jsonResponse_(api_getSponsorROI({
      sponsorId: body.sponsorId || '',
      sponsorshipCost: body.sponsorshipCost || 0,
      costPerClick: body.costPerClick || 0,
      conversionRate: body.conversionRate || 0,
      avgTransactionValue: body.avgTransactionValue || 0,
      dateFrom: body.dateFrom || '',
      dateTo: body.dateTo || '',
      brandId,
      adminKey
    }));
  }

  // Sponsor Analytics
  if (action === 'getSponsorAnalytics' || action === 'api_getSponsorAnalytics') {
    return jsonResponse_(api_getSponsorAnalytics({
      sponsorId: body.sponsorId || '',
      eventId: body.eventId || '',
      dateFrom: body.dateFrom || '',
      dateTo: body.dateTo || '',
      brandId,
      adminKey
    }));
  }

  // Webhook Management Endpoints (gated by WEBHOOKS feature flag)
  if (action === 'registerWebhook' || action === 'api_registerWebhook') {
    const featureCheck = requireFeature_('WEBHOOKS');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(WebhookService_register({
      brandId,
      adminKey,
      eventType: body.eventType || '',
      url: body.url || '',
      secret: body.secret || '',
      enabled: body.enabled,
      filters: body.filters
    }));
  }

  if (action === 'unregisterWebhook' || action === 'api_unregisterWebhook') {
    const featureCheck = requireFeature_('WEBHOOKS');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(WebhookService_unregister({
      brandId,
      adminKey,
      webhookId: body.webhookId || ''
    }));
  }

  if (action === 'listWebhooks' || action === 'api_listWebhooks') {
    const featureCheck = requireFeature_('WEBHOOKS');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(WebhookService_list({
      brandId,
      adminKey
    }));
  }

  if (action === 'testWebhook' || action === 'api_testWebhook') {
    const featureCheck = requireFeature_('WEBHOOKS');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(WebhookService_test({
      brandId,
      adminKey,
      webhookId: body.webhookId || ''
    }));
  }

  if (action === 'getWebhookDeliveries' || action === 'api_getWebhookDeliveries') {
    const featureCheck = requireFeature_('WEBHOOKS');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(WebhookService_getDeliveries({
      brandId,
      adminKey,
      webhookId: body.webhookId || '',
      limit: body.limit || 50
    }));
  }

  // i18n (Internationalization) Endpoints (gated by I18N feature flag)
  if (action === 'translate' || action === 'api_translate') {
    const featureCheck = requireFeature_('I18N');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(api_translate({
      key: body.key || '',
      locale: body.locale || '',
      params: body.params || {}
    }));
  }

  if (action === 'getSupportedLocales' || action === 'api_getSupportedLocales') {
    const featureCheck = requireFeature_('I18N');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(i18n_getSupportedLocales());
  }

  if (action === 'setUserLocale' || action === 'api_setUserLocale') {
    const featureCheck = requireFeature_('I18N');
    if (featureCheck) return jsonResponse_(featureCheck);
    return jsonResponse_(i18n_setUserLocale(body.locale || ''));
  }

  // Template Management Endpoints
  if (action === 'getTemplate' || action === 'api_getTemplate') {
    return jsonResponse_(api_getTemplate({
      templateId: body.templateId || '',
      locale: body.locale || ''
    }));
  }

  if (action === 'listTemplates' || action === 'api_listTemplates') {
    return jsonResponse_(api_listTemplates({
      category: body.category || '',
      locale: body.locale || '',
      includeDeprecated: body.includeDeprecated || false
    }));
  }

  if (action === 'validateTemplateData' || action === 'api_validateTemplateData') {
    return jsonResponse_(api_validateTemplateData({
      templateId: body.templateId || '',
      data: body.data || {},
      locale: body.locale || ''
    }));
  }

  return jsonResponse_(Err(ERR.BAD_INPUT, `Unknown action: ${action}`));
}

// === Origin Validation =====================================================
// Fixed: Bug #16 - Add origin validation to prevent unauthorized API access
function isAllowedOrigin_(origin, authHeaders) {
  // Fixed: Bug #16 Part 2 - Requests without origin (curl, Postman, server-to-server)
  // must have authentication headers (JWT token or Authorization header)
  if (!origin) {
    // Non-browser requests must provide authentication
    const hasAuth = authHeaders && (
      authHeaders.authorization ||
      authHeaders.Authorization ||
      authHeaders['x-api-key'] ||
      authHeaders['X-API-Key']
    );

    if (!hasAuth) {
      diag_('warn', 'isAllowedOrigin_', 'Non-browser request without auth headers', {});
      return false;
    }

    // Has auth headers, allow to proceed to authentication layer
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname.toLowerCase();

    // Allow localhost for development
    if (originHost === 'localhost' || originHost === '127.0.0.1') {
      return true;
    }

    // Check against brand hostnames
    for (const brand of BRANDS) {
      if (brand.hostnames && brand.hostnames.some(h => h.toLowerCase() === originHost)) {
        return true;
      }
    }

    // Allow script.google.com for Apps Script frontends
    if (originHost.endsWith('.google.com')) {
      return true;
    }

    return false;
  } catch (e) {
    diag_('warn', 'isAllowedOrigin_', 'Invalid origin URL', {origin, error: String(e)});
    return false;
  }
}

// === JSON Response Helper with CORS =======================================
function jsonResponse_(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);

  // CORS headers are automatically handled by Apps Script
  // Origin validation is performed in doPost/doGet handlers
  return output;
}

/**
 * Map page identifiers to HTML template files
 * Page routing: URL param → internal page → HTML file
 *
 * Admin variants (see routePage_ for mode logic):
 *   admin → Admin.html (full dashboard, mode=advanced)
 *   admin-enhanced → AdminEnhanced.html (experimental, mode=enhanced)
 *   wizard → AdminWizard.html (default simplified wizard)
 *
 * @param {string} page - Page identifier from routing
 * @returns {string} HTML template filename (without .html extension)
 */
function pageFile_(page){
  // === MVP SURFACES ===
  if (page==='admin') return 'Admin';
  if (page==='poster') return 'Poster';
  if (page==='display') return 'Display';
  if (page==='report' || page==='analytics') return 'SharedReport';
  if (page==='sponsor') return 'Sponsor';
  // === Supporting Pages ===
  if (page==='test') return 'Test';
  if (page==='diagnostics') return 'Diagnostics';
  if (page==='sponsor-roi') return 'SponsorDashboard';
  if (page==='signup') return 'Signup';
  if (page==='config') return 'ConfigHtml';
  if (page==='planner') return 'PlannerCards';
  // === v2+ (archived) - redirect to Admin ===
  if (page==='wizard' || page==='admin-enhanced') return 'Admin';
  return 'Public';
}

// === Template Context Management ===========================================
// Global variable to hold template context for include() function
var TEMPLATE_CONTEXT_ = null;

/**
 * Set the global template context (used by include() to pass variables)
 * @param {object} context - Template variables to make available to included files
 * @private
 */
function global_setTemplateContext_(context) {
  TEMPLATE_CONTEXT_ = context;
}

/**
 * Get the global template context
 * @returns {object|null} - Current template context or null
 * @private
 */
function global_getTemplateContext_() {
  return TEMPLATE_CONTEXT_;
}

/**
 * Include and evaluate an HTML template file with template variable support
 *
 * This function is called from HTML templates using <?!= include('filename') ?>
 * It evaluates the included file as a template, allowing it to use <?= ?> tags
 * for variable substitution.
 *
 * @param {string} filename - The name of the HTML file to include (without .html extension)
 * @returns {string} - The evaluated HTML content
 */
function include(filename) {
  // Create template from file to enable template tag evaluation
  const template = HtmlService.createTemplateFromFile(filename);

  // Get the global template context (set by routePage_)
  const context = global_getTemplateContext_();

  // Pass template variables from context to the included template
  // This enables <?= variableName ?> tags in included files to work correctly
  if (context) {
    Object.keys(context).forEach(function(key) {
      template[key] = context[key];
    });
  }

  // Evaluate the template and return the HTML content
  return template.evaluate().getContent();
}

// === Shortlink redirect handler ============================================
function handleRedirect_(token) {
  if (!token) {
    return HtmlService.createHtmlOutput('<h1>Invalid shortlink</h1>');
  }

  // Use root brand spreadsheet for shortlinks
  const rootBrand = findBrand_('root');
  if (!rootBrand || !rootBrand.store || !rootBrand.store.spreadsheetId) {
    return HtmlService.createHtmlOutput('<h1>Configuration error</h1>');
  }

  const spreadsheetId = rootBrand.store.spreadsheetId;
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sh = ss.getSheetByName('SHORTLINKS');
  if (!sh) {
    return HtmlService.createHtmlOutput('<h1>Shortlink not found</h1>');
  }

  const rows = sh.getDataRange().getValues().slice(1);
  const row = rows.find(r => r[0] === token);

  if (!row) {
    diag_('warn', 'handleRedirect_', 'Token not found', {token}, spreadsheetId);
    return HtmlService.createHtmlOutput('<h1>Shortlink not found</h1>');
  }

  // Fixed: Bug #53 - Extract brandId for validation (7th column if present)
  const [tok, targetUrl, eventId, sponsorId, surface, createdAt, shortlinkBrandId] = row;

  // Fixed: Bug #52 - Validate URL before redirect to prevent XSS
  if (!isUrl(targetUrl)) {
    diag_('error', 'handleRedirect_', 'Invalid URL in shortlink', {token, targetUrl}, spreadsheetId);
    return HtmlService.createHtmlOutput('<h1>Invalid shortlink URL</h1>');
  }

  // Additional validation: ensure HTTP(S) only
  try {
    const url = new URL(targetUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      diag_('error', 'handleRedirect_', 'Non-HTTP protocol in shortlink', {token, protocol: url.protocol}, spreadsheetId);
      return HtmlService.createHtmlOutput('<h1>Invalid shortlink protocol</h1>');
    }
  } catch(e) {
    diag_('error', 'handleRedirect_', 'URL parsing failed', {token, targetUrl, error: String(e)}, spreadsheetId);
    return HtmlService.createHtmlOutput('<h1>Invalid shortlink URL</h1>');
  }

  // Log analytics
  try {
    api_logEvents({
      items: [{
        eventId: eventId || '',
        surface: surface || 'shortlink',
        metric: 'click',
        sponsorId: sponsorId || '',
        token: tok
      }]
    });
  } catch(e) {
    diag_('warn', 'handleRedirect_', 'Analytics log failed', {error: String(e)}, spreadsheetId);
  }

  diag_('info', 'handleRedirect_', 'Redirect', {token, targetUrl, eventId, sponsorId}, spreadsheetId);

  // Fixed: Bug #1 - Add warning page for external redirects to prevent phishing
  const url = new URL(targetUrl);
  const hostname = url.hostname.toLowerCase();

  // Check if this is an external domain (not a known brand domain)
  let isExternal = true;
  for (const brand of BRANDS) {
    if (brand.hostnames && brand.hostnames.some(h => h.toLowerCase() === hostname)) {
      isExternal = false;
      break;
    }
  }

  // Use sanitized URL - escape it for HTML context
  const escapedUrl = String(targetUrl)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // If external domain, show warning page
  if (isExternal) {
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>External Link Warning</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 5px; }
          .url { word-break: break-all; background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 3px; }
          .buttons { margin-top: 20px; }
          button { padding: 10px 20px; margin-right: 10px; cursor: pointer; }
          .continue { background: #007bff; color: white; border: none; border-radius: 3px; }
          .cancel { background: #6c757d; color: white; border: none; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="warning">
          <h2>⚠️ External Link Warning</h2>
          <p>You are about to leave this site and visit an external website:</p>
          <div class="url">${escapedUrl}</div>
          <p><strong>Warning:</strong> We cannot guarantee the safety or content of external websites. Proceed with caution.</p>
          <div class="buttons">
            <button class="continue" onclick="window.location.href='${escapedUrl}'">Continue to External Site</button>
            <button class="cancel" onclick="window.close()">Cancel</button>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Internal redirect - proceed immediately
  return HtmlService.createHtmlOutput(`
    <meta http-equiv="refresh" content="0;url=${escapedUrl}">
    <p>Redirecting...</p>
  `);
}

// === Authentication & Authorization ========================================

/**
 * Multi-method authentication support:
 * 1. adminKey (legacy) - Simple secret key
 * 2. Bearer token (JWT) - Stateless token-based auth
 * 3. API Key (header) - X-API-Key header
 */
function authenticateRequest_(e, body, brandId) {
  const brand= findBrand_(brandId);
  if (!brand) {
    return Err(ERR.NOT_FOUND, 'Unknown brand');
  }

  // Method 1: adminKey in body (legacy, backward compatible)
  const adminKey = body?.adminKey || e?.parameter?.adminKey || '';
  const brandSecret = getAdminSecret_(brand.id);
  if (adminKey && brandSecret && adminKey === brandSecret) {
    return Ok({ brand, method: 'adminKey' });
  }

  // Method 2: Bearer token (JWT)
  const authHeader = e?.headers?.Authorization || e?.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtResult = verifyJWT_(token, brand);
    if (jwtResult.ok) {
      return Ok({ brand, method: 'jwt', claims: jwtResult.value });
    }
  }

  // Method 3: API Key in header
  const apiKey = e?.headers?.['X-API-Key'] || e?.headers?.['x-api-key'] || '';
  const brandApiSecret = getAdminSecret_(brand.id);
  if (apiKey && brandApiSecret && apiKey === brandApiSecret) {
    return Ok({ brand, method: 'apiKey' });
  }

  // No valid authentication found
  return Err(ERR.BAD_INPUT, 'Invalid authentication credentials');
}

/**
 * Simple JWT verification (for demonstration)
 * In production, use a proper JWT library or Google's OAuth
 */
// Fixed: Bug #2 - Add algorithm verification to prevent "none" algorithm attack
/**
 * Timing-safe string comparison to prevent timing attacks
 * Returns true if strings are equal, false otherwise
 * Always takes constant time regardless of where strings differ
 */
function timingSafeCompare_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Different lengths = not equal, but still compare all bytes to maintain constant time
  const aLen = a.length;
  const bLen = b.length;
  let result = aLen === bLen ? 0 : 1;

  // Compare all bytes, using modulo to handle different lengths
  const maxLen = Math.max(aLen, bLen);
  for (let i = 0; i < maxLen; i++) {
    const aChar = i < aLen ? a.charCodeAt(i) : 0;
    const bChar = i < bLen ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }

  return result === 0;
}

function verifyJWT_(token, brand) {
  try {
    // Simple validation: decode base64 payload
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Err(ERR.BAD_INPUT, 'Invalid JWT format');
    }

    // Verify algorithm in header (prevent "none" algorithm attack)
    let header;
    try {
      header = JSON.parse(Utilities.newBlob(Utilities.base64Decode(parts[0])).getDataAsString());
    } catch (e) {
      return Err(ERR.BAD_INPUT, 'Invalid JWT header');
    }

    // Only allow HS256 algorithm
    if (!header.alg || header.alg !== 'HS256') {
      diag_('error', 'verifyJWT_', 'Invalid algorithm', {alg: header.alg});
      return Err(ERR.BAD_INPUT, 'Invalid JWT algorithm');
    }

    const payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(parts[1])).getDataAsString());

    // Verify brand
    if (payload.brand !== brand.id) {
      return Err(ERR.BAD_INPUT, 'Token brand mismatch');
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return Err(ERR.BAD_INPUT, 'Token expired');
    }

    // Verify signature (simplified - use proper crypto in production)
    const brandSecret = getAdminSecret_(brand.id);
    if (!brandSecret) {
      return UserFriendlyErr_(ERR.INTERNAL, 'Brand secret not configured', { brandId: brand.id }, 'verifyJWT_');
    }
    const expectedSignature = generateJWTSignature_(parts[0] + '.' + parts[1], brandSecret);

    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeCompare_(parts[2], expectedSignature)) {
      return Err(ERR.BAD_INPUT, 'Invalid token signature');
    }

    // Verify not-before if present
    if (payload.nbf && payload.nbf > now) {
      return Err(ERR.BAD_INPUT, 'Token not yet valid');
    }

    return Ok(payload);
  } catch (e) {
    return UserFriendlyErr_(ERR.BAD_INPUT, 'Invalid JWT verification', { error: e.message }, 'verifyJWT_');
  }
}

// =============================================================================
// === MVP API CONTRACTS (Triangle Live Demo) ==================================
// =============================================================================
// Surfaces: Admin, Poster, Display, Public, Sponsor, SharedReport
//
// DO NOT change these contracts without updating:
//   - NUSDK.html (API client)
//   - tests/e2e/* (end-to-end tests)
//   - tests/unit/* (unit tests)
//
// ┌─────────────────────────────────────────────────────────────────────────────
// │ MVP CONTRACTS - Don't break during iteration
// ├─────────────────────────────────────────────────────────────────────────────
// │ Event Core:
// │   api_create()              → Create new event (Admin)
// │   api_get()                 → Get single event (all surfaces)
// │   api_updateEventData()     → Update event data (Admin)
// │   api_getPublicBundle()     → Public bundle (Public, Poster, Display)
// │
// │ Forms:
// │   api_createFormFromTemplate() → Create registration form (Admin)
// │   api_generateFormShortlink()  → Trackable form links (Admin)
// │
// │ Sponsors & Analytics:
// │   api_getSponsorSettings()  → Sponsor placements (all surfaces)
// │   api_getSharedAnalytics()  → Shared analytics (SharedReport) [SharedReporting.gs]
// │   api_getSponsorAnalytics() → Sponsor metrics (Sponsor, SharedReport)
// │   api_getSponsorROI()       → ROI calculation (Sponsor, SharedReport)
// │
// │ Templates:
// │   api_getEventTemplates()   → Available templates for brand (Admin)
// └─────────────────────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────────
// │ v2+ APIs - Working but not MVP focus
// ├─────────────────────────────────────────────────────────────────────────────
// │ Portfolio:     api_getPortfolioSponsorReport, api_getPortfolioSummary,
// │                api_getPortfolioSponsors
// │ Multi-brand:   Brand hierarchy, child brand rollups
// │ Exports:       api_exportReport (advanced spreadsheet exports)
// │ i18n:          Full internationalization system
// └─────────────────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Generate JWT token for a brand (for demo/testing)
 * @tier mvp
 */
function api_generateToken(req) {
  const authCheck = gate_(req.brandId, req.adminKey);
  if (!authCheck.ok) return authCheck;

  const brand= authCheck.value.brand;
  const expiresIn = req.expiresIn || 3600; // 1 hour default

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    brand: brand.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    scope: req.scope || 'events'
  };

  const headerB64 = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const brandSecret = getAdminSecret_(brand.id);
  if (!brandSecret) {
    return UserFriendlyErr_(ERR.INTERNAL, 'Brand secret not configured', { brandId: brand.id }, 'api_generateToken');
  }
  const signature = generateJWTSignature_(headerB64 + '.' + payloadB64, brandSecret);

  const token = headerB64 + '.' + payloadB64 + '.' + signature;

  return Ok({
    token,
    expiresIn,
    expiresAt: new Date((payload.exp * 1000)).toISOString(),
    usage: `Authorization: Bearer ${token}`
  });
}

function generateJWTSignature_(data, secret) {
  const signature = Utilities.computeHmacSha256Signature(data, secret);
  return Utilities.base64EncodeWebSafe(signature);
}

/**
 * Get available event templates for a brand
 * Admin calls this to populate template picker dropdown/tiles
 * @tier mvp
 */
function api_getEventTemplates(payload, ctx) {
  const brandId = (ctx && ctx.brandId) || (payload && payload.brandId) || 'root';
  const cfg = getBrandTemplateConfig_(brandId);
  const templates = getTemplatesForBrand_(brandId);
  return Ok({
    items: templates,
    defaultTemplateId: cfg.defaultTemplateId
  });
}

// === Guards / Helpers ======================================================
// Fixed: Bug #18 - Improved rate limiting with IP tracking and backoff
const RATE_MAX_PER_MIN = 10; // Reduced from 20
const RATE_LOCKOUT_MINS = 15;
const MAX_FAILED_AUTH = 5;

function gate_(brandId, adminKey, ipAddress = null){
  const brand=findBrand_(brandId);
  if(!brand) return Err(ERR.NOT_FOUND,'Unknown brand');

  const brandSecret = getAdminSecret_(brand.id);
  const cache = CacheService.getScriptCache();

  // Track failed authentication attempts per IP
  if (brandSecret && adminKey !== brandSecret) {
    if (ipAddress) {
      const failKey = `auth_fail:${brandId}:${ipAddress}`;
      const fails = Number(cache.get(failKey) || '0');

      if (fails >= MAX_FAILED_AUTH) {
        return Err(ERR.RATE_LIMITED, `Too many failed authentication attempts. Try again in ${RATE_LOCKOUT_MINS} minutes.`);
      }

      cache.put(failKey, String(fails + 1), RATE_LOCKOUT_MINS * 60); // 15 min lockout
    }
    return Err(ERR.BAD_INPUT,'Invalid admin key');
  }

  // Rate limiting per brand AND per IP (if available)
  const identifier = ipAddress ? `${brandId}:${ipAddress}` : brandId;
  const rateKey = `rate:${identifier}:${new Date().toISOString().slice(0,16)}`;
  const n = Number(cache.get(rateKey)||'0');
  if (n >= RATE_MAX_PER_MIN) return Err(ERR.RATE_LIMITED,'Too many requests. Please try again later.');
  cache.put(rateKey, String(n+1), 60);

  return Ok({brand});
}

function assertScopeAllowed_(brand, scope){
  const allowed = (brand.scopesAllowed && brand.scopesAllowed.length)
    ? brand.scopesAllowed : ['events','leagues','tournaments'];
  if (!allowed.includes(scope)) {
    return UserFriendlyErr_(ERR.BAD_INPUT, `Scope not enabled: ${scope}`, { scope, brandId: brand.id, allowedScopes: allowed }, 'assertScopeAllowed_');
  }
  return Ok();
}

// Fixed: Bug #32 - Comprehensive URL validation
function isUrl(s, maxLength = 2048) {
  if (!s || typeof s !== 'string') return false;

  const urlStr = String(s);

  // Length check
  if (urlStr.length > maxLength) return false;

  try {
    const url = new URL(urlStr);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Blocklist dangerous patterns
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerous.some(d => urlStr.toLowerCase().includes(d))) {
      return false;
    }

    // Prevent SSRF - block private IPs and localhost
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.') ||
        hostname.startsWith('169.254.')) { // Link-local
      return false;
    }

    return true;
  } catch(_) {
    return false;
  }
}

// Fixed: Bug #28 - Safe JSON parsing helper
function safeJSONParse_(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString || '{}');
  } catch (e) {
    diag_('error', 'safeJSONParse_', 'JSON parse failed', {
      error: e.message,
      jsonString: String(jsonString).slice(0, 200)
    });
    return defaultValue;
  }
}

// Delegate to SecurityMiddleware for consistent sanitization across codebase
// See SecurityMiddleware.gs for implementation details
function sanitizeInput_(input, maxLength = 1000) {
  return SecurityMiddleware_sanitizeInput(input, maxLength);
}

function sanitizeId_(id) {
  return SecurityMiddleware_sanitizeId(id);
}

function sanitizeSpreadsheetValue_(value) {
  return SecurityMiddleware_sanitizeSpreadsheetValue(value);
}

// === Sheet Utilities =========================================================
// NOTE: These could be extracted to SheetUtils.gs in the future for better
// modularity. Keeping here for now to minimize risk during refactoring.
// Candidates for extraction: getStoreSheet_, _ensureAnalyticsSheet_, _ensureShortlinksSheet_

function getStoreSheet_(brand, scope){
  const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);
  const title = scope.toUpperCase();
  let sh = ss.getSheetByName(title);
  if (!sh){
    sh = ss.insertSheet(title);
    sh.appendRow(['id','brandId','templateId','dataJSON','createdAt','slug']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _ensureAnalyticsSheet_(spreadsheetId){
  // If no spreadsheet ID provided, use root brand
  if (!spreadsheetId) {
    const rootBrand = findBrand_('root');
    if (rootBrand && rootBrand.store && rootBrand.store.spreadsheetId) {
      spreadsheetId = rootBrand.store.spreadsheetId;
    }
  }

  const ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActive();

  let sh = ss.getSheetByName('ANALYTICS');
  if (!sh){
    sh = ss.insertSheet('ANALYTICS');
    // Extended columns for sponsor/BBN attribution: sessionId ties events together, visibleSponsorIds for context
    sh.appendRow(['timestamp','eventId','surface','metric','sponsorId','value','token','userAgent','sessionId','visibleSponsorIds']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _ensureShortlinksSheet_(spreadsheetId){
  // If no spreadsheet ID provided, use root brand
  if (!spreadsheetId) {
    const rootBrand = findBrand_('root');
    if (rootBrand && rootBrand.store && rootBrand.store.spreadsheetId) {
      spreadsheetId = rootBrand.store.spreadsheetId;
    }
  }

  const ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActive();

  let sh = ss.getSheetByName('SHORTLINKS');
  if (!sh){
    sh = ss.insertSheet('SHORTLINKS');
    sh.appendRow(['token','targetUrl','eventId','sponsorId','surface','createdAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

// === APIs (uniform envelopes + SWR) =======================================

/**
 * System status check - verifies database connectivity and returns build info
 * @tier mvp
 */
function api_status(brandId){
  return runSafe('api_status', () => {
    try {
      // Get brand info if provided
      const brand= brandId ? findBrand_(brandId) : findBrand_('root');
      if (!brand) {
        return Err(ERR.NOT_FOUND, `Brand not found: ${brandId}`);
      }

      const brandInfo = brand.id;

      // Use brand's spreadsheet ID instead of getActive() for web app context
      const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);
      const id = ss.getId();
      const dbOk = !!id;

      return _ensureOk_('api_status', SC_STATUS, Ok({
        build: ZEB.BUILD_ID,
        contract: ZEB.CONTRACT_VER,
        brand: brandInfo,
        time: new Date().toISOString(),
        db: { ok: dbOk, id }
      }));
    } catch(e) {
      // Enhanced error handling with setup guidance
      const errorMsg = String(e.message || e);
      const setupUrl = ScriptApp.getService().getUrl() + '?p=setup';

      if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
        return Err(ERR.INTERNAL,
          `Spreadsheet not found or inaccessible. Please check:\n` +
          `1. Spreadsheet ID is correct: ${brand.store.spreadsheetId}\n` +
          `2. Script owner has access to the spreadsheet\n` +
          `3. Run setup check: ${setupUrl}`
        );
      }

      if (errorMsg.includes('permission') || errorMsg.includes('authorization')) {
        return Err(ERR.INTERNAL,
          `Permission denied accessing spreadsheet. Please:\n` +
          `1. Ensure script owner can edit the spreadsheet\n` +
          `2. Check OAuth scopes include spreadsheets access\n` +
          `3. Re-authorize the deployment if needed`
        );
      }

      return Err(ERR.INTERNAL,
        `Status check failed: ${errorMsg}\n` +
        `Run setup diagnostics: ${setupUrl}`
      );
    }
  });
}

/**
 * Comprehensive setup verification endpoint for first-time configuration
 * Checks all critical setup requirements and provides actionable guidance
 * @tier mvp
 */
function api_setupCheck(brandId) {
  return runSafe('api_setupCheck', () => {
    const checks = [];
    const issues = [];
    const warnings = [];
    const fixes = [];

    const brand= brandId ? findBrand_(brandId) : findBrand_('root');
    if (!brand) {
      return Err(ERR.NOT_FOUND, `Brand not found: ${brandId || 'root'}`);
    }

    // Check 1: Brand Configuration
    checks.push({ name: 'Brand Configuration', status: 'checking' });
    try {
      if (!brand.id || !brand.name || !brand.store) {
        issues.push('Brand configuration incomplete');
        fixes.push('Verify brand configuration in Config.gs');
        checks[0].status = 'error';
      } else {
        checks[0].status = 'ok';
        checks[0].details = `Brand: ${brand.name} (${brand.id})`;
      }
    } catch(e) {
      checks[0].status = 'error';
      checks[0].error = String(e.message);
    }

    // Check 2: Spreadsheet Access
    checks.push({ name: 'Spreadsheet Access', status: 'checking' });
    try {
      const spreadsheetId = brand.store.spreadsheetId;
      if (!spreadsheetId) {
        issues.push('Spreadsheet ID not configured');
        fixes.push('Set spreadsheetId in Config.gs for brand: ' + brand.id);
        checks[1].status = 'error';
      } else {
        try {
          const ss = SpreadsheetApp.openById(spreadsheetId);
          const name = ss.getName();
          const id = ss.getId();
          checks[1].status = 'ok';
          checks[1].details = `Connected to: "${name}" (${id})`;

          // Verify ownership/edit access
          try {
            ss.getSheetByName('TEST_PERMISSIONS');
            const testSheet = ss.insertSheet('TEST_PERMISSIONS');
            ss.deleteSheet(testSheet);
            checks[1].permissions = 'owner/editor';
          } catch(permErr) {
            warnings.push('Limited spreadsheet permissions - may affect some operations');
            checks[1].permissions = 'viewer/limited';
          }

        } catch(accessErr) {
          const errMsg = String(accessErr.message);
          checks[1].status = 'error';
          checks[1].error = errMsg;

          if (errMsg.includes('not found')) {
            issues.push(`Spreadsheet not found: ${spreadsheetId}`);
            fixes.push('Update spreadsheetId in Config.gs with a valid Google Sheets ID');
            fixes.push('Ensure spreadsheet ID is from URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit');
          } else if (errMsg.includes('permission')) {
            issues.push('No permission to access spreadsheet');
            fixes.push('Share the spreadsheet with script owner (zeventbook@gmail.com)');
            fixes.push('Grant at least "Editor" access to the spreadsheet');
          } else {
            issues.push('Cannot access spreadsheet: ' + errMsg);
            fixes.push('Verify spreadsheet ID and permissions');
          }
        }
      }
    } catch(e) {
      checks[1].status = 'error';
      checks[1].error = String(e.message);
    }

    // Check 3: Admin Secrets
    checks.push({ name: 'Admin Secrets', status: 'checking' });
    try {
      const secret = getAdminSecret_(brand.id);
      if (!secret) {
        warnings.push(`Admin secret not set for brand: ${brand.id}`);
        fixes.push(`Set admin secret via Script Properties: ADMIN_SECRET_${brand.id.toUpperCase()}`);
        fixes.push('Go to: Project Settings > Script Properties > Add property');
        checks[2].status = 'warning';
        checks[2].details = 'Not configured (write operations will fail)';
      } else {
        checks[2].status = 'ok';
        checks[2].details = 'Configured (length: ' + secret.length + ' chars)';
      }
    } catch(e) {
      checks[2].status = 'error';
      checks[2].error = String(e.message);
    }

    // Check 4: Deployment Settings
    checks.push({ name: 'Deployment Configuration', status: 'checking' });
    try {
      const deploymentUrl = ScriptApp.getService().getUrl();
      if (!deploymentUrl) {
        issues.push('No active deployment found');
        fixes.push('Deploy as Web App: Deploy > New deployment');
        fixes.push('Set: Execute as = Me, Who has access = Anyone');
        checks[3].status = 'error';
      } else {
        checks[3].status = 'ok';
        checks[3].details = deploymentUrl;

        // Check if deployment is accessible
        try {
          const isAnonymous = ScriptApp.getService().isEnabled();
          checks[3].access = isAnonymous ? 'anonymous' : 'requires-auth';

          if (!isAnonymous) {
            warnings.push('Deployment may require authentication');
            fixes.push('Edit deployment: Who has access = Anyone');
          }
        } catch(e) {
          // Can't determine access level
        }
      }
    } catch(e) {
      checks[3].status = 'error';
      checks[3].error = String(e.message);
    }

    // Check 5: OAuth Scopes
    checks.push({ name: 'OAuth Scopes', status: 'checking' });
    try {
      // Try to access services to verify scopes
      const scopeTests = [];

      // Spreadsheets scope
      try {
        SpreadsheetApp.getActiveSpreadsheet();
        scopeTests.push({ scope: 'spreadsheets', ok: true });
      } catch(e) {
        if (brand.store.spreadsheetId) {
          try {
            SpreadsheetApp.openById(brand.store.spreadsheetId);
            scopeTests.push({ scope: 'spreadsheets', ok: true });
          } catch(e2) {
            scopeTests.push({ scope: 'spreadsheets', ok: false, error: 'Permission denied' });
          }
        }
      }

      // External requests scope
      try {
        UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
        scopeTests.push({ scope: 'external_request', ok: true });
      } catch(e) {
        scopeTests.push({ scope: 'external_request', ok: false, error: String(e.message) });
      }

      const failedScopes = scopeTests.filter(t => !t.ok);
      if (failedScopes.length > 0) {
        warnings.push('Some OAuth scopes may not be authorized');
        fixes.push('Re-authorize deployment to grant all permissions');
        checks[4].status = 'warning';
        checks[4].details = scopeTests;
      } else {
        checks[4].status = 'ok';
        checks[4].details = 'All required scopes authorized';
      }
    } catch(e) {
      checks[4].status = 'error';
      checks[4].error = String(e.message);
    }

    // Check 6: Required Sheets Structure
    checks.push({ name: 'Database Structure', status: 'checking' });
    try {
      if (checks[1].status === 'ok') {
        const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);
        const existingSheets = ss.getSheets().map(s => s.getName());

        const requiredSheets = ['EVENTS', 'SPONSORS', 'ANALYTICS', 'SHORTLINKS', 'DIAG'];
        const missingSheets = requiredSheets.filter(name => !existingSheets.includes(name));

        if (missingSheets.length > 0) {
          warnings.push('Some data sheets will be auto-created on first use');
          checks[5].status = 'warning';
          checks[5].details = `Missing sheets: ${missingSheets.join(', ')}`;
          checks[5].note = 'These will be created automatically when needed';
        } else {
          checks[5].status = 'ok';
          checks[5].details = 'All required sheets present';
        }
      } else {
        checks[5].status = 'skipped';
        checks[5].details = 'Spreadsheet not accessible';
      }
    } catch(e) {
      checks[5].status = 'warning';
      checks[5].error = String(e.message);
    }

    // Determine overall status
    const hasErrors = checks.some(c => c.status === 'error');
    const hasWarnings = checks.some(c => c.status === 'warning');

    let overallStatus = 'ok';
    let message = 'All setup checks passed! System is ready to use.';

    if (hasErrors) {
      overallStatus = 'error';
      message = `Setup incomplete. Found ${issues.length} critical issue(s) that must be fixed.`;
    } else if (hasWarnings) {
      overallStatus = 'warning';
      message = `Setup mostly complete. Found ${warnings.length} warning(s) that should be addressed.`;
    }

    return Ok({
      status: overallStatus,
      message,
      brand: brand.id,
      timestamp: new Date().toISOString(),
      checks,
      issues,
      warnings,
      fixes,
      nextSteps: fixes.length > 0 ? fixes : [
        'Your setup is complete!',
        'Test the API: ' + ScriptApp.getService().getUrl() + '?p=status&brand=' + brand.id,
        'View documentation: ' + ScriptApp.getService().getUrl() + '?p=docs'
      ]
    });
  });
}

/**
 * Quick permission check endpoint
 * Tests if the deployment has necessary permissions to access spreadsheets
 *
 * Usage: GET /exec?page=permissions or GET /exec?page=permissions&brand=abc
 *
 * Returns:
 * - ok: true if all permissions are granted
 * - error: detailed error message if permissions are missing
 * - details: information about what was tested
 * @tier mvp
 */
function api_checkPermissions(brandId) {
  return runSafe('api_checkPermissions', () => {
    const results = {
      deployment: {},
      spreadsheet: {},
      oauth: {},
      recommendations: []
    };

    // Check brand
    const brand = brandId ? findBrand_(brandId) : findBrand_('root');
    if (!brand) {
      return Err(ERR.NOT_FOUND, `Brand not found: ${brandId || 'root'}`);
    }

    results.brand = {
      id: brand.id,
      name: brand.name,
      spreadsheetId: brand.store?.spreadsheetId || 'not configured'
    };

    // Check deployment info
    try {
      const service = ScriptApp.getService();
      results.deployment.url = service.getUrl();
      results.deployment.configured = true;
    } catch (e) {
      results.deployment.error = 'Could not get deployment URL';
      results.deployment.configured = false;
      results.recommendations.push('Deploy the script as a web app');
    }

    // Check spreadsheet access
    if (brand.store?.spreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);
        const name = ss.getName();
        const id = ss.getId();

        results.spreadsheet.accessible = true;
        results.spreadsheet.name = name;
        results.spreadsheet.id = id;
        results.spreadsheet.message = 'Spreadsheet access granted';
      } catch (e) {
        results.spreadsheet.accessible = false;
        results.spreadsheet.error = String(e.message);

        if (e.message.includes('not found') || e.message.includes('does not exist')) {
          results.spreadsheet.message = 'Spreadsheet not found';
          results.recommendations.push('Verify spreadsheet ID in Config.gs: ' + brand.store.spreadsheetId);
          results.recommendations.push('Check that spreadsheet exists: https://docs.google.com/spreadsheets/d/' + brand.store.spreadsheetId);
        } else if (e.message.includes('permission') || e.message.includes('authorization')) {
          results.spreadsheet.message = 'Permission denied';
          results.recommendations.push('The deployment needs to be authorized to access spreadsheets');
          results.recommendations.push('Steps to authorize:');
          results.recommendations.push('1. Open Apps Script editor: https://script.google.com');
          results.recommendations.push('2. Select function "api_checkPermissions" and click Run');
          results.recommendations.push('3. Grant permissions when prompted');
          results.recommendations.push('4. Re-deploy the web app');
        } else {
          results.spreadsheet.message = 'Unexpected error accessing spreadsheet';
          results.recommendations.push('Error: ' + e.message);
        }
      }
    } else {
      results.spreadsheet.accessible = false;
      results.spreadsheet.message = 'No spreadsheet ID configured';
      results.recommendations.push('Configure spreadsheet ID in Config.gs for brand: ' + brand.id);
    }

    // Check OAuth scopes
    const scopeTests = [];

    // Test spreadsheet scope
    try {
      if (results.spreadsheet.accessible) {
        scopeTests.push({ scope: 'spreadsheets', granted: true });
      } else {
        // Try to open any spreadsheet to test the scope
        try {
          SpreadsheetApp.getActiveSpreadsheet();
          scopeTests.push({ scope: 'spreadsheets', granted: true });
        } catch (e) {
          scopeTests.push({
            scope: 'spreadsheets',
            granted: false,
            error: 'Spreadsheet access not authorized'
          });
        }
      }
    } catch (e) {
      scopeTests.push({
        scope: 'spreadsheets',
        granted: false,
        error: String(e.message)
      });
    }

    // Test external request scope
    try {
      UrlFetchApp.fetch('https://www.google.com', {
        muteHttpExceptions: true,
        method: 'HEAD'
      });
      scopeTests.push({ scope: 'external_request', granted: true });
    } catch (e) {
      scopeTests.push({
        scope: 'external_request',
        granted: false,
        error: String(e.message)
      });
      results.recommendations.push('External request scope not granted (may be needed for webhooks)');
    }

    results.oauth.scopes = scopeTests;
    results.oauth.allGranted = scopeTests.every(s => s.granted);

    // Determine overall status
    const allOk = results.deployment.configured &&
                  results.spreadsheet.accessible &&
                  results.oauth.allGranted;

    if (allOk) {
      return Ok({
        status: 'ok',
        message: 'All permissions are properly configured!',
        details: results,
        nextSteps: [
          'Your deployment is ready to use',
          'Test the API: ' + (results.deployment.url || '') + '?page=status&brand=' + brand.id,
          'View docs: ' + (results.deployment.url || '') + '?page=docs'
        ]
      });
    } else {
      return Ok({
        status: 'error',
        message: 'Permission issues detected',
        details: results,
        recommendations: results.recommendations,
        helpUrl: 'See APPS_SCRIPT_DEPLOYMENT_GUIDE.md for detailed instructions'
      });
    }
  });
}

/**
 * Simple health check endpoint
 * @tier mvp
 */
function api_healthCheck(){
  return runSafe('api_healthCheck', () => {
    diag_('info','health','ping',{build:ZEB.BUILD_ID});
    return Ok({ checks:[{ ok:true, message:'alive' }] });
  });
}

/**
 * Get brand/environment configuration
 * @tier mvp
 */
function api_getConfig(arg){
  return runSafe('api_getConfig', () => {
    const brands = loadBrands_().map(t => ({
      id:t.id, name:t.name, scopesAllowed:t.scopesAllowed||['events','leagues','tournaments']
    }));
    const value = { brands, templates:TEMPLATES, build:ZEB.BUILD_ID };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (arg?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return { ok:true, etag, value };
  });
}

// === Event Contract Hydration ================================================
// Transforms raw storage data into canonical Event shape per EVENT_CONTRACT.md v2.0

/**
 * Default values for event fields per EVENT_CONTRACT.md v2.0 (MVP + V2-Ready)
 * @private
 */
const EVENT_DEFAULTS_ = {
  // Schedule/Standings/Bracket (MVP Optional)
  schedule: null,
  standings: null,
  bracket: null,

  // CTAs (MVP Required)
  ctas: {
    primary: {
      label: 'Sign Up',
      url: ''
    },
    secondary: null
  },

  // Sponsors (V2 Optional)
  sponsors: [],

  // Media (V2 Optional)
  media: {},

  // External Data (V2 Optional)
  externalData: {},

  // Analytics (Reserved)
  analytics: { enabled: false },

  // Payments (Reserved)
  payments: { enabled: false },

  // Settings (MVP Required)
  settings: {
    showSchedule: false,
    showStandings: false,
    showBracket: false,
    showSponsors: false
  }
};

/**
 * Hydrate raw event row into canonical Event shape
 * @param {Array} row - Raw spreadsheet row [id, brandId, templateId, data, createdAt, slug]
 * @param {Object} options - { baseUrl, hydrateSponsors: boolean }
 * @returns {Object} Canonical Event object per EVENT_CONTRACT.md v2.0
 * @private
 */
function hydrateEvent_(row, options = {}) {
  const [id, brandId, templateId, dataJson, createdAt, slug] = row;
  const data = safeJSONParse_(dataJson, {});
  const baseUrl = options.baseUrl || ScriptApp.getService().getUrl();

  // Extract startDateISO (backward compat: dateISO → startDateISO)
  const startDateISO = data.startDateISO || data.dateISO || '';

  // Extract venue (backward compat: location/venueName → venue)
  const venue = data.venue || data.location || data.venueName || '';

  // Extract signupUrl for links (from data or build default)
  const signupUrl = data.signupUrl || data.ctas?.primary?.url || '';

  // Build links object
  const links = {
    publicUrl: `${baseUrl}?page=events&brand=${brandId}&id=${id}`,
    displayUrl: `${baseUrl}?page=display&brand=${brandId}&id=${id}&tv=1`,
    posterUrl: `${baseUrl}?page=poster&brand=${brandId}&id=${id}`,
    signupUrl: signupUrl,
    sharedReportUrl: null  // V2 Optional
  };

  // Generate QR codes as base64 PNG data URIs
  const qr = {
    public: generateQRDataUri_(links.publicUrl),
    signup: signupUrl ? generateQRDataUri_(signupUrl) : generateQRDataUri_(links.publicUrl)
  };

  // Build CTAs (backward compat: ctaLabels[0] → ctas.primary)
  let ctas = EVENT_DEFAULTS_.ctas;
  if (data.ctas?.primary) {
    ctas = {
      primary: {
        label: data.ctas.primary.label || 'Sign Up',
        url: data.ctas.primary.url || signupUrl
      },
      secondary: data.ctas.secondary || null
    };
  } else if (Array.isArray(data.ctaLabels) && data.ctaLabels.length > 0) {
    // Backward compat: convert ctaLabels array to ctas object
    const firstCta = data.ctaLabels[0];
    ctas = {
      primary: {
        label: firstCta.label || 'Sign Up',
        url: firstCta.url || signupUrl
      },
      secondary: data.ctaLabels[1] ? {
        label: data.ctaLabels[1].label,
        url: data.ctaLabels[1].url || ''
      } : null
    };
  }

  // Build settings (backward compat: sections.*.enabled → settings.show*)
  let settings = EVENT_DEFAULTS_.settings;
  if (data.settings) {
    settings = {
      showSchedule: !!data.settings.showSchedule,
      showStandings: !!data.settings.showStandings,
      showBracket: !!data.settings.showBracket,
      showSponsors: !!data.settings.showSponsors
    };
  } else if (data.sections) {
    // Backward compat: sections object → settings flags
    settings = {
      showSchedule: !!data.sections.schedule?.enabled,
      showStandings: !!data.sections.standings?.enabled,
      showBracket: !!data.sections.bracket?.enabled,
      showSponsors: !!data.sections.sponsors?.enabled
    };
  }

  // Hydrate sponsors from IDs if requested (V2 Optional)
  let sponsors = [];
  if (options.hydrateSponsors && data.sponsorIds) {
    const hydratedSponsors = hydrateSponsorIds_(brandId, data.sponsorIds);
    // Add default placement for V2 compat
    sponsors = hydratedSponsors.map(s => ({
      id: s.id,
      name: s.name,
      logoUrl: s.logoUrl || '',
      linkUrl: s.website || null,
      placement: 'public'  // Default placement
    }));
  } else if (Array.isArray(data.sponsors)) {
    sponsors = data.sponsors;
  }

  // Build media object (V2 Optional, backward compat from videoUrl/mapEmbedUrl)
  let media = {};
  if (data.media && typeof data.media === 'object') {
    media = data.media;
  } else if (data.videoUrl || data.mapEmbedUrl) {
    media = {
      videoUrl: data.videoUrl || null,
      mapUrl: data.mapEmbedUrl || null,
      gallery: null
    };
  }

  // Build externalData (V2 Optional, simplified)
  let externalData = {};
  if (data.externalData && typeof data.externalData === 'object') {
    externalData = {
      scheduleUrl: data.externalData.scheduleUrl || null,
      standingsUrl: data.externalData.standingsUrl || null,
      bracketUrl: data.externalData.bracketUrl || null
    };
  }

  // Timestamps
  const now = new Date().toISOString();
  const createdAtISO = createdAt || now;
  const updatedAtISO = data.updatedAtISO || createdAtISO;

  // Build canonical event shape per EVENT_CONTRACT.md v2.0
  return {
    // Identity (MVP Required)
    id: id,
    slug: slug || id,
    name: data.name || '',
    startDateISO: startDateISO,
    venue: venue,

    // Links (MVP Required)
    links: links,

    // QR Codes (MVP Required)
    qr: qr,

    // Schedule/Standings/Bracket (MVP Optional)
    schedule: Array.isArray(data.schedule) ? data.schedule : EVENT_DEFAULTS_.schedule,
    standings: Array.isArray(data.standings) ? data.standings : EVENT_DEFAULTS_.standings,
    bracket: data.bracket || EVENT_DEFAULTS_.bracket,

    // CTAs (MVP Required)
    ctas: ctas,

    // Sponsors (V2 Optional)
    sponsors: sponsors,

    // Media (V2 Optional)
    media: media,

    // External Data (V2 Optional)
    externalData: externalData,

    // Analytics (Reserved)
    analytics: data.analytics || EVENT_DEFAULTS_.analytics,

    // Payments (Reserved)
    payments: data.payments || EVENT_DEFAULTS_.payments,

    // Settings (MVP Required)
    settings: settings,

    // Metadata (MVP Required)
    createdAtISO: createdAtISO,
    updatedAtISO: updatedAtISO
  };
}

/**
 * Generate QR code as base64 PNG data URI
 * Uses Google Charts API for QR code generation
 * @param {string} url - URL to encode
 * @returns {string} Base64 PNG data URI
 * @private
 */
function generateQRDataUri_(url) {
  if (!url) return '';
  try {
    // Use Google Charts API for QR generation
    const qrApiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(url)}`;
    const response = UrlFetchApp.fetch(qrApiUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return `data:image/png;base64,${base64}`;
    }
  } catch (e) {
    diag_('warn', 'generateQRDataUri_', 'Failed to generate QR code', { url, error: e.message });
  }
  return '';
}

/**
 * Hydrate sponsor IDs into full sponsor objects
 * @param {string} brandId - Brand to look up sponsors in
 * @param {string} sponsorIds - Comma-separated sponsor IDs
 * @returns {Array} Array of sponsor objects
 * @private
 */
function hydrateSponsorIds_(brandId, sponsorIds) {
  if (!sponsorIds) return [];

  const ids = String(sponsorIds).split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return [];

  try {
    const brand = findBrand_(brandId);
    if (!brand) return [];

    const sh = getStoreSheet_(brand, 'sponsors');
    const rows = sh.getDataRange().getValues().slice(1);

    return ids.map(id => {
      const row = rows.find(r => r[0] === id && r[1] === brandId);
      if (!row) return { id, name: 'Unknown', logoUrl: null, website: null, tier: null };

      const data = safeJSONParse_(row[3], {});
      return {
        id: row[0],
        name: data.name || 'Unknown',
        logoUrl: data.logoUrl || null,
        website: data.website || null,
        tier: data.tier || null
      };
    });
  } catch (e) {
    diag_('warn', 'hydrateSponsorIds_', 'Failed to hydrate sponsors', { brandId, error: e.message });
    return [];
  }
}

/**
 * List events with pagination
 * @tier mvp
 */
function api_list(payload){
  return runSafe('api_list', () => {
    const { brandId, scope, limit, offset } = payload||{};
    const brand=findBrand_(brandId); if(!brand) return Err(ERR.NOT_FOUND,'Unknown brand');
    const a=assertScopeAllowed_(brand, scope); if(!a.ok) return a;

    // Pagination parameters (default: 100 items per page, max 1000)
    const pageLimit = Math.min(parseInt(limit) || 100, 1000);
    const pageOffset = Math.max(parseInt(offset) || 0, 0);

    const sh = getStoreSheet_(brand, scope);
    // Fixed: Bug #24 - Check if sheet has more than just header before getRange
    const lastRow = sh.getLastRow();

    // Load and filter rows (Apps Script doesn't support query-level filtering)
    const allRows = lastRow > 1
      ? sh.getRange(2, 1, lastRow - 1, 6).getValues()
          .filter(r => r[1]===brandId)
      : [];

    // Apply pagination after filtering
    const totalCount = allRows.length;
    const baseUrl = ScriptApp.getService().getUrl();

    // Hydrate each event to canonical shape (sponsors not hydrated in list for performance)
    const paginatedRows = allRows
      .slice(pageOffset, pageOffset + pageLimit)
      .map(r => hydrateEvent_(r, { baseUrl, hydrateSponsors: false }));

    const value = {
      items: paginatedRows,
      pagination: {
        total: totalCount,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: (pageOffset + pageLimit) < totalCount
      }
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_list', SC_LIST, { ok:true, etag, value });
  });
}

/**
 * Get single event by ID
 * Returns full canonical Event shape per EVENT_CONTRACT.md
 * @tier mvp
 */
function api_get(payload){
  return runSafe('api_get', () => {
    const { brandId, scope, id } = payload||{};

    // Fixed: Bug #19 - Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand=findBrand_(brandId); if(!brand) return Err(ERR.NOT_FOUND,'Unknown brand');
    const a=assertScopeAllowed_(brand, scope); if(!a.ok) return a;
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND,'Not found');

    // Hydrate to canonical Event shape with full sponsor data
    const baseUrl = ScriptApp.getService().getUrl();
    const value = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_get', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Bundled endpoint for public pages - returns event + config in single call
 * Reduces latency for detail views by eliminating multiple round-trips
 * Returns canonical Event shape per EVENT_CONTRACT.md
 * @param {object} payload - { brandId, scope, id, ifNoneMatch }
 * @returns {object} { ok, value: { event, config }, etag }
 * @tier mvp
 */
function api_getPublicBundle(payload){
  return runSafe('api_getPublicBundle', () => {
    const { brandId, scope, id } = payload||{};

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Not found');

    // Hydrate to canonical Event shape with full sponsor data
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    // Build bundled response
    const value = {
      // Full canonical event shape
      event: event,
      // Brand config subset (public-safe fields only)
      config: {
        appTitle: brand.appTitle || brand.name || 'Events',
        brandId: brand.id,
        brandName: brand.name
      }
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getPublicBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Admin Bundle - Optimized bundle for Admin.html surface
 * Returns event + admin-specific config, templates, diagnostics, and all sponsors
 *
 * AdminEventBundle interface:
 * - event: EventCore (full canonical event shape)
 * - brandConfig: { brandId, allowedTemplates, defaultTemplateId }
 * - templates: TemplateDescriptor[] (available templates for this brand)
 * - diagnostics: { hasForm, hasShortlinks, lastPublishedAt }
 * - allSponsors: Sponsor[] (all sponsors for brand, for dropdown linking)
 *
 * Admin editable fields (MVP):
 *   templateId (while status === 'draft'), name, description, dateTime, timezone,
 *   location, venueName, imageUrl, videoUrl, mapEmbedUrl, audience, notesLabel, notes,
 *   sections.*.enabled, sections.*.label, ctaLabels (labels only),
 *   externalData.scheduleUrl/standingsUrl/bracketUrl, sponsor attachments
 *
 * Admin cannot edit: id, short*Url fields, analytics-derived data
 *
 * @param {object} payload - { brandId, scope, id, adminKey, ifNoneMatch }
 * @returns {object} { ok, value: AdminEventBundle, etag }
 * @tier mvp
 */
function api_getAdminBundle(payload){
  return runSafe('api_getAdminBundle', () => {
    const { brandId, scope, id, adminKey } = payload||{};

    // Auth required for admin bundle
    const g = gate_(brandId, adminKey);
    if (!g.ok) return g;

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Event not found');

    // Hydrate to canonical Event shape with full sponsor data
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    // Get brand template config
    const templateConfig = getBrandTemplateConfig_(brandId);
    const templates = getTemplatesForBrand_(brandId);

    // Get all sponsors for brand (for dropdown linking)
    const allSponsors = getAllSponsorsForBrand_(brandId);

    // Build diagnostics - check for forms and shortlinks
    const diagnostics = getEventDiagnostics_(brandId, sanitizedId);

    // Build bundled response matching AdminEventBundle interface
    const value = {
      // Full canonical event shape
      event: event,

      // Brand configuration for admin
      brandConfig: {
        brandId: brand.id,
        allowedTemplates: templateConfig.templates,
        defaultTemplateId: templateConfig.defaultTemplateId
      },

      // Available templates for this brand
      templates: templates,

      // System diagnostics (readonly in UI)
      diagnostics: diagnostics,

      // All sponsors for dropdown/linking
      allSponsors: allSponsors
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getAdminBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Get all sponsors for a brand (helper for admin bundle)
 * @param {string} brandId - Brand ID
 * @returns {Array} Array of sponsor objects
 * @private
 */
function getAllSponsorsForBrand_(brandId) {
  try {
    const brand = findBrand_(brandId);
    if (!brand) return [];

    const sh = getStoreSheet_(brand, 'sponsors');
    const lastRow = sh.getLastRow();
    if (lastRow <= 1) return [];

    const rows = sh.getRange(2, 1, lastRow - 1, 6).getValues();

    return rows
      .filter(r => r[1] === brandId)
      .map(row => {
        const data = safeJSONParse_(row[3], {});
        return {
          id: row[0],
          name: data.name || 'Unknown',
          logoUrl: data.logoUrl || null,
          website: data.website || null,
          tier: data.tier || null,
          entity: data.entity || null
        };
      });
  } catch (e) {
    diag_('error', 'getAllSponsorsForBrand_', 'Failed to get sponsors', { brandId, error: String(e) });
    return [];
  }
}

/**
 * Get event diagnostics for admin bundle
 * @param {string} brandId - Brand ID
 * @param {string} eventId - Event ID
 * @returns {object} Diagnostics object
 * @private
 */
function getEventDiagnostics_(brandId, eventId) {
  try {
    // Check for shortlinks (look in SHORTLINKS sheet)
    let hasShortlinks = false;
    let hasForm = false;
    let lastPublishedAt = null;

    const brand = findBrand_(brandId);
    if (brand) {
      const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);

      // Check SHORTLINKS sheet for this event
      const slSheet = ss.getSheetByName('SHORTLINKS');
      if (slSheet && slSheet.getLastRow() > 1) {
        const slData = slSheet.getDataRange().getValues().slice(1);
        hasShortlinks = slData.some(row => row[2] === eventId || String(row[1]).includes(eventId));
      }

      // Check if event has form URLs set (signupUrl, checkinUrl, feedbackUrl)
      const evSheet = ss.getSheetByName('events');
      if (evSheet) {
        const evData = evSheet.getDataRange().getValues().slice(1);
        const eventRow = evData.find(r => r[0] === eventId && r[1] === brandId);
        if (eventRow) {
          const data = safeJSONParse_(eventRow[3], {});
          hasForm = !!(data.signupUrl || data.checkinUrl || data.feedbackUrl);

          // Check for lastPublishedAt in data or use status change
          if (data.status === 'published' && data.publishedAt) {
            lastPublishedAt = data.publishedAt;
          }
        }
      }
    }

    return {
      hasForm: hasForm,
      hasShortlinks: hasShortlinks,
      lastPublishedAt: lastPublishedAt
    };
  } catch (e) {
    diag_('error', 'getEventDiagnostics_', 'Failed to get diagnostics', { brandId, eventId, error: String(e) });
    return {
      hasForm: false,
      hasShortlinks: false,
      lastPublishedAt: null
    };
  }
}

/**
 * Display Bundle - Optimized bundle for Display.html (TV mode)
 * Returns event + rotation/layout config computed from Config + Template + Brand
 *
 * DisplayBundle interface:
 * - event: EventCore (full canonical event shape with hydrated sponsors)
 * - rotation: { sponsorSlots, rotationMs } - sponsor display config
 * - layout: { hasSidePane, emphasis } - layout emphasis ('scores'|'sponsors'|'hero')
 *
 * All values are computed from ZEB.DISPLAY_CONFIG with template-specific overrides.
 * No extra DB fields needed.
 *
 * @param {object} payload - { brandId, scope, id, ifNoneMatch }
 * @returns {object} { ok, value: DisplayBundle, etag }
 * @tier mvp
 */
function api_getDisplayBundle(payload){
  return runSafe('api_getDisplayBundle', () => {
    const { brandId, scope, id } = payload||{};

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Event not found');

    // Hydrate to canonical Event shape with full sponsor data
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    // Get display config computed from Config + Template
    const displayConfig = getDisplayConfig_(event.templateId, brandId);

    // Build bundled response matching DisplayBundle interface
    const value = {
      // Full canonical event shape
      event: event,

      // Rotation config (sponsor display settings)
      rotation: {
        sponsorSlots: displayConfig.rotation.sponsorSlots,
        rotationMs: displayConfig.rotation.rotationMs
      },

      // Layout config (emphasis and pane settings)
      layout: {
        hasSidePane: displayConfig.layout.hasSidePane,
        emphasis: displayConfig.layout.emphasis
      }
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getDisplayBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Get display configuration for a template/brand
 * Merges ZEB.DISPLAY_CONFIG defaults with template-specific overrides
 *
 * @param {string} templateId - Event template ID
 * @param {string} brandId - Brand ID (for future brand-specific overrides)
 * @returns {object} Display config { rotation, layout }
 * @private
 */
function getDisplayConfig_(templateId, brandId) {
  const defaults = ZEB.DISPLAY_CONFIG;

  // Start with global defaults
  const config = {
    rotation: { ...defaults.rotation },
    layout: { ...defaults.layout }
  };

  // Apply template-specific overrides
  const templateOverrides = defaults.templateOverrides?.[templateId];
  if (templateOverrides) {
    if (templateOverrides.rotation) {
      Object.assign(config.rotation, templateOverrides.rotation);
    }
    if (templateOverrides.layout) {
      Object.assign(config.layout, templateOverrides.layout);
    }
  }

  // Future: Apply brand-specific overrides here
  // const brand = findBrand_(brandId);
  // if (brand?.displayConfig) { ... }

  return config;
}

/**
 * Poster Bundle - Optimized bundle for Poster.html (print-friendly)
 * Returns event + QR codes + print-formatted strings
 *
 * PosterBundle interface:
 * - event: EventCore (full canonical event shape with hydrated sponsors)
 * - qrCodes: { public, signup } - QR code URLs for scanning
 * - print: { dateLine, venueLine } - Pre-formatted strings for print
 *
 * Note: Tracking is maintained through event.links URLs which can be
 * shortlinks created via api_createShortlink for full analytics.
 *
 * @param {object} payload - { brandId, scope, id, ifNoneMatch }
 * @returns {object} { ok, value: PosterBundle, etag }
 * @tier mvp
 */
function api_getPosterBundle(payload){
  return runSafe('api_getPosterBundle', () => {
    const { brandId, scope, id } = payload||{};

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Event not found');

    // Hydrate to canonical Event shape with full sponsor data
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    // Generate QR code URLs using quickchart.io (works for print)
    const qrCodes = generateQRCodes_(event);

    // Generate print-friendly formatted strings
    const printStrings = generatePrintStrings_(event);

    // Build bundled response matching PosterBundle interface
    const value = {
      // Full canonical event shape (includes links for tracking)
      event: event,

      // QR code URLs
      qrCodes: qrCodes,

      // Print-friendly formatted strings
      print: printStrings
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getPosterBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Generate QR code URLs for poster
 * Uses quickchart.io API which is reliable for print use
 *
 * @param {object} event - Hydrated event object
 * @returns {object} { public, signup } QR code image URLs
 * @private
 */
function generateQRCodes_(event) {
  const QR_SIZE = 200;
  const QR_MARGIN = 1;

  // Helper to generate QR URL
  const qrUrl = (targetUrl) => {
    if (!targetUrl) return null;
    return `https://quickchart.io/qr?text=${encodeURIComponent(targetUrl)}&size=${QR_SIZE}&margin=${QR_MARGIN}`;
  };

  return {
    // Public event page QR - uses event.links.publicUrl (can be shortlink for tracking)
    public: qrUrl(event.links?.publicUrl),

    // Signup form QR - uses signupUrl (can be shortlink for tracking)
    signup: qrUrl(event.signupUrl)
  };
}

/**
 * Generate print-friendly formatted strings
 *
 * @param {object} event - Hydrated event object
 * @returns {object} { dateLine, venueLine } formatted strings
 * @private
 */
function generatePrintStrings_(event) {
  let dateLine = null;
  let venueLine = null;

  // Format date line
  if (event.dateTime) {
    try {
      const dt = new Date(event.dateTime);
      if (!isNaN(dt.getTime())) {
        // Format: "Saturday, August 15, 2025 at 6:00 PM"
        const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
        const datePart = dt.toLocaleDateString('en-US', dateOpts);
        const timePart = dt.toLocaleTimeString('en-US', timeOpts);
        dateLine = `${datePart} at ${timePart}`;
      }
    } catch (e) {
      // If date parsing fails, leave as null
    }
  }

  // Format venue line
  if (event.venueName && event.location && event.venueName !== event.location) {
    // Show both: "Chicago Bocce Club · 123 Main St, Chicago, IL"
    venueLine = `${event.venueName} · ${event.location}`;
  } else if (event.location) {
    venueLine = event.location;
  } else if (event.venueName) {
    venueLine = event.venueName;
  }

  return {
    dateLine: dateLine,
    venueLine: venueLine
  };
}

/**
 * api_getSponsorBundle - Optimized bundle for sponsor portal
 * Returns thin event view + sponsors with analytics metrics
 *
 * @param {object} payload - { brandId, scope, id, ifNoneMatch }
 * @returns {object} { ok, value: SponsorBundle, etag }
 * @tier mvp
 */
function api_getSponsorBundle(payload){
  return runSafe('api_getSponsorBundle', () => {
    const { brandId, scope, id } = payload||{};

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Event not found');

    // Hydrate with sponsors
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: true });

    // Get sponsor metrics from ANALYTICS sheet
    const sponsorMetrics = getSponsorMetricsForEvent_(brand, sanitizedId);

    // Build thin event view per SponsorBundle interface
    const thinEvent = {
      id: event.id,
      name: event.name,
      dateTime: event.dateTime,
      location: event.location,
      brandId: event.brandId
    };

    // Enrich sponsors with metrics
    const sponsorsWithMetrics = (event.hydratedSponsors || []).map(sponsor => {
      const metrics = sponsorMetrics[sponsor.id] || { impressions: 0, clicks: 0 };
      const ctr = metrics.impressions > 0
        ? +((metrics.clicks / metrics.impressions) * 100).toFixed(2)
        : 0;
      return {
        ...sponsor,
        metrics: {
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr: ctr
        }
      };
    });

    // Build bundled response matching SponsorBundle interface
    const value = {
      event: thinEvent,
      sponsors: sponsorsWithMetrics
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getSponsorBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Get sponsor metrics (impressions, clicks) for a specific event
 * Reads from ANALYTICS sheet and aggregates by sponsorId
 *
 * @param {object} brand - Brand configuration
 * @param {string} eventId - Event ID to filter by
 * @returns {object} { [sponsorId]: { impressions, clicks } }
 * @private
 */
function getSponsorMetricsForEvent_(brand, eventId) {
  const metrics = {};

  try {
    // Get analytics sheet
    const spreadsheetId = brand.spreadsheetId || ZEB.MASTER_SHEET_ID;
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const analyticsSheet = ss.getSheetByName('ANALYTICS');

    if (!analyticsSheet) {
      // No analytics sheet yet - return empty metrics
      return metrics;
    }

    const data = analyticsSheet.getDataRange().getValues().slice(1); // Skip header

    // Filter by eventId and aggregate by sponsorId
    // Columns: 0=timestamp, 1=eventId, 2=surface, 3=metric, 4=sponsorId, 5=value
    for (const row of data) {
      const rowEventId = row[1];
      const metricType = row[3];
      const sponsorId = row[4];

      // Skip if not for this event or no sponsorId
      if (rowEventId !== eventId || !sponsorId) continue;

      // Initialize sponsor entry if needed
      if (!metrics[sponsorId]) {
        metrics[sponsorId] = { impressions: 0, clicks: 0 };
      }

      // Aggregate based on metric type
      if (metricType === 'impression') {
        metrics[sponsorId].impressions++;
      } else if (metricType === 'click') {
        metrics[sponsorId].clicks++;
      }
    }
  } catch (e) {
    // If analytics sheet doesn't exist or error, return empty metrics
    Logger.log('getSponsorMetricsForEvent_ error: ' + e.message);
  }

  return metrics;
}

/**
 * api_getSharedReportBundle - Optimized bundle for shared analytics reports
 * Returns thin event view + aggregated metrics from ANALYTICS sheet
 *
 * @param {object} payload - { brandId, scope, id, ifNoneMatch }
 * @returns {object} { ok, value: SharedReportBundle, etag }
 * @tier mvp
 */
function api_getSharedReportBundle(payload){
  return runSafe('api_getSharedReportBundle', () => {
    const { brandId, scope, id } = payload||{};

    // Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const brand = findBrand_(brandId);
    if (!brand) return Err(ERR.NOT_FOUND, 'Unknown brand');

    const a = assertScopeAllowed_(brand, scope);
    if (!a.ok) return a;

    // Get event data
    const sh = getStoreSheet_(brand, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===brandId);
    if (!r) return Err(ERR.NOT_FOUND, 'Event not found');

    // Hydrate event (no sponsors needed for report bundle)
    const baseUrl = ScriptApp.getService().getUrl();
    const event = hydrateEvent_(r, { baseUrl, hydrateSponsors: false });

    // Get event metrics from ANALYTICS sheet
    const metrics = getEventMetricsForReport_(brand, sanitizedId);

    // Build thin event view per SharedReportBundle interface
    const thinEvent = {
      id: event.id,
      name: event.name,
      dateTime: event.dateTime,
      brandId: event.brandId,
      templateId: event.templateId
    };

    // Build bundled response matching SharedReportBundle interface
    const value = {
      event: thinEvent,
      metrics: metrics
    };

    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_getSharedReportBundle', SC_GET, { ok:true, etag, value });
  });
}

/**
 * Get aggregated event metrics for SharedReportBundle
 * Reads from ANALYTICS sheet and aggregates by metric type
 *
 * All metrics are derived from logs, not stored on EventCore:
 * - views/uniqueViews from 'view' metric
 * - signupClicks/checkinClicks/feedbackClicks from 'click' with token
 * - sponsor metrics from 'impression'/'click' with sponsorId
 * - league metrics from 'click' with token (schedule/standings/bracket)
 *
 * @param {object} brand - Brand configuration
 * @param {string} eventId - Event ID to filter by
 * @returns {object} SharedReportBundle.metrics structure
 * @private
 */
function getEventMetricsForReport_(brand, eventId) {
  // Initialize metrics structure
  const metrics = {
    views: 0,
    uniqueViews: 0,
    signupClicks: 0,
    checkinClicks: 0,
    feedbackClicks: 0,
    sponsor: {
      totalImpressions: 0,
      totalClicks: 0,
      avgCtr: 0
    },
    league: {
      scheduleClicks: 0,
      standingsClicks: 0,
      bracketClicks: 0
    },
    broadcast: {
      statsClicks: 0,
      scoreboardClicks: 0,
      streamClicks: 0
    }
  };

  try {
    // Get analytics sheet
    const spreadsheetId = brand.spreadsheetId || ZEB.MASTER_SHEET_ID;
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const analyticsSheet = ss.getSheetByName('ANALYTICS');

    if (!analyticsSheet) {
      // No analytics sheet yet - return zero metrics
      return metrics;
    }

    const data = analyticsSheet.getDataRange().getValues().slice(1); // Skip header

    // Track unique userAgents for uniqueViews
    const uniqueUserAgents = new Set();

    // Filter by eventId and aggregate metrics
    // Columns: 0=timestamp, 1=eventId, 2=surface, 3=metric, 4=sponsorId, 5=value, 6=token, 7=userAgent
    for (const row of data) {
      const rowEventId = row[1];

      // Skip if not for this event
      if (rowEventId !== eventId) continue;

      const metricType = row[3];
      const sponsorId = row[4];
      const token = row[6] || '';
      const userAgent = row[7] || '';

      // Aggregate based on metric type
      switch (metricType) {
        case 'view':
        case 'pageview':
          metrics.views++;
          if (userAgent) uniqueUserAgents.add(userAgent);
          break;

        case 'impression':
          if (sponsorId) {
            metrics.sponsor.totalImpressions++;
          }
          break;

        case 'click':
          if (sponsorId) {
            // Sponsor click
            metrics.sponsor.totalClicks++;
          } else {
            // Non-sponsor click - check token for type
            const tokenLower = token.toLowerCase();
            if (tokenLower === 'signup' || tokenLower.includes('signup')) {
              metrics.signupClicks++;
            } else if (tokenLower === 'checkin' || tokenLower.includes('checkin')) {
              metrics.checkinClicks++;
            } else if (tokenLower === 'feedback' || tokenLower.includes('feedback')) {
              metrics.feedbackClicks++;
            }
          }
          break;

        case 'external_click':
          // BBN external link clicks (api_logExternalClick stores linkType in sponsorId column)
          // Valid linkTypes: schedule, standings, bracket, stats, scoreboard, stream
          switch (sponsorId) {
            case 'schedule':
              metrics.league.scheduleClicks++;
              break;
            case 'standings':
              metrics.league.standingsClicks++;
              break;
            case 'bracket':
              metrics.league.bracketClicks++;
              break;
            case 'stats':
              metrics.broadcast.statsClicks++;
              break;
            case 'scoreboard':
              metrics.broadcast.scoreboardClicks++;
              break;
            case 'stream':
              metrics.broadcast.streamClicks++;
              break;
          }
          break;
      }
    }

    // Calculate unique views
    metrics.uniqueViews = uniqueUserAgents.size;

    // Calculate sponsor avgCtr
    if (metrics.sponsor.totalImpressions > 0) {
      metrics.sponsor.avgCtr = +((metrics.sponsor.totalClicks / metrics.sponsor.totalImpressions) * 100).toFixed(2);
    }

  } catch (e) {
    // If analytics sheet doesn't exist or error, return zero metrics
    Logger.log('getEventMetricsForReport_ error: ' + e.message);
  }

  return metrics;
}

/**
 * Create new event
 * Builds canonical event per EVENT_CONTRACT.md v2.0
 * @tier mvp
 */
function api_create(payload){
  return runSafe('api_create', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { brandId, scope, templateId, data, adminKey, idemKey } = payload;

    const g=gate_(brandId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findBrand_(brandId), scope); if(!a.ok) return a;

    // === EVENT_CONTRACT.md v2.0: Validate MVP Required Fields ===
    const name = sanitizeInput_(String(data?.name || '').trim());
    const startDateISO = String(data?.startDateISO || data?.dateISO || '').trim();
    const venue = sanitizeInput_(String(data?.venue || data?.location || '').trim());

    if (!name) return Err(ERR.BAD_INPUT, 'Missing required field: name');
    if (!startDateISO) return Err(ERR.BAD_INPUT, 'Missing required field: startDateISO');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateISO)) return Err(ERR.BAD_INPUT, 'Invalid date format: startDateISO must be YYYY-MM-DD');
    if (!venue) return Err(ERR.BAD_INPUT, 'Missing required field: venue');

    // Validate id if provided by Admin, otherwise generate
    let id = data?.id;
    if (id) {
      // Validate UUID format from Admin
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
        return Err(ERR.BAD_INPUT, 'Invalid id format: must be UUID v4');
      }
    } else {
      id = Utilities.getUuid();
    }

    // Validate slug if provided by Admin
    let slug = data?.slug;
    if (slug) {
      slug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 50);
      if (!slug) return Err(ERR.BAD_INPUT, 'Invalid slug format');
    }

    // Idempotency check
    if (idemKey){
      if (!/^[a-zA-Z0-9-]{1,128}$/.test(idemKey)) {
        return Err(ERR.BAD_INPUT, 'Invalid idempotency key format');
      }
      const c=CacheService.getScriptCache(), k=`idem:${brandId}:${scope}:${idemKey}`;
      if (c.get(k)) return Err(ERR.BAD_INPUT,'Duplicate create');
      c.put(k, '1', 600);
    }

    // Prepare storage
    const brand = findBrand_(brandId);
    const sh = getStoreSheet_(brand, scope);
    const now = new Date().toISOString();
    const baseUrl = ScriptApp.getService().getUrl();

    // Build/validate slug with collision detection under lock
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);

      // If no slug provided, generate from name
      if (!slug) {
        slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').substring(0, 50);
      }

      // Check for slug collisions and handle
      const existingSlugs = sh.getDataRange().getValues().slice(1).map(r => r[5]);
      let counter = 2;
      let originalSlug = slug;
      while (existingSlugs.includes(slug)) {
        slug = `${originalSlug}-${counter}`;
        counter++;
      }

      // === Build canonical event per EVENT_CONTRACT.md v2.0 ===
      const signupUrl = data?.links?.signupUrl || data?.signupUrl || '';

      const links = {
        publicUrl: `${baseUrl}?page=events&brand=${brandId}&id=${id}`,
        displayUrl: `${baseUrl}?page=display&brand=${brandId}&id=${id}&tv=1`,
        posterUrl: `${baseUrl}?page=poster&brand=${brandId}&id=${id}`,
        signupUrl: signupUrl,
        sharedReportUrl: null
      };

      // Generate QR codes
      const qr = {
        public: generateQRDataUri_(links.publicUrl),
        signup: signupUrl ? generateQRDataUri_(signupUrl) : generateQRDataUri_(links.publicUrl)
      };

      // Build CTA (use provided or default)
      const ctaLabel = sanitizeInput_(String(data?.ctas?.primary?.label || 'Sign Up').trim());
      const ctas = {
        primary: {
          label: ctaLabel,
          url: signupUrl || links.publicUrl
        },
        secondary: data?.ctas?.secondary || null
      };

      // Build settings (MVP Required)
      const settings = {
        showSchedule: !!data?.settings?.showSchedule,
        showStandings: !!data?.settings?.showStandings,
        showBracket: !!data?.settings?.showBracket,
        showSponsors: !!data?.settings?.showSponsors
      };

      // Build complete canonical event object for storage
      const canonicalEvent = {
        name: name,
        startDateISO: startDateISO,
        venue: venue,
        ctas: ctas,
        settings: settings,
        schedule: data?.schedule || null,
        standings: data?.standings || null,
        bracket: data?.bracket || null,
        sponsors: data?.sponsors || [],
        media: data?.media || {},
        externalData: data?.externalData || {},
        analytics: data?.analytics || { enabled: false },
        payments: data?.payments || { enabled: false },
        updatedAtISO: now
      };

      // Store event
      sh.appendRow([id, brandId, templateId || 'custom', JSON.stringify(canonicalEvent), now, slug]);

      diag_('info','api_create','created',{id,brandId,scope,templateId});

      // Return full hydrated event per EVENT_CONTRACT.md v2.0
      return Ok({
        id: id,
        slug: slug,
        name: name,
        startDateISO: startDateISO,
        venue: venue,
        links: links,
        qr: qr,
        ctas: ctas,
        settings: settings,
        schedule: canonicalEvent.schedule,
        standings: canonicalEvent.standings,
        bracket: canonicalEvent.bracket,
        sponsors: canonicalEvent.sponsors,
        media: canonicalEvent.media,
        externalData: canonicalEvent.externalData,
        analytics: canonicalEvent.analytics,
        payments: canonicalEvent.payments,
        createdAtISO: now,
        updatedAtISO: now
      });

    } finally {
      lock.releaseLock();
    }
  });
}

/**
 * Update event data (merge with existing)
 * @tier mvp
 */
function api_updateEventData(req){
  return runSafe('api_updateEventData', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { brandId, scope, id, data, adminKey } = req;

    // Fixed: Bug #19 - Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const g=gate_(brandId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findBrand_(brandId), scope||'events'); if(!a.ok) return a;

    const brand= findBrand_(brandId);
    const sh = getStoreSheet_(brand, scope||'events');

    // Fixed: Bug #13 - Add LockService for read-modify-write operation
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Wait up to 10 seconds

      const rows = sh.getDataRange().getValues();
      const rowIdx = rows.findIndex((r, i) => i > 0 && r[0]===sanitizedId && r[1]===brandId);

      if (rowIdx === -1) {
        lock.releaseLock();
        return Err(ERR.NOT_FOUND,'Event not found');
      }

      const existingData = safeJSONParse_(rows[rowIdx][3], {});
      const templateId = rows[rowIdx][2];
      const tpl = findTemplate_(templateId);

      if (!tpl) {
        lock.releaseLock();
        return Err(ERR.INTERNAL, 'Template not found');
      }

      // Fixed: Bug #27 - Validate update data against template schema
      for (const [key, value] of Object.entries(data || {})) {
        const field = tpl.fields.find(f => f.id === key);

        // Reject unknown fields
        if (!field) {
          lock.releaseLock();
          return Err(ERR.BAD_INPUT, `Unknown field: ${key}`);
        }

        // Validate field type
        if (value !== null && value !== undefined) {
          if (field.type === 'url' && !isUrl(value)) {
            lock.releaseLock();
            return Err(ERR.BAD_INPUT, `Invalid URL for field: ${key}`);
          }

          // Sanitize non-URL fields
          if (field.type !== 'url' && typeof value === 'string') {
            data[key] = sanitizeInput_(value);
          }
        }
      }

      const mergedData = Object.assign({}, existingData, data || {});

      sh.getRange(rowIdx + 1, 4).setValue(JSON.stringify(mergedData));

    } finally {
      lock.releaseLock();
    }

    diag_('info','api_updateEventData','updated',{id: sanitizedId,brandId,scope,data});

    return api_get({ brandId, scope: scope||'events', id: sanitizedId });
  });
}

/**
 * Log analytics events (impressions, clicks, dwell time)
 * Core tracking endpoint for the analytics loop
 * Fire-and-forget - no auth required for public tracking
 *
 * Extended columns for attribution:
 * - sessionId: ties events from same page visit together
 * - visibleSponsorIds: (reserved for external_click, not used here)
 *
 * @tier mvp
 */
function api_logEvents(req){
  return runSafe('api_logEvents', () => {
    const items = (req && req.items) || [];
    if (!items.length) return Ok({count:0});

    const sh = _ensureAnalyticsSheet_();
    const now = Date.now();

    // Fixed: Bug #29 - Sanitize all values for spreadsheet to prevent formula injection
    // Extended to 10 columns: +sessionId, +visibleSponsorIds (empty for regular events)
    const rows = items.map(it => [
      new Date(it.ts || now),
      sanitizeSpreadsheetValue_(it.eventId || ''),
      sanitizeSpreadsheetValue_(it.surface || ''),
      sanitizeSpreadsheetValue_(it.metric || ''),
      sanitizeSpreadsheetValue_(it.sponsorId || ''),
      Number(it.value || 0),
      sanitizeSpreadsheetValue_(it.token || ''),
      sanitizeSpreadsheetValue_((it.ua || '').slice(0, 200)),
      sanitizeSpreadsheetValue_(it.sessionId || ''),  // Session ID for attribution
      ''  // visibleSponsorIds - not used for regular sponsor events
    ]);
    sh.getRange(sh.getLastRow()+1, 1, rows.length, 10).setValues(rows);

    diag_('info','api_logEvents','logged',{count: rows.length});
    return Ok({count: rows.length});
  });
}

/**
 * Log external link clicks from League & Broadcast card (BBN/BocceLabs)
 * Fire-and-forget analytics for sponsor/BBN attribution
 *
 * Extended for attribution analysis:
 * - sessionId: ties this click to sponsor impressions in same session
 * - visibleSponsorIds: which sponsors were on-screen when click happened
 *
 * @param {Object} req
 * @param {string} req.eventId - Event ID
 * @param {string} req.linkType - schedule|standings|bracket|stats|scoreboard|stream
 * @param {string} [req.sessionId] - Session UUID for attribution
 * @param {string[]} [req.visibleSponsorIds] - Sponsor IDs visible at click time
 * @param {string} [req.surface] - Surface where click happened (default: 'public')
 * @tier mvp
 */
function api_logExternalClick(req) {
  return runSafe('api_logExternalClick', () => {
    const { eventId, linkType, sessionId, visibleSponsorIds, surface } = req || {};

    // Validate inputs
    if (!eventId || typeof eventId !== 'string') {
      return Err(ERR.BAD_INPUT, 'missing or invalid eventId');
    }
    if (!linkType || typeof linkType !== 'string') {
      return Err(ERR.BAD_INPUT, 'missing or invalid linkType');
    }

    // Validate linkType is one of the expected values
    const validLinkTypes = ['schedule', 'standings', 'bracket', 'stats', 'scoreboard', 'stream'];
    if (!validLinkTypes.includes(linkType)) {
      return Err(ERR.BAD_INPUT, 'invalid linkType');
    }

    // Log to analytics sheet
    const sh = _ensureAnalyticsSheet_();
    const now = new Date();

    // Serialize visibleSponsorIds as JSON if provided
    const sponsorIdsJson = Array.isArray(visibleSponsorIds) && visibleSponsorIds.length > 0
      ? JSON.stringify(visibleSponsorIds.slice(0, 20))  // Cap at 20 to prevent bloat
      : '';

    // Extended analytics columns (10 total):
    // [timestamp, eventId, surface, metric, sponsorId/linkType, value, token, ua, sessionId, visibleSponsorIds]
    const row = [
      now,
      sanitizeSpreadsheetValue_(eventId),
      sanitizeSpreadsheetValue_(surface || 'public'),  // surface
      'external_click',                                 // metric
      sanitizeSpreadsheetValue_(linkType),              // linkType in sponsorId column
      1,                                                // value (1 click)
      '',                                               // token (unused)
      '',                                               // ua (unused for this endpoint)
      sanitizeSpreadsheetValue_(sessionId || ''),       // sessionId for attribution
      sanitizeSpreadsheetValue_(sponsorIdsJson)         // visibleSponsorIds JSON
    ];

    sh.getRange(sh.getLastRow() + 1, 1, 1, 10).setValues([row]);

    diag_('info', 'api_logExternalClick', 'logged', { eventId, linkType, hasSession: !!sessionId, sponsorCount: visibleSponsorIds?.length || 0 });
    return Ok({ logged: true });
  });
}

/**
 * Get event analytics report
 * @tier mvp
 */
function api_getReport(req){
  return runSafe('api_getReport', () => {
    const { brandId, adminKey } = req || {};

    // Fixed: Add authentication check - Bug #6
    const g = gate_(brandId || 'root', adminKey);
    if (!g.ok) return g;

    const eventId = String(req && req.id || '');
    if (!eventId) return Err(ERR.BAD_INPUT,'missing id');

    // Fixed: Bug #30 - Verify event belongs to brand before returning analytics
    const brand= g.value.brand;
    const eventSheet = SpreadsheetApp.openById(brand.store.spreadsheetId)
      .getSheetByName(brand.scopesAllowed.includes('events') ? 'EVENTS' : 'EVENTS');

    if (!eventSheet) {
      return Err(ERR.NOT_FOUND, 'Events sheet not found');
    }

    // Verify event exists and belongs to this brand
    const eventRows = eventSheet.getDataRange().getValues().slice(1);
    const event = eventRows.find(r => r[0] === eventId && r[1] === brandId);

    if (!event) {
      diag_('warn', 'api_getReport', 'Unauthorized analytics access attempt', { eventId, brandId });
      return Err(ERR.NOT_FOUND, 'Event not found or unauthorized');
    }

    const sh = _ensureAnalyticsSheet_();
    const data = sh.getDataRange().getValues().slice(1)
      .filter(r => r[1] === eventId);

    const agg = {
      totals: { impressions:0, clicks:0, dwellSec:0 },
      bySurface: {},
      bySponsor: {},
      byToken: {}
    };

    // Fixed: Bug #39 - Use explicit null/undefined checks instead of || operator
    for (const r of data){
      const surface = r[2];
      const metric = r[3];
      const sponsorId = (r[4] !== null && r[4] !== undefined && r[4] !== '') ? r[4] : '-';
      const value = Number((r[5] !== null && r[5] !== undefined) ? r[5] : 0);
      const token = (r[6] !== null && r[6] !== undefined && r[6] !== '') ? r[6] : '-';

      if (!agg.bySurface[surface]) agg.bySurface[surface] = {impressions:0, clicks:0, dwellSec:0};
      if (!agg.bySponsor[sponsorId]) agg.bySponsor[sponsorId] = {impressions:0, clicks:0, dwellSec:0};
      if (!agg.byToken[token]) agg.byToken[token] = {impressions:0, clicks:0, dwellSec:0};
      const surf = agg.bySurface[surface];
      const spons = agg.bySponsor[sponsorId];
      const tok = agg.byToken[token];

      if (metric === 'impression'){
        agg.totals.impressions++; surf.impressions++; spons.impressions++; tok.impressions++;
      }
      if (metric === 'click'){
        agg.totals.clicks++; surf.clicks++; spons.clicks++; tok.clicks++;
      }
      if (metric === 'dwellSec'){
        agg.totals.dwellSec += value; surf.dwellSec += value; spons.dwellSec += value; tok.dwellSec += value;
      }
    }

    // Calculate CTR for sponsors and tokens
    for (const k in agg.bySponsor){
      const s = agg.bySponsor[k];
      s.ctr = s.impressions ? +(s.clicks / s.impressions).toFixed(4) : 0;
    }
    for (const k in agg.byToken){
      const t = agg.byToken[k];
      t.ctr = t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0;
    }

    return Ok(agg);
  });
}

/**
 * Export report to spreadsheet
 * @tier v2 - Advanced export matrix
 */
function api_exportReport(req){
  return runSafe('api_exportReport', () => {
    const eventId = String(req && req.id || '');
    if (!eventId) return Err(ERR.BAD_INPUT,'missing id');

    // Security fix: Pass credentials to api_getReport for proper authentication
    const { brandId, adminKey } = req || {};
    const rep = api_getReport({id: eventId, brandId: brandId || 'root', adminKey});
    if (!rep.ok) return rep;

    const ss = SpreadsheetApp.getActive();
    const name = `Report – ${eventId}`;
    let sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
    sh = ss.insertSheet(name);

    // Totals
    sh.getRange(1,1,1,2).setValues([['Metric','Total']]).setFontWeight('bold');
    sh.getRange(2,1,3,2).setValues([
      ['Impressions', rep.value.totals.impressions],
      ['Clicks',      rep.value.totals.clicks],
      ['Dwell (sec)', rep.value.totals.dwellSec]
    ]);

    // By Surface
    sh.getRange(6,1,1,4).setValues([['Surface','Impressions','Clicks','Dwell (sec)']]).setFontWeight('bold');
    const srows = Object.entries(rep.value.bySurface).map(([k,v]) => [k,v.impressions,v.clicks,v.dwellSec]);
    if (srows.length) sh.getRange(7,1,srows.length,4).setValues(srows);

    // By Sponsor
    sh.getRange(6,6,1,5).setValues([['SponsorId','Impressions','Clicks','CTR','Dwell (sec)']]).setFontWeight('bold');
    const prows = Object.entries(rep.value.bySponsor).map(([k,v]) => [k,v.impressions,v.clicks,v.ctr,v.dwellSec]);
    if (prows.length) sh.getRange(7,6,prows.length,5).setValues(prows);

    // By Token
    sh.getRange(6,12,1,5).setValues([['Token','Impressions','Clicks','CTR','Dwell (sec)']]).setFontWeight('bold');
    const trows = Object.entries(rep.value.byToken).filter(([k]) => k !== '-').map(([k,v]) => [k,v.impressions,v.clicks,v.ctr,v.dwellSec]);
    if (trows.length) sh.getRange(7,12,trows.length,5).setValues(trows);

    sh.autoResizeColumns(1, 15);

    diag_('info','api_exportReport','exported',{eventId, sheetId: sh.getSheetId()});
    return Ok({sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId()});
  });
}

/**
 * Get sponsor-specific analytics data
 * Allows sponsors to view their performance metrics across events
 * @param {object} req - Request object with sponsorId, eventId (optional), dateFrom/dateTo (optional)
 * @returns {object} Sponsor analytics including impressions, clicks, CTR, ROI by surface
 * @tier mvp - Core analytics for sponsor value proposition
 */
function api_getSponsorAnalytics(req) {
  return runSafe('api_getSponsorAnalytics', () => {
    if (!req || typeof req !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');

    const { sponsorId, eventId, dateFrom, dateTo, brandId, adminKey } = req;

    if (!sponsorId) return Err(ERR.BAD_INPUT, 'Missing sponsorId');

    // Optional authentication - sponsors can view their own data
    // Admin key allows viewing any sponsor's data
    if (adminKey) {
      const g = gate_(brandId || 'root', adminKey);
      if (!g.ok) return g;
    }

    // Get analytics data
    const sh = _ensureAnalyticsSheet_();
    let data = sh.getDataRange().getValues().slice(1);

    // Filter by sponsor ID
    data = data.filter(r => r[4] === sponsorId);

    // Filter by event ID if provided
    if (eventId) {
      data = data.filter(r => r[1] === eventId);
    }

    // Filter by date range if provided
    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
      const toDate = dateTo ? new Date(dateTo) : new Date();

      data = data.filter(r => {
        const rowDate = new Date(r[0]); // timestamp column
        return rowDate >= fromDate && rowDate <= toDate;
      });
    }

    // Aggregate metrics
    const agg = {
      sponsorId: sponsorId,
      totals: { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 },
      bySurface: {}, // poster, display, public, etc.
      byEvent: {},
      timeline: [] // Daily breakdown
    };

    // Process each analytics row
    for (const r of data) {
      const timestamp = r[0];
      const evtId = r[1];
      const surface = r[2];
      const metric = r[3];
      const value = Number((r[5] !== null && r[5] !== undefined) ? r[5] : 0);

      // Initialize surface if not exists
      if (!agg.bySurface[surface]) {
        agg.bySurface[surface] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
      }

      // Initialize event if not exists
      if (!agg.byEvent[evtId]) {
        agg.byEvent[evtId] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
      }

      const surf = agg.bySurface[surface];
      const evt = agg.byEvent[evtId];

      // Aggregate metrics
      if (metric === 'impression') {
        agg.totals.impressions++;
        surf.impressions++;
        evt.impressions++;
      }
      if (metric === 'click') {
        agg.totals.clicks++;
        surf.clicks++;
        evt.clicks++;
      }
      if (metric === 'dwellSec') {
        agg.totals.dwellSec += value;
        surf.dwellSec += value;
        evt.dwellSec += value;
      }

      // Track daily timeline
      const date = new Date(timestamp).toISOString().split('T')[0];
      let dayData = agg.timeline.find(d => d.date === date);
      if (!dayData) {
        dayData = { date, impressions: 0, clicks: 0, dwellSec: 0 };
        agg.timeline.push(dayData);
      }

      if (metric === 'impression') dayData.impressions++;
      if (metric === 'click') dayData.clicks++;
      if (metric === 'dwellSec') dayData.dwellSec += value;
    }

    // Calculate CTR (Click-Through Rate) for all aggregations
    agg.totals.ctr = agg.totals.impressions > 0
      ? +(agg.totals.clicks / agg.totals.impressions * 100).toFixed(2)
      : 0;

    for (const surface in agg.bySurface) {
      const s = agg.bySurface[surface];
      s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
    }

    for (const evtId in agg.byEvent) {
      const e = agg.byEvent[evtId];
      e.ctr = e.impressions > 0 ? +(e.clicks / e.impressions * 100).toFixed(2) : 0;
    }

    for (const day of agg.timeline) {
      day.ctr = day.impressions > 0 ? +(day.clicks / day.impressions * 100).toFixed(2) : 0;
    }

    // Sort timeline by date
    agg.timeline.sort((a, b) => a.date.localeCompare(b.date));

    // Add engagement score (weighted average of CTR and dwell time)
    agg.totals.engagementScore = calculateEngagementScore_(
      agg.totals.ctr,
      agg.totals.dwellSec,
      agg.totals.impressions
    );

    // Add performance insights
    agg.insights = generateSponsorInsights_(agg);

    diag_('info', 'api_getSponsorAnalytics', 'Analytics retrieved', {
      sponsorId,
      eventId: eventId || 'all',
      totalImpressions: agg.totals.impressions
    });

    return Ok(agg);
  });
}

/**
 * Get Sponsor ROI Dashboard
 * High-value feature providing comprehensive ROI analysis for sponsors
 *
 * @param {object} req - Request object
 * @param {string} req.sponsorId - Sponsor ID
 * @param {number} [req.sponsorshipCost] - Total sponsorship investment
 * @param {number} [req.costPerClick] - Expected cost per click
 * @param {number} [req.conversionRate] - Conversion rate percentage
 * @param {number} [req.avgTransactionValue] - Average transaction value
 * @param {string} [req.dateFrom] - Start date (ISO)
 * @param {string} [req.dateTo] - End date (ISO)
 * @param {string} [req.brandId] - Brand ID
 * @param {string} [req.adminKey] - Admin key for authentication
 * @returns {object} ROI dashboard with metrics, financials, and insights
 * @tier mvp - The WOW factor: real ROI numbers for sponsors
 */
function api_getSponsorROI(req) {
  return runSafe('api_getSponsorROI', () => {
    if (!req || typeof req !== 'object') {
      return Err(ERR.BAD_INPUT, 'Missing payload');
    }

    const { sponsorId, brandId, adminKey } = req;

    if (!sponsorId) {
      return Err(ERR.BAD_INPUT, 'Missing sponsorId');
    }

    // Optional authentication - sponsors can view their own data
    // Admin key allows viewing any sponsor's data
    if (adminKey) {
      const g = gate_(brandId || 'root', adminKey);
      if (!g.ok) return g;
    }

    // Use SponsorService to calculate ROI
    const roiResult = SponsorService_calculateROI({
      sponsorId: req.sponsorId,
      sponsorshipCost: req.sponsorshipCost || 0,
      costPerClick: req.costPerClick || 0,
      conversionRate: req.conversionRate || 0,
      avgTransactionValue: req.avgTransactionValue || 0,
      dateFrom: req.dateFrom,
      dateTo: req.dateTo
    });

    if (!roiResult.ok) {
      return roiResult;
    }

    diag_('info', 'api_getSponsorROI', 'ROI dashboard retrieved', {
      sponsorId,
      roi: roiResult.value.financials.roi
    });

    return roiResult;
  });
}

/**
 * Get sponsor placement settings and configurations
 *
 * Returns available placement positions, allowed positions per surface,
 * and upsell opportunities (e.g., dedicated TV pane).
 *
 * @param {object} req - Request parameters
 * @param {string} [req.brandId] - Brand ID for brand-specific settings
 * @returns {object} Result envelope with sponsor settings
 * @tier mvp
 */
function api_getSponsorSettings(req) {
  return runSafe('api_getSponsorSettings', () => {
    const { brandId } = req || {};

    // Use SponsorService to get settings
    const settingsResult = SponsorService_getSettings({ brandId });

    if (!settingsResult.ok) {
      return settingsResult;
    }

    diag_('info', 'api_getSponsorSettings', 'Settings retrieved', {
      brandId: brandId || 'default',
      placementsCount: Object.keys(settingsResult.value.placements).length
    });

    return settingsResult;
  });
}

/**
 * Validate sponsor placement configuration
 *
 * Ensures sponsors are assigned to valid placements and don't exceed limits.
 *
 * @param {object} req - Request parameters
 * @param {array} req.sponsors - Array of sponsor objects with placements
 * @param {string} [req.brandId] - Brand ID for settings lookup
 * @returns {object} Result envelope with validation results
 * @tier mvp
 */
function api_validateSponsorPlacements(req) {
  return runSafe('api_validateSponsorPlacements', () => {
    const { sponsors, brandId } = req || {};

    if (!Array.isArray(sponsors)) {
      return Err(ERR.BAD_INPUT, 'Sponsors must be an array');
    }

    // Use SponsorService to validate placements
    const validationResult = SponsorService_validatePlacements({
      sponsors,
      brandId
    });

    if (!validationResult.ok) {
      return validationResult;
    }

    diag_('info', 'api_validateSponsorPlacements', 'Placements validated', {
      brandId: brandId || 'default',
      valid: validationResult.value.valid,
      totalSponsors: validationResult.value.totalSponsors,
      errorsCount: validationResult.value.errors.length,
      warningsCount: validationResult.value.warnings.length
    });

    return validationResult;
  });
}

/**
 * Calculate engagement score from CTR and dwell time
 * @param {number} ctr - Click-through rate (percentage)
 * @param {number} dwellSec - Total dwell time in seconds
 * @param {number} impressions - Total impressions
 * @returns {number} Engagement score (0-100)
 */
function calculateEngagementScore_(ctr, dwellSec, impressions) {
  if (impressions === 0) return 0;

  // Normalize dwell time (assuming 5 seconds is good engagement per impression)
  const avgDwellPerImpression = dwellSec / impressions;
  const normalizedDwell = Math.min(avgDwellPerImpression / 5 * 100, 100);

  // Weight: 60% CTR, 40% dwell time
  const score = (ctr * 0.6) + (normalizedDwell * 0.4);

  return +score.toFixed(2);
}

/**
 * Generate performance insights for sponsors
 * @param {object} agg - Aggregated analytics data
 * @returns {array} Array of insight objects
 */
function generateSponsorInsights_(agg) {
  const insights = [];

  // Insight 1: Best performing surface
  let bestSurface = null;
  let bestCTR = 0;

  for (const [surface, data] of Object.entries(agg.bySurface)) {
    if (data.ctr > bestCTR && data.impressions >= 10) { // Need at least 10 impressions for statistical relevance
      bestCTR = data.ctr;
      bestSurface = surface;
    }
  }

  if (bestSurface) {
    insights.push({
      type: 'success',
      title: 'Top Performing Surface',
      message: `Your ${bestSurface} ads have the highest CTR at ${bestCTR}%. Consider increasing investment in this channel.`,
      metric: { surface: bestSurface, ctr: bestCTR }
    });
  }

  // Insight 2: Low CTR warning
  if (agg.totals.impressions >= 100 && agg.totals.ctr < 1) {
    insights.push({
      type: 'warning',
      title: 'Low Click-Through Rate',
      message: `Your overall CTR is ${agg.totals.ctr}%. Consider refreshing your ad creative or targeting to improve engagement.`,
      metric: { ctr: agg.totals.ctr }
    });
  }

  // Insight 3: Surface comparison
  const surfaces = Object.keys(agg.bySurface);
  if (surfaces.length > 1) {
    const surfacePerformance = surfaces.map(s => ({
      name: s,
      ...agg.bySurface[s]
    })).sort((a, b) => b.ctr - a.ctr);

    if (surfacePerformance.length >= 2) {
      const top = surfacePerformance[0];
      const bottom = surfacePerformance[surfacePerformance.length - 1];

      if (top.ctr > bottom.ctr * 2 && bottom.impressions >= 10) {
        insights.push({
          type: 'info',
          title: 'Surface Performance Gap',
          message: `${top.name} performs ${(top.ctr / bottom.ctr).toFixed(1)}x better than ${bottom.name}. Consider reallocating budget.`,
          metric: { topSurface: top.name, topCTR: top.ctr, bottomSurface: bottom.name, bottomCTR: bottom.ctr }
        });
      }
    }
  }

  // Insight 4: Engagement quality
  if (agg.totals.impressions > 0) {
    const avgDwell = agg.totals.dwellSec / agg.totals.impressions;
    if (avgDwell > 5) {
      insights.push({
        type: 'success',
        title: 'High Engagement Quality',
        message: `Users spend an average of ${avgDwell.toFixed(1)} seconds viewing your ads, indicating strong interest.`,
        metric: { avgDwellSec: avgDwell }
      });
    } else if (avgDwell < 2 && agg.totals.impressions >= 50) {
      insights.push({
        type: 'warning',
        title: 'Short View Duration',
        message: `Average view time is only ${avgDwell.toFixed(1)} seconds. Your ad creative may not be capturing attention.`,
        metric: { avgDwellSec: avgDwell }
      });
    }
  }

  // Insight 5: Recent trend
  if (agg.timeline.length >= 7) {
    const recent = agg.timeline.slice(-7);
    const older = agg.timeline.slice(-14, -7);

    if (older.length >= 7) {
      const recentAvgCTR = recent.reduce((sum, d) => sum + d.ctr, 0) / recent.length;
      const olderAvgCTR = older.reduce((sum, d) => sum + d.ctr, 0) / older.length;

      if (recentAvgCTR > olderAvgCTR * 1.2) {
        insights.push({
          type: 'success',
          title: 'Improving Trend',
          message: `Your CTR has increased by ${((recentAvgCTR / olderAvgCTR - 1) * 100).toFixed(0)}% in the last week compared to the previous week.`,
          metric: { recentCTR: recentAvgCTR, previousCTR: olderAvgCTR, change: recentAvgCTR - olderAvgCTR }
        });
      } else if (olderAvgCTR > recentAvgCTR * 1.2) {
        insights.push({
          type: 'warning',
          title: 'Declining Performance',
          message: `Your CTR has decreased by ${((1 - recentAvgCTR / olderAvgCTR) * 100).toFixed(0)}% in the last week. Consider refreshing your ad creative.`,
          metric: { recentCTR: recentAvgCTR, previousCTR: olderAvgCTR, change: recentAvgCTR - olderAvgCTR }
        });
      }
    }
  }

  return insights;
}

/**
 * Create trackable shortlink for CTR tracking
 * @tier mvp - Core tracking for analytics loop
 */
function api_createShortlink(req){
  return runSafe('api_createShortlink', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { targetUrl, eventId, sponsorId, surface, adminKey, brandId } = req;

    if (!targetUrl) return Err(ERR.BAD_INPUT,'Missing targetUrl');

    // Fixed: Bug #45 & #51 - Validate targetUrl format and length
    if (!isUrl(targetUrl, 2048)) {
      diag_('warn', 'api_createShortlink', 'Invalid or too long URL', {targetUrl: targetUrl.substring(0, 100)});
      return Err(ERR.BAD_INPUT, 'Invalid or too long targetUrl (max 2048 characters)');
    }

    const g=gate_(brandId||'root', adminKey); if(!g.ok) return g;

    const sh = _ensureShortlinksSheet_();

    // Fixed: Bug #34 - Use full UUID for secure token generation (128-bit entropy)
    // Previously used only first 8 chars which was guessable (~30-bit entropy)
    const token = Utilities.getUuid();

    // Fixed: Bug #53 - Store brandId for validation on redirect
    sh.appendRow([
      token,
      targetUrl,
      eventId||'',
      sponsorId||'',
      surface||'',
      new Date().toISOString(),
      brandId||'root' // Add brandId for cross-brand validation
    ]);

    const base = ScriptApp.getService().getUrl();
    const shortlink = `${base}?p=r&t=${token}`;

    diag_('info','api_createShortlink','created',{token, targetUrl, eventId, sponsorId});
    return Ok({ token, shortlink, targetUrl });
  });
}

// === Google Forms Template Creation ===

/**
 * List available form templates
 * @tier mvp
 */
function api_listFormTemplates(){
  return runSafe('api_listFormTemplates', () => {
    const templates = listFormTemplates_();
    return Ok({ templates });
  });
}

/**
 * Create Google Form from template
 * @tier mvp
 */
function api_createFormFromTemplate(req){
  return runSafe('api_createFormFromTemplate', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { templateType, eventName, eventId, adminKey, brandId } = req;

    if (!templateType) return Err(ERR.BAD_INPUT,'Missing templateType');

    const g=gate_(brandId||'root', adminKey); if(!g.ok) return g;

    const template = findFormTemplate_(templateType);
    if (!template) return Err(ERR.BAD_INPUT, `Unknown template type: ${templateType}`);

    try {
      // Create the form
      const formTitle = eventName ? `${eventName} - ${template.label}` : template.label;
      const form = FormApp.create(formTitle);

      form.setDescription(template.description);
      form.setCollectEmail(true);
      form.setLimitOneResponsePerUser(false);
      form.setShowLinkToRespondAgain(true);

      // Add questions from template
      template.questions.forEach(q => {
        let item;

        switch(q.type) {
          case 'TEXT':
            item = form.addTextItem();
            item.setTitle(q.title);
            if (q.required) item.setRequired(true);
            break;

          case 'PARAGRAPH_TEXT':
            item = form.addParagraphTextItem();
            item.setTitle(q.title);
            if (q.required) item.setRequired(true);
            break;

          case 'MULTIPLE_CHOICE':
            item = form.addMultipleChoiceItem();
            item.setTitle(q.title);
            if (q.choices && q.choices.length > 0) {
              item.setChoiceValues(q.choices);
            }
            if (q.required) item.setRequired(true);
            break;

          case 'SCALE':
            item = form.addScaleItem();
            item.setTitle(q.title);
            if (q.scaleMin && q.scaleMax) {
              item.setBounds(q.scaleMin, q.scaleMax);
            }
            if (q.scaleMinLabel) item.setLabels(q.scaleMinLabel, q.scaleMaxLabel || '');
            if (q.required) item.setRequired(true);
            break;

          default:
            // Default to text item
            item = form.addTextItem();
            item.setTitle(q.title);
            if (q.required) item.setRequired(true);
        }
      });

      // Create response spreadsheet
      const responseSheet = SpreadsheetApp.create(`${formTitle} - Responses`);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());

      const formId = form.getId();
      const editUrl = form.getEditUrl();
      const publishedUrl = form.getPublishedUrl();
      const responseSheetUrl = responseSheet.getUrl();

      diag_('info','api_createFormFromTemplate','created',{formId, templateType, eventId});

      return Ok({
        formId,
        editUrl,
        publishedUrl,
        responseSheetUrl,
        templateType,
        eventId: eventId || ''
      });

    } catch(e) {
      diag_('error','api_createFormFromTemplate','failed',{error: e.toString(), templateType});
      return Err(ERR.SERVER_ERROR, `Failed to create form: ${e.toString()}`);
    }
  });
}

/**
 * Generate trackable shortlink for form URL
 * @tier mvp
 */
function api_generateFormShortlink(req){
  return runSafe('api_generateFormShortlink', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { formUrl, formType, eventId, adminKey, brandId } = req;

    if (!formUrl) return Err(ERR.BAD_INPUT,'Missing formUrl');

    // Use existing shortlink API
    return api_createShortlink({
      targetUrl: formUrl,
      eventId: eventId || '',
      sponsorId: '',
      surface: `form-${formType || 'unknown'}`,
      adminKey,
      brandId
    });
  });
}

// =============================================================================
// === v2+ APIs - Working but NOT MVP focus ====================================
// =============================================================================
// These APIs work but are not critical for focus group testing.
// Don't delete, but don't design around them for MVP.
// =============================================================================

// === Brand Portfolio Analytics API (Parent Organizations) =================

/**
 * Get consolidated sponsor report across brand portfolio
 * @param {object} req - Request with brandId, adminKey, sponsorId, options
 * @returns {object} - Portfolio-wide sponsor analytics
 * @tier v2 - Multi-event portfolio analytics
 */
function api_getPortfolioSponsorReport(req) {
  return runSafe('api_getPortfolioSponsorReport', () => {
    const { brandId, adminKey, sponsorId, options } = req;

    // Validate parent brand
    const brand= findBrand_(brandId);
    if (!brand) {
      return Err(ERR.NOT_FOUND, 'Brand not found');
    }

    if (brand.type !== 'parent') {
      return Err(ERR.BAD_INPUT, 'Only parent organizations can access portfolio reports');
    }

    // Verify admin access
    if (!isValidAdminKey_(adminKey, brandId)) {
      return Err(ERR.BAD_INPUT, 'Invalid admin key');
    }

    // Get portfolio report
    const result = getPortfolioSponsorReport_(brandId, sponsorId, options || {});

    if (!result.ok) {
      return Err(ERR.INTERNAL, result.error || 'Failed to generate portfolio report');
    }

    return Ok(result.value);
  });
}

/**
 * Get brand portfolio summary for parent organization
 * @param {object} req - Request with brandId, adminKey
 * @returns {object} - Portfolio summary
 * @tier v2 - Multi-event portfolio analytics
 */
function api_getPortfolioSummary(req) {
  return runSafe('api_getPortfolioSummary', () => {
    const { brandId, adminKey } = req;

    // Validate parent brand
    const brand= findBrand_(brandId);
    if (!brand) {
      return Err(ERR.NOT_FOUND, 'Brand not found');
    }

    if (brand.type !== 'parent') {
      return Err(ERR.BAD_INPUT, 'Only parent organizations can access portfolio summary');
    }

    // Verify admin access
    if (!isValidAdminKey_(adminKey, brandId)) {
      return Err(ERR.BAD_INPUT, 'Invalid admin key');
    }

    // Get portfolio summary
    const result = getPortfolioSummary_(brandId);

    if (!result.ok) {
      return Err(ERR.INTERNAL, result.error || 'Failed to generate portfolio summary');
    }

    return Ok(result.value);
  });
}

/**
 * Get list of all sponsors across brand portfolio
 * @param {object} req - Request with brandId, adminKey
 * @returns {object} - Portfolio sponsors list
 * @tier v2 - Multi-event portfolio analytics
 */
function api_getPortfolioSponsors(req) {
  return runSafe('api_getPortfolioSponsors', () => {
    const { brandId, adminKey } = req;

    // Validate parent brand
    const brand= findBrand_(brandId);
    if (!brand) {
      return Err(ERR.NOT_FOUND, 'Brand not found');
    }

    if (brand.type !== 'parent') {
      return Err(ERR.BAD_INPUT, 'Only parent organizations can access portfolio sponsors');
    }

    // Verify admin access
    if (!isValidAdminKey_(adminKey, brandId)) {
      return Err(ERR.BAD_INPUT, 'Invalid admin key');
    }

    // Get portfolio sponsors
    const result = getPortfolioSponsors_(brandId);

    if (!result.ok) {
      return Err(ERR.INTERNAL, result.error || 'Failed to get portfolio sponsors');
    }

    return Ok(result.value);
  });
}

/**
 * Run full system diagnostics
 * @tier mvp - Useful for debugging setup issues
 */
function api_runDiagnostics(){
  return runSafe('api_runDiagnostics', () => {
    const steps = [];
    let eventId = null;
    let sheetUrl = null;

    try {
      // 1. Status check
      const st = api_status('root');
      steps.push({ name: 'status', ok: st.ok, error: st.ok ? null : st.message });
      if (!st.ok) return Ok({ steps, ok: false });

      // 2. Create temp event
      const create = api_create({
        brandId: 'root',
        scope: 'events',
        templateId: 'event',
        adminKey: getAdminSecret_('root'),
        idemKey: `diag-${Date.now()}`,
        data: { name: 'Diagnostic Test Event', dateISO: '2025-12-31', signupUrl: '' }
      });
      steps.push({ name: 'create_event', ok: create.ok, error: create.ok ? null : create.message });
      if (!create.ok) return Ok({ steps, ok: false });
      eventId = create.value.id;

      // 3. Update display config
      const upd = api_updateEventData({
        brandId: 'root',
        scope: 'events',
        id: eventId,
        adminKey: getAdminSecret_('root'),
        data: {
          display: { mode: 'static' },
          sponsors: [{ id: 'test-sp1', name: 'Test Sponsor', placements: { tvTop: true } }]
        }
      });
      steps.push({ name: 'update_config', ok: upd.ok, error: upd.ok ? null : upd.message });

      // 4. Log analytics
      const log = api_logEvents({
        items: [
          { eventId, surface: 'display', metric: 'impression', sponsorId: 'test-sp1' },
          { eventId, surface: 'display', metric: 'dwellSec', value: 10 }
        ]
      });
      steps.push({ name: 'log_analytics', ok: log.ok, error: log.ok ? null : log.message });

      // 5. Get report
      const rep = api_getReport({ id: eventId });
      steps.push({ name: 'get_report', ok: rep.ok, error: rep.ok ? null : rep.message });

      // 6. Export report
      const exp = api_exportReport({ id: eventId });
      steps.push({ name: 'export_report', ok: exp.ok, error: exp.ok ? null : exp.message });
      if (exp.ok) sheetUrl = exp.value.sheetUrl;

      // 7. Create shortlink
      const sl = api_createShortlink({
        brandId: 'root',
        adminKey: findBrand_('root').adminSecret,
        targetUrl: create.value.links.publicUrl,
        eventId,
        surface: 'test'
      });
      steps.push({ name: 'create_shortlink', ok: sl.ok, error: sl.ok ? null : sl.message });

      const allOk = steps.every(s => s.ok);
      diag_('info', 'api_runDiagnostics', allOk ? 'All checks passed' : 'Some checks failed', { steps });

      return Ok({ steps, eventId, sheetUrl, ok: allOk });
    } catch(e) {
      steps.push({ name: 'exception', ok: false, error: String(e) });
      return Ok({ steps, ok: false });
    }
  });
}

// === Brand Portfolio Analytics =============================================
// Multi-brand sponsorship reporting for parent organizations

/**
 * Get consolidated sponsor report across brand portfolio
 *
 * @param {string} parentBrandId - Parent organization (e.g., 'abc')
 * @param {string} sponsorId - Sponsor ID to report on
 * @param {object} options - Optional filters (dateRange, etc.)
 * @returns {object} - Aggregated sponsor metrics
 */
function getPortfolioSponsorReport_(parentBrandId, sponsorId, options = {}) {
  const parentBrand = findBrand_(parentBrandId);

  if (!parentBrand || parentBrand.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent brand or not a parent organization'
    };
  }

  const report = {
    parentOrg: {
      id: parentBrandId,
      name: parentBrand.name
    },
    sponsor: {
      id: sponsorId,
      name: null  // Will be populated from data
    },
    portfolioSummary: {
      totalImpressions: 0,
      totalClicks: 0,
      totalEvents: 0,
      portfolioCTR: 0,
      dateRange: options.dateRange || { start: null, end: null }
    },
    byBrand: {},
    topPerformingEvents: [],
    generatedAt: new Date().toISOString()
  };

  // Get sponsor data from parent brand
  const parentData = getSponsorDataForBrand_(parentBrandId, sponsorId, options);
  if (parentData) {
    report.portfolioSummary.totalImpressions += parentData.impressions || 0;
    report.portfolioSummary.totalClicks += parentData.clicks || 0;
    report.portfolioSummary.totalEvents += parentData.events || 0;
    report.byBrand[parentBrandId] = {
      name: parentBrand.name,
      ...parentData
    };

    // Set sponsor name if found
    if (parentData.sponsorName) {
      report.sponsor.name = parentData.sponsorName;
    }
  }

  // Get sponsor data from child brands
  const childBrandIds = parentBrand.childBrands || [];
  childBrandIds.forEach(childId => {
    const childBrand = findBrand_(childId);
    if (!childBrand) return;

    // Skip child brands not included in portfolio reports
    if (childBrand.includeInPortfolioReports === false) return;

    const childData = getSponsorDataForBrand_(childId, sponsorId, options);
    if (childData) {
      report.portfolioSummary.totalImpressions += childData.impressions || 0;
      report.portfolioSummary.totalClicks += childData.clicks || 0;
      report.portfolioSummary.totalEvents += childData.events || 0;
      report.byBrand[childId] = {
        name: childBrand.name,
        ...childData
      };

      // Set sponsor name if not yet set
      if (!report.sponsor.name && childData.sponsorName) {
        report.sponsor.name = childData.sponsorName;
      }
    }
  });

  // Calculate portfolio CTR
  if (report.portfolioSummary.totalImpressions > 0) {
    report.portfolioSummary.portfolioCTR = (
      (report.portfolioSummary.totalClicks / report.portfolioSummary.totalImpressions) * 100
    ).toFixed(2);
  }

  // Aggregate top performing events across all brands
  report.topPerformingEvents = getTopPerformingEventsAcrossPortfolio_(
    parentBrandId,
    sponsorId,
    childBrandIds,
    5  // Top 5 events
  );

  return {
    ok: true,
    value: report
  };
}

/**
 * Get sponsor data for a specific brand
 *
 * @param {string} brandId - Brand ID
 * @param {string} sponsorId - Sponsor ID
 * @param {object} options - Optional filters
 * @returns {object|null} - Sponsor data or null
 */
function getSponsorDataForBrand_(brandId, sponsorId, options = {}) {
  try {
    // Get all events for this brand
    const brand= findBrand_(brandId);
    if (!brand) return null;

    const db = getDb_(brand);
    const events = db.list('events') || [];

    // Get sponsors to find sponsor name
    const sponsors = db.list('sponsors') || [];
    const sponsor = sponsors.find(s => s.id === sponsorId);
    const sponsorName = sponsor ? sponsor.name : null;

    // Filter events that have this sponsor
    const sponsoredEvents = events.filter(event => {
      const eventSponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim());
      return eventSponsorIds.includes(sponsorId);
    });

    if (sponsoredEvents.length === 0) {
      return {
        sponsorName: sponsorName,
        impressions: 0,
        clicks: 0,
        events: 0,
        ctr: 0,
        eventsList: []
      };
    }

    // Aggregate metrics
    let totalImpressions = 0;
    let totalClicks = 0;
    const eventsList = [];

    sponsoredEvents.forEach(event => {
      // Get analytics for this event (if available)
      const eventImpressions = event.analytics?.impressions || 0;
      const eventClicks = event.analytics?.clicks || 0;

      totalImpressions += eventImpressions;
      totalClicks += eventClicks;

      eventsList.push({
        id: event.id,
        name: event.name,
        date: event.dateISO,
        impressions: eventImpressions,
        clicks: eventClicks,
        ctr: eventImpressions > 0 ? ((eventClicks / eventImpressions) * 100).toFixed(2) : 0
      });
    });

    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    return {
      sponsorName: sponsorName,
      impressions: totalImpressions,
      clicks: totalClicks,
      events: sponsoredEvents.length,
      ctr: ctr,
      eventsList: eventsList
    };

  } catch (error) {
    console.error(`Error getting sponsor data for brand ${brandId}:`, error);
    return null;
  }
}

/**
 * Get top performing events across brand portfolio
 *
 * @param {string} parentBrandId - Parent brand ID
 * @param {string} sponsorId - Sponsor ID
 * @param {array} childBrandIds - Child brand IDs
 * @param {number} limit - Number of top events to return
 * @returns {array} - Top performing events
 */
function getTopPerformingEventsAcrossPortfolio_(parentBrandId, sponsorId, childBrandIds, limit = 5) {
  const allEvents = [];

  // Collect events from parent
  const parentData = getSponsorDataForBrand_(parentBrandId, sponsorId);
  if (parentData && parentData.eventsList) {
    parentData.eventsList.forEach(event => {
      allEvents.push({
        ...event,
        brandId: parentBrandId,
        brandName: findBrand_(parentBrandId)?.name || parentBrandId
      });
    });
  }

  // Collect events from children
  childBrandIds.forEach(childId => {
    const childBrand = findBrand_(childId);
    // Skip child brands not included in portfolio reports
    if (!childBrand || childBrand.includeInPortfolioReports === false) return;

    const childData = getSponsorDataForBrand_(childId, sponsorId);
    if (childData && childData.eventsList) {
      childData.eventsList.forEach(event => {
        allEvents.push({
          ...event,
          brandId: childId,
          brandName: childBrand.name || childId
        });
      });
    }
  });

  // Sort by impressions (descending) and return top N
  return allEvents
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

/**
 * Get brand portfolio summary for parent organization
 * Shows overall portfolio health and activity
 *
 * @param {string} parentBrandId - Parent brand ID
 * @returns {object} - Portfolio summary
 */
function getPortfolioSummary_(parentBrandId) {
  const parentBrand = findBrand_(parentBrandId);

  if (!parentBrand || parentBrand.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent brand or not a parent organization'
    };
  }

  const summary = {
    portfolio: {
      parent: {
        id: parentBrandId,
        name: parentBrand.name
      },
      children: []
    },
    metrics: {
      totalEvents: 0,
      totalSponsors: 0,
      totalImpressions: 0,
      activeSponsors: new Set()
    },
    byBrand: {}
  };

  // Get parent metrics
  const parentDb = getDb_(parentBrand);
  const parentEvents = parentDb.list('events') || [];
  const parentSponsors = parentDb.list('sponsors') || [];

  summary.metrics.totalEvents += parentEvents.length;
  summary.metrics.totalSponsors += parentSponsors.length;

  // Track active sponsors (sponsors with events)
  parentEvents.forEach(event => {
    const sponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim()).filter(id => id);
    sponsorIds.forEach(sid => summary.metrics.activeSponsors.add(sid));

    const eventImpressions = event.analytics?.impressions || 0;
    summary.metrics.totalImpressions += eventImpressions;
  });

  summary.byBrand[parentBrandId] = {
    name: parentBrand.name,
    events: parentEvents.length,
    sponsors: parentSponsors.length
  };

  // Get child metrics
  const childBrandIds = parentBrand.childBrands || [];
  childBrandIds.forEach(childId => {
    const childBrand = findBrand_(childId);
    if (!childBrand) return;

    // Skip child brands not included in portfolio reports
    if (childBrand.includeInPortfolioReports === false) return;

    summary.portfolio.children.push({
      id: childId,
      name: childBrand.name
    });

    const childDb = getDb_(childBrand);
    const childEvents = childDb.list('events') || [];
    const childSponsors = childDb.list('sponsors') || [];

    summary.metrics.totalEvents += childEvents.length;
    summary.metrics.totalSponsors += childSponsors.length;

    // Track active sponsors
    childEvents.forEach(event => {
      const sponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim()).filter(id => id);
      sponsorIds.forEach(sid => summary.metrics.activeSponsors.add(sid));

      const eventImpressions = event.analytics?.impressions || 0;
      summary.metrics.totalImpressions += eventImpressions;
    });

    summary.byBrand[childId] = {
      name: childBrand.name,
      events: childEvents.length,
      sponsors: childSponsors.length
    };
  });

  // Convert Set to count
  summary.metrics.activeSponsors = summary.metrics.activeSponsors.size;

  return {
    ok: true,
    value: summary
  };
}

/**
 * Get list of all sponsors across brand portfolio
 * Useful for parent organizations to see all sponsors
 *
 * @param {string} parentBrandId - Parent brand ID
 * @returns {object} - List of sponsors with brand breakdown
 */
function getPortfolioSponsors_(parentBrandId) {
  const parentBrand = findBrand_(parentBrandId);

  if (!parentBrand || parentBrand.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent brand or not a parent organization'
    };
  }

  const sponsorsMap = new Map();

  // Helper to add sponsor to map
  const addSponsor = (sponsor, brandId, brandName) => {
    const key = sponsor.id;
    if (!sponsorsMap.has(key)) {
      sponsorsMap.set(key, {
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        website: sponsor.website,
        tier: sponsor.tier,
        brands: []
      });
    }
    sponsorsMap.get(key).brands.push({
      brandId: brandId,
      brandName: brandName
    });
  };

  // Get sponsors from parent
  const parentDb = getDb_(parentBrand);
  const parentSponsors = parentDb.list('sponsors') || [];
  parentSponsors.forEach(sponsor => {
    addSponsor(sponsor, parentBrandId, parentBrand.name);
  });

  // Get sponsors from children
  const childBrandIds = parentBrand.childBrands || [];
  childBrandIds.forEach(childId => {
    const childBrand = findBrand_(childId);
    if (!childBrand) return;

    // Skip child brands not included in portfolio reports
    if (childBrand.includeInPortfolioReports === false) return;

    const childDb = getDb_(childBrand);
    const childSponsors = childDb.list('sponsors') || [];
    childSponsors.forEach(sponsor => {
      addSponsor(sponsor, childId, childBrand.name);
    });
  });

  return {
    ok: true,
    value: {
      sponsors: Array.from(sponsorsMap.values()),
      totalCount: sponsorsMap.size
    }
  };
}
