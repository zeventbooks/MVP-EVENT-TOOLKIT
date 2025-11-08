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
  const pageParam = (e?.parameter?.page || e?.parameter?.p || '').toString();
  const hostHeader = (e?.headers?.host || e?.parameter?.host || '').toString();
  const tenant = findTenantByHost_(hostHeader) || findTenant_('root');

  const path = (e?.pathInfo || '').toString().replace(/^\/+|\/+$/g,''); // future proxy support
  const scope = (e?.parameter?.p || 'events').toString(); // MVP default
  const allowed = tenant.scopesAllowed?.length ? tenant.scopesAllowed : ['events','leagues','tournaments'];
  if (!allowed.includes(scope)){
    const first = allowed[0] || 'events';
    return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=?p=${first}&tenant=${tenant.id}">`);
  }

  const page = (pageParam==='admin' || pageParam==='poster' || pageParam==='test' || pageParam==='display' || pageParam==='checkin') ? pageParam : 'public';
  const tpl = HtmlService.createTemplateFromFile(pageFile_(page));
  tpl.appTitle = `${tenant.name} · ${scope}`;
  tpl.tenantId = tenant.id;
  tpl.scope = scope;
  tpl.execUrl = ScriptApp.getService().getUrl();
  tpl.ZEB.BUILD_ID = ZEB.BUILD_ID;
  return tpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function pageFile_(page){
  if (page==='admin') return 'Admin';
  if (page==='poster') return 'Poster';
  if (page==='test')   return 'Test';
  if (page==='display') return 'Display';
  if (page==='checkin') return 'CheckIn';
  return 'Public';
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

    const data = JSON.parse(r[3]||'{}');

    // Auto-load sponsors for this event (if scope is events)
    if (scope === 'events') {
      try {
        const sponsorSh = getSponsorsSheet_();
        const sponsorRows = sponsorSh.getRange(2, 1, Math.max(0, sponsorSh.getLastRow() - 1), 9).getValues()
          .filter(sr => sr[1] === tenantId && (sr[2] === id || sr[2] === ''))
          .map(sr => ({
            id: sr[0],
            name: sr[3],
            img: sr[4],
            tier: sr[5],
            placements: {
              tvTop: sr[6] === 'TRUE',
              tvSide: sr[7] === 'TRUE'
            }
          }));
        data.sponsors = sponsorRows;
      } catch (e) {
        // If sponsors sheet doesn't exist or errors, continue without sponsors
        data.sponsors = [];
      }
    }

    const value = { id:r[0], tenantId:r[1], templateId:r[2], data, createdAt:r[4], slug:r[5],
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

function api_update(payload){
  return runSafe('api_update', () => {
    if(!payload||typeof payload!=='object') return Err(ERR.BAD_INPUT,'Missing payload');
    const { tenantId, scope, id, data, adminKey } = payload;

    const g=gate_(tenantId, adminKey); if(!g.ok) return g;
    const a=assertScopeAllowed_(findTenant_(tenantId), scope); if(!a.ok) return a;

    if (!id) return Err(ERR.BAD_INPUT, 'ID is required');

    const tenant = findTenant_(tenantId);
    const sh = getStoreSheet_(tenant, scope);
    const rows = sh.getDataRange().getValues();
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id && r[1] === tenantId);

    if (rowIndex === -1) return Err(ERR.NOT_FOUND, 'Not found');

    const row = rows[rowIndex];
    const updatedData = data || JSON.parse(row[3] || '{}');

    sh.getRange(rowIndex + 1, 1, 1, 6).setValues([[
      id,
      tenantId,
      row[2], // templateId (unchanged)
      JSON.stringify(updatedData),
      row[4], // createdAt (unchanged)
      row[5]  // slug (unchanged)
    ]]);

    diag_('info','api_update','updated',{id,tenantId,scope});
    return Ok({ id });
  });
}

// === Analytics API =========================================================
function getAnalyticsSheet_(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  let sh = ss.getSheetByName('ANALYTICS');
  if (!sh) {
    sh = ss.insertSheet('ANALYTICS');
    sh.appendRow(['timestamp', 'tenantId', 'eventId', 'sponsorId', 'surface', 'metric', 'value', 'context']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function api_logEvents(payload){
  return runSafe('api_logEvents', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { events } = payload;
    if (!Array.isArray(events) || events.length === 0) return Err(ERR.BAD_INPUT, 'Events must be a non-empty array');

    const sh = getAnalyticsSheet_();
    const rows = events.map(e => [
      new Date().toISOString(),
      e.tenantId || '',
      e.eventId || '',
      e.sponsorId || '',
      e.surface || '',
      e.metric || '',
      e.value || '',
      e.context ? JSON.stringify(e.context) : ''
    ]);

    if (rows.length > 0) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
    }

    diag_('info', 'api_logEvents', 'logged', { count: rows.length });
    return Ok({ logged: rows.length });
  });
}

// === Attendees API =========================================================
function getAttendeesSheet_(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  let sh = ss.getSheetByName('ATTENDEES');
  if (!sh) {
    sh = ss.insertSheet('ATTENDEES');
    sh.appendRow(['id', 'tenantId', 'eventId', 'name', 'email', 'phone', 'registeredAt', 'checkedInAt', 'qrCode']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function api_registerAttendee(payload){
  return runSafe('api_registerAttendee', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, eventId, name, email, phone } = payload;

    if (!name) return Err(ERR.BAD_INPUT, 'Name is required');
    if (!email) return Err(ERR.BAD_INPUT, 'Email is required');

    const sh = getAttendeesSheet_();
    const id = Utilities.getUuid();
    const qrCode = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id));

    sh.appendRow([
      id,
      tenantId || '',
      eventId || '',
      name,
      email,
      phone || '',
      new Date().toISOString(),
      '', // checkedInAt (empty until check-in)
      qrCode
    ]);

    diag_('info', 'api_registerAttendee', 'registered', { id, tenantId, eventId, email });
    return Ok({ id, qrCode });
  });
}

function api_checkInAttendee(payload){
  return runSafe('api_checkInAttendee', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, eventId, attendeeId, qrCode, adminKey } = payload;

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    const sh = getAttendeesSheet_();
    const rows = sh.getDataRange().getValues();

    let rowIndex = -1;
    if (attendeeId) {
      rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === attendeeId && r[1] === tenantId && r[2] === eventId);
    } else if (qrCode) {
      rowIndex = rows.findIndex((r, i) => i > 0 && r[8] === qrCode && r[1] === tenantId && r[2] === eventId);
    }

    if (rowIndex === -1) return Err(ERR.NOT_FOUND, 'Attendee not found');

    const row = rows[rowIndex];

    // Update check-in timestamp
    sh.getRange(rowIndex + 1, 8).setValue(new Date().toISOString());

    diag_('info', 'api_checkInAttendee', 'checked-in', { id: row[0], tenantId, eventId });
    return Ok({ id: row[0], name: row[3], checkedInAt: new Date().toISOString() });
  });
}

