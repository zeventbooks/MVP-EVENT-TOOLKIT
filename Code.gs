// === Constants / Envelopes / Errors =======================================
const ERR = Object.freeze({
  BAD_INPUT:   'BAD_INPUT',
  NOT_FOUND:   'NOT_FOUND',
  RATE_LIMITED:'RATE_LIMITED',
  INTERNAL:    'INTERNAL'
});
const Ok  = (value={}) => ({ ok:true,  value });
const Err = (code, message) => ({ ok:false, code, message: message||code });

// === Logger (append-only with caps) =======================================
const DIAG_SHEET='DIAG', DIAG_MAX=3000, DIAG_PER_DAY=800;
function diag_(level, where, msg, meta){
  try{
    const ss=SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
    let sh=ss.getSheetByName(DIAG_SHEET); if(!sh){ sh=ss.insertSheet(DIAG_SHEET); sh.appendRow(['ts','level','where','msg','meta']); }
    sh.appendRow([new Date().toISOString(), level, where, msg, meta?JSON.stringify(meta):'' ]);
    // hard cap
    const last=sh.getLastRow(); if(last>DIAG_MAX){ sh.deleteRows(2, last-DIAG_MAX); }
    // soft per-day cap
    const today=(new Date()).toISOString().slice(0,10);
    const ts=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),1).getValues().flat();
    const idx=ts.map((t,i)=>String(t).startsWith(today)?i+2:null).filter(Boolean);
    if(idx.length>DIAG_PER_DAY){ sh.deleteRows(idx[0], idx.length-DIAG_PER_DAY); }
  }catch(_){}
}
function runSafe(where, fn){
  try{ return fn(); }
  catch(e){ diag_('error',where,'Exception',{err:String(e),stack:e&&e.stack}); return Err(ERR.INTERNAL,'Unexpected error'); }
}

// === Router ================================================================
function doGet(e){
  const pageParam = (e?.parameter?.page || '').toString();
  const pParam = (e?.parameter?.p || '').toString();
  const hostHeader = (e?.headers?.host || e?.parameter?.host || '').toString();
  const tenant = findTenantByHost_(hostHeader) || findTenant_('root');

  // Handle special routes
  if (pParam === 'r') { // Redirect route
    const token = (e?.parameter?.t || '').toString();
    return handleRedirect_(token);
  }
  if (pParam === 'status') { // Status API endpoint
    const res = api_status();
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  }

  const path = (e?.pathInfo || '').toString().replace(/^\/+|\/+$/g,''); // future proxy support
  const scope = pParam || 'events'; // MVP default

  // Check if scope is enabled globally
  if (!isScopeEnabled_(scope)){
    const first = getActiveScopes_()[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&tenant=${tenant.id}">`);
  }

  // Check if tenant allows scope
  const allowed = tenant.scopesAllowed?.length ? tenant.scopesAllowed : ['events','leagues','tournaments'];
  if (!allowed.includes(scope)){
    const first = allowed[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&tenant=${tenant.id}">`);
  }

  const page = pageFile_(pageParam || pParam || 'public');
  const tpl = HtmlService.createTemplateFromFile(page);
  tpl.appTitle = `${tenant.name} · ${scope}`;
  tpl.tenantId = tenant.id;
  tpl.scope = scope;
  tpl.execUrl = ScriptApp.getService().getUrl();
  tpl.BUILD_ID = ZEB.BUILD_ID;
  tpl.FEATURES = FEATURES;
  return tpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function pageFile_(page){
  if (page==='admin') return 'Admin';
  if (page==='config') return 'Config';
  if (page==='diagnostics') return 'Diagnostics';
  if (page==='poster') return 'Poster';
  if (page==='display') return 'Display';
  if (page==='test')   return 'Test';
  return 'Public';
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// === Guards / Helpers ======================================================
const RATE_MAX_PER_MIN=10;
function gate_(tenantId, adminKey){
  const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');
  if (tenant.adminSecret && adminKey !== tenant.adminSecret) return Err(ERR.BAD_INPUT,'Invalid admin key');
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
function isUrl(s){ try{ new URL(String(s)); return true; }catch(_){ return false; } }

function getStoreSheet_(tenant, scope){
  const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
  const title = scope.toUpperCase(); // EVENTS
  let sh = ss.getSheetByName(title);
  if (!sh){ sh = ss.insertSheet(title); sh.appendRow(['id','tenantId','templateId','dataJSON','createdAt','slug']); }
  return sh;
}

// === APIs (uniform envelopes + SWR) =======================================
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
    return { ok:true, etag, value };
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
    const value = { id:r[0], tenantId:r[1], templateId:r[2], data:JSON.parse(r[3]||'{}'), createdAt:r[4], slug:r[5],
      links: {
        publicUrl: `${ScriptApp.getService().getUrl()}?p=events&tenant=${tenantId}&id=${r[0]}`,
        posterUrl: `${ScriptApp.getService().getUrl()}?page=poster&p=events&tenant=${tenantId}&id=${r[0]}`
      }
    };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok:true, notModified:true, etag };
    return { ok:true, etag, value };
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
      if (c.get(k)) return Err(ERR.BAD_INPUT,'Duplicate create'); c.put(k,'1',600);
    }

    // Write row
    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope);
    const id = Utilities.getUuid();
    const slug = String((data?.name || id)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    sh.appendRow([id, tenantId, templateId, JSON.stringify(data||{}), new Date().toISOString(), slug]);

    const base = ScriptApp.getService().getUrl();
    const links = {
      publicUrl: `${base}?p=events&tenant=${tenantId}&id=${id}`,
      posterUrl: `${base}?page=poster&p=events&tenant=${tenantId}&id=${id}`
    };
    diag_('info','api_create','created',{id,tenantId,scope});
    return Ok({ id, links });
  });
}

