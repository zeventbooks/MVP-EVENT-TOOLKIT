// === MVP Config (events-only) =============================================
// === Global App Constants (single source of truth) ===
const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'zeventbooks-prodstart-v1',
  CONTRACT_VER: '1.0.1'
});


// Tenants (root = you; add spreadsheetIds for orgs as needed)
const TENANTS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbook.io','www.zeventbook.io'],
    adminSecret: 'CHANGE_ME_root',
    // store: current file by default
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    // MVP flags: events only
    scopesAllowed: ['events']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    hostnames: ['americanbocceco.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_abc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_cbc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  }
];

// Templates
const TEMPLATES = [
  {
    id:'event',
    label:'Event',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'signupUrl',   type:'url',  required:false },
      { id:'videoUrl',    type:'url',  required:false },
      { id:'galleryUrls', type:'text', required:false }, // Comma-separated URLs
      { id:'bioText',     type:'text', required:false },
      { id:'bioUrl',      type:'url',  required:false }
    ]
  }
];

// Accessors
function loadTenants_(){ return TENANTS; }
function findTenant_(id){ return TENANTS.find(t=>t.id===id) || null; }
function findTenantByHost_(host){
  host = String(host||'').toLowerCase();
  return TENANTS.find(t => (t.hostnames||[]).includes(host)) || TENANTS.find(t=>t.id==='root');
}
function findTemplate_(id){ return TEMPLATES.find(x=>x.id===id) || null; }