function api_listAttendees(payload){
  return runSafe('api_listAttendees', () => {
    const { tenantId, eventId, adminKey } = payload || {};

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    const sh = getAttendeesSheet_();
    const rows = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 9).getValues()
      .filter(r => r[1] === tenantId && (!eventId || r[2] === eventId))
      .map(r => ({
        id: r[0],
        tenantId: r[1],
        eventId: r[2],
        name: r[3],
        email: r[4],
        phone: r[5],
        registeredAt: r[6],
        checkedInAt: r[7],
        qrCode: r[8]
      }));

    const value = { items: rows };
    return Ok(value);
  });
}

// === Surveys API ===========================================================
function getSurveysSheet_(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  let sh = ss.getSheetByName('SURVEYS');
  if (!sh) {
    sh = ss.insertSheet('SURVEYS');
    sh.appendRow(['id', 'tenantId', 'eventId', 'title', 'questionsJSON', 'createdAt', 'active']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getResponsesSheet_(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  let sh = ss.getSheetByName('RESPONSES');
  if (!sh) {
    sh = ss.insertSheet('RESPONSES');
    sh.appendRow(['id', 'tenantId', 'surveyId', 'attendeeEmail', 'answersJSON', 'submittedAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function api_createSurvey(payload){
  return runSafe('api_createSurvey', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, eventId, title, questions, adminKey } = payload;

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    if (!title) return Err(ERR.BAD_INPUT, 'Title is required');
    if (!Array.isArray(questions) || questions.length === 0) return Err(ERR.BAD_INPUT, 'Questions required');

    const sh = getSurveysSheet_();
    const id = Utilities.getUuid();

    sh.appendRow([
      id,
      tenantId,
      eventId || '',
      title,
      JSON.stringify(questions),
      new Date().toISOString(),
      'TRUE'
    ]);

    diag_('info', 'api_createSurvey', 'created', { id, tenantId, eventId, title });
    return Ok({ id });
  });
}

function api_submitSurveyResponse(payload){
  return runSafe('api_submitSurveyResponse', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, surveyId, attendeeEmail, answers } = payload;

    if (!surveyId) return Err(ERR.BAD_INPUT, 'Survey ID required');
    if (!answers) return Err(ERR.BAD_INPUT, 'Answers required');

    const sh = getResponsesSheet_();
    const id = Utilities.getUuid();

    sh.appendRow([
      id,
      tenantId || '',
      surveyId,
      attendeeEmail || 'anonymous',
      JSON.stringify(answers),
      new Date().toISOString()
    ]);

    diag_('info', 'api_submitSurveyResponse', 'submitted', { id, surveyId });
    return Ok({ id });
  });
}

function api_listSurveys(payload){
  return runSafe('api_listSurveys', () => {
    const { tenantId, eventId } = payload || {};
    const tenant = findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

    const sh = getSurveysSheet_();
    const rows = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 7).getValues()
      .filter(r => r[1] === tenantId && (!eventId || r[2] === eventId))
      .map(r => ({
        id: r[0],
        tenantId: r[1],
        eventId: r[2],
        title: r[3],
        questions: JSON.parse(r[4] || '[]'),
        createdAt: r[5],
        active: r[6] === 'TRUE'
      }));

    const value = { items: rows };
    return Ok(value);
  });
}

function api_getSurveyResponses(payload){
  return runSafe('api_getSurveyResponses', () => {
    const { tenantId, surveyId, adminKey } = payload || {};

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    const sh = getResponsesSheet_();
    const rows = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 6).getValues()
      .filter(r => r[1] === tenantId && r[2] === surveyId)
      .map(r => ({
        id: r[0],
        surveyId: r[2],
        attendeeEmail: r[3],
        answers: JSON.parse(r[4] || '{}'),
        submittedAt: r[5]
      }));

    const value = { items: rows };
    return Ok(value);
  });
}

