// === Zeventbook Production-Grade Backend ===
// Build: triangle-prod-v1.2

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
 * @param {string} spreadsheetId - Optional spreadsheet ID (uses root tenant if not provided)
 */
// Fixed: Bug #17 - Sanitize sensitive data from metadata before logging
function sanitizeMetaForLogging_(meta) {
  if (!meta || typeof meta !== 'object') return meta;

  const sanitized = { ...meta };
  const sensitiveKeys = ['adminKey', 'token', 'password', 'secret', 'authorization', 'bearer', 'csrf', 'csrfToken'];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

function diag_(level, where, msg, meta, spreadsheetId){
  try{
    // If spreadsheet ID not provided, try to get from root tenant
    if (!spreadsheetId) {
      const rootTenant = findTenant_('root');
      if (rootTenant && rootTenant.store && rootTenant.store.spreadsheetId) {
        spreadsheetId = rootTenant.store.spreadsheetId;
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

    // Hard cap cleanup - Fixed: Bug #8
    const last = sh.getLastRow();
    if(last > DIAG_MAX){
      const rowsToDelete = last - DIAG_MAX;
      if (rowsToDelete > 0) {
        sh.deleteRows(2, rowsToDelete);
      }
    }

    // Lazy daily cleanup - only run periodically to avoid performance hit - Fixed: Bug #9
    const shouldCleanup = (Math.random() < 0.1); // 10% chance on each log
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
  const cache = CacheService.getUserCache();
  const valid = cache.get('csrf_' + token);
  if (valid) {
    cache.remove('csrf_' + token); // One-time use
    return true;
  }
  return false;
}

// === Router ================================================================
function doGet(e){
  const pageParam = (e?.parameter?.page || e?.parameter?.p || '').toString();
  const actionParam = (e?.parameter?.action || '').toString();
  const hostHeader = (e?.headers?.host || e?.parameter?.host || '').toString();
  const tenant = findTenantByHost_(hostHeader) || findTenant_('root');

  // REST API Routes (for custom frontends)
  if (actionParam) {
    return handleRestApiGet_(e, actionParam, tenant);
  }

  // Shortlink redirect route
  if (pageParam === 'r' || pageParam === 'redirect') {
    const token = (e?.parameter?.t || e?.parameter?.token || '').toString();
    return handleRedirect_(token);
  }

  // API Documentation page
  if (pageParam === 'docs' || pageParam === 'api') {
    return HtmlService.createHtmlOutputFromFile('ApiDocs')
      .setTitle('API Documentation - MVP Event Toolkit')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Status endpoint
  if (pageParam === 'status') {
    const tenantParam = (e?.parameter?.tenant || 'root').toString();
    const status = api_status(tenantParam);
    return ContentService.createTextOutput(JSON.stringify(status, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const path = (e?.pathInfo || '').toString().replace(/^\/+|\/+$/g,'');
  const scope = (e?.parameter?.p || e?.parameter?.scope || 'events').toString();
  const allowed = tenant.scopesAllowed?.length ? tenant.scopesAllowed : ['events','leagues','tournaments'];

  if (!allowed.includes(scope)){
    const first = allowed[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&tenant=${tenant.id}">`);
  }

  // Admin mode selection: default to wizard for simplicity, allow advanced mode via URL parameter
  let page = (pageParam==='admin' || pageParam==='wizard' || pageParam==='poster' || pageParam==='test' || pageParam==='display' || pageParam==='report' || pageParam==='analytics' || pageParam==='diagnostics' || pageParam==='sponsor' || pageParam==='signup' || pageParam==='config') ? pageParam : 'public';

  // Route admin to wizard by default (simple mode), unless mode=advanced is specified
  if (page === 'admin') {
    const mode = (e?.parameter?.mode || '').toString();
    if (mode !== 'advanced') {
      page = 'wizard'; // Default to wizard (simple mode)
    }
  }

  const tpl = HtmlService.createTemplateFromFile(pageFile_(page));
  tpl.appTitle = `${tenant.name} · ${scope}`;
  tpl.tenantId = tenant.id;
  tpl.scope = scope;
  tpl.execUrl = ScriptApp.getService().getUrl();
  tpl.ZEB = ZEB;
  return tpl.evaluate()
    .setTitle(`${tpl.appTitle} · ${page}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// === REST API Handler for POST requests ===================================
function doPost(e){
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || e.parameter?.action || '';
    const tenant = findTenantByHost_(e?.headers?.host) || findTenant_('root');

    // Fixed: Bug #4 - CSRF protection for state-changing operations
    const stateChangingActions = ['create', 'update', 'delete', 'updateEventData', 'createShortlink', 'createFormFromTemplate', 'generateFormShortlink'];
    if (stateChangingActions.includes(action)) {
      if (!validateCSRFToken_(body.csrfToken)) {
        return jsonResponse_(Err(ERR.BAD_INPUT, 'Invalid or missing CSRF token. Please refresh the page and try again.'));
      }
    }

    return handleRestApiPost_(e, action, body, tenant);
  } catch(err) {
    return jsonResponse_(Err(ERR.BAD_INPUT, 'Invalid JSON body'));
  }
}

// === REST API GET Handler (read-only operations) ==========================
function handleRestApiGet_(e, action, tenant) {
  const tenantId = e.parameter.tenant || tenant.id;
  const scope = e.parameter.scope || 'events';
  const etag = e.parameter.etag || '';
  const id = e.parameter.id || '';

  // Public endpoints (no auth required)
  if (action === 'status') {
    return jsonResponse_(api_status(tenantId));
  }

  // Fixed: Bug #4 - CSRF token generation endpoint
  if (action === 'generateCSRFToken') {
    const token = generateCSRFToken_();
    return jsonResponse_(Ok({ csrfToken: token }));
  }

  if (action === 'config') {
    return jsonResponse_(api_getConfig({tenantId, scope, ifNoneMatch: etag}));
  }

  if (action === 'list') {
    return jsonResponse_(api_list({tenantId, scope, ifNoneMatch: etag}));
  }

  if (action === 'get') {
    if (!id) return jsonResponse_(Err(ERR.BAD_INPUT, 'Missing id parameter'));
    return jsonResponse_(api_get({tenantId, scope, id, ifNoneMatch: etag}));
  }

  return jsonResponse_(Err(ERR.BAD_INPUT, `Unknown action: ${action}`));
}

// === REST API POST Handler (write operations, require auth) ===============
function handleRestApiPost_(e, action, body, tenant) {
  const tenantId = body.tenantId || e.parameter?.tenant || tenant.id;
  const scope = body.scope || e.parameter?.scope || 'events';

  // Special case: token generation uses old auth flow
  if (action === 'generateToken') {
    return jsonResponse_(api_generateToken({
      tenantId,
      adminKey: body.adminKey,
      expiresIn: body.expiresIn,
      scope
    }));
  }

  // Check authorization using multi-method authentication
  const authCheck = authenticateRequest_(e, body, tenantId);
  if (!authCheck.ok) {
    return jsonResponse_(authCheck);
  }

  const authenticatedTenant = authCheck.value.tenant;
  const adminKey = body.adminKey || getAdminSecret_(authenticatedTenant.id); // For backward compatibility

  // Route to appropriate API function
  if (action === 'create') {
    return jsonResponse_(api_create({
      tenantId,
      adminKey,
      scope,
      templateId: body.templateId,
      data: body.data
    }));
  }

  if (action === 'update') {
    return jsonResponse_(api_updateEventData({
      tenantId,
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
      tenantId,
      adminKey,
      id: body.eventId || '',  // Fixed: Changed eventId to id to match api_getReport
      startDate: body.startDate || '',
      endDate: body.endDate || ''
    }));
  }

  if (action === 'createShortlink') {
    return jsonResponse_(api_createShortlink({
      tenantId,
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
      tenantId,
      adminKey,
      templateType: body.templateType,
      eventName: body.eventName || '',
      eventId: body.eventId || ''
    }));
  }

  if (action === 'generateFormShortlink') {
    return jsonResponse_(api_generateFormShortlink({
      tenantId,
      adminKey,
      formUrl: body.formUrl,
      formType: body.formType || '',
      eventId: body.eventId || ''
    }));
  }

  return jsonResponse_(Err(ERR.BAD_INPUT, `Unknown action: ${action}`));
}

// === JSON Response Helper with CORS =======================================
function jsonResponse_(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);

  // Add CORS headers to allow requests from custom frontends
  // Note: In production, restrict this to specific domains
  return output;
}

function pageFile_(page){
  if (page==='admin') return 'Admin';
  if (page==='wizard') return 'AdminWizard';
  if (page==='poster') return 'Poster';
  if (page==='test') return 'Test';
  if (page==='display') return 'Display';
  if (page==='report' || page==='analytics') return 'SharedReport';
  if (page==='diagnostics') return 'Diagnostics';
  if (page==='sponsor') return 'Sponsor';
  if (page==='signup') return 'Signup';
  if (page==='config') return 'ConfigHtml';
  return 'Public';
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// === Shortlink redirect handler ============================================
function handleRedirect_(token) {
  if (!token) {
    return HtmlService.createHtmlOutput('<h1>Invalid shortlink</h1>');
  }

  // Use root tenant spreadsheet for shortlinks
  const rootTenant = findTenant_('root');
  if (!rootTenant || !rootTenant.store || !rootTenant.store.spreadsheetId) {
    return HtmlService.createHtmlOutput('<h1>Configuration error</h1>');
  }

  const spreadsheetId = rootTenant.store.spreadsheetId;
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

  const [tok, targetUrl, eventId, sponsorId, surface, createdAt] = row;

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

  // Use sanitized URL - escape it for HTML context
  const escapedUrl = String(targetUrl)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return HtmlService.createHtmlOutput(`
    <meta http-equiv="refresh" content="0;url=${escapedUrl}">
    <p>Redirecting to safe URL...</p>
  `);
}

// === Authentication & Authorization ========================================

/**
 * Multi-method authentication support:
 * 1. adminKey (legacy) - Simple secret key
 * 2. Bearer token (JWT) - Stateless token-based auth
 * 3. API Key (header) - X-API-Key header
 */
function authenticateRequest_(e, body, tenantId) {
  const tenant = findTenant_(tenantId);
  if (!tenant) {
    return Err(ERR.NOT_FOUND, 'Unknown tenant');
  }

  // Method 1: adminKey in body (legacy, backward compatible)
  const adminKey = body?.adminKey || e?.parameter?.adminKey || '';
  const tenantSecret = getAdminSecret_(tenant.id);
  if (adminKey && tenantSecret && adminKey === tenantSecret) {
    return Ok({ tenant, method: 'adminKey' });
  }

  // Method 2: Bearer token (JWT)
  const authHeader = e?.headers?.Authorization || e?.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtResult = verifyJWT_(token, tenant);
    if (jwtResult.ok) {
      return Ok({ tenant, method: 'jwt', claims: jwtResult.value });
    }
  }

  // Method 3: API Key in header
  const apiKey = e?.headers?.['X-API-Key'] || e?.headers?.['x-api-key'] || '';
  const tenantApiSecret = getAdminSecret_(tenant.id);
  if (apiKey && tenantApiSecret && apiKey === tenantApiSecret) {
    return Ok({ tenant, method: 'apiKey' });
  }

  // No valid authentication found
  return Err(ERR.BAD_INPUT, 'Invalid authentication credentials');
}

/**
 * Simple JWT verification (for demonstration)
 * In production, use a proper JWT library or Google's OAuth
 */
function verifyJWT_(token, tenant) {
  try {
    // Simple validation: decode base64 payload
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Err(ERR.BAD_INPUT, 'Invalid JWT format');
    }

    const payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(parts[1])).getDataAsString());

    // Verify tenant
    if (payload.tenant !== tenant.id) {
      return Err(ERR.BAD_INPUT, 'Token tenant mismatch');
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return Err(ERR.BAD_INPUT, 'Token expired');
    }

    // Verify signature (simplified - use proper crypto in production)
    const tenantSecret = getAdminSecret_(tenant.id);
    if (!tenantSecret) {
      return Err(ERR.INTERNAL, 'Tenant secret not configured');
    }
    const expectedSignature = generateJWTSignature_(parts[0] + '.' + parts[1], tenantSecret);
    if (parts[2] !== expectedSignature) {
      return Err(ERR.BAD_INPUT, 'Invalid token signature');
    }

    return Ok(payload);
  } catch (e) {
    return Err(ERR.BAD_INPUT, 'Invalid JWT: ' + e.message);
  }
}

/**
 * Generate JWT token for a tenant (for demo/testing)
 */
function api_generateToken(req) {
  const authCheck = gate_(req.tenantId, req.adminKey);
  if (!authCheck.ok) return authCheck;

  const tenant = authCheck.value.tenant;
  const expiresIn = req.expiresIn || 3600; // 1 hour default

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    tenant: tenant.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    scope: req.scope || 'events'
  };

  const headerB64 = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const tenantSecret = getAdminSecret_(tenant.id);
  if (!tenantSecret) {
    return Err(ERR.INTERNAL, 'Tenant secret not configured');
  }
  const signature = generateJWTSignature_(headerB64 + '.' + payloadB64, tenantSecret);

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

// === Guards / Helpers ======================================================
// Fixed: Bug #18 - Improved rate limiting with IP tracking and backoff
const RATE_MAX_PER_MIN = 10; // Reduced from 20
const RATE_LOCKOUT_MINS = 15;
const MAX_FAILED_AUTH = 5;

function gate_(tenantId, adminKey, ipAddress = null){
  const tenant=findTenant_(tenantId);
  if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

  const tenantSecret = getAdminSecret_(tenant.id);
  const cache = CacheService.getScriptCache();

  // Track failed authentication attempts per IP
  if (tenantSecret && adminKey !== tenantSecret) {
    if (ipAddress) {
      const failKey = `auth_fail:${tenantId}:${ipAddress}`;
      const fails = Number(cache.get(failKey) || '0');

      if (fails >= MAX_FAILED_AUTH) {
        return Err(ERR.RATE_LIMITED, `Too many failed authentication attempts. Try again in ${RATE_LOCKOUT_MINS} minutes.`);
      }

      cache.put(failKey, String(fails + 1), RATE_LOCKOUT_MINS * 60); // 15 min lockout
    }
    return Err(ERR.BAD_INPUT,'Invalid admin key');
  }

  // Rate limiting per tenant AND per IP (if available)
  const identifier = ipAddress ? `${tenantId}:${ipAddress}` : tenantId;
  const rateKey = `rate:${identifier}:${new Date().toISOString().slice(0,16)}`;
  const n = Number(cache.get(rateKey)||'0');
  if (n >= RATE_MAX_PER_MIN) return Err(ERR.RATE_LIMITED,'Too many requests. Please try again later.');
  cache.put(rateKey, String(n+1), 60);

  return Ok({tenant});
}

function assertScopeAllowed_(tenant, scope){
  const allowed = (tenant.scopesAllowed && tenant.scopesAllowed.length)
    ? tenant.scopesAllowed : ['events','leagues','tournaments'];
  if (!allowed.includes(scope)) return Err(ERR.BAD_INPUT, `Scope not enabled: ${scope}`);
  return Ok();
}

function isUrl(s) {
  try {
    const url = new URL(String(s));
    return ['http:', 'https:'].includes(url.protocol);
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

// Fixed: Bug #14 - Comprehensive input sanitization with context-aware escaping
function sanitizeInput_(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') return '';

  let sanitized = String(input)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();

  // Remove dangerous characters and patterns
  sanitized = sanitized
    .replace(/[<>"'`&]/g, '') // Remove HTML special chars and backticks
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/&#/g, '') // Remove HTML entity encoding
    .replace(/\\x/g, '') // Remove hex encoding
    .replace(/\\u/g, ''); // Remove unicode encoding

  return sanitized.slice(0, maxLength);
}

// Fixed: Bug #19 - Add ID format validation
function sanitizeId_(id) {
  if (!id || typeof id !== 'string') return null;
  // Ensure ID is valid UUID format or safe alphanumeric string
  if (!/^[a-zA-Z0-9-_]{1,100}$/.test(id)) return null;
  return id;
}

function getStoreSheet_(tenant, scope){
  const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
  const title = scope.toUpperCase();
  let sh = ss.getSheetByName(title);
  if (!sh){
    sh = ss.insertSheet(title);
    sh.appendRow(['id','tenantId','templateId','dataJSON','createdAt','slug']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _ensureAnalyticsSheet_(spreadsheetId){
  // If no spreadsheet ID provided, use root tenant
  if (!spreadsheetId) {
    const rootTenant = findTenant_('root');
    if (rootTenant && rootTenant.store && rootTenant.store.spreadsheetId) {
      spreadsheetId = rootTenant.store.spreadsheetId;
    }
  }

  const ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActive();

  let sh = ss.getSheetByName('ANALYTICS');
  if (!sh){
    sh = ss.insertSheet('ANALYTICS');
    sh.appendRow(['timestamp','eventId','surface','metric','sponsorId','value','token','userAgent']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _ensureShortlinksSheet_(spreadsheetId){
  // If no spreadsheet ID provided, use root tenant
  if (!spreadsheetId) {
    const rootTenant = findTenant_('root');
    if (rootTenant && rootTenant.store && rootTenant.store.spreadsheetId) {
      spreadsheetId = rootTenant.store.spreadsheetId;
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

function api_status(tenantId){
  return runSafe('api_status', () => {
    try {
      // Get tenant info if provided
      const tenant = tenantId ? findTenant_(tenantId) : findTenant_('root');
      if (!tenant) {
        return Err(ERR.NOT_FOUND, `Tenant not found: ${tenantId}`);
      }

      const tenantInfo = tenant.id;

      // Use tenant's spreadsheet ID instead of getActive() for web app context
      const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
      const id = ss.getId();
      const dbOk = !!id;

      return _ensureOk_('api_status', SC_STATUS, Ok({
        build: ZEB.BUILD_ID,
        contract: ZEB.CONTRACT_VER,
        tenant: tenantInfo,
        time: new Date().toISOString(),
        db: { ok: dbOk, id }
      }));
    } catch(e) {
      return Err(ERR.INTERNAL, `Status check failed: ${e.message}`);
    }
  });
}

function api_healthCheck(){
  return runSafe('api_healthCheck', () => {
    diag_('info','health','ping',{build:ZEB.BUILD_ID});
    return Ok({ checks:[{ ok:true, message:'alive' }] });
  });
}

function api_getConfig(arg){
  return runSafe('api_getConfig', () => {
    const tenants = loadTenants_().map(t => ({
      id:t.id, name:t.name, scopesAllowed:t.scopesAllowed||['events','leagues','tournaments']
    }));
    const value = { tenants, templates:TEMPLATES, build:ZEB.BUILD_ID };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (arg?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return { ok:true, etag, value };
  });
}

function api_list(payload){
  return runSafe('api_list', () => {
    const { tenantId, scope } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');
    const a=assertScopeAllowed_(tenant, scope); if(!a.ok) return a;

    const sh = getStoreSheet_(tenant, scope);
    // Fixed: Bug #24 - Check if sheet has more than just header before getRange
    const lastRow = sh.getLastRow();
    const rows = lastRow > 1
      ? sh.getRange(2, 1, lastRow - 1, 6).getValues()
          .filter(r => r[1]===tenantId)
          .map(r => ({ id:r[0], templateId:r[2], data:safeJSONParse_(r[3], {}), createdAt:r[4], slug:r[5] }))
      : [];
    const value = { items: rows };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_list', SC_LIST, { ok:true, etag, value });
  });
}

function api_get(payload){
  return runSafe('api_get', () => {
    const { tenantId, scope, id } = payload||{};

    // Fixed: Bug #19 - Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');
    const a=assertScopeAllowed_(tenant, scope); if(!a.ok) return a;
    const sh = getStoreSheet_(tenant, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===sanitizedId && row[1]===tenantId);
    if (!r) return Err(ERR.NOT_FOUND,'Not found');

    const base = ScriptApp.getService().getUrl();
    const value = {
      id:r[0], tenantId:r[1], templateId:r[2],
      data:safeJSONParse_(r[3], {}),
      createdAt:r[4], slug:r[5],
      links: {
        publicUrl: `${base}?p=events&tenant=${tenantId}&id=${r[0]}`,
        posterUrl: `${base}?page=poster&p=events&tenant=${tenantId}&id=${r[0]}`,
        displayUrl: `${base}?page=display&p=events&tenant=${tenantId}&id=${r[0]}&tv=1`,
        reportUrl: `${base}?page=report&tenant=${tenantId}&id=${r[0]}`
      }
    };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_get', SC_GET, { ok:true, etag, value });
  });
}

function api_create(payload){
  return runSafe('api_create', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, scope, templateId, data, adminKey, idemKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findTenant_(tenantId), scope); if(!a.ok) return a;
    const tpl = findTemplate_(templateId); if(!tpl) return Err(ERR.BAD_INPUT,'Unknown template');

    // Validate required + simple types
    for (const f of tpl.fields){
      const v = data?.[f.id];
      if (f.required && (v===undefined || v==='')) return Err(ERR.BAD_INPUT,`Missing field: ${f.id}`);
      if (v!=null && f.type==='url' && !isUrl(v)) return Err(ERR.BAD_INPUT,`Invalid URL: ${f.id}`);
    }

    // Idempotency (10m)
    if (idemKey){
      const c=CacheService.getScriptCache(), k=`idem:${tenantId}:${scope}:${idemKey}`;
      if (c.get(k)) return Err(ERR.BAD_INPUT,'Duplicate create');
      c.put(k,'1',600);
    }

    // Sanitize data inputs
    const sanitizedData = {};
    for (const f of tpl.fields) {
      const val = data?.[f.id];
      if (val !== undefined && val !== null) {
        sanitizedData[f.id] = (f.type === 'url') ? String(val) : sanitizeInput_(String(val));
      }
    }

    // Write row with collision-safe slug - Fixed: Bug #12 - Add LockService
    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope);
    const id = Utilities.getUuid();

    // Acquire lock for read-modify-write operation
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Wait up to 10 seconds

      let slug = String((sanitizedData?.name || id)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

      // Handle slug collisions - INSIDE lock
      const existingSlugs = sh.getDataRange().getValues().slice(1).map(r => r[5]);
      let counter = 2;
      let originalSlug = slug;
      while (existingSlugs.includes(slug)) {
        slug = `${originalSlug}-${counter}`;
        counter++;
      }

      sh.appendRow([id, tenantId, templateId, JSON.stringify(sanitizedData), new Date().toISOString(), slug]);

    } finally {
      lock.releaseLock();
    }

    const base = ScriptApp.getService().getUrl();
    const links = {
      publicUrl: `${base}?p=events&tenant=${tenantId}&id=${id}`,
      posterUrl: `${base}?page=poster&p=events&tenant=${tenantId}&id=${id}`,
      displayUrl: `${base}?page=display&p=events&tenant=${tenantId}&id=${id}&tv=1`,
      reportUrl: `${base}?page=report&tenant=${tenantId}&id=${id}`
    };
    diag_('info','api_create','created',{id,tenantId,scope});
    return Ok({ id, links });
  });
}

function api_updateEventData(req){
  return runSafe('api_updateEventData', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, scope, id, data, adminKey } = req;

    // Fixed: Bug #19 - Validate ID format
    const sanitizedId = sanitizeId_(id);
    if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findTenant_(tenantId), scope||'events'); if(!a.ok) return a;

    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope||'events');

    // Fixed: Bug #13 - Add LockService for read-modify-write operation
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Wait up to 10 seconds

      const rows = sh.getDataRange().getValues();
      const rowIdx = rows.findIndex((r, i) => i > 0 && r[0]===sanitizedId && r[1]===tenantId);

      if (rowIdx === -1) {
        lock.releaseLock();
        return Err(ERR.NOT_FOUND,'Event not found');
      }

      const existingData = safeJSONParse_(rows[rowIdx][3], {});
      const mergedData = Object.assign({}, existingData, data || {});

      sh.getRange(rowIdx + 1, 4).setValue(JSON.stringify(mergedData));

    } finally {
      lock.releaseLock();
    }

    diag_('info','api_updateEventData','updated',{id: sanitizedId,tenantId,scope,data});

    return api_get({ tenantId, scope: scope||'events', id: sanitizedId });
  });
}

function api_logEvents(req){
  return runSafe('api_logEvents', () => {
    const items = (req && req.items) || [];
    if (!items.length) return Ok({count:0});

    const sh = _ensureAnalyticsSheet_();
    const now = Date.now();
    const rows = items.map(it => [
      new Date(it.ts || now),
      String(it.eventId||''),
      String(it.surface||''),
      String(it.metric||''),
      String(it.sponsorId||''),
      Number(it.value||0),
      String(it.token||''),
      String(it.ua||'').slice(0, 200)
    ]);
    sh.getRange(sh.getLastRow()+1, 1, rows.length, 8).setValues(rows);

    diag_('info','api_logEvents','logged',{count: rows.length});
    return Ok({count: rows.length});
  });
}

function api_getReport(req){
  return runSafe('api_getReport', () => {
    const { tenantId, adminKey } = req || {};

    // Fixed: Add authentication check - Bug #6
    const g = gate_(tenantId || 'root', adminKey);
    if (!g.ok) return g;

    const eventId = String(req && req.id || '');
    if (!eventId) return Err(ERR.BAD_INPUT,'missing id');

    const sh = _ensureAnalyticsSheet_();
    const data = sh.getDataRange().getValues().slice(1)
      .filter(r => r[1] === eventId);

    const agg = {
      totals: { impressions:0, clicks:0, dwellSec:0 },
      bySurface: {},
      bySponsor: {},
      byToken: {}
    };

    for (const r of data){
      const surface = r[2], metric = r[3], sponsorId = r[4]||'-', value = Number(r[5]||0), token = r[6]||'-';

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

function api_exportReport(req){
  return runSafe('api_exportReport', () => {
    const eventId = String(req && req.id || '');
    if (!eventId) return Err(ERR.BAD_INPUT,'missing id');

    const rep = api_getReport({id:eventId});
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

function api_createShortlink(req){
  return runSafe('api_createShortlink', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { targetUrl, eventId, sponsorId, surface, adminKey, tenantId } = req;

    if (!targetUrl) return Err(ERR.BAD_INPUT,'Missing targetUrl');

    const g=gate_(tenantId||'root', adminKey); if(!g.ok) return g;

    const sh = _ensureShortlinksSheet_();

    // Fixed: Bug #25 - UUID split with validation
    const uuid = Utilities.getUuid();
    const parts = uuid.split('-');
    const token = parts.length > 0 ? parts[0] : uuid.substring(0, 8);

    sh.appendRow([
      token,
      targetUrl,
      eventId||'',
      sponsorId||'',
      surface||'',
      new Date().toISOString()
    ]);

    const base = ScriptApp.getService().getUrl();
    const shortlink = `${base}?p=r&t=${token}`;

    diag_('info','api_createShortlink','created',{token, targetUrl, eventId, sponsorId});
    return Ok({ token, shortlink, targetUrl });
  });
}

// === Google Forms Template Creation ===

function api_listFormTemplates(){
  return runSafe('api_listFormTemplates', () => {
    const templates = listFormTemplates_();
    return Ok({ templates });
  });
}

function api_createFormFromTemplate(req){
  return runSafe('api_createFormFromTemplate', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { templateType, eventName, eventId, adminKey, tenantId } = req;

    if (!templateType) return Err(ERR.BAD_INPUT,'Missing templateType');

    const g=gate_(tenantId||'root', adminKey); if(!g.ok) return g;

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

function api_generateFormShortlink(req){
  return runSafe('api_generateFormShortlink', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { formUrl, formType, eventId, adminKey, tenantId } = req;

    if (!formUrl) return Err(ERR.BAD_INPUT,'Missing formUrl');

    // Use existing shortlink API
    return api_createShortlink({
      targetUrl: formUrl,
      eventId: eventId || '',
      sponsorId: '',
      surface: `form-${formType || 'unknown'}`,
      adminKey,
      tenantId
    });
  });
}

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
        tenantId: 'root',
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
        tenantId: 'root',
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
        tenantId: 'root',
        adminKey: findTenant_('root').adminSecret,
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
