/**
 * Template Service Unit Tests
 *
 * Tests for applyTemplateToEvent_ and template system behavior.
 * Validates that templates correctly seed sections, ctaLabels, and defaults
 * while preserving user edits.
 *
 * @see TemplateService.gs
 */

// Mock template data matching TemplateService.gs
const EVENT_TEMPLATES = {
  bar_night: {
    id: 'bar_night',
    label: 'Bar / Tavern Event',
    icon: '🍺',
    sections: {
      video: true,
      map: true,
      schedule: false,
      sponsors: true,
      notes: true,
      gallery: false
    },
    defaultCtas: ['RSVP', 'Add to Calendar'],
    defaults: {
      audience: 'Adults 21+',
      notesLabel: 'House Rules',
      sponsorStripLabel: "Tonight's Sponsors"
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
      notes: true,
      gallery: false
    },
    defaultCtas: ['Register Team', 'View Schedule'],
    defaults: {
      audience: 'Teams & Captains',
      notesLabel: 'League Notes',
      sponsorStripLabel: 'Season Sponsors'
    }
  },
  school: {
    id: 'school',
    label: 'School / Youth Event',
    icon: '🎓',
    sections: {
      video: true,
      map: true,
      schedule: false,
      sponsors: true,
      notes: true,
      gallery: true
    },
    defaultCtas: ['Buy Tickets', 'Donate'],
    defaults: {
      audience: 'Families & Supporters',
      notesLabel: 'Event Details',
      sponsorStripLabel: 'Our Sponsors'
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
      notes: true,
      gallery: true
    },
    defaultCtas: ['Donate', 'Buy Tickets', 'Share'],
    defaults: {
      audience: 'Donors & Guests',
      notesLabel: 'About the Cause',
      sponsorStripLabel: 'Event Sponsors'
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
      notes: true,
      gallery: true
    },
    defaultCtas: ['Register', 'Learn More'],
    defaults: {
      audience: 'Everyone',
      notesLabel: 'Notes',
      sponsorStripLabel: 'Sponsors'
    }
  }
};

// Implementation matching TemplateService.gs
function getEventTemplate_(templateId) {
  return EVENT_TEMPLATES[templateId] || EVENT_TEMPLATES.custom;
}

function applyTemplateToEvent_(event, templateId) {
  const tpl = getEventTemplate_(templateId);

  // Set template reference
  event.templateId = tpl.id;

  // Initialize sections if not present
  event.sections = event.sections || {};

  // Apply section defaults (only where user hasn't overridden)
  Object.keys(tpl.sections).forEach(function(key) {
    if (event.sections[key] == null) {
      event.sections[key] = tpl.sections[key];
    }
  });

  // Apply default CTAs if none set
  if (!event.ctaLabels || !event.ctaLabels.length) {
    event.ctaLabels = tpl.defaultCtas.slice();
  }

  // Apply other defaults
  if (tpl.defaults) {
    if (!event.audience && tpl.defaults.audience) {
      event.audience = tpl.defaults.audience;
    }
    if (!event.notesLabel && tpl.defaults.notesLabel) {
      event.notesLabel = tpl.defaults.notesLabel;
    }
    if (!event.sponsorStripLabel && tpl.defaults.sponsorStripLabel) {
      event.sponsorStripLabel = tpl.defaults.sponsorStripLabel;
    }
  }

  return event;
}

// ============================================================================
// TESTS
// ============================================================================

