/**
 * API Testing Helpers for Playwright
 * Replaces Newman/Postman API testing with native Playwright API testing
 */

export class ApiHelpers {
  /**
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} baseUrl
   */
  constructor(request, baseUrl) {
    this.request = request;
    this.baseUrl = baseUrl;
  }

  /**
   * GET request helper
   * @param {string} path - URL path (including query params)
   * @param {object} options - Additional options
   */
  async get(path, options = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    return await this.request.get(url, options);
  }

  /**
   * POST request helper
   * @param {string} path - URL path
   * @param {object} data - Request body
   * @param {object} options - Additional options
   */
  async post(path, data, options = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    return await this.request.post(url, {
      data,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
  }

  // ============================================================================
  // SYSTEM APIs
  // ============================================================================

  /**
   * Check system status
   * @param {string} tenant - Tenant ID
   */
  async getStatus(tenant = 'root') {
    return await this.get(`?p=status&tenant=${tenant}`);
  }

  /**
   * Run diagnostics (requires admin key)
   * @param {string} tenant - Tenant ID
   * @param {string} adminKey - Admin key
   */
  async runDiagnostics(tenant, adminKey) {
    return await this.post('?action=runDiagnostics', {
      tenantId: tenant,
      adminKey
    });
  }

  // ============================================================================
  // EVENT APIs (CRUD)
  // ============================================================================

  /**
   * Create an event
   * @param {string} tenant - Tenant ID
   * @param {object} eventData - Event data
   * @param {string} adminKey - Admin key
   */
  async createEvent(tenant, eventData, adminKey) {
    return await this.post('?action=create', {
      tenantId: tenant,
      scope: 'events',
      templateId: 'event',
      adminKey,
      data: eventData
    });
  }

  /**
   * Get a specific event
   * @param {string} tenant - Tenant ID
   * @param {string} eventId - Event ID
   */
  async getEvent(tenant, eventId) {
    return await this.get(`?p=api&action=get&tenantId=${tenant}&scope=events&id=${eventId}`);
  }

  /**
   * List all events for a tenant
   * @param {string} tenant - Tenant ID
   */
  async listEvents(tenant) {
    return await this.get(`?p=api&action=list&tenantId=${tenant}&scope=events`);
  }

  /**
   * Update an event
   * @param {string} tenant - Tenant ID
   * @param {string} eventId - Event ID
   * @param {object} updateData - Fields to update
   * @param {string} adminKey - Admin key
   */
  async updateEvent(tenant, eventId, updateData, adminKey) {
    return await this.post('?action=update', {
      tenantId: tenant,
      scope: 'events',
      id: eventId,
      adminKey,
      data: updateData
    });
  }

  /**
   * Delete an event
   * @param {string} tenant - Tenant ID
   * @param {string} eventId - Event ID
   * @param {string} adminKey - Admin key
   */
  async deleteEvent(tenant, eventId, adminKey) {
    return await this.post('?action=delete', {
      tenantId: tenant,
      scope: 'events',
      id: eventId,
      adminKey
    });
  }

  // ============================================================================
  // SPONSOR APIs (CRUD)
  // ============================================================================

  /**
   * Create a sponsor
   * @param {string} tenant - Tenant ID
   * @param {object} sponsorData - Sponsor data
   * @param {string} adminKey - Admin key
   */
  async createSponsor(tenant, sponsorData, adminKey) {
    return await this.post('?action=create', {
      tenantId: tenant,
      scope: 'sponsors',
      templateId: 'sponsor',
      adminKey,
      data: sponsorData
    });
  }

  /**
   * Get a specific sponsor
   * @param {string} tenant - Tenant ID
   * @param {string} sponsorId - Sponsor ID
   */
  async getSponsor(tenant, sponsorId) {
    return await this.get(`?p=api&action=get&tenantId=${tenant}&scope=sponsors&id=${sponsorId}`);
  }

  /**
   * List all sponsors for a tenant
   * @param {string} tenant - Tenant ID
   */
  async listSponsors(tenant) {
    return await this.get(`?p=api&action=list&tenantId=${tenant}&scope=sponsors`);
  }

  /**
   * Update a sponsor
   * @param {string} tenant - Tenant ID
   * @param {string} sponsorId - Sponsor ID
   * @param {object} updateData - Fields to update
   * @param {string} adminKey - Admin key
   */
  async updateSponsor(tenant, sponsorId, updateData, adminKey) {
    return await this.post('?action=update', {
      tenantId: tenant,
      scope: 'sponsors',
      id: sponsorId,
      adminKey,
      data: updateData
    });
  }

  /**
   * Delete a sponsor
   * @param {string} tenant - Tenant ID
   * @param {string} sponsorId - Sponsor ID
   * @param {string} adminKey - Admin key
   */
  async deleteSponsor(tenant, sponsorId, adminKey) {
    return await this.post('?action=delete', {
      tenantId: tenant,
      scope: 'sponsors',
      id: sponsorId,
      adminKey
    });
  }

  // ============================================================================
  // HELPER UTILITIES
  // ============================================================================

  /**
   * Assert response is successful
   * @param {import('@playwright/test').APIResponse} response
   */
  async assertSuccess(response) {
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`API request failed: ${response.status()} ${response.statusText()}\n${body}`);
    }
    return response;
  }

