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

function _ensureOk_(label, schema, obj) {
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

function diag_(level, where, msg, meta){
  try{
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(DIAG_SHEET);
    if(!sh){
      sh = ss.insertSheet(DIAG_SHEET);
      sh.appendRow(['ts','level','where','msg','meta']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date().toISOString(), level, where, msg, meta ? JSON.stringify(meta) : '']);

    // Hard cap cleanup
    const last = sh.getLastRow();
    if(last > DIAG_MAX){
      sh.deleteRows(2, Math.min(last - DIAG_MAX, last - 1));
    }

    // Lazy daily cleanup - only run periodically to avoid performance hit
    const shouldCleanup = (Math.random() < 0.1); // 10% chance on each log
    if(shouldCleanup && last > DIAG_PER_DAY){
      const today = (new Date()).toISOString().slice(0,10);
      const ts = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 1).getValues().flat();
      const idx = ts.map((t, i) => String(t).startsWith(today) ? i + 2 : null).filter(Boolean);
      if(idx.length > DIAG_PER_DAY){
        sh.deleteRows(idx[0], Math.min(idx.length - DIAG_PER_DAY, idx.length));
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

// === Router ================================================================
function doGet(e){
  const pageParam = (e?.parameter?.page || e?.parameter?.p || '').toString();
  const hostHeader = (e?.headers?.host || e?.parameter?.host || '').toString();
  const tenant = findTenantByHost_(hostHeader) || findTenant_('root');

  // Shortlink redirect route
  if (pageParam === 'r' || pageParam === 'redirect') {
    const token = (e?.parameter?.t || e?.parameter?.token || '').toString();
    return handleRedirect_(token);
  }

  // Status endpoint
  if (pageParam === 'status') {
    const status = api_status();
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

  const page = (pageParam==='admin' || pageParam==='poster' || pageParam==='test' || pageParam==='display') ? pageParam : 'public';
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

function pageFile_(page){
  if (page==='admin') return 'Admin';
  if (page==='poster') return 'Poster';
  if (page==='test') return 'Test';
  if (page==='display') return 'Display';
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

  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('SHORTLINKS');
  if (!sh) {
    return HtmlService.createHtmlOutput('<h1>Shortlink not found</h1>');
  }

  const rows = sh.getDataRange().getValues().slice(1);
  const row = rows.find(r => r[0] === token);

  if (!row) {
    diag_('warn', 'handleRedirect_', 'Token not found', {token});
    return HtmlService.createHtmlOutput('<h1>Shortlink not found</h1>');
  }

  const [tok, targetUrl, eventId, sponsorId, surface, createdAt] = row;

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
    diag_('warn', 'handleRedirect_', 'Analytics log failed', {error: String(e)});
  }

  diag_('info', 'handleRedirect_', 'Redirect', {token, targetUrl, eventId, sponsorId});

  return HtmlService.createHtmlOutput(`
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <p>Redirecting...</p>
  `);
}

// === Guards / Helpers ======================================================
const RATE_MAX_PER_MIN=20;

function gate_(tenantId, adminKey){
  const tenant=findTenant_(tenantId);
  if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');
  if (tenant.adminSecret && adminKey !== tenant.adminSecret)
    return Err(ERR.BAD_INPUT,'Invalid admin key');

  // Rate limiting per tenant per minute
  const cache=CacheService.getScriptCache();
  const key=`rate:${tenantId}:${new Date().toISOString().slice(0,16)}`;
  const n = Number(cache.get(key)||'0');
  if (n>=RATE_MAX_PER_MIN) return Err(ERR.RATE_LIMITED,'Too many requests');
  cache.put(key,String(n+1),60);
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

function sanitizeInput_(input) {
  if (!input || typeof input !== 'string') return '';
  return String(input)
    .replace(/[<>\"']/g, '')
    .trim()
    .slice(0, 1000);
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

function _ensureAnalyticsSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('ANALYTICS');
  if (!sh){
    sh = ss.insertSheet('ANALYTICS');
    sh.appendRow(['timestamp','eventId','surface','metric','sponsorId','value','token','userAgent']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _ensureShortlinksSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('SHORTLINKS');
  if (!sh){
    sh = ss.insertSheet('SHORTLINKS');
    sh.appendRow(['token','targetUrl','eventId','sponsorId','surface','createdAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

// === APIs (uniform envelopes + SWR) =======================================

function api_status(){
  return runSafe('api_status', () => {
    try {
      const ss = SpreadsheetApp.getActive();
      const id = ss.getId();
      const dbOk = !!id;

      return _ensureOk_('api_status', SC_STATUS, Ok({
        build: ZEB.BUILD_ID,
        contract: ZEB.CONTRACT_VER,
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
    const rows = sh.getRange(2,1,Math.max(0, sh.getLastRow()-1),6).getValues()
      .filter(r => r[1]===tenantId)
      .map(r => ({ id:r[0], templateId:r[2], data:JSON.parse(r[3]||'{}'), createdAt:r[4], slug:r[5] }));
    const value = { items: rows };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return _ensureOk_('api_list', SC_LIST, { ok:true, etag, value });
  });
}

function api_get(payload){
  return runSafe('api_get', () => {
    const { tenantId, scope, id } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');
    const a=assertScopeAllowed_(tenant, scope); if(!a.ok) return a;
    const sh = getStoreSheet_(tenant, scope);
    const r = sh.getDataRange().getValues().slice(1).find(row => row[0]===id && row[1]===tenantId);
    if (!r) return Err(ERR.NOT_FOUND,'Not found');

    const base = ScriptApp.getService().getUrl();
    const value = {
      id:r[0], tenantId:r[1], templateId:r[2],
      data:JSON.parse(r[3]||'{}'),
      createdAt:r[4], slug:r[5],
      links: {
        publicUrl: `${base}?p=events&tenant=${tenantId}&id=${r[0]}`,
        posterUrl: `${base}?page=poster&p=events&tenant=${tenantId}&id=${r[0]}`,
        displayUrl: `${base}?page=display&p=events&tenant=${tenantId}&id=${r[0]}&tv=1`
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

    // Write row with collision-safe slug
    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope);
    const id = Utilities.getUuid();
    let slug = String((sanitizedData?.name || id)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    // Handle slug collisions
    const existingSlugs = sh.getDataRange().getValues().slice(1).map(r => r[5]);
    let counter = 2;
    let originalSlug = slug;
    while (existingSlugs.includes(slug)) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }

    sh.appendRow([id, tenantId, templateId, JSON.stringify(sanitizedData), new Date().toISOString(), slug]);

    const base = ScriptApp.getService().getUrl();
    const links = {
      publicUrl: `${base}?p=events&tenant=${tenantId}&id=${id}`,
      posterUrl: `${base}?page=poster&p=events&tenant=${tenantId}&id=${id}`,
      displayUrl: `${base}?page=display&p=events&tenant=${tenantId}&id=${id}&tv=1`
    };
    diag_('info','api_create','created',{id,tenantId,scope});
    return Ok({ id, links });
  });
}

function api_updateEventData(req){
  return runSafe('api_updateEventData', () => {
    if(!req||typeof req!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, scope, id, data, adminKey } = req;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findTenant_(tenantId), scope||'events'); if(!a.ok) return a;

    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope||'events');
    const rows = sh.getDataRange().getValues();
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0]===id && r[1]===tenantId);

    if (rowIdx === -1) return Err(ERR.NOT_FOUND,'Event not found');

    const existingData = JSON.parse(rows[rowIdx][3] || '{}');
    const mergedData = Object.assign({}, existingData, data || {});

    sh.getRange(rowIdx + 1, 4).setValue(JSON.stringify(mergedData));

    diag_('info','api_updateEventData','updated',{id,tenantId,scope,data});

    return api_get({ tenantId, scope: scope||'events', id });
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

      const surf = (agg.bySurface[surface] ||= {impressions:0, clicks:0, dwellSec:0});
      const spons = (agg.bySponsor[sponsorId] ||= {impressions:0, clicks:0, dwellSec:0});
      const tok = (agg.byToken[token] ||= {impressions:0, clicks:0, dwellSec:0});

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
    const token = Utilities.getUuid().split('-')[0]; // Short 8-char token

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

function api_runDiagnostics(){
  return runSafe('api_runDiagnostics', () => {
    const steps = [];
    let eventId = null;
    let sheetUrl = null;

    try {
      // 1. Status check
      const st = api_status();
      steps.push({ name: 'status', ok: st.ok, error: st.ok ? null : st.message });
      if (!st.ok) return Ok({ steps, ok: false });

      // 2. Create temp event
      const create = api_create({
        tenantId: 'root',
        scope: 'events',
        templateId: 'event',
        adminKey: findTenant_('root').adminSecret,
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
        adminKey: findTenant_('root').adminSecret,
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
