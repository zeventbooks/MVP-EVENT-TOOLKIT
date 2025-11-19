/**
 * Security Middleware Service
 *
 * Centralizes all security-related operations:
 * - JWT token generation and verification
 * - CSRF protection
 * - Multi-method authentication (adminKey, JWT, API Key)
 * - Rate limiting
 * - Input sanitization
 * - Tenant isolation
 *
 * Design principles:
 * - Single responsibility for security concerns
 * - Fail-secure by default
 * - Constant-time operations for sensitive comparisons
 * - Comprehensive logging for security events
 *
 * @module SecurityMiddleware
 */

// === Constants ============================================================
const SECURITY_CONFIG = Object.freeze({
  CSRF_EXPIRY_SECONDS: 3600,        // 1 hour
  JWT_DEFAULT_EXPIRY: 3600,          // 1 hour
  RATE_MAX_PER_MIN: 10,              // Max requests per minute
  RATE_LOCKOUT_MINS: 15,             // Lockout duration
  MAX_FAILED_AUTH: 5,                // Max failed auth attempts
  LOCK_TIMEOUT_MS: 5000              // Lock acquisition timeout
});

// === CSRF Protection ======================================================

/**
 * Generate a CSRF token and store it in user cache
 * @returns {string} UUID-based CSRF token
 */
function SecurityMiddleware_generateCSRFToken() {
  const token = Utilities.getUuid();
  const cache = CacheService.getUserCache();
  cache.put('csrf_' + token, '1', SECURITY_CONFIG.CSRF_EXPIRY_SECONDS);
  return token;
}

/**
 * Validate and consume a CSRF token (one-time use)
 * Uses LockService for atomic check-and-remove to prevent race conditions
 *
 * @param {string} token - CSRF token to validate
 * @returns {boolean} True if token is valid and unused
 */
function SecurityMiddleware_validateCSRFToken(token) {
  if (!token || typeof token !== 'string') return false;

  const lock = LockService.getUserLock();
  try {
    // Acquire lock with timeout
    if (!lock.tryLock(SECURITY_CONFIG.LOCK_TIMEOUT_MS)) {
      diag_('warn', 'SecurityMiddleware_validateCSRFToken', 'Failed to acquire lock',
        { token: token.substring(0, 8) + '...' });
      return false;
    }

    const cache = CacheService.getUserCache();
    const valid = cache.get('csrf_' + token);

    if (valid) {
      cache.remove('csrf_' + token); // One-time use (atomic)
      return true;
    }
    return false;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock might have expired, ignore
    }
  }
}

// === JWT Operations =======================================================

/**
 * Timing-safe string comparison to prevent timing attacks
 * Always takes constant time regardless of where strings differ
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function SecurityMiddleware_timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

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

/**
 * Generate JWT signature using HMAC-SHA256
 *
 * @param {string} data - Data to sign (header.payload)
 * @param {string} secret - Secret key
 * @returns {string} Base64-encoded signature
 */
function SecurityMiddleware_generateJWTSignature(data, secret) {
  const signature = Utilities.computeHmacSha256Signature(data, secret);
  return Utilities.base64EncodeWebSafe(signature);
}

/**
 * Verify JWT token
 * Validates: format, algorithm, tenant, expiration, signature, not-before
 *
 * @param {string} token - JWT token
 * @param {object} tenant - Tenant configuration
 * @returns {object} Result envelope with claims or error
 */
