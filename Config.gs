// === Zeventbook Production Config ===
// Single source of truth for app constants and tenant configuration

const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'triangle-prod-v1.2',
  CONTRACT_VER: '1.0.2'
});

// Tenants (multi-tenant architecture, single DB for MVP)
const TENANTS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbook.io','www.zeventbook.io'],
    adminSecret: 'CHANGE_ME_root',  // ⚠️ CHANGE THIS in production!
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    hostnames: ['americanbocceco.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_abc',   // ⚠️ CHANGE THIS in production!
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_cbc',   // ⚠️ CHANGE THIS in production!
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  },
  {
    id: 'cbl',
    name: 'Chicago Bocce League',
    hostnames: ['chicagobocceleague.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_cbl',   // ⚠️ CHANGE THIS in production!
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events']
  }
];

// Templates (event schema)
const TEMPLATES = [
  {
    id: 'event',
    label: 'Event',
    fields: [
      { id: 'name',      type: 'text', required: true },
      { id: 'dateISO',   type: 'date', required: true },
      { id: 'signupUrl', type: 'url',  required: false }
    ]
  }
];

// Accessors
function loadTenants_() { return TENANTS; }
function findTenant_(id) { return TENANTS.find(t => t.id === id) || null; }
function findTenantByHost_(host) {
  host = String(host || '').toLowerCase();
  return TENANTS.find(t => (t.hostnames || []).includes(host)) || TENANTS.find(t => t.id === 'root');
}
function findTemplate_(id) { return TEMPLATES.find(x => x.id === id) || null; }
