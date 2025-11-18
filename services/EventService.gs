/**
 * Event Service
 *
 * Centralizes all event-related operations:
 * - List events (with pagination)
 * - Get event by ID
 * - Create event (with validation, idempotency)
 * - Update event data
 * - Event slug generation and collision handling
 * - URL generation for event surfaces
 *
 * Design principles:
 * - Encapsulates data validation and business logic
 * - Uses LockService for atomic operations
 * - Provides pagination support
 * - Sanitizes all inputs
 * - Supports idempotency for create operations
 *
 * @module EventService
 */

// === List Operations ======================================================

/**
 * List events with pagination support
 *
 * @param {object} params - Query parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.scope - Scope (events, leagues, tournaments)
 * @param {number} [params.limit=100] - Page limit (max 1000)
 * @param {number} [params.offset=0] - Page offset
 * @param {string} [params.ifNoneMatch] - ETag for conditional request
 * @returns {object} Result envelope with paginated events
 */
function EventService_list(params) {
  const { tenantId, scope, limit, offset, ifNoneMatch } = params || {};

  const tenant = findTenant_(tenantId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const scopeCheck = SecurityMiddleware_assertScopeAllowed(tenant, scope);
  if (!scopeCheck.ok) return scopeCheck;

  // Pagination parameters (default: 100 items per page, max 1000)
  const pageLimit = Math.min(parseInt(limit) || 100, 1000);
  const pageOffset = Math.max(parseInt(offset) || 0, 0);

  const sh = getStoreSheet_(tenant, scope);
  const lastRow = sh.getLastRow();

  // Load and filter rows
  const allRows = lastRow > 1
    ? sh.getRange(2, 1, lastRow - 1, 6).getValues()
        .filter(r => r[1] === tenantId)
    : [];

  // Apply pagination after filtering
  const totalCount = allRows.length;
  const paginatedRows = allRows
    .slice(pageOffset, pageOffset + pageLimit)
    .map(r => ({
      id: r[0],
      templateId: r[2],
      data: safeJSONParse_(r[3], {}),
      createdAt: r[4],
      slug: r[5]
    }));

  const value = {
    items: paginatedRows,
    pagination: {
      total: totalCount,
      limit: pageLimit,
      offset: pageOffset,
      hasMore: (pageOffset + pageLimit) < totalCount
    }
  };

  // Generate ETag for cache validation
  const etag = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value))
  );

  if (ifNoneMatch === etag) {
    return { ok: true, notModified: true, etag };
  }

  return Ok({ etag, value });
}

// === Get Operations =======================================================

/**
 * Get event by ID with generated URLs
 *
 * @param {object} params - Query parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.scope - Scope
 * @param {string} params.id - Event ID
 * @param {string} [params.ifNoneMatch] - ETag for conditional request
 * @returns {object} Result envelope with event details
 */
function EventService_get(params) {
  const { tenantId, scope, id, ifNoneMatch } = params || {};

  // Validate ID format
  const sanitizedId = SecurityMiddleware_sanitizeId(id);
  if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

  const tenant = findTenant_(tenantId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const scopeCheck = SecurityMiddleware_assertScopeAllowed(tenant, scope);
  if (!scopeCheck.ok) return scopeCheck;

  const sh = getStoreSheet_(tenant, scope);
  const r = sh.getDataRange().getValues().slice(1)
    .find(row => row[0] === sanitizedId && row[1] === tenantId);

  if (!r) return Err(ERR.NOT_FOUND, 'Not found');

  const base = ScriptApp.getService().getUrl();
  const value = {
    id: r[0],
    tenantId: r[1],
    templateId: r[2],
    data: safeJSONParse_(r[3], {}),
    createdAt: r[4],
    slug: r[5],
    links: EventService_generateUrls(base, tenantId, r[0], scope)
  };

  const etag = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value))
  );

  if (ifNoneMatch === etag) {
    return { ok: true, notModified: true, etag };
  }

  return Ok({ etag, value });
}

// === Create Operations ====================================================

/**
 * Create new event with validation and idempotency
 *
 * @param {object} params - Create parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.scope - Scope
 * @param {string} params.templateId - Template ID
 * @param {object} params.data - Event data
 * @param {string} [params.idemKey] - Idempotency key
 * @returns {object} Result envelope with created event details
 */