// === Sponsors APIs ========================================================
function api_updateSponsors(payload){
  return runSafe('api_updateSponsors', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, entityType, entityId, sponsors, adminKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;

    const tenant = findTenant_(tenantId);
    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    let sh = ss.getSheetByName('SPONSORS');
    if (!sh){ sh = ss.insertSheet('SPONSORS'); sh.appendRow(['id','tenantId','entityType','entityId','posterTop','tvTop','tvSide','mobileBanner','createdAt']); }

    // Find existing row or create new
    const rows = sh.getDataRange().getValues();
    let rowIndex = rows.findIndex((r,i) => i>0 && r[1]===tenantId && r[2]===entityType && r[3]===entityId);

    const id = rowIndex > 0 ? rows[rowIndex][0] : Utilities.getUuid();
    const data = [id, tenantId, entityType, entityId,
                  sponsors?.posterTop||'', sponsors?.tvTop||'',
                  sponsors?.tvSide||'', sponsors?.mobileBanner||'',
                  new Date().toISOString()];

    if(rowIndex > 0){ sh.getRange(rowIndex+1, 1, 1, data.length).setValues([data]); }
    else { sh.appendRow(data); }

    diag_('info','api_updateSponsors','saved',{entityType,entityId});
    return Ok({ id });
  });
}

function api_getSponsors(payload){
  return runSafe('api_getSponsors', () => {
    const { tenantId, entityType, entityId } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    const sh = ss.getSheetByName('SPONSORS');
    if (!sh) return Ok({ sponsors:{} });

    const r = sh.getDataRange().getValues().slice(1).find(row => row[1]===tenantId && row[2]===entityType && row[3]===entityId);
    if (!r) return Ok({ sponsors:{} });

    const value = { posterTop:r[4], tvTop:r[5], tvSide:r[6], mobileBanner:r[7] };
    return Ok({ sponsors: value });
  });
}

