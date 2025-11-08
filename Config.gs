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
    // Scopes: events, leagues, tournaments all enabled
    scopesAllowed: ['events', 'leagues', 'tournaments']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    hostnames: ['americanbocceco.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_abc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'leagues', 'tournaments']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    adminSecret: 'CHANGE_ME_cbc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'leagues', 'tournaments']
  }
];

// Templates
const TEMPLATES = [
  {
    id:'event',
    label:'Event (Standard)',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'signupUrl',   type:'url',  required:false },
      { id:'videoUrl',    type:'url',  required:false },
      { id:'galleryUrls', type:'text', required:false },
      { id:'bioText',     type:'text', required:false },
      { id:'bioUrl',      type:'url',  required:false }
    ]
  },
  {
    id:'event-ticketed',
    label:'Ticketed Event',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'capacity',    type:'text', required:false },
      { id:'ticketTiers', type:'text', required:false }, // JSON: [{name, price, perks}]
      { id:'ticketUrl',   type:'url',  required:false },
      { id:'earlyBirdEnd',type:'date', required:false },
      { id:'videoUrl',    type:'url',  required:false },
      { id:'galleryUrls', type:'text', required:false }
    ]
  },
  {
    id:'event-recurring',
    label:'Recurring Event',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true }, // First occurrence
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'recurrence',  type:'text', required:false }, // weekly, biweekly, monthly
      { id:'endDateISO',  type:'date', required:false }, // Series end
      { id:'dayOfWeek',   type:'text', required:false }, // Monday, Tuesday, etc.
      { id:'signupUrl',   type:'url',  required:false },
      { id:'videoUrl',    type:'url',  required:false }
    ]
  },
  {
    id:'event-workshop',
    label:'Workshop/Class',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'instructor',  type:'text', required:false },
      { id:'skillLevel',  type:'text', required:false }, // Beginner, Intermediate, Advanced
      { id:'materials',   type:'text', required:false }, // What to bring
      { id:'capacity',    type:'text', required:false },
      { id:'signupUrl',   type:'url',  required:false },
      { id:'videoUrl',    type:'url',  required:false }
    ]
  },
  {
    id:'event-fundraiser',
    label:'Fundraiser',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'cause',       type:'text', required:false },
      { id:'goalAmount',  type:'text', required:false },
      { id:'raisedAmount',type:'text', required:false },
      { id:'donateUrl',   type:'url',  required:false },
      { id:'impactStory', type:'text', required:false },
      { id:'videoUrl',    type:'url',  required:false }
    ]
  },
  {
    id:'event-virtual',
    label:'Virtual Event',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'timezone',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'platform',    type:'text', required:false }, // Zoom, Teams, etc.
      { id:'streamUrl',   type:'url',  required:false },
      { id:'accessCode',  type:'text', required:false },
      { id:'recordingUrl',type:'url',  required:false },
      { id:'signupUrl',   type:'url',  required:false }
    ]
  },
  {
    id:'event-tournament',
    label:'Tournament/Competition',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'format',      type:'text', required:false }, // Single-elim, Round-robin
      { id:'divisions',   type:'text', required:false }, // A, B, C or Age groups
      { id:'prizePool',   type:'text', required:false },
      { id:'registrationUrl',type:'url',required:false },
      { id:'resultsUrl',  type:'url',  required:false },
      { id:'videoUrl',    type:'url',  required:false }
    ]
  },
  {
    id:'event-social',
    label:'Social Gathering',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'description', type:'text', required:false },
      { id:'vibe',        type:'text', required:false }, // Casual, Formal, Family-friendly
      { id:'foodDrinks',  type:'text', required:false }, // What's provided
      { id:'ageRestriction',type:'text',required:false },
      { id:'rsvpUrl',     type:'url',  required:false },
      { id:'galleryUrls', type:'text', required:false }
    ]
  },
  {
    id:'league',
    label:'League Season',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'startDateISO',type:'date', required:true },
      { id:'endDateISO',  type:'date', required:false },
      { id:'sport',       type:'text', required:false },
      { id:'divisions',   type:'text', required:false }, // A, B, Rec
      { id:'numTeams',    type:'text', required:false },
      { id:'scheduleUrl', type:'url',  required:false },
      { id:'standingsUrl',type:'url',  required:false },
      { id:'rulesUrl',    type:'url',  required:false },
      { id:'registrationUrl',type:'url',required:false }
    ]
  },
  {
    id:'tournament',
    label:'Tournament',
    fields:[
      { id:'name',        type:'text', required:true },
      { id:'dateISO',     type:'date', required:true },
      { id:'location',    type:'text', required:false },
      { id:'sport',       type:'text', required:false },
      { id:'format',      type:'text', required:false }, // Single-elim, Double-elim, Round-robin
      { id:'numTeams',    type:'text', required:false },
      { id:'divisions',   type:'text', required:false },
      { id:'bracketUrl',  type:'url',  required:false },
      { id:'resultsUrl',  type:'url',  required:false },
      { id:'registrationUrl',type:'url',required:false }
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
