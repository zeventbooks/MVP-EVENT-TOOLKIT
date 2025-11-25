/**
 * API Schemas and Contracts
 *
 * GAS runtime validation that MIRRORS the JSON Schema source of truth:
 *   - /schemas/event.schema.json   (Event entity)
 *   - /schemas/sponsor.schema.json (Sponsor entity)
 *
 * IMPORTANT: If a field isn't in the JSON schema, it doesn't exist.
 *            If it's in the schema, it must be wired here.
 *
 * See EVENT_CONTRACT.md for human-readable documentation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESPONSE ENVELOPE CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ALL API endpoints MUST return one of these two envelope shapes:
 *
 * SUCCESS:
 * {
 *   ok: true,
 *   etag?: string,           // Optional cache tag
 *   notModified?: boolean,   // Optional 304 equivalent
 *   value: { ... }           // Endpoint-specific payload
 * }
 *
 * ERROR:
 * {
 *   ok: false,
 *   code: "BAD_INPUT" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL" | "UNAUTHORIZED" | "CONTRACT",
 *   message: "Human-readable error description"
 * }
 *
 * NUSDK.html handles these envelopes consistently:
 * - Success: res.ok === true, data in res.value
 * - Error: res.ok === false, error in res.code + res.message
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RPC ENDPOINT INVENTORY (12 endpoints used by surfaces)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Admin.html:
 *   - api_getEventTemplates   → templates.getEventTemplates
 *   - api_create              → events.create
 *   - api_get                 → events.get
 *   - api_updateEventData     → events.update
 *   - api_createFormFromTemplate → forms.createFromTemplate
 *   - api_generateFormShortlink  → forms.generateShortlink
 *
 * Public.html:
 *   - api_getPublicBundle     → bundles.public
 *   - api_list                → events.list
 *   - api_logExternalClick    → analytics.logExternalClick
 *
 * Display.html:
 *   - api_getDisplayBundle    → bundles.display
 *   - api_logExternalClick    → analytics.logExternalClick
 *
 * Poster.html:
 *   - api_getPosterBundle     → bundles.poster
 *
 * SharedReport.html:
 *   - api_getSharedAnalytics  → analytics.getSharedReport
 *   - api_getSponsorAnalytics → sponsors.getAnalytics
 *   - api_exportSharedReport  → analytics.exportReport
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @module ApiSchemas
 * @version 2.2.0
 * @see /schemas/event.schema.json
 * @see /schemas/sponsor.schema.json
 * @see EVENT_CONTRACT.md
 */

// === Common Schemas =======================================================