// === Display Config APIs ==================================================
function api_updateDisplay(payload){
  return runSafe('api_updateDisplay', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, entityType, entityId, displayConfig, adminKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;

    const tenant = findTenant_(tenantId);
    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    let sh = ss.getSheetByName('DISPLAY_CONFIG');
    if (!sh){ sh = ss.insertSheet('DISPLAY_CONFIG'); sh.appendRow(['id','tenantId','entityType','entityId','urlsJSON','timingsJSON','createdAt']); }

    const rows = sh.getDataRange().getValues();
    let rowIndex = rows.findIndex((r,i) => i>0 && r[1]===tenantId && r[2]===entityType && r[3]===entityId);

    const id = rowIndex > 0 ? rows[rowIndex][0] : Utilities.getUuid();
    const data = [id, tenantId, entityType, entityId,
                  JSON.stringify(displayConfig?.urls||[]),
                  JSON.stringify(displayConfig?.timings||[]),
                  new Date().toISOString()];

    if(rowIndex > 0){ sh.getRange(rowIndex+1, 1, 1, data.length).setValues([data]); }
    else { sh.appendRow(data); }

    diag_('info','api_updateDisplay','saved',{entityType,entityId});
    return Ok({ id });
  });
}

function api_getDisplay(payload){
  return runSafe('api_getDisplay', () => {
    const { tenantId, entityType, entityId } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    const sh = ss.getSheetByName('DISPLAY_CONFIG');
    if (!sh) return Ok({ displayConfig:{urls:[],timings:[]} });

    const r = sh.getDataRange().getValues().slice(1).find(row => row[1]===tenantId && row[2]===entityType && row[3]===entityId);
    if (!r) return Ok({ displayConfig:{urls:[],timings:[]} });

    const value = { urls: JSON.parse(r[4]||'[]'), timings: JSON.parse(r[5]||'[]') };
    return Ok({ displayConfig: value });
  });
}

// === Forms APIs ===========================================================
function api_updateForms(payload){
  return runSafe('api_updateForms', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, entityType, entityId, forms, adminKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;

    const tenant = findTenant_(tenantId);
    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    let sh = ss.getSheetByName('FORMS');
    if (!sh){ sh = ss.insertSheet('FORMS'); sh.appendRow(['id','tenantId','entityType','entityId','signupUrl','checkinUrl','walkinUrl','surveyUrl','createdAt']); }

    const rows = sh.getDataRange().getValues();
    let rowIndex = rows.findIndex((r,i) => i>0 && r[1]===tenantId && r[2]===entityType && r[3]===entityId);

    const id = rowIndex > 0 ? rows[rowIndex][0] : Utilities.getUuid();
    const data = [id, tenantId, entityType, entityId,
                  forms?.signupUrl||'', forms?.checkinUrl||'',
                  forms?.walkinUrl||'', forms?.surveyUrl||'',
                  new Date().toISOString()];

    if(rowIndex > 0){ sh.getRange(rowIndex+1, 1, 1, data.length).setValues([data]); }
    else { sh.appendRow(data); }

    diag_('info','api_updateForms','saved',{entityType,entityId});
    return Ok({ id });
  });
}

function api_getForms(payload){
  return runSafe('api_getForms', () => {
    const { tenantId, entityType, entityId } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    const sh = ss.getSheetByName('FORMS');
    if (!sh) return Ok({ forms:{} });

    const r = sh.getDataRange().getValues().slice(1).find(row => row[1]===tenantId && row[2]===entityType && row[3]===entityId);
    if (!r) return Ok({ forms:{} });

    const value = { signupUrl:r[4], checkinUrl:r[5], walkinUrl:r[6], surveyUrl:r[7] };
    return Ok({ forms: value });
  });
}