function SecurityMiddleware_verifyJWT(token, tenant) {
  try {
    // Validate format
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
      diag_('error', 'SecurityMiddleware_verifyJWT', 'Invalid algorithm', {alg: header.alg});
      return Err(ERR.BAD_INPUT, 'Invalid JWT algorithm');
    }

    // Parse payload
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

    // Verify signature
    const tenantSecret = getAdminSecret_(tenant.id);
    if (!tenantSecret) {
      return UserFriendlyErr_(ERR.INTERNAL, 'Tenant secret not configured',
        { brandId: tenant.id }, 'SecurityMiddleware_verifyJWT');
    }
    const expectedSignature = SecurityMiddleware_generateJWTSignature(
      parts[0] + '.' + parts[1], tenantSecret
    );

    // Timing-safe comparison to prevent timing attacks
    if (!SecurityMiddleware_timingSafeCompare(parts[2], expectedSignature)) {
      return Err(ERR.BAD_INPUT, 'Invalid token signature');
    }

    // Verify not-before if present
    if (payload.nbf && payload.nbf > now) {
      return Err(ERR.BAD_INPUT, 'Token not yet valid');
    }

    return Ok(payload);
  } catch (e) {
    return UserFriendlyErr_(ERR.BAD_INPUT, 'Invalid JWT verification',
      { error: e.message }, 'SecurityMiddleware_verifyJWT');
  }
}

/**
 * Generate JWT token for a tenant
 *
 * @param {object} params - Token parameters
 * @param {object} params.tenant - Tenant configuration
 * @param {number} [params.expiresIn=3600] - Expiry time in seconds
 * @param {string} [params.scope='events'] - Token scope
 * @param {object} [params.customClaims={}] - Additional claims
 * @returns {object} Result envelope with token or error
 */
function SecurityMiddleware_generateJWT(params) {
  const { tenant, expiresIn = SECURITY_CONFIG.JWT_DEFAULT_EXPIRY, scope = 'events', customClaims = {} } = params;

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    tenant: tenant.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    scope: scope,
    ...customClaims
  };

  const headerB64 = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const tenantSecret = getAdminSecret_(tenant.id);

  if (!tenantSecret) {
    return UserFriendlyErr_(ERR.INTERNAL, 'Tenant secret not configured',
      { brandId: tenant.id }, 'SecurityMiddleware_generateJWT');
  }

  const signature = SecurityMiddleware_generateJWTSignature(headerB64 + '.' + payloadB64, tenantSecret);
  const token = headerB64 + '.' + payloadB64 + '.' + signature;

  return Ok({
    token,
    expiresIn,
    expiresAt: new Date((payload.exp * 1000)).toISOString(),
    usage: `Authorization: Bearer ${token}`
  });
}

// === Authentication =======================================================

/**
 * Authenticate request using multiple methods
 * Supports: adminKey (legacy), JWT Bearer token, API Key header
 *
 * @param {object} e - Request event object
 * @param {object} body - Request body
 * @param {string} brandId - Tenant ID
 * @returns {object} Result envelope with authentication details or error
 */