// === Sponsors API ==========================================================
function getSponsorsSheet_(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  let sh = ss.getSheetByName('SPONSORS');
  if (!sh) {
    sh = ss.insertSheet('SPONSORS');
    sh.appendRow(['id', 'tenantId', 'eventId', 'name', 'logoUrl', 'tier', 'placementTvTop', 'placementTvSide', 'createdAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function api_createSponsor(payload){
  return runSafe('api_createSponsor', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, eventId, name, logoUrl, tier, placements, adminKey } = payload;

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    if (!name) return Err(ERR.BAD_INPUT, 'Name is required');
    if (logoUrl && !isUrl(logoUrl)) return Err(ERR.BAD_INPUT, 'Invalid logo URL');

    const sh = getSponsorsSheet_();
    const id = Utilities.getUuid();
    const placementsObj = placements || {};

    sh.appendRow([
      id,
      tenantId,
      eventId || '',
      name,
      logoUrl || '',
      tier || 'standard',
      placementsObj.tvTop ? 'TRUE' : 'FALSE',
      placementsObj.tvSide ? 'TRUE' : 'FALSE',
      new Date().toISOString()
    ]);

    diag_('info', 'api_createSponsor', 'created', { id, tenantId, eventId, name });
    return Ok({ id });
  });
}

function api_updateSponsor(payload){
  return runSafe('api_updateSponsor', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, id, name, logoUrl, tier, placements, adminKey } = payload;

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    if (!id) return Err(ERR.BAD_INPUT, 'Sponsor ID is required');

    const sh = getSponsorsSheet_();
    const rows = sh.getDataRange().getValues();
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id && r[1] === tenantId);

    if (rowIndex === -1) return Err(ERR.NOT_FOUND, 'Sponsor not found');

    const row = rows[rowIndex];
    const placementsObj = placements || { tvTop: row[6] === 'TRUE', tvSide: row[7] === 'TRUE' };

    sh.getRange(rowIndex + 1, 1, 1, 9).setValues([[
      id,
      tenantId,
      row[2], // eventId (unchanged)
      name !== undefined ? name : row[3],
      logoUrl !== undefined ? logoUrl : row[4],
      tier !== undefined ? tier : row[5],
      placementsObj.tvTop ? 'TRUE' : 'FALSE',
      placementsObj.tvSide ? 'TRUE' : 'FALSE',
      row[8] // createdAt (unchanged)
    ]]);

    diag_('info', 'api_updateSponsor', 'updated', { id, tenantId });
    return Ok({ id });
  });
}

function api_deleteSponsor(payload){
  return runSafe('api_deleteSponsor', () => {
    if(!payload || typeof payload !== 'object') return Err(ERR.BAD_INPUT, 'Missing payload');
    const { tenantId, id, adminKey } = payload;

    const g = gate_(tenantId, adminKey); if(!g.ok) return g;

    if (!id) return Err(ERR.BAD_INPUT, 'Sponsor ID is required');

    const sh = getSponsorsSheet_();
    const rows = sh.getDataRange().getValues();
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id && r[1] === tenantId);

    if (rowIndex === -1) return Err(ERR.NOT_FOUND, 'Sponsor not found');

    sh.deleteRow(rowIndex + 1);

    diag_('info', 'api_deleteSponsor', 'deleted', { id, tenantId });
    return Ok({ id });
  });
}

function api_listSponsors(payload){
  return runSafe('api_listSponsors', () => {
    const { tenantId, eventId } = payload || {};
    const tenant = findTenant_(tenantId); if(!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

    const sh = getSponsorsSheet_();
    const rows = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 9).getValues()
      .filter(r => r[1] === tenantId && (!eventId || r[2] === eventId || r[2] === ''))
      .map(r => ({
        id: r[0],
        tenantId: r[1],
        eventId: r[2],
        name: r[3],
        logoUrl: r[4],
        tier: r[5],
        placements: {
          tvTop: r[6] === 'TRUE',
          tvSide: r[7] === 'TRUE'
        },
        createdAt: r[8]
      }));

    const value = { items: rows };
    const etag = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value)));
    if (payload?.ifNoneMatch === etag) return { ok: true, notModified: true, etag };
    return { ok: true, etag, value };
  });
}