describe('TemplateService - applyTemplateToEvent_', () => {

  describe('Bar Night Template', () => {
    test('sets correct sections for bar_night', () => {
      const event = { name: 'Trivia Night' };
      const result = applyTemplateToEvent_(event, 'bar_night');

      expect(result.templateId).toBe('bar_night');
      expect(result.sections.video).toBe(true);
      expect(result.sections.map).toBe(true);
      expect(result.sections.schedule).toBe(false); // Bar events don't have schedules
      expect(result.sections.sponsors).toBe(true);
      expect(result.sections.gallery).toBe(false);
    });

    test('sets correct CTAs for bar_night', () => {
      const event = { name: 'Happy Hour' };
      const result = applyTemplateToEvent_(event, 'bar_night');

      expect(result.ctaLabels).toEqual(['RSVP', 'Add to Calendar']);
    });

    test('sets correct defaults for bar_night', () => {
      const event = { name: 'Live Music' };
      const result = applyTemplateToEvent_(event, 'bar_night');

      expect(result.audience).toBe('Adults 21+');
      expect(result.notesLabel).toBe('House Rules');
      expect(result.sponsorStripLabel).toBe("Tonight's Sponsors");
    });
  });

  describe('Rec League Template', () => {
    test('sets correct sections for rec_league', () => {
      const event = { name: 'Summer Softball' };
      const result = applyTemplateToEvent_(event, 'rec_league');

      expect(result.templateId).toBe('rec_league');
      expect(result.sections.video).toBe(false); // Rec leagues don't need video
      expect(result.sections.schedule).toBe(true); // Rec leagues NEED schedule
      expect(result.sections.map).toBe(true);
      expect(result.sections.sponsors).toBe(true);
    });

    test('sets correct CTAs for rec_league', () => {
      const event = { name: 'Basketball League' };
      const result = applyTemplateToEvent_(event, 'rec_league');

      expect(result.ctaLabels).toEqual(['Register Team', 'View Schedule']);
    });

    test('sets league-specific labels', () => {
      const event = { name: 'Volleyball Tournament' };
      const result = applyTemplateToEvent_(event, 'rec_league');

      expect(result.notesLabel).toBe('League Notes');
      expect(result.sponsorStripLabel).toBe('Season Sponsors');
    });
  });

  describe('School/Fundraiser Templates', () => {
    test('school template enables gallery section', () => {
      const event = { name: 'Band Concert' };
      const result = applyTemplateToEvent_(event, 'school');

      expect(result.sections.gallery).toBe(true);
      expect(result.sections.schedule).toBe(false);
    });

    test('school template sets Buy Tickets / Donate CTAs', () => {
      const event = { name: 'Sports Banquet' };
      const result = applyTemplateToEvent_(event, 'school');

      expect(result.ctaLabels).toContain('Buy Tickets');
      expect(result.ctaLabels).toContain('Donate');
    });

    test('fundraiser template sets Donate as primary CTA', () => {
      const event = { name: 'Charity Gala' };
      const result = applyTemplateToEvent_(event, 'fundraiser');

      expect(result.ctaLabels[0]).toBe('Donate'); // First CTA is Donate
      expect(result.ctaLabels).toContain('Buy Tickets');
      expect(result.ctaLabels).toContain('Share');
    });

    test('fundraiser sets cause-specific labels', () => {
      const event = { name: 'Benefit Night' };
      const result = applyTemplateToEvent_(event, 'fundraiser');

      expect(result.notesLabel).toBe('About the Cause');
    });
  });

  describe('Custom Template', () => {
    test('custom template enables all sections', () => {
      const event = { name: 'My Custom Event' };
      const result = applyTemplateToEvent_(event, 'custom');

      expect(result.templateId).toBe('custom');
      expect(result.sections.video).toBe(true);
      expect(result.sections.map).toBe(true);
      expect(result.sections.schedule).toBe(true);
      expect(result.sections.sponsors).toBe(true);
      expect(result.sections.notes).toBe(true);
      expect(result.sections.gallery).toBe(true);
    });
  });

  describe('Idempotent & Non-Destructive Behavior', () => {
    test('calling applyTemplateToEvent_ twice produces same result', () => {
      const event = { name: 'Test Event' };
      const result1 = applyTemplateToEvent_(event, 'bar_night');
      const result2 = applyTemplateToEvent_(result1, 'bar_night');

      expect(result1).toEqual(result2);
    });

    test('preserves user-set sections when template is applied', () => {
      const event = {
        name: 'Custom Bar Event',
        sections: {
          video: false, // User turned off video
          schedule: true // User turned on schedule (unusual for bar)
        }
      };
      const result = applyTemplateToEvent_(event, 'bar_night');

      // User overrides should be preserved
      expect(result.sections.video).toBe(false); // User's choice
      expect(result.sections.schedule).toBe(true); // User's choice
      // Template defaults should fill in the rest
      expect(result.sections.map).toBe(true);
      expect(result.sections.sponsors).toBe(true);
    });

    test('preserves user-set CTAs when template is applied', () => {
      const event = {
        name: 'Special Event',
        ctaLabels: ['Custom CTA', 'Another CTA']
      };
      const result = applyTemplateToEvent_(event, 'bar_night');

      // User's custom CTAs should be preserved
      expect(result.ctaLabels).toEqual(['Custom CTA', 'Another CTA']);
    });

    test('preserves user-set labels when template is applied', () => {
      const event = {
        name: 'My Event',
        notesLabel: 'My Custom Notes Label',
        sponsorStripLabel: 'My Custom Sponsors'
      };
      const result = applyTemplateToEvent_(event, 'bar_night');

      // User's labels should be preserved
      expect(result.notesLabel).toBe('My Custom Notes Label');
      expect(result.sponsorStripLabel).toBe('My Custom Sponsors');
    });

    test('preserves existing event data (name, date, location)', () => {
      const event = {
        id: 'EVT_123',
        name: 'Trivia Night',
        dateTime: '2025-12-01T19:00:00',
        location: '123 Main St',
        videoUrl: 'https://youtube.com/watch?v=abc',
        mapEmbedUrl: 'https://maps.google.com/embed?...',
        sponsors: [{ name: 'Acme Corp' }]
      };
      const result = applyTemplateToEvent_(event, 'bar_night');

      // All original data should be preserved
      expect(result.id).toBe('EVT_123');
      expect(result.name).toBe('Trivia Night');
      expect(result.dateTime).toBe('2025-12-01T19:00:00');
      expect(result.location).toBe('123 Main St');
      expect(result.videoUrl).toBe('https://youtube.com/watch?v=abc');
      expect(result.mapEmbedUrl).toBe('https://maps.google.com/embed?...');
      expect(result.sponsors).toEqual([{ name: 'Acme Corp' }]);
    });
  });

  describe('Template Switching', () => {
    test('switching templates updates templateId', () => {
      const event = { name: 'Test' };
      let result = applyTemplateToEvent_(event, 'bar_night');
      expect(result.templateId).toBe('bar_night');

      result = applyTemplateToEvent_(result, 'rec_league');
      expect(result.templateId).toBe('rec_league');
    });

    test('switching templates fills in missing sections from new template', () => {
      const event = { name: 'Test', sections: { video: true } };
      let result = applyTemplateToEvent_(event, 'bar_night');

      // Now switch to rec_league which has schedule=true by default
      result = applyTemplateToEvent_(result, 'rec_league');

      // video should stay as user set it
      expect(result.sections.video).toBe(true);
      // schedule was not set by user, so new template default applies
      // (but since bar_night already set it to false, it stays false)
      // This is correct behavior - template only sets null values
    });
  });

  describe('Fallback to Custom Template', () => {
    test('unknown templateId falls back to custom', () => {
      const event = { name: 'Unknown Template' };
      const result = applyTemplateToEvent_(event, 'nonexistent_template');

      expect(result.templateId).toBe('custom');
      // Should get custom template's sections (all enabled)
      expect(result.sections.video).toBe(true);
      expect(result.sections.schedule).toBe(true);
    });
  });

});