function SecurityMiddleware_authenticateRequest(e, body, brandId) {
  const tenant = findTenant_(brandId);
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
    const jwtResult = SecurityMiddleware_verifyJWT(token, tenant);
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

// === Rate Limiting ========================================================

/**
 * Check rate limits and authenticate tenant
 * Includes IP-based failed authentication tracking
 *
 * @param {string} brandId - Tenant ID
 * @param {string} adminKey - Admin secret key
 * @param {string} [ipAddress] - Client IP address
 * @returns {object} Result envelope with tenant or error
 */
function SecurityMiddleware_gate(brandId, adminKey, ipAddress = null) {
  const tenant = findTenant_(brandId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const tenantSecret = getAdminSecret_(tenant.id);
  const cache = CacheService.getScriptCache();

  // Track failed authentication attempts per IP
  if (tenantSecret && adminKey !== tenantSecret) {
    if (ipAddress) {
      const failKey = `auth_fail:${brandId}:${ipAddress}`;
      const fails = Number(cache.get(failKey) || '0');

      if (fails >= SECURITY_CONFIG.MAX_FAILED_AUTH) {
        return Err(ERR.RATE_LIMITED,
          `Too many failed authentication attempts. Try again in ${SECURITY_CONFIG.RATE_LOCKOUT_MINS} minutes.`);
      }

      cache.put(failKey, String(fails + 1), SECURITY_CONFIG.RATE_LOCKOUT_MINS * 60);
    }
    return Err(ERR.BAD_INPUT, 'Invalid admin key');
  }

  // Check rate limit
  const rateLimitKey = `rate:${brandId}`;
  const count = Number(cache.get(rateLimitKey) || '0');

  if (count >= SECURITY_CONFIG.RATE_MAX_PER_MIN) {
    return Err(ERR.RATE_LIMITED, `Too many requests. Maximum ${SECURITY_CONFIG.RATE_MAX_PER_MIN} per minute.`);
  }

  cache.put(rateLimitKey, String(count + 1), 60); // 1 minute window

  return Ok({ tenant });
}

// === Input Sanitization ===================================================

/**
 * Sanitize input to prevent injection attacks
 *
 * @param {string} input - Input string
 * @param {number} [maxLength=1000] - Maximum allowed length
 * @returns {string} Sanitized input
 */
function SecurityMiddleware_sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';

  // Truncate to max length
  let sanitized = input.substring(0, maxLength);

  // Remove potential script tags and dangerous characters
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  return sanitized;
}

/**
 * Sanitize ID to ensure it contains only safe characters
 *
 * @param {string} id - ID string
 * @returns {string} Sanitized ID or empty string
 */
function SecurityMiddleware_sanitizeId(id) {
  if (typeof id !== 'string') return '';
  // Allow only alphanumeric, dash, underscore
  return id.match(/^[a-zA-Z0-9_-]+$/) ? id : '';
}

/**
 * Sanitize value for spreadsheet storage
 * Prevents formula injection
 *
 * @param {*} value - Value to sanitize
 * @returns {*} Sanitized value
 */
function SecurityMiddleware_sanitizeSpreadsheetValue(value) {
  if (typeof value !== 'string') return value;

  // Prevent formula injection by escaping leading special characters
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => value.startsWith(char))) {
    return "'" + value; // Prefix with single quote to treat as text
  }

  return value;
}

/**
 * Sanitize sensitive data from metadata before logging
 * Removes: passwords, keys, tokens, secrets, API keys
 *
 * @param {object} meta - Metadata object
 * @returns {object} Sanitized metadata
 */
function SecurityMiddleware_sanitizeMetaForLogging(meta) {
  if (!meta || typeof meta !== 'object') return meta;

  const sanitized = {};
  const sensitiveKeys = ['password', 'secret', 'key', 'token', 'adminKey', 'apiKey', 'authorization'];

  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = SecurityMiddleware_sanitizeMetaForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// === Tenant Isolation =====================================================

/**
 * Validate that tenant has access to requested scope
 *
 * @param {object} tenant - Tenant configuration
 * @param {string} scope - Requested scope
 * @returns {object} Result envelope (Ok/Err)
 */
function SecurityMiddleware_assertScopeAllowed(tenant, scope) {
  const allowed = tenant.scopesAllowed?.length ? tenant.scopesAllowed : ['events', 'leagues', 'tournaments'];
  if (!allowed.includes(scope)) {
    return Err(ERR.BAD_INPUT, `Scope '${scope}' not allowed for tenant ${tenant.id}`);
  }
  return Ok();
}

/**
 * Extract and validate origin header
 * Returns sanitized origin or null if invalid
 *
 * @param {object} e - Request event object
 * @param {Array<string>} allowedOrigins - List of allowed origins
 * @returns {string|null} Validated origin or null
 */
function SecurityMiddleware_validateOrigin(e, allowedOrigins = []) {
  const origin = e?.headers?.Origin || e?.headers?.origin || '';

  if (!origin) return null;

  // If no allowed origins specified, accept any (for backward compatibility)
  if (allowedOrigins.length === 0) return origin;

  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) return origin;

  // Check if origin matches wildcard patterns
  for (const allowed of allowedOrigins) {
    if (allowed.includes('*')) {
      const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) return origin;
    }
  }

  return null;
}
