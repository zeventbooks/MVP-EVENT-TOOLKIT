// === MVP Config (events-only launch, extensible for leagues/tournaments) ===
// === Global App Constants (single source of truth) ===
const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'mvp-v1.1-full-triangle',
  CONTRACT_VER: '1.1.0',
  DB_NAME: 'ZEB_DB' // Main spreadsheet ID storage
});

// === Feature Flags (master control for progressive rollout) ===
const FEATURES = Object.freeze({
  events: true,        // ✅ ENABLED for MVP launch
  leagues: false,      // 🔒 Post-MVP (Phase 2)
  tournaments: false,  // 🔒 Post-MVP (Phase 2)
  multiTenant: false   // 🔒 Post-MVP (single tenant for now)
});

// === Database Configuration ===
// OPTION 1: Paste your spreadsheet ID here (recommended for production)
const DB_SPREADSHEET_ID = ''; // Leave empty to auto-create on first run

// OPTION 2: Auto-create will happen on first API call if DB_SPREADSHEET_ID is empty
function getOrCreateDatabase_() {
  // Try user-provided ID first
  if (DB_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(DB_SPREADSHEET_ID).getId();
    } catch(e) {
      throw new Error(`Cannot open spreadsheet ${DB_SPREADSHEET_ID}: ${e.message}`);
    }
  }

  // Try script properties (persistent storage)
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('DB_SPREADSHEET_ID');

  if (ssId) {
    try {
      SpreadsheetApp.openById(ssId); // Verify it still exists
      return ssId;
    } catch(e) {
      // Spreadsheet was deleted, create new one
      props.deleteProperty('DB_SPREADSHEET_ID');
      ssId = null;
    }
  }

  // Create new spreadsheet
  const ss = SpreadsheetApp.create(ZEB.DB_NAME + ' - Database');
  ssId = ss.getId();
  props.setProperty('DB_SPREADSHEET_ID', ssId);

  // Add instructions sheet
  const sheet = ss.getSheets()[0];
  sheet.setName('README');
  sheet.appendRow(['Zeventbook Database']);
  sheet.appendRow([]);
  sheet.appendRow(['This spreadsheet stores all your event data.']);
  sheet.appendRow(['Spreadsheet ID:', ssId]);
  sheet.appendRow(['Created:', new Date().toISOString()]);
  sheet.appendRow([]);
  sheet.appendRow(['Data sheets will be created automatically:']);
  sheet.appendRow(['- EVENTS: Event records']);
  sheet.appendRow(['- SPONSORS: Sponsor placements']);
  sheet.appendRow(['- DISPLAY_CONFIG: TV carousel settings']);
  sheet.appendRow(['- FORMS: Form URLs']);
  sheet.appendRow(['- LINKS: Shortlink tokens']);
  sheet.appendRow(['- ANALYTICS: Tracking data']);
  sheet.appendRow(['- DIAG: Diagnostic logs']);

  return ssId;
}

// Tenants (MVP: single root tenant; future: add abc, cbc, cbl)
const TENANTS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbooks.com', 'www.zeventbooks.com'],
    adminSecret: 'CHANGE_ME_root',
    store: { type: 'workbook', get spreadsheetId() { return getOrCreateDatabase_(); } },
    scopesAllowed: ['events', 'leagues', 'tournaments'], // Ready for all, but FEATURES gate them
    isActive: true
  }
  // Future tenants (ready to enable):
  // {
  //   id: 'abc',
  //   name: 'American Bocce Co.',
  //   hostnames: ['americanbocceco.zeventbooks.com'],
  //   adminSecret: 'CHANGE_ME_abc',
  //   store: { type: 'workbook', get spreadsheetId() { return getOrCreateDatabase_(); } },
  //   scopesAllowed: ['leagues', 'tournaments'],
  //   isActive: false
  // },
  // {
  //   id: 'cbc',
  //   name: 'Chicago Bocce Club',
  //   hostnames: ['chicagobocceclub.zeventbooks.com'],
  //   adminSecret: 'CHANGE_ME_cbc',
  //   store: { type: 'workbook', get spreadsheetId() { return getOrCreateDatabase_(); } },
  //   scopesAllowed: ['events', 'leagues'],
  //   isActive: false
  // },
  // {
  //   id: 'cbl',
  //   name: 'Chicago Bocce League',
  //   hostnames: ['chicagobocceleague.zeventbooks.com'],
  //   adminSecret: 'CHANGE_ME_cbl',
  //   store: { type: 'workbook', get spreadsheetId() { return getOrCreateDatabase_(); } },
  //   scopesAllowed: ['events', 'tournaments'],
  //   isLeague: true, // Special: this tenant IS a league
  //   affiliatedWith: 'abc', // Relationship tracking
  //   isActive: false
  // }
];

// Templates for Events (MVP), Leagues & Tournaments (future-ready)
const TEMPLATES = [
  {
    id:'event',
    label:'Event',
    scope: 'events',
    fields:[
      { id:'name',        type:'text', required:true, label:'Event Name' },
      { id:'dateISO',     type:'date', required:true, label:'Date' },
      { id:'location',    type:'text', required:false, label:'Location' },
      { id:'summary',     type:'textarea', required:false, label:'Summary' },
      { id:'summaryLink', type:'url',  required:false, label:'Summary Link' },
      { id:'videoUrl',    type:'url',  required:false, label:'Video URL' },
      { id:'bioLink',     type:'url',  required:false, label:'Bio Link' }
    ]
  }
  // Future templates (ready to enable):
  // {
  //   id:'league',
  //   label:'League',
  //   scope: 'leagues',
  //   fields:[
  //     { id:'name',   type:'text', required:true, label:'League Name' },
  //     { id:'season', type:'text', required:true, label:'Season' },
  //     { id:'logoUrl', type:'url', required:false, label:'Logo URL' }
  //   ]
  // },
  // {
  //   id:'tournament',
  //   label:'Tournament',
  //   scope: 'tournaments',
  //   fields:[
  //     { id:'name',     type:'text', required:true, label:'Tournament Name' },
  //     { id:'dateISO',  type:'date', required:true, label:'Date' },
  //     { id:'leagueId', type:'text', required:false, label:'League ID (optional)' }
  //   ]
  // }
];

// Form Templates (4 types for event lifecycle)
const FORM_TEMPLATES = [
  { id:'signup',  label:'Sign-Up Form',  type:'signup' },
  { id:'checkin', label:'Check-In Form', type:'checkin' },
  { id:'walkin',  label:'Walk-In Form',  type:'walkin' },
  { id:'survey',  label:'Survey Form',   type:'survey' }
];

// Accessors
function loadTenants_(){ return TENANTS.filter(t => t.isActive !== false); }
function findTenant_(id){ return TENANTS.find(t=>t.id===id) || null; }
function findTenantByHost_(host){
  host = String(host||'').toLowerCase();
  return TENANTS.find(t => (t.hostnames||[]).includes(host)) || TENANTS.find(t=>t.id==='root');
}
function findTemplate_(id){ return TEMPLATES.find(x=>x.id===id) || null; }
function getActiveScopes_(){
  return Object.keys(FEATURES).filter(k => FEATURES[k] === true && k !== 'multiTenant');
}
function isScopeEnabled_(scope){ return FEATURES[scope] === true; }