function EventService_create(params) {
  if (!params || typeof params !== 'object') {
    return Err(ERR.BAD_INPUT, 'Missing payload');
  }

  const { tenantId, scope, templateId, data, idemKey } = params;

  const tenant = findTenant_(tenantId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const scopeCheck = SecurityMiddleware_assertScopeAllowed(tenant, scope);
  if (!scopeCheck.ok) return scopeCheck;

  const tpl = findTemplate_(templateId);
  if (!tpl) return Err(ERR.BAD_INPUT, 'Unknown template');

  // Validate required fields and types
  const validationResult = EventService_validateData(data, tpl);
  if (!validationResult.ok) return validationResult;

  // Handle idempotency (24 hours)
  if (idemKey) {
    const idemResult = EventService_checkIdempotency(tenantId, scope, idemKey);
    if (!idemResult.ok) return idemResult;
  }

  // Sanitize data inputs
  const sanitizedData = EventService_sanitizeData(data, tpl);

  // Create event with collision-safe slug (atomic operation)
  const createResult = EventService_persistEvent(tenant, scope, templateId, sanitizedData);
  if (!createResult.ok) return createResult;

  const { id } = createResult.value;
  const base = ScriptApp.getService().getUrl();
  const links = EventService_generateUrls(base, tenantId, id, scope);

  diag_('info', 'EventService_create', 'created', { id, tenantId, scope });

  return Ok({ id, links });
}

// === Update Operations ====================================================

/**
 * Update event data
 *
 * @param {object} params - Update parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.scope - Scope
 * @param {string} params.id - Event ID
 * @param {object} params.data - Updated data
 * @returns {object} Result envelope with updated event
 */
function EventService_update(params) {
  if (!params || typeof params !== 'object') {
    return Err(ERR.BAD_INPUT, 'Missing payload');
  }

  const { tenantId, scope, id, data } = params;

  // Validate ID format
  const sanitizedId = SecurityMiddleware_sanitizeId(id);
  if (!sanitizedId) return Err(ERR.BAD_INPUT, 'Invalid ID format');

  const tenant = findTenant_(tenantId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const scopeCheck = SecurityMiddleware_assertScopeAllowed(tenant, scope || 'events');
  if (!scopeCheck.ok) return scopeCheck;

  const sh = getStoreSheet_(tenant, scope || 'events');

  // Use LockService for atomic read-modify-write
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const rows = sh.getDataRange().getValues();
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === sanitizedId && r[1] === tenantId);

    if (rowIdx === -1) {
      lock.releaseLock();
      return Err(ERR.NOT_FOUND, 'Event not found');
    }

    const existingData = safeJSONParse_(rows[rowIdx][3], {});
    const templateId = rows[rowIdx][2];
    const tpl = findTemplate_(templateId);

    if (!tpl) {
      lock.releaseLock();
      return Err(ERR.INTERNAL, 'Template not found');
    }

    // Merge and validate data
    const mergedData = { ...existingData, ...data };
    const validationResult = EventService_validateData(mergedData, tpl);
    if (!validationResult.ok) {
      lock.releaseLock();
      return validationResult;
    }

    // Sanitize updated data
    const sanitizedData = EventService_sanitizeData(mergedData, tpl);

    // Update row (rowIdx is 0-based, but sheet is 1-based, and we have header)
    const sheetRow = rowIdx + 1;
    sh.getRange(sheetRow, 4).setValue(JSON.stringify(sanitizedData));

    lock.releaseLock();

    diag_('info', 'EventService_update', 'updated', { id: sanitizedId, tenantId, scope });

    return Ok({ id: sanitizedId, data: sanitizedData });
  } catch (e) {
    try { lock.releaseLock(); } catch (err) { }
    return UserFriendlyErr_(ERR.INTERNAL, 'Update failed', { error: e.message }, 'EventService_update');
  }
}

// === Helper Functions =====================================================

/**
 * Validate event data against template
 *
 * @param {object} data - Event data
 * @param {object} template - Template definition
 * @returns {object} Result envelope (Ok/Err)
 */
