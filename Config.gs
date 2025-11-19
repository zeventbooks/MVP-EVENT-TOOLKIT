// === Zeventbook Production Config ===
// Extended event model with full Triangle support

const ZEB = Object.freeze({
  APP_TITLE: 'Zeventbook',
  BUILD_ID: 'triangle-extended-v1.3',
  CONTRACT_VER: '1.0.3',

  // Customer-Friendly URL Routing
  // Maps friendly URLs to technical parameters for better UX
  // Example: /abc/events → ?brand=abc&p=public
  //          /abc/manage → ?brand=abc&p=admin
  URL_ALIASES: {
    // Public-facing aliases (no authentication required)
    'events': { page: 'public', label: 'Events', public: true },
    'schedule': { page: 'public', label: 'Schedule', public: true },
    'calendar': { page: 'public', label: 'Calendar', public: true },

    // Admin/Management aliases (authentication required)
    'manage': { page: 'admin', mode: 'advanced', label: 'Management', public: false },
    'admin': { page: 'admin', mode: 'advanced', label: 'Admin', public: false },
    'create': { page: 'wizard', label: 'Create Event', public: false },
    'planner': { page: 'planner', label: 'Event Planner', public: false },
    'cards': { page: 'planner', label: 'Card Interface', public: false },
    'dashboard': { page: 'admin', label: 'Dashboard', public: false },

    // Display aliases (for TV/kiosks)
    'display': { page: 'display', label: 'Display', public: true },
    'tv': { page: 'display', label: 'TV Display', public: true },
    'kiosk': { page: 'display', label: 'Kiosk', public: true },
    'screen': { page: 'display', label: 'Screen', public: true },

    // Marketing/Promotional aliases
    'posters': { page: 'poster', label: 'Posters', public: true },
    'poster': { page: 'poster', label: 'Poster', public: true },
    'flyers': { page: 'poster', label: 'Flyers', public: true },

    // Analytics aliases
    'analytics': { page: 'report', label: 'Analytics', public: false },
    'reports': { page: 'report', label: 'Reports', public: false },
    'insights': { page: 'report', label: 'Insights', public: false },
    'stats': { page: 'report', label: 'Statistics', public: false },

    // Utility aliases
    'status': { page: 'status', label: 'Status', public: true },
    'health': { page: 'status', label: 'Health Check', public: true },
    'docs': { page: 'api', label: 'API Docs', public: true },
    'api': { page: 'api', label: 'API Documentation', public: true }
  },

  // Brand URL Templates
  // Defines how brands can customize their URLs
  BRAND_URL_PATTERNS: {
    // Pattern: /{brand}/{alias}
    // Example: /abc/events, /cbc/manage
    enableBrandPrefix: true,

    // Pattern: subdomain routing (requires DNS)
    // Example: abc.zeventbooks.com/events
    enableSubdomainRouting: false,

    // Custom aliases per brand (optional)
    // Allows brands to create branded URLs
    customAliases: {
      // ABC (Parent Organization) - Custom URLs
      'abc': {
        'tournaments': { page: 'public', label: 'Tournaments', public: true },
        'leagues': { page: 'public', label: 'Leagues', public: true },
        'bocce': { page: 'public', label: 'Bocce Events', public: true },
        'network': { page: 'report', label: 'Network Analytics', public: false }  // Parent-level reporting
      },

      // CBC (Child Brand) - Custom URLs
      'cbc': {
        'tournaments': { page: 'public', label: 'CBC Tournaments', public: true },
        'club-events': { page: 'public', label: 'Club Events', public: true },
        'register': { page: 'wizard', label: 'Register Event', public: false }
      },

      // CBL (Child Brand) - Custom URLs
      'cbl': {
        'seasons': { page: 'public', label: 'Seasons', public: true },
        'league-events': { page: 'public', label: 'League Events', public: true },
        'schedule': { page: 'public', label: 'Schedule', public: true }
      }
    }
  },

  // Demo Mode Configuration
  // Activated via ?demo=true URL parameter
  // Use cases: Development testing, UAT, stakeholder demos, screenshots/videos
  DEMO_MODE: {
    // Visual indicators
    showBadge: true,              // Show "DEMO MODE" badge
    badgeText: '🧪 DEMO MODE',    // Badge text
    badgeColor: '#667eea',        // Badge color

    // Development & UAT features
    showDebugPanel: true,         // Show debug info panel
    showApiTiming: true,          // Log API response times
    showErrorDetails: true,       // Show detailed error messages
    enableConsoleLogging: true,   // Enhanced console logs

    // Sample data features
    enablePrefill: true,          // Enable sample data auto-fill
    showPrefillButton: true,      // Show "Fill Sample Data" button

    // Feature highlighting (for stakeholder demos)
    highlightNewFeatures: true,   // Add badges/glow to new features
    showHelpTooltips: true,       // Extra help tooltips

    // Screenshot/video mode
    showWatermark: false,         // Optional "DEMO" watermark (set to true for videos)
    hideRealData: true,           // Hide real user data in demo mode

    // Sample data templates
    sampleEvent: {
      name: 'Summer Bocce Tournament 2025',
      dateISO: '2025-08-15',
      timeISO: '18:00',
      location: 'Chicago Bocce Club - North Avenue Courts',
      entity: 'Chicago Bocce League',
      summary: 'Join us for the annual summer tournament! Open to all skill levels.',
      imageUrl: 'https://picsum.photos/800/400?random=1',
      sponsorIds: ''
    },

    sampleSponsor: {
      name: 'Local Pizza Co.',
      website: 'https://example.com',
      tier: 'Gold',
      entity: 'Chicago Bocce League',
      logoUrl: 'https://picsum.photos/200/200?random=2'
    }
  }
});

