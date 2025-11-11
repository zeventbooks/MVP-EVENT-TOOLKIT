// === Zeventbook Production Config ===
// Extended event model with full Triangle support

const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'triangle-extended-v1.3',
  CONTRACT_VER: '1.0.3'
});

// Tenants (multi-tenant architecture, single DB for MVP)
const TENANTS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbook.io','www.zeventbook.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    adminSecret: '4a249d9791716c208479712c74aae27a',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    hostnames: ['americanbocceco.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    adminSecret: 'CHANGE_ME_abc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    adminSecret: 'CHANGE_ME_cbc',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbl',
    name: 'Chicago Bocce League',
    hostnames: ['chicagobocceleague.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    adminSecret: 'CHANGE_ME_cbl',
    store: { type: 'workbook', spreadsheetId: SpreadsheetApp.getActive().getId() },
    scopesAllowed: ['events', 'sponsors']
  }
];

// Templates - Extended event model
const TEMPLATES = [
  {
    id: 'event',
    label: 'Event',
    fields: [
      // Core fields
      { id: 'name',        type: 'text', required: true },
      { id: 'dateISO',     type: 'date', required: true },
      { id: 'timeISO',     type: 'time', required: false },
      { id: 'location',    type: 'text', required: false },
      { id: 'entity',      type: 'text', required: false },

      // Summary
      { id: 'summary',     type: 'text', required: false },
      { id: 'summaryLink', type: 'url',  required: false },

      // Media
      { id: 'imageUrl',    type: 'url',  required: false },
      { id: 'videoUrl',    type: 'url',  required: false },
      { id: 'galleryUrls', type: 'text', required: false }, // Comma-separated URLs

      // Bio
      { id: 'bio',         type: 'text', required: false },
      { id: 'bioLink',     type: 'url',  required: false },

      // Sign-up URLs
      { id: 'signupUrl',   type: 'url',  required: false },
      { id: 'registerUrl', type: 'url',  required: false },
      { id: 'checkinUrl',  type: 'url',  required: false },
      { id: 'walkinUrl',   type: 'url',  required: false },
      { id: 'surveyUrl',   type: 'url',  required: false },

      // Sponsors (comma-separated IDs)
      { id: 'sponsorIds',  type: 'text', required: false }
    ]
  },
  {
    id: 'sponsor',
    label: 'Sponsor',
    fields: [
      { id: 'name',        type: 'text', required: true },
      { id: 'logoUrl',     type: 'url',  required: false },
      { id: 'website',     type: 'url',  required: false },
      { id: 'tier',        type: 'text', required: false },
      { id: 'entity',      type: 'text', required: false },
      { id: 'startDate',   type: 'date', required: false },
      { id: 'endDate',     type: 'date', required: false },
      { id: 'displayOrder', type: 'text', required: false }
    ]
  }
];

// Google Forms Templates - Pre-built form configurations
const FORM_TEMPLATES = [
  {
    id: 'check-in',
    label: 'Check-In Form',
    description: 'Quick check-in for registered attendees',
    questions: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Confirmation Number (if available)', type: 'TEXT', required: false },
      { title: 'Number in Party', type: 'MULTIPLE_CHOICE', choices: ['1', '2', '3', '4', '5+'], required: true },
      { title: 'Additional Notes', type: 'PARAGRAPH_TEXT', required: false }
    ]
  },
  {
    id: 'walk-in',
    label: 'Walk-In Registration Form',
    description: 'Registration for walk-in attendees',
    questions: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: false },
      { title: 'Number in Party', type: 'MULTIPLE_CHOICE', choices: ['1', '2', '3', '4', '5+'], required: true },
      { title: 'How did you hear about this event?', type: 'MULTIPLE_CHOICE', choices: ['Social Media', 'Friend/Family', 'Website', 'Email', 'Other'], required: false },
      { title: 'Additional Comments', type: 'PARAGRAPH_TEXT', required: false }
    ]
  },
  {
    id: 'survey',
    label: 'Post-Event Survey',
    description: 'Feedback and satisfaction survey',
    questions: [
      { title: 'Overall, how would you rate this event?', type: 'SCALE', scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Poor', scaleMaxLabel: 'Excellent', required: true },
      { title: 'What did you enjoy most about the event?', type: 'PARAGRAPH_TEXT', required: false },
      { title: 'What could we improve for future events?', type: 'PARAGRAPH_TEXT', required: false },
      { title: 'Would you attend another event?', type: 'MULTIPLE_CHOICE', choices: ['Definitely', 'Probably', 'Not Sure', 'Probably Not', 'Definitely Not'], required: true },
      { title: 'Would you recommend this event to others?', type: 'SCALE', scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Not Likely', scaleMaxLabel: 'Very Likely', required: true },
      { title: 'Any additional feedback?', type: 'PARAGRAPH_TEXT', required: false }
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
function findFormTemplate_(id) { return FORM_TEMPLATES.find(x => x.id === id) || null; }
function listFormTemplates_() { return FORM_TEMPLATES; }