  /**
   * Get JSON response or throw detailed error
   * @param {import('@playwright/test').APIResponse} response
   */
  async getJsonOrThrow(response) {
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`API request failed: ${response.status()}\n${body}`);
    }
    return await response.json();
  }

  /**
   * Wait for condition with retries
   * @param {Function} condition - Async function that returns boolean
   * @param {number} maxAttempts - Maximum retry attempts
   * @param {number} delayMs - Delay between retries
   */
  async waitFor(condition, maxAttempts = 10, delayMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await condition()) {
        return true;
      }
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  /**
   * Create test event with default values
   * @param {string} tenant - Tenant ID
   * @param {string} adminKey - Admin key
   * @param {object} overrides - Override default values
   */
  async createTestEvent(tenant, adminKey, overrides = {}) {
    const timestamp = Date.now();
    const defaultEvent = {
      name: `Test Event ${timestamp}`,
      dateISO: '2025-12-01',
      timeISO: '18:00',
      location: 'Test Venue',
      summary: 'Test event created by automated tests',
      entity: 'test',
      ...overrides
    };

    const response = await this.createEvent(tenant, defaultEvent, adminKey);
    const data = await this.getJsonOrThrow(response);

    return {
      response,
      data,
      eventId: data.value?.id,
      eventData: defaultEvent
    };
  }

  /**
   * Create test sponsor with default values
   * @param {string} tenant - Tenant ID
   * @param {string} adminKey - Admin key
   * @param {object} overrides - Override default values
   */
  async createTestSponsor(tenant, adminKey, overrides = {}) {
    const timestamp = Date.now();
    const defaultSponsor = {
      name: `Test Sponsor ${timestamp}`,
      website: 'https://example.com',
      tier: 'gold',
      entity: 'test',
      ...overrides
    };

    const response = await this.createSponsor(tenant, defaultSponsor, adminKey);
    const data = await this.getJsonOrThrow(response);

    return {
      response,
      data,
      sponsorId: data.value?.id,
      sponsorData: defaultSponsor
    };
  }
}

/**
 * Test data builders
 */
export class EventBuilder {
  constructor() {
    this.data = {
      name: 'Test Event',
      dateISO: '2025-12-01',
      timeISO: '18:00',
      location: 'Test Venue',
      entity: 'test'
    };
  }

  withName(name) {
    this.data.name = name;
    return this;
  }

  withDate(date) {
    this.data.dateISO = date;
    return this;
  }

  withTime(time) {
    this.data.timeISO = time;
    return this;
  }

  withLocation(location) {
    this.data.location = location;
    return this;
  }

  withSummary(summary) {
    this.data.summary = summary;
    return this;
  }

  withSponsors(sponsorIds) {
    this.data.sponsorIds = Array.isArray(sponsorIds) ? sponsorIds.join(',') : sponsorIds;
    return this;
  }

  withEntity(entity) {
    this.data.entity = entity;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

export class SponsorBuilder {
  constructor() {
    this.data = {
      name: 'Test Sponsor',
      website: 'https://example.com',
      tier: 'gold',
      entity: 'test'
    };
  }

  withName(name) {
    this.data.name = name;
    return this;
  }

  withWebsite(website) {
    this.data.website = website;
    return this;
  }

  withTier(tier) {
    this.data.tier = tier;
    return this;
  }

  withLogo(logoUrl) {
    this.data.logoUrl = logoUrl;
    return this;
  }

  withEntity(entity) {
    this.data.entity = entity;
    return this;
  }

  build() {
    return { ...this.data };
  }
}