const SCHEMAS = {
  // Common types
  common: {
    id: {
      type: 'string',
      pattern: '^[a-zA-Z0-9_-]+$',
      minLength: 1,
      maxLength: 128
    },
    brandId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9_-]+$',
      minLength: 1,
      maxLength: 64
    },
    scope: {
      type: 'string',
      enum: ['events', 'leagues', 'tournaments']
    },
    isoDate: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z)?$'
    },
    url: {
      type: 'string',
      pattern: '^https?://.+'
    },
    email: {
      type: 'string',
      pattern: '^[^@]+@[^@]+\\.[^@]+$'
    }
  },

  // === Authentication Schemas ==============================================

  auth: {
    generateToken: {
      request: {
        type: 'object',
        required: ['brandId', 'adminKey'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          adminKey: { type: 'string', minLength: 1 },
          expiresIn: { type: 'number', minimum: 60, maximum: 86400 },
          scope: { $ref: '#/common/scope' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['token', 'expiresIn', 'expiresAt', 'usage'],
            properties: {
              token: { type: 'string' },
              expiresIn: { type: 'number' },
              expiresAt: { $ref: '#/common/isoDate' },
              usage: { type: 'string' }
            }
          }
        }
      }
    }
  },

  // === Event Schemas =======================================================
  // MIRRORS: /schemas/event.schema.json (v2.1.0)
  // See EVENT_CONTRACT.md for human-readable documentation

  events: {
    // Shared schema definitions for reuse

    // Schedule row for event schedule
    _scheduleRow: {
      type: 'object',
      required: ['time', 'title'],
      properties: {
        time: { type: 'string' },
        title: { type: 'string' },
        description: { type: ['string', 'null'] }
      }
    },

    // Standing row for standings table
    _standingRow: {
      type: 'object',
      required: ['rank', 'team', 'wins', 'losses'],
      properties: {
        rank: { type: 'number' },
        team: { type: 'string' },
        wins: { type: 'number' },
        losses: { type: 'number' },
        points: { type: ['number', 'null'] }
      }
    },

    // Bracket match
    _bracketMatch: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        team1: { type: ['string', 'null'] },
        team2: { type: ['string', 'null'] },
        score1: { type: ['number', 'null'] },
        score2: { type: ['number', 'null'] },
        winner: { type: ['string', 'null'] }
      }
    },

    // Bracket round
    _bracketRound: {
      type: 'object',
      required: ['name', 'matches'],
      properties: {
        name: { type: 'string' },
        matches: {
          type: 'array',
          items: { $ref: '#/schemas/events/_bracketMatch' }
        }
      }
    },

    // CTA object (primary/secondary)
    _cta: {
      type: 'object',
      required: ['label', 'url'],
      properties: {
        label: { type: 'string', minLength: 1 },
        url: { type: 'string' }
      }
    },

    // Sponsor with placement (V2) - MIRRORS: /schemas/sponsor.schema.json
    _sponsor: {
      type: 'object',
      required: ['id', 'name', 'logoUrl', 'placement'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        logoUrl: { type: 'string' },
        linkUrl: { type: ['string', 'null'] },
        placement: {
          type: 'string',
          enum: ['poster', 'display', 'public', 'tv-banner']
        }
      }
    },

    // Media object (V2)
    _media: {
      type: ['object', 'null'],
      properties: {
        videoUrl: { type: ['string', 'null'] },
        mapUrl: { type: ['string', 'null'] },
        gallery: {
          type: ['array', 'null'],
          items: { type: 'string' }
        }
      }
    },

    // External data (V2)
    _externalData: {
      type: ['object', 'null'],
      properties: {
        scheduleUrl: { type: ['string', 'null'] },
        standingsUrl: { type: ['string', 'null'] },
        bracketUrl: { type: ['string', 'null'] }
      }
    },

    // Analytics (Reserved)
    _analytics: {
      type: ['object', 'null'],
      properties: {
        enabled: { type: 'boolean' },
        eventViews: { type: ['number', 'null'] },
        publicPageViews: { type: ['number', 'null'] },
        displayViews: { type: ['number', 'null'] },
        signupStarts: { type: ['number', 'null'] },
        signupCompletes: { type: ['number', 'null'] },
        qrScans: { type: ['number', 'null'] }
      }
    },

    // Payments (Reserved)
    _payments: {
      type: ['object', 'null'],
      properties: {
        enabled: { type: 'boolean' },
        provider: { type: 'string', enum: ['stripe'] },
        price: { type: 'number' },
        currency: { type: 'string' },
        checkoutUrl: { type: ['string', 'null'] }
      }
    },

    // Settings - MIRRORS: /schemas/event.schema.json Settings (MVP-frozen v2.2)
    _settings: {
      type: 'object',
      required: ['showSchedule', 'showStandings', 'showBracket'],
      properties: {
        // MVP Required
        showSchedule: { type: 'boolean' },
        showStandings: { type: 'boolean' },
        showBracket: { type: 'boolean' },
        // MVP Optional (V2 content but MVP toggles)
        showSponsors: { type: 'boolean' },
        // MVP Optional - surface-specific toggles (default true)
        showSponsorBanner: { type: 'boolean' },
        showSponsorStrip: { type: 'boolean' },
        showLeagueStrip: { type: 'boolean' },
        showQRSection: { type: 'boolean' }
      }
    },

    // Full event shape - MIRRORS: /schemas/event.schema.json (MVP-frozen v2.2)
    _eventShape: {
      type: 'object',
      required: ['id', 'slug', 'name', 'startDateISO', 'venue', 'links', 'qr', 'ctas', 'settings', 'createdAtISO', 'updatedAtISO'],
      properties: {
        // Identity (MVP Required)
        id: { $ref: '#/common/id' },
        slug: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1, maxLength: 200 },
        startDateISO: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        venue: { type: 'string', minLength: 1, maxLength: 200 },
        templateId: { type: ['string', 'null'], maxLength: 64 },  // MVP Optional

        // Links (MVP Required)
        links: {
          type: 'object',
          required: ['publicUrl', 'displayUrl', 'posterUrl', 'signupUrl'],
          properties: {
            publicUrl: { type: 'string' },
            displayUrl: { type: 'string' },
            posterUrl: { type: 'string' },
            signupUrl: { type: 'string' },
            sharedReportUrl: { type: ['string', 'null'] }
          }
        },

        // QR Codes (MVP Required)
        qr: {
          type: 'object',
          required: ['public', 'signup'],
          properties: {
            public: { type: 'string' },
            signup: { type: 'string' }
          }
        },

        // Schedule/Standings/Bracket (MVP Optional)
        schedule: {
          type: ['array', 'null'],
          items: { $ref: '#/schemas/events/_scheduleRow' }
        },
        standings: {
          type: ['array', 'null'],
          items: { $ref: '#/schemas/events/_standingRow' }
        },
        bracket: {
          type: ['object', 'null'],
          properties: {
            rounds: {
              type: 'array',
              items: { $ref: '#/schemas/events/_bracketRound' }
            }
          }
        },

        // CTAs (MVP Required)
        ctas: {
          type: 'object',
          required: ['primary'],
          properties: {
            primary: { $ref: '#/schemas/events/_cta' },
            secondary: {
              oneOf: [
                { $ref: '#/schemas/events/_cta' },
                { type: 'null' }
              ]
            }
          }
        },

        // Sponsors (V2 Optional)
        sponsors: {
          type: ['array', 'null'],
          items: { $ref: '#/schemas/events/_sponsor' }
        },

        // Media (V2 Optional)
        media: { $ref: '#/schemas/events/_media' },

        // External Data (V2 Optional)
        externalData: { $ref: '#/schemas/events/_externalData' },

        // Analytics (Reserved)
        analytics: { $ref: '#/schemas/events/_analytics' },

        // Payments (Reserved)
        payments: { $ref: '#/schemas/events/_payments' },

        // Settings (MVP Required)
        settings: { $ref: '#/schemas/events/_settings' },

        // Metadata (MVP Required)
        createdAtISO: { $ref: '#/common/isoDate' },
        updatedAtISO: { $ref: '#/common/isoDate' }
      }
    },

    list: {
      request: {
        type: 'object',
        required: ['brandId', 'scope'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 },
          ifNoneMatch: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          notModified: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['items', 'pagination'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/schemas/events/_eventShape' }
              },
              pagination: {
                type: 'object',
                required: ['total', 'limit', 'offset', 'hasMore'],
                properties: {
                  total: { type: 'number' },
                  limit: { type: 'number' },
                  offset: { type: 'number' },
                  hasMore: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    },

    get: {
      request: {
        type: 'object',
        required: ['brandId', 'scope', 'id'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          id: { $ref: '#/common/id' },
          ifNoneMatch: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          notModified: { type: 'boolean' },
          value: { $ref: '#/schemas/events/_eventShape' }
        }
      }
    },

    create: {
      request: {
        type: 'object',
        required: ['brandId', 'scope', 'templateId', 'data', 'adminKey'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          templateId: { type: 'string' },
          data: { type: 'object' },
          adminKey: { type: 'string' },
          idemKey: { type: 'string', pattern: '^[a-zA-Z0-9-]{1,128}$' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['id', 'links'],
            properties: {
              id: { $ref: '#/common/id' },
              links: { type: 'object' }
            }
          }
        }
      }
    },

    update: {
      request: {
        type: 'object',
        required: ['brandId', 'id', 'data', 'adminKey'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          id: { $ref: '#/common/id' },
          data: { type: 'object' },
          adminKey: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['id', 'data'],
            properties: {
              id: { $ref: '#/common/id' },
              data: { type: 'object' }
            }
          }
        }
      }
    }
  },

  // === Bundle Schemas ======================================================
  // Optimized payloads for each surface (Public, Display, Poster)

  bundles: {
    // api_getPublicBundle - Public.html
    public: {
      request: {
        type: 'object',
        required: ['brandId', 'id'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          id: { $ref: '#/common/id' },
          ifNoneMatch: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          notModified: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['event', 'config'],
            properties: {
              event: { $ref: '#/schemas/events/_eventShape' },
              config: {
                type: 'object',
                properties: {
                  brandId: { type: 'string' },
                  brandName: { type: 'string' },
                  appTitle: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },

    // api_getDisplayBundle - Display.html
    display: {
      request: {
        type: 'object',
        required: ['brandId', 'id'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          id: { $ref: '#/common/id' },
          ifNoneMatch: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          notModified: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['event', 'rotation', 'layout'],
            properties: {
              event: { $ref: '#/schemas/events/_eventShape' },
              rotation: {
                type: 'object',
                properties: {
                  sponsorSlots: { type: 'number' },
                  rotationMs: { type: 'number' }
                }
              },
              layout: {
                type: 'object',
                properties: {
                  hasSidePane: { type: 'boolean' },
                  emphasis: { type: 'string', enum: ['hero', 'scores', 'sponsors'] }
                }
              }
            }
          }
        }
      }
    },

    // api_getPosterBundle - Poster.html
    poster: {
      request: {
        type: 'object',
        required: ['brandId', 'id'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          scope: { $ref: '#/common/scope' },
          id: { $ref: '#/common/id' },
          ifNoneMatch: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          notModified: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['event', 'qrCodes', 'print'],
            properties: {
              event: { $ref: '#/schemas/events/_eventShape' },
              qrCodes: {
                type: 'object',
                properties: {
                  public: { type: ['string', 'null'] },
                  signup: { type: ['string', 'null'] }
                }
              },
              print: {
                type: 'object',
                properties: {
                  dateLine: { type: ['string', 'null'] },
                  venueLine: { type: ['string', 'null'] }
                }
              }
            }
          }
        }
      }
    }
  },

  // === Template Schemas ====================================================

  templates: {
    // api_getEventTemplates - Admin.html
    getEventTemplates: {
      request: {
        type: 'object',
        required: ['brandId'],
        properties: {
          brandId: { $ref: '#/common/brandId' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['templates', 'defaultTemplateId'],
            properties: {
              templates: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'label'],
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    description: { type: 'string' },
                    icon: { type: 'string' },
                    exampleName: { type: 'string' }
                  }
                }
              },
              defaultTemplateId: { type: 'string' }
            }
          }
        }
      }
    }
  },

  // === Analytics Schemas ===================================================

  analytics: {
    // api_logExternalClick - Public.html, Display.html
    logExternalClick: {
      request: {
        type: 'object',
        required: ['eventId', 'surface', 'token'],
        properties: {
          eventId: { $ref: '#/common/id' },
          surface: { type: 'string', enum: ['public', 'display', 'poster'] },
          token: { type: 'string' },
          brandId: { $ref: '#/common/brandId' }
        }
      },
      response: {
        type: 'object',
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            properties: {
              logged: { type: 'boolean' }
            }
          }
        }
      }
    },

    // api_getSharedAnalytics - SharedReport.html
    getSharedReport: {
      request: {
        type: 'object',
        required: ['brandId', 'id'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          id: { $ref: '#/common/id' },
          scope: { $ref: '#/common/scope' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          etag: { type: 'string' },
          value: {
            type: 'object',
            required: ['event', 'metrics'],
            properties: {
              event: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  startDateISO: { type: 'string' },
                  venue: { type: 'string' },
                  templateId: { type: 'string' }
                }
              },
              metrics: {
                type: 'object',
                properties: {
                  views: { type: 'number' },
                  uniqueViews: { type: 'number' },
                  signupClicks: { type: 'number' },
                  checkinClicks: { type: 'number' },
                  feedbackClicks: { type: 'number' },
                  sponsor: { type: 'object' },
                  league: { type: 'object' },
                  broadcast: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },

    // api_exportSharedReport - SharedReport.html
    exportReport: {
      request: {
        type: 'object',
        required: ['brandId'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          eventId: { $ref: '#/common/id' },
          format: { type: 'string', enum: ['csv', 'json', 'pdf'] }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            properties: {
              data: { type: 'string' },
              filename: { type: 'string' },
              mimeType: { type: 'string' }
            }
          }
        }
      }
    },

    logEvents: {
      request: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['eventId', 'surface', 'metric'],
              properties: {
                ts: { type: 'number' },
                eventId: { type: 'string' },
                surface: { type: 'string', enum: ['public', 'poster', 'display', 'mobile'] },
                metric: { type: 'string', enum: ['impression', 'click', 'dwellSec'] },
                sponsorId: { type: 'string' },
                value: { type: 'number' },
                token: { type: 'string' },
                ua: { type: 'string' }
              }
            }
          }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['count'],
            properties: {
              count: { type: 'number' }
            }
          }
        }
      }
    },

    getReport: {
      request: {
        type: 'object',
        required: ['brandId', 'id', 'adminKey'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          id: { $ref: '#/common/id' },
          adminKey: { type: 'string' },
          dateFrom: { $ref: '#/common/isoDate' },
          dateTo: { $ref: '#/common/isoDate' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['totals', 'bySurface', 'bySponsor', 'byToken'],
            properties: {
              totals: { $ref: '#/schemas/analytics/metrics' },
              bySurface: { type: 'object' },
              bySponsor: { type: 'object' },
              byToken: { type: 'object' }
            }
          }
        }
      }
    },

    metrics: {
      type: 'object',
      required: ['impressions', 'clicks', 'dwellSec'],
      properties: {
        impressions: { type: 'number', minimum: 0 },
        clicks: { type: 'number', minimum: 0 },
        dwellSec: { type: 'number', minimum: 0 },
        ctr: { type: 'number', minimum: 0, maximum: 100 }
      }
    }
  },

  // === Sponsor Schemas =====================================================

  sponsors: {
    getAnalytics: {
      request: {
        type: 'object',
        required: ['sponsorId'],
        properties: {
          sponsorId: { type: 'string' },
          eventId: { $ref: '#/common/id' },
          dateFrom: { $ref: '#/common/isoDate' },
          dateTo: { $ref: '#/common/isoDate' },
          brandId: { $ref: '#/common/brandId' },
          adminKey: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['sponsorId', 'totals', 'bySurface', 'byEvent', 'timeline'],
            properties: {
              sponsorId: { type: 'string' },
              totals: { $ref: '#/schemas/analytics/metrics' },
              bySurface: { type: 'object' },
              byEvent: { type: 'object' },
              timeline: { type: 'array' },
              insights: { type: 'array' }
            }
          }
        }
      }
    },

    getROI: {
      request: {
        type: 'object',
        required: ['sponsorId'],
        properties: {
          sponsorId: { type: 'string' },
          sponsorshipCost: { type: 'number', minimum: 0 },
          costPerClick: { type: 'number', minimum: 0 },
          conversionRate: { type: 'number', minimum: 0, maximum: 100 },
          avgTransactionValue: { type: 'number', minimum: 0 },
          dateFrom: { $ref: '#/common/isoDate' },
          dateTo: { $ref: '#/common/isoDate' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['sponsorId', 'period', 'metrics', 'financials', 'insights'],
            properties: {
              sponsorId: { type: 'string' },
              period: {
                type: 'object',
                properties: {
                  from: { $ref: '#/common/isoDate' },
                  to: { $ref: '#/common/isoDate' }
                }
              },
              metrics: { type: 'object' },
              financials: {
                type: 'object',
                required: ['totalCost', 'costPerClick', 'cpm', 'estimatedConversions', 'estimatedRevenue', 'roi'],
                properties: {
                  totalCost: { type: 'number' },
                  costPerClick: { type: 'number' },
                  cpm: { type: 'number' },
                  estimatedConversions: { type: 'number' },
                  estimatedRevenue: { type: 'number' },
                  roi: { type: 'number' }
                }
              },
              insights: { type: 'array' }
            }
          }
        }
      }
    }
  },

  // === Form Schemas ========================================================

  forms: {
    listTemplates: {
      request: {
        type: 'object',
        properties: {}
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['templates'],
            properties: {
              templates: { type: 'array' }
            }
          }
        }
      }
    },

    createFromTemplate: {
      request: {
        type: 'object',
        required: ['templateType', 'brandId', 'adminKey'],
        properties: {
          templateType: { type: 'string' },
          eventName: { type: 'string' },
          eventId: { $ref: '#/common/id' },
          brandId: { $ref: '#/common/brandId' },
          adminKey: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['formId', 'editUrl', 'publishedUrl', 'responseSheetUrl'],
            properties: {
              formId: { type: 'string' },
              editUrl: { $ref: '#/common/url' },
              publishedUrl: { $ref: '#/common/url' },
              responseSheetUrl: { $ref: '#/common/url' },
              templateType: { type: 'string' },
              eventId: { type: 'string' }
            }
          }
        }
      }
    },

    // api_generateFormShortlink - Admin.html
    generateShortlink: {
      request: {
        type: 'object',
        required: ['formUrl', 'brandId', 'adminKey'],
        properties: {
          formUrl: { $ref: '#/common/url' },
          eventId: { $ref: '#/common/id' },
          brandId: { $ref: '#/common/brandId' },
          adminKey: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['shortUrl'],
            properties: {
              shortUrl: { $ref: '#/common/url' },
              originalUrl: { $ref: '#/common/url' },
              eventId: { type: 'string' }
            }
          }
        }
      }
    }
  },

  // === Webhook Schemas =====================================================

  webhooks: {
    register: {
      request: {
        type: 'object',
        required: ['brandId', 'eventType', 'url'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          eventType: {
            type: 'string',
            enum: [
              'event.created', 'event.updated', 'event.deleted',
              'analytics.report', 'analytics.threshold',
              'sponsor.performance', 'sponsor.ctr.low', 'sponsor.ctr.high',
              'form.submitted', 'registration.completed',
              'system.error', 'system.warning'
            ]
          },
          url: {
            type: 'string',
            pattern: '^https://.+',
            maxLength: 2048
          },
          secret: {
            type: 'string',
            minLength: 16,
            maxLength: 128
          },
          enabled: { type: 'boolean' },
          filters: { type: 'object' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['id', 'brandId', 'eventType', 'url', 'secret', 'enabled', 'createdAt'],
            properties: {
              id: { type: 'string' },
              brandId: { type: 'string' },
              eventType: { type: 'string' },
              url: { type: 'string' },
              secret: { type: 'string' },
              enabled: { type: 'boolean' },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    },
    unregister: {
      request: {
        type: 'object',
        required: ['brandId', 'webhookId'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          webhookId: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['id', 'deleted'],
            properties: {
              id: { type: 'string' },
              deleted: { type: 'boolean' }
            }
          }
        }
      }
    },
    list: {
      request: {
        type: 'object',
        required: ['brandId'],
        properties: {
          brandId: { $ref: '#/common/brandId' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['webhooks'],
            properties: {
              webhooks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    brandId: { type: 'string' },
                    eventType: { type: 'string' },
                    url: { type: 'string' },
                    enabled: { type: 'boolean' },
                    createdAt: { type: 'string' },
                    lastTriggered: { type: 'string' },
                    deliveryCount: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    test: {
      request: {
        type: 'object',
        required: ['brandId', 'webhookId'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          webhookId: { type: 'string' }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['webhookId', 'url', 'success', 'statusCode', 'timestamp'],
            properties: {
              webhookId: { type: 'string' },
              url: { type: 'string' },
              success: { type: 'boolean' },
              statusCode: { type: 'number' },
              response: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    },
    getDeliveries: {
      request: {
        type: 'object',
        required: ['brandId'],
        properties: {
          brandId: { $ref: '#/common/brandId' },
          webhookId: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 500 }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['deliveries', 'count'],
            properties: {
              deliveries: {
                type: 'array',
                items: {
                  type: 'object'
                }
              },
              count: { type: 'number' }
            }
          }
        }
      }
    }
  },

  // === i18n Schemas ========================================================

  i18n: {
    translate: {
      request: {
        type: 'object',
        required: ['key'],
        properties: {
          key: {
            type: 'string',
            minLength: 1,
            maxLength: 256
          },
          locale: {
            type: 'string',
            pattern: '^[a-z]{2}-[A-Z]{2}$'
          },
          params: {
            type: 'object'
          }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['key', 'locale', 'translation'],
            properties: {
              key: { type: 'string' },
              locale: { type: 'string' },
              translation: { type: 'string' }
            }
          }
        }
      }
    },
    getSupportedLocales: {
      request: {
        type: 'object',
        properties: {}
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['locales', 'default'],
            properties: {
              locales: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['code', 'name'],
                  properties: {
                    code: { type: 'string' },
                    name: { type: 'string' },
                    nativeName: { type: 'string' }
                  }
                }
              },
              default: { type: 'string' }
            }
          }
        }
      }
    },
    setUserLocale: {
      request: {
        type: 'object',
        required: ['locale'],
        properties: {
          locale: {
            type: 'string',
            pattern: '^[a-z]{2}-[A-Z]{2}$'
          }
        }
      },
      response: {
        type: 'object',
        required: ['ok', 'value'],
        properties: {
          ok: { type: 'boolean' },
          value: {
            type: 'object',
            required: ['locale'],
            properties: {
              locale: { type: 'string' }
            }
          }
        }
      }
    }
  },

  // === Error Schemas =======================================================

  error: {
    type: 'object',
    required: ['ok', 'code', 'message'],
    properties: {
      ok: { type: 'boolean', enum: [false] },
      code: {
        type: 'string',
        enum: ['BAD_INPUT', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL', 'CONTRACT', 'UNAUTHORIZED']
      },
      message: { type: 'string' }
    }
  }
};

/**
 * Validate request against schema
 *
 * @param {string} endpoint - Endpoint name (e.g., 'events.list')
 * @param {object} data - Request data
 * @returns {object} Result envelope (Ok/Err)
 */
function ApiSchemas_validateRequest(endpoint, data) {
  const parts = endpoint.split('.');
  if (parts.length !== 2) {
    return Err(ERR.BAD_INPUT, 'Invalid endpoint format');
  }

  const [category, operation] = parts;
  const schema = SCHEMAS[category]?.[operation]?.request;

  if (!schema) {
    return Err(ERR.BAD_INPUT, `Unknown endpoint: ${endpoint}`);
  }

  try {
    schemaCheck(schema, data, `ApiSchemas_validateRequest:${endpoint}`);
    return Ok();
  } catch (e) {
    return Err(ERR.BAD_INPUT, e.message);
  }
}

/**
 * Validate response against schema
 *
 * @param {string} endpoint - Endpoint name (e.g., 'events.list')
 * @param {object} data - Response data
 * @returns {object} Result envelope (Ok/Err)
 */
function ApiSchemas_validateResponse(endpoint, data) {
  const parts = endpoint.split('.');
  if (parts.length !== 2) {
    return Err(ERR.CONTRACT, 'Invalid endpoint format');
  }

  const [category, operation] = parts;
  const schema = SCHEMAS[category]?.[operation]?.response;

  if (!schema) {
    return Err(ERR.CONTRACT, `Unknown endpoint: ${endpoint}`);
  }

  try {
    schemaCheck(schema, data, `ApiSchemas_validateResponse:${endpoint}`);
    return Ok();
  } catch (e) {
    return Err(ERR.CONTRACT, e.message);
  }
}

/**
 * Get schema for endpoint
 *
 * @param {string} endpoint - Endpoint name
 * @returns {object|null} Schema object or null
 */
function ApiSchemas_getSchema(endpoint) {
  const parts = endpoint.split('.');
  if (parts.length !== 2) return null;

  const [category, operation] = parts;
  return SCHEMAS[category]?.[operation] || null;
}

/**
 * Get all schemas (for documentation generation)
 *
 * @returns {object} All schemas
 */
function ApiSchemas_getAllSchemas() {
  return SCHEMAS;
}
