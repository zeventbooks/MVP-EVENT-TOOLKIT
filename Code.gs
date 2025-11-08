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

  const page = (pageParam==='admin' || pageParam==='poster' || pageParam==='test') ? pageParam : 'public';
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