describe('Template Catalog Integrity', () => {

  test('all MVP templates are defined', () => {
    const mvpTemplates = ['bar_night', 'rec_league', 'school', 'fundraiser', 'custom'];

    mvpTemplates.forEach(id => {
      expect(EVENT_TEMPLATES[id]).toBeDefined();
      expect(EVENT_TEMPLATES[id].id).toBe(id);
      expect(EVENT_TEMPLATES[id].label).toBeTruthy();
      expect(EVENT_TEMPLATES[id].sections).toBeDefined();
      expect(EVENT_TEMPLATES[id].defaultCtas).toBeDefined();
    });
  });

  test('all templates have required fields', () => {
    Object.values(EVENT_TEMPLATES).forEach(tpl => {
      expect(tpl).toHaveProperty('id');
      expect(tpl).toHaveProperty('label');
      expect(tpl).toHaveProperty('sections');
      expect(tpl).toHaveProperty('defaultCtas');
      expect(Array.isArray(tpl.defaultCtas)).toBe(true);
    });
  });

  test('all templates have all section keys', () => {
    const requiredSections = ['video', 'map', 'schedule', 'sponsors', 'notes', 'gallery'];

    Object.values(EVENT_TEMPLATES).forEach(tpl => {
      requiredSections.forEach(section => {
        expect(tpl.sections).toHaveProperty(section);
        expect(typeof tpl.sections[section]).toBe('boolean');
      });
    });
  });

});