// === Shortlinks APIs ======================================================
function api_createShortlink(payload){
  return runSafe('api_createShortlink', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, entityType, entityId, targetUrl, linkType, adminKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;
    if(!isUrl(targetUrl)) return Err(ERR.BAD_INPUT,'Invalid target URL');

    const tenant = findTenant_(tenantId);
    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    let sh = ss.getSheetByName('LINKS');
    if (!sh){ sh = ss.insertSheet('LINKS'); sh.appendRow(['token','tenantId','entityType','entityId','targetUrl','linkType','createdAt','clicks']); }

    const token = Utilities.base64Encode(Utilities.getUuid().slice(0,8)).replace(/[=+\/]/g,'').slice(0,8);
    sh.appendRow([token, tenantId, entityType, entityId, targetUrl, linkType||'', new Date().toISOString(), 0]);

    const shortUrl = `${ScriptApp.getService().getUrl()}?p=r&t=${token}`;
    diag_('info','api_createShortlink','created',{token,linkType});
    return Ok({ token, shortUrl, targetUrl });
  });
}

function handleRedirect_(token){
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('LINKS');
    if (!sh) return HtmlService.createHtmlOutput('<h1>Link not found</h1>');

    const rows = sh.getDataRange().getValues();
    const rowIndex = rows.findIndex((r,i) => i>0 && r[0]===token);
    if (rowIndex < 1) return HtmlService.createHtmlOutput('<h1>Link not found</h1>');

    const targetUrl = rows[rowIndex][4];
    const clicks = Number(rows[rowIndex][7]||0) + 1;
    sh.getRange(rowIndex+1, 8).setValue(clicks);

    // Log analytics
    logAnalytics_({ token, surface:'redirect', action:'click', meta:{} });

    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=${targetUrl}">`);
  } catch(e) {
    diag_('error','handleRedirect_','Exception',{err:String(e)});
    return HtmlService.createHtmlOutput('<h1>Error processing redirect</h1>');
  }
}

// === Analytics APIs =======================================================
function api_logAnalytics(payload){
  return runSafe('api_logAnalytics', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    logAnalytics_(payload);
    return Ok({});
  });
}

function logAnalytics_(data){
  try {
    const { token, entityId, surface, action, meta } = data||{};
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('ANALYTICS');
    if (!sh){ sh = ss.insertSheet('ANALYTICS'); sh.appendRow(['timestamp','token','entityId','surface','action','metaJSON']); }

    sh.appendRow([new Date().toISOString(), token||'', entityId||'', surface||'', action||'', JSON.stringify(meta||{})]);

    // Cap analytics rows
    const MAX_ANALYTICS = 10000;
    if(sh.getLastRow() > MAX_ANALYTICS){ sh.deleteRows(2, sh.getLastRow() - MAX_ANALYTICS); }
  } catch(_){}
}

// === Reports APIs =========================================================
function api_getReport(payload){
  return runSafe('api_getReport', () => {
    const { tenantId, entityType, entityId } = payload||{};
    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    const sh = ss.getSheetByName('ANALYTICS');
    if (!sh) return Ok({ report:{} });

    const rows = sh.getDataRange().getValues().slice(1).filter(r => r[2]===entityId);

    const bySurface = {};
    const byAction = {};
    rows.forEach(r => {
      const surf = r[3]||'unknown';
      const act = r[4]||'unknown';
      bySurface[surf] = (bySurface[surf]||0) + 1;
      byAction[act] = (byAction[act]||0) + 1;
    });

    const value = { totalEvents: rows.length, bySurface, byAction };
    return Ok({ report: value });
  });
}

function api_exportReport(payload){
  return runSafe('api_exportReport', () => {
    const { tenantId, entityType, entityId, adminKey } = payload||{};
    const g=gate_(tenantId, adminKey); if(!g.ok) return g;

    const tenant=findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND,'Unknown tenant');

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);
    const reportName = `Report_${entityType}_${entityId}_${new Date().toISOString().slice(0,10)}`;

    let reportSh = ss.getSheetByName(reportName);
    if (!reportSh){ reportSh = ss.insertSheet(reportName); }
    else { reportSh.clear(); }

    reportSh.appendRow(['Zeventbook Report', entityType, entityId]);
    reportSh.appendRow([]);

    // Get analytics
    const analyticsData = api_getReport({ tenantId, entityType, entityId });
    if(analyticsData.ok){
      const r = analyticsData.value.report;
      reportSh.appendRow(['Total Events', r.totalEvents]);
      reportSh.appendRow([]);
      reportSh.appendRow(['By Surface']);
      Object.entries(r.bySurface||{}).forEach(([k,v]) => reportSh.appendRow([k,v]));
      reportSh.appendRow([]);
      reportSh.appendRow(['By Action']);
      Object.entries(r.byAction||{}).forEach(([k,v]) => reportSh.appendRow([k,v]));
    }

    diag_('info','api_exportReport','exported',{entityId,reportName});
    return Ok({ sheetUrl: ss.getUrl() + '#gid=' + reportSh.getSheetId(), sheetName: reportName });
  });
}