function EventService_validateData(data, template) {
  for (const field of template.fields) {
    const value = data?.[field.id];

    // Check required fields
    if (field.required && (value === undefined || value === '')) {
      return Err(ERR.BAD_INPUT, `Missing field: ${field.id}`);
    }

    // Validate URL fields
    if (value != null && field.type === 'url' && !isUrl(value)) {
      return Err(ERR.BAD_INPUT, `Invalid URL: ${field.id}`);
    }
  }

  return Ok();
}

/**
 * Sanitize event data based on template
 *
 * @param {object} data - Event data
 * @param {object} template - Template definition
 * @returns {object} Sanitized data
 */
function EventService_sanitizeData(data, template) {
  const sanitized = {};

  for (const field of template.fields) {
    const val = data?.[field.id];
    if (val !== undefined && val !== null) {
      sanitized[field.id] = (field.type === 'url')
        ? String(val)
        : SecurityMiddleware_sanitizeInput(String(val));
    }
  }

  return sanitized;
}

/**
 * Check idempotency key
 *
 * @param {string} tenantId - Tenant ID
 * @param {string} scope - Scope
 * @param {string} idemKey - Idempotency key
 * @returns {object} Result envelope (Ok/Err)
 */
function EventService_checkIdempotency(tenantId, scope, idemKey) {
  // Validate idemKey format
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(idemKey)) {
    return Err(ERR.BAD_INPUT, 'Invalid idempotency key format');
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    const cache = CacheService.getScriptCache();
    const key = `idem:${tenantId}:${scope}:${idemKey}`;

    if (cache.get(key)) {
      lock.releaseLock();
      return Err(ERR.BAD_INPUT, 'Duplicate create');
    }

    cache.put(key, JSON.stringify({ timestamp: Date.now(), status: 'processing' }), 86400);
    lock.releaseLock();

    return Ok();
  } catch (e) {
    try { lock.releaseLock(); } catch (err) { }
    return UserFriendlyErr_(ERR.INTERNAL, 'Idempotency check failed',
      { error: e.message }, 'EventService_checkIdempotency');
  }
}

/**
 * Persist event to spreadsheet with collision-safe slug
 *
 * @param {object} tenant - Tenant configuration
 * @param {string} scope - Scope
 * @param {string} templateId - Template ID
 * @param {object} data - Sanitized event data
 * @returns {object} Result envelope with event ID
 */
function EventService_persistEvent(tenant, scope, templateId, data) {
  const sh = getStoreSheet_(tenant, scope);
  const id = Utilities.getUuid();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // Generate slug from name or ID
    let slug = String((data?.name || id))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Handle slug collisions (atomic check)
    const existingSlugs = sh.getDataRange().getValues().slice(1).map(r => r[5]);
    let counter = 2;
    let originalSlug = slug;
    while (existingSlugs.includes(slug)) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }

    sh.appendRow([
      id,
      tenant.id,
      templateId,
      JSON.stringify(data),
      new Date().toISOString(),
      slug
    ]);

    lock.releaseLock();

    return Ok({ id, slug });
  } catch (e) {
    try { lock.releaseLock(); } catch (err) { }
    return UserFriendlyErr_(ERR.INTERNAL, 'Event creation failed',
      { error: e.message }, 'EventService_persistEvent');
  }
}

/**
 * Generate URLs for event surfaces
 *
 * @param {string} baseUrl - Base service URL
 * @param {string} tenantId - Tenant ID
 * @param {string} eventId - Event ID
 * @param {string} scope - Scope
 * @returns {object} URLs for public, poster, display, report
 */
function EventService_generateUrls(baseUrl, tenantId, eventId, scope) {
  return {
    publicUrl: `${baseUrl}?p=${scope}&tenant=${tenantId}&id=${eventId}`,
    posterUrl: `${baseUrl}?page=poster&p=${scope}&tenant=${tenantId}&id=${eventId}`,
    displayUrl: `${baseUrl}?page=display&p=${scope}&tenant=${tenantId}&id=${eventId}&tv=1`,
    reportUrl: `${baseUrl}?page=report&tenant=${tenantId}&id=${eventId}`
  };
}
