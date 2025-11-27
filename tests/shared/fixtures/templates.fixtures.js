/**
 * Template Fixtures - Single Source of Truth for Tests
 *
 * These fixtures MUST match TemplateService.gs EVENT_TEMPLATES.
 * If they drift, update this file to match production.
 *
 * Template sections map to event.settings.show* flags:
 *   sections.schedule  → settings.showSchedule
 *   sections.standings → settings.showStandings (implied by schedule for leagues)
 *   sections.bracket   → settings.showBracket (implied by schedule for tournaments)
 *   sections.sponsors  → settings.showSponsors
 *   sections.video     → settings.showVideo
 *   sections.map       → settings.showMap
 *   sections.gallery   → settings.showGallery
 *
 * @see src/mvp/TemplateService.gs EVENT_TEMPLATES
 * @see schemas/event.schema.json Settings
 */

/**
 * MVP Templates (focus group ready)
 */
const MVP_TEMPLATES = {
  bar_night: {
    id: 'bar_night',
    label: 'Bar / Tavern Event',
    icon: '🍺',
    sections: {
      video: true,
      map: true,
      schedule: false,
      sponsors: true,
      gallery: true
    }
  },
  rec_league: {
    id: 'rec_league',
    label: 'Rec League / Season',
    icon: '⚾',
    sections: {
      video: false,
      map: true,
      schedule: true,
      sponsors: true,
      gallery: true
    }
  },
  custom: {
    id: 'custom',
    label: 'Custom Event',
    icon: '✨',
    sections: {
      video: true,
      map: true,
      schedule: true,
      sponsors: true,
      gallery: true
    }
  }
};

/**
 * V2+ Templates (post-MVP)
 */
const V2_TEMPLATES = {
  school: {
    id: 'school',
    label: 'School / Youth Event',
    icon: '🎓',
    sections: {
      video: true,
      map: true,
      schedule: false,
      sponsors: true,
      gallery: true
    }
  },
  fundraiser: {
    id: 'fundraiser',
    label: 'Fundraiser / Charity',
    icon: '💝',
    sections: {
      video: true,
      map: true,
      schedule: false,
      sponsors: true,
      gallery: true
    }
  },
  corporate: {
    id: 'corporate',
    label: 'Corporate / Professional',
    icon: '💼',
    sections: {
      video: true,
      map: true,
      schedule: true,
      sponsors: true,
      gallery: false
    }
  },
  wedding: {
    id: 'wedding',
    label: 'Wedding',
    icon: '💒',
    sections: {
      video: true,
      map: true,
      schedule: true,
      sponsors: false,
      gallery: true
    }
  },
  trivia: {
    id: 'trivia',
    label: 'Trivia Night',
    icon: '🧠',
    sections: {
      video: false,
      map: true,
      schedule: false,
      sponsors: true,
      gallery: false
    }
  }
};

/**
 * All templates (MVP + V2)
 */
const ALL_TEMPLATES = { ...MVP_TEMPLATES, ...V2_TEMPLATES };

/**
 * Section to Settings mapping
 * Template sections map to event.settings.show* flags
 */
const SECTION_TO_SETTING_MAP = {
  schedule: 'showSchedule',
  // standings/bracket are derived from template type, not sections
  sponsors: 'showSponsors',
  video: 'showVideo',
  map: 'showMap',
  gallery: 'showGallery'
};

/**
 * Get expected settings.show* values for a template
 * @param {string} templateId - Template ID
 * @returns {Object} Expected settings values
 */
function getExpectedSettingsForTemplate(templateId) {
  const template = ALL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const settings = {
    // MVP Required defaults
    showSchedule: template.sections.schedule || false,
    showStandings: false, // Set by TemplateService based on template type
    showBracket: false,   // Set by TemplateService based on template type
    // MVP Optional
    showSponsors: template.sections.sponsors || false,
    showVideo: template.sections.video !== false,     // Default true
    showMap: template.sections.map !== false,         // Default true
    showGallery: template.sections.gallery !== false, // Default true
    // Surface-specific (always default true)
    showSponsorBanner: true,
    showSponsorStrip: true,
    showLeagueStrip: true,
    showQRSection: true
  };

  // League templates enable standings
  if (['rec_league', 'darts', 'bags', 'pinball'].includes(templateId)) {
    settings.showStandings = true;
  }

  // Tournament templates enable bracket
  if (['rec_league'].includes(templateId)) {
    settings.showBracket = true;
  }

  return settings;
}

/**
 * Custom template exposes ALL settings (full schema access)
 */
const CUSTOM_TEMPLATE_EXPECTED_SETTINGS = {
  showSchedule: true,
  showStandings: false,  // User toggles manually
  showBracket: false,    // User toggles manually
  showSponsors: true,
  showVideo: true,
  showMap: true,
  showGallery: true,
  showSponsorBanner: true,
  showSponsorStrip: true,
  showLeagueStrip: true,
  showQRSection: true
};

/**
 * All setting keys that should be available in Admin.html for Custom template
 */
const ALL_SETTING_KEYS = [
  'showSchedule',
  'showStandings',
  'showBracket',
  'showSponsors',
  'showVideo',
  'showMap',
  'showGallery',
  'showSponsorBanner',
  'showSponsorStrip',
  'showLeagueStrip',
  'showQRSection'
];

module.exports = {
  MVP_TEMPLATES,
  V2_TEMPLATES,
  ALL_TEMPLATES,
  SECTION_TO_SETTING_MAP,
  getExpectedSettingsForTemplate,
  CUSTOM_TEMPLATE_EXPECTED_SETTINGS,
  ALL_SETTING_KEYS
};