// Brands (multi-brand architecture, single DB for MVP)
// SECURITY: Admin secrets moved to Script Properties for security
// Set via: File > Project Properties > Script Properties in Apps Script UI
// Or via: PropertiesService.getScriptProperties().setProperty('ADMIN_SECRET_ROOT', 'your-secret')
const BRANDS = [
  {
    id: 'root',
    name: 'Zeventbook',
    hostnames: ['zeventbook.io','www.zeventbook.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_ROOT'
    store: { type: 'workbook', spreadsheetId: '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'abc',
    name: 'American Bocce Co.',
    type: 'parent',  // Parent organization
    childBrands: ['cbc', 'cbl'],  // Child brands under ABC
    hostnames: ['americanbocceco.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_ABC'
    store: { type: 'workbook', spreadsheetId: '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbc',
    name: 'Chicago Bocce Club',
    type: 'child',  // Child brand of ABC
    parentBrand: 'abc',  // Parent organization
    includeInPortfolioReports: true,  // Include this child in parent's brand portfolio analytics
    hostnames: ['chicagobocceclub.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_CBC'
    store: { type: 'workbook', spreadsheetId: '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ' },
    scopesAllowed: ['events', 'sponsors']
  },
  {
    id: 'cbl',
    name: 'Chicago Bocce League',
    type: 'child',  // Child brand of ABC
    parentBrand: 'abc',  // Parent organization
    includeInPortfolioReports: true,  // Include this child in parent's brand portfolio analytics
    hostnames: ['chicagobocceleague.zeventbooks.io'],
    logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
    // adminSecret: moved to Script Properties as 'ADMIN_SECRET_CBL'
    store: { type: 'workbook', spreadsheetId: '1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ' },
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
    id: 'sign-up',
    label: 'Sign-Up Form',
    description: 'Pre-registration for upcoming events',
    questions: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: false },
      { title: 'Number of Attendees', type: 'MULTIPLE_CHOICE', choices: ['1', '2', '3', '4', '5+'], required: true },
      { title: 'Dietary Restrictions', type: 'TEXT', required: false },
      { title: 'How did you hear about this event?', type: 'MULTIPLE_CHOICE', choices: ['Social Media', 'Friend/Family', 'Website', 'Email', 'Other'], required: false },
      { title: 'Special Requests or Comments', type: 'PARAGRAPH_TEXT', required: false }
    ]
  },
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
function loadBrands_() { return BRANDS; }
function findBrand_(id) { return BRANDS.find(b => b.id === id) || null; }
// Fixed: Bug #43 - Don't default to root brand for unknown hosts
function findBrandByHost_(host) {
  host = String(host || '').toLowerCase();
  const brand = BRANDS.find(b => (b.hostnames || []).includes(host));

  if (!brand) {
    // Log warning for unknown hostname
    try {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] Unknown hostname: ${host}`);
    } catch (e) {
      // Ignore logging errors
    }
  }

  return brand || null;
}
function findTemplate_(id) { return TEMPLATES.find(x => x.id === id) || null; }
function findFormTemplate_(id) { return FORM_TEMPLATES.find(x => x.id === id) || null; }
function listFormTemplates_() { return FORM_TEMPLATES; }

/**
 * Get admin secret for a brand from Script Properties
 * @param {string} brandId - Brand ID (root, abc, cbc, cbl)
 * @returns {string|null} - Admin secret or null if not found
 */
function getAdminSecret_(brandId) {
  if (!brandId) return null;

  const props = PropertiesService.getScriptProperties();
  const key = `ADMIN_SECRET_${brandId.toUpperCase()}`;
  const secret = props.getProperty(key);

  // If not found, log warning
  if (!secret) {
    console.warn(`Admin secret not found for brand: ${brandId}. Set via Script Properties: ${key}`);
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

  for (const [brandId, secret] of Object.entries(secrets)) {
    const key = `ADMIN_SECRET_${brandId.toUpperCase()}`;
    props.setProperty(key, secret);
    console.log(`✅ Set admin secret for brand: ${brandId}`);
  }

  console.log('✅ Admin secrets migration complete!');
  console.log('⚠️  Remove hardcoded secrets from Config.gs if not already done');
}

/**
 * URL Alias Resolution
 * Converts friendly URLs to technical parameters
 *
 * Examples:
 *   resolveUrlAlias_('events') → { page: 'public', label: 'Events' }
 *   resolveUrlAlias_('manage') → { page: 'admin', mode: 'advanced', label: 'Management' }
 *   resolveUrlAlias_('tournaments', 'abc') → { page: 'public', label: 'Tournaments' }
 *
 * @param {string} alias - Friendly URL alias
 * @param {string} brandId - Optional brand ID for custom aliases
 * @returns {object|null} - Alias configuration or null if not found
 */
function resolveUrlAlias_(alias, brandId) {
  if (!alias) return null;

  const aliasLower = alias.toLowerCase();

  // Check brand-specific custom aliases first
  if (brandId && ZEB.BRAND_URL_PATTERNS.customAliases[brandId]) {
    const customAlias = ZEB.BRAND_URL_PATTERNS.customAliases[brandId][aliasLower];
    if (customAlias) {
      return { ...customAlias, source: 'brand-custom' };
    }
  }

  // Check global aliases
  const globalAlias = ZEB.URL_ALIASES[aliasLower];
  if (globalAlias) {
    return { ...globalAlias, source: 'global' };
  }

  return null;
}

/**
 * Generate friendly URL for a page
 *
 * Examples:
 *   getFriendlyUrl_('public', 'abc') → '/abc/events'
 *   getFriendlyUrl_('admin', 'cbc') → '/cbc/manage'
 *   getFriendlyUrl_('display', 'root') → '/display'
 *
 * @param {string} page - Technical page name
 * @param {string} brandId - Brand ID (optional)
 * @param {object} options - Additional options (mode, etc.)
 * @returns {string} - Friendly URL path
 */
function getFriendlyUrl_(page, brandId, options = {}) {
  // Find matching alias
  let matchingAlias = null;

  // Check brand custom aliases first
  if (brandId && ZEB.BRAND_URL_PATTERNS.customAliases[brandId]) {
    for (const [alias, config] of Object.entries(ZEB.BRAND_URL_PATTERNS.customAliases[brandId])) {
      if (config.page === page &&
          (!options.mode || config.mode === options.mode)) {
        matchingAlias = alias;
        break;
      }
    }
  }

  // Check global aliases
  if (!matchingAlias) {
    for (const [alias, config] of Object.entries(ZEB.URL_ALIASES)) {
      if (config.page === page &&
          (!options.mode || config.mode === options.mode)) {
        matchingAlias = alias;
        break;
      }
    }
  }

  // Build URL
  if (matchingAlias) {
    if (ZEB.BRAND_URL_PATTERNS.enableBrandPrefix && brandId && brandId !== 'root') {
      return `/${brandId}/${matchingAlias}`;
    }
    return `/${matchingAlias}`;
  }

  // Fallback to query parameters
  let url = `?p=${page}`;
  if (brandId) url += `&brand=${brandId}`;
  if (options.mode) url += `&mode=${options.mode}`;
  return url;
}

/**
 * Get list of all available aliases
 * Useful for documentation and navigation menus
 *
 * @param {string} brandId - Optional brand ID to include custom aliases
 * @param {boolean} publicOnly - Only return public aliases
 * @returns {array} - Array of alias objects
 */
function listUrlAliases_(brandId, publicOnly = false) {
  const aliases = [];

  // Add global aliases
  for (const [alias, config] of Object.entries(ZEB.URL_ALIASES)) {
    if (!publicOnly || config.public) {
      aliases.push({
        alias: alias,
        ...config,
        url: getFriendlyUrl_(config.page, brandId, { mode: config.mode })
      });
    }
  }

  // Add brand custom aliases
  if (brandId && ZEB.BRAND_URL_PATTERNS.customAliases[brandId]) {
    for (const [alias, config] of Object.entries(ZEB.BRAND_URL_PATTERNS.customAliases[brandId])) {
      if (!publicOnly || config.public) {
        aliases.push({
          alias: alias,
          ...config,
          url: getFriendlyUrl_(config.page, brandId, { mode: config.mode }),
          custom: true
        });
      }
    }
  }

  return aliases;
}
