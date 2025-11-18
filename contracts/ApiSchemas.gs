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
    tenantId: {
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
        required: ['tenantId', 'adminKey'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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

  events: {
    list: {
      request: {
        type: 'object',
        required: ['tenantId', 'scope'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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
                items: {
                  type: 'object',
                  required: ['id', 'templateId', 'data', 'createdAt', 'slug'],
                  properties: {
                    id: { $ref: '#/common/id' },
                    templateId: { type: 'string' },
                    data: { type: 'object' },
                    createdAt: { $ref: '#/common/isoDate' },
                    slug: { type: 'string' }
                  }
                }
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
        required: ['tenantId', 'scope', 'id'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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
            required: ['id', 'tenantId', 'templateId', 'data', 'createdAt', 'slug', 'links'],
            properties: {
              id: { $ref: '#/common/id' },
              tenantId: { $ref: '#/common/tenantId' },
              templateId: { type: 'string' },
              data: { type: 'object' },
              createdAt: { $ref: '#/common/isoDate' },
              slug: { type: 'string' },
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
          }
        }
      }
    },

    create: {
      request: {
        type: 'object',
        required: ['tenantId', 'scope', 'templateId', 'data', 'adminKey'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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
        required: ['tenantId', 'id', 'data', 'adminKey'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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
        required: ['tenantId', 'id', 'adminKey'],
        properties: {
          tenantId: { $ref: '#/common/tenantId' },
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
          tenantId: { $ref: '#/common/tenantId' },
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
        required: ['templateType', 'tenantId', 'adminKey'],
        properties: {
          templateType: { type: 'string' },
          eventName: { type: 'string' },
          eventId: { $ref: '#/common/id' },
          tenantId: { $ref: '#/common/tenantId' },
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