// === Status & Diagnostics APIs ============================================
function api_status(){
  return runSafe('api_status', () => {
    try {
      const ss = SpreadsheetApp.getActive();
      const dbOk = ss && ss.getId();
      const contractOk = ZEB.CONTRACT_VER === '1.1.0';

      return Ok({
        build: ZEB.BUILD_ID,
        contract: ZEB.CONTRACT_VER,
        db: { ok: !!dbOk, id: dbOk },
        time: new Date().toISOString(),
        features: FEATURES
      });
    } catch(e) {
      return Err(ERR.INTERNAL, 'Status check failed: ' + String(e));
    }
  });
}

function api_selfTest(payload){
  return runSafe('api_selfTest', () => {
    const { tenantId, adminKey } = payload||{};
    const g=gate_(tenantId||'root', adminKey); if(!g.ok) return g;

    const steps = [];
    let testEventId = null;

    // Step 1: Status check
    const statusRes = api_status();
    steps.push({ name:'Status', ok:statusRes.ok, error: statusRes.ok?null:statusRes.message });
    if(!statusRes.ok) return Ok({ steps, ok:false });

    // Step 2: Create test event
    const createRes = api_create({
      tenantId: tenantId||'root',
      scope: 'events',
      templateId: 'event',
      adminKey,
      idemKey: 'selftest-'+Date.now(),
      data: { name:'Self-Test Event', dateISO: new Date().toISOString().slice(0,10) }
    });
    steps.push({ name:'Create Event', ok:createRes.ok, error: createRes.ok?null:createRes.message });
    if(!createRes.ok) return Ok({ steps, ok:false });
    testEventId = createRes.value.id;

    // Step 3: Update sponsors
    const sponsorsRes = api_updateSponsors({
      tenantId: tenantId||'root',
      entityType:'event',
      entityId: testEventId,
      adminKey,
      sponsors:{ posterTop:'Test Sponsor', tvTop:'Test', tvSide:'Test', mobileBanner:'Test' }
    });
    steps.push({ name:'Update Sponsors', ok:sponsorsRes.ok, error: sponsorsRes.ok?null:sponsorsRes.message });

    // Step 4: Update display
    const displayRes = api_updateDisplay({
      tenantId: tenantId||'root',
      entityType:'event',
      entityId: testEventId,
      adminKey,
      displayConfig:{ urls:['https://youtube.com'], timings:[10] }
    });
    steps.push({ name:'Update Display', ok:displayRes.ok, error: displayRes.ok?null:displayRes.message });

    // Step 5: Log analytics
    logAnalytics_({ entityId:testEventId, surface:'test', action:'impression', meta:{} });
    steps.push({ name:'Log Analytics', ok:true });

    // Step 6: Export report
    const reportRes = api_exportReport({
      tenantId: tenantId||'root',
      entityType:'event',
      entityId: testEventId,
      adminKey
    });
    steps.push({ name:'Export Report', ok:reportRes.ok, error: reportRes.ok?null:reportRes.message, sheetUrl: reportRes.value?.sheetUrl });

    const allOk = steps.every(s => s.ok);
    diag_('info','api_selfTest','completed',{allOk,steps:steps.length});
    return Ok({ ok:allOk, steps, eventId:testEventId, sheetUrl: reportRes.value?.sheetUrl });
  });
}
