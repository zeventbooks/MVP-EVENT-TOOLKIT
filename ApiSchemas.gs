/**
 * API Schemas and Contracts
 *
 * Defines formal JSON Schema contracts for all API endpoints:
 * - Request schemas (input validation)
 * - Response schemas (output validation)
 * - Error schemas (error handling)
 *
 * Benefits:
 * - Type-safe client generation
 * - Contract testing
 * - API documentation
 * - Runtime validation
 *
 * @module ApiSchemas
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
  // Canonical Event Contract v1.0 - See EVENT_CONTRACT.md for documentation

  events: {
    // Shared schema definitions for reuse
    _eventStatus: {
      type: 'string',
      enum: ['draft', 'published', 'cancelled', 'completed']
    },

    _sectionConfig: {
      type: ['object', 'null'],
      properties: {
        enabled: { type: 'boolean' },
        title: { type: ['string', 'null'] },
        content: { type: ['string', 'null'] }
      }
    },

    _ctaLabel: {
      type: 'object',
      required: ['key', 'label'],
      properties: {
        key: { type: 'string' },
        label: { type: 'string' },
        url: { type: ['string', 'null'] }
      }
    },

    _sponsor: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        logoUrl: { type: ['string', 'null'] },
        website: { type: ['string', 'null'] },
        tier: { type: ['string', 'null'] }
      }
    },

    // Full event shape per EVENT_CONTRACT.md
    _eventShape: {
      type: 'object',
      required: ['id', 'brandId', 'templateId', 'name', 'status', 'createdAt', 'slug', 'links'],
      properties: {
        // Envelope (system-managed)
        id: { $ref: '#/common/id' },
        brandId: { $ref: '#/common/brandId' },
        templateId: { type: 'string' },

        // Core Identity
        name: { type: 'string', minLength: 1, maxLength: 200 },
        status: { $ref: '#/schemas/events/_eventStatus' },
        dateTime: { type: ['string', 'null'] },
        location: { type: ['string', 'null'] },
        venueName: { type: ['string', 'null'] },

        // Content
        summary: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        audience: { type: ['string', 'null'] },

        // Sections
        sections: {
          type: 'object',
          properties: {
            video: { $ref: '#/schemas/events/_sectionConfig' },
            map: { $ref: '#/schemas/events/_sectionConfig' },
            schedule: { $ref: '#/schemas/events/_sectionConfig' },
            sponsors: { $ref: '#/schemas/events/_sectionConfig' },
            notes: { $ref: '#/schemas/events/_sectionConfig' },
            gallery: { $ref: '#/schemas/events/_sectionConfig' }
          }
        },

        // CTA Labels
        ctaLabels: {
          type: 'array',
          items: { $ref: '#/schemas/events/_ctaLabel' }
        },

        // External Data
        externalData: {
          type: 'object',
          properties: {
            scheduleUrl: { type: ['string', 'null'] },
            standingsUrl: { type: ['string', 'null'] },
            bracketUrl: { type: ['string', 'null'] }
          }
        },

        // Media URLs
        videoUrl: { type: ['string', 'null'] },
        mapEmbedUrl: { type: ['string', 'null'] },

        // Action URLs
        signupUrl: { type: ['string', 'null'] },
        checkinUrl: { type: ['string', 'null'] },
        feedbackUrl: { type: ['string', 'null'] },

        // Sponsors (hydrated)
        sponsors: {
          type: 'array',
          items: { $ref: '#/schemas/events/_sponsor' }
        },

        // Metadata
        createdAt: { $ref: '#/common/isoDate' },
        slug: { type: 'string' },

        // Generated Links
        links: {
          type: 'object',
          required: ['publicUrl', 'posterUrl', 'displayUrl', 'reportUrl'],
          properties: {
            publicUrl: { $ref: '#/common/url' },
            posterUrl: { $ref: '#/common/url' },
            displayUrl: { $ref: '#/common/url' },
            reportUrl: { $ref: '#/common/url' }
          }
        }
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

  // === Analytics Schemas ===================================================

  analytics: {
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
