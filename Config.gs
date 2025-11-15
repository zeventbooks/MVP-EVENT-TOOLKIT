// === Zeventbook Production Config ===
// Extended event model with full Triangle support

const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'triangle-extended-v1.3',
  CONTRACT_VER: '1.0.3'
});

// Tenants (multi-tenant architecture, single DB for MVP)
// SECURITY: Admin secrets moved to Script Properties for security
// Set via: File > Project Properties > Script Properties in Apps Script UI
// Or via: PropertiesService.getScriptProperties().setProperty('ADMIN_SECRET_ROOT', 'your-secret')
const TENANTS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbook.io','www.zeventbook.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_ROOT'
    store: { type: 'workbook', spreadsheetId: '1ixHd2iUc27UF0fJvKh9hXsRI1XZtNRKqbZYf0vgMbKrBFItxngd7L-VO' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    hostnames: ['americanbocceco.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_ABC'
    store: { type: 'workbook', spreadsheetId: '1ixHd2iUc27UF0fJvKh9hXsRI1XZtNRKqbZYf0vgMbKrBFItxngd7L-VO' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_CBC'
    store: { type: 'workbook', spreadsheetId: '1ixHd2iUc27UF0fJvKh9hXsRI1XZtNRKqbZYf0vgMbKrBFItxngd7L-VO' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbl',
    name: 'Chicago Bocce League',
    hostnames: ['chicagobocceleague.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_CBL'
    store: { type: 'workbook', spreadsheetId: '1ixHd2iUc27UF0fJvKh9hXsRI1XZtNRKqbZYf0vgMbKrBFItxngd7L-VO' },
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
// Fixed: Bug #43 - Don't default to root tenant for unknown hosts
function findTenantByHost_(host) {
  host = String(host || '').toLowerCase();
  const tenant = TENANTS.find(t => (t.hostnames || []).includes(host));

  if (!tenant) {
    // Log warning for unknown hostname
    try {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] Unknown hostname: ${host}`);
    } catch (e) {
      // Ignore logging errors
    }
  }

  return tenant || null;
}
function findTemplate_(id) { return TEMPLATES.find(x => x.id === id) || null; }
function findFormTemplate_(id) { return FORM_TEMPLATES.find(x => x.id === id) || null; }
function listFormTemplates_() { return FORM_TEMPLATES; }

/**
 * Get admin secret for a tenant from Script Properties
 * @param {string} tenantId - Tenant ID (root, abc, cbc, cbl)
 * @returns {string|null} - Admin secret or null if not found
 */
function getAdminSecret_(tenantId) {
  if (!tenantId) return null;

  const props = PropertiesService.getScriptProperties();
  const key = `ADMIN_SECRET_${tenantId.toUpperCase()}`;
  const secret = props.getProperty(key);

  // If not found, log warning
  if (!secret) {
    console.warn(`Admin secret not found for tenant: ${tenantId}. Set via Script Properties: ${key}`);
  }

  return secret;
}

/**
 * Setup script - Initialize admin secrets in Script Properties
 * Run this once manually to migrate from hardcoded secrets
 * Example: setupAdminSecrets_({ root: 'secret1', abc: 'secret2', ... })
 */
function setupAdminSecrets_(secrets) {
  const props = PropertiesService.getScriptProperties();

  for (const [tenantId, secret] of Object.entries(secrets)) {
    const key = `ADMIN_SECRET_${tenantId.toUpperCase()}`;
    props.setProperty(key, secret);
    console.log(`✅ Set admin secret for tenant: ${tenantId}`);
  }

  console.log('✅ Admin secrets migration complete!');
  console.log('⚠️  Remove hardcoded secrets from Config.gs if not already done');
}
