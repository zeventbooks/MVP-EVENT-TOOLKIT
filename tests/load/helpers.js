/**
 * k6 Load Testing Helpers
 * Shared utilities for load testing the MVP Event Toolkit API
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';

/**
 * Get base URL from environment or use default
 */
export function getBaseUrl() {
  return __ENV.BASE_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
}

/**
 * Get admin key from environment
 */
export function getAdminKey() {
  return __ENV.ADMIN_KEY || '';
}

/**
 * Get tenant ID from environment or use default
 */
export function getTenantId() {
  return __ENV.TENANT_ID || 'root';
}

/**
 * Common headers for API requests
 */
export const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

/**
 * Check if response is successful (200 OK with ok:true)
 * @param {http.Response} response - HTTP response
 * @param {string} name - Check name for reporting
 */
export function checkSuccess(response, name = 'request') {
  return check(response, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: response time < 5s`]: (r) => r.timings.duration < 5000,
    [`${name}: has ok:true`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true;
      } catch (e) {
        return false;
      }
    }
  });
}

/**
 * Check if response has expected structure
 * @param {http.Response} response - HTTP response
 * @param {string} name - Check name for reporting
 */
export function checkStructure(response, name = 'response') {
  return check(response, {
    [`${name}: has envelope structure`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('ok') && body.hasOwnProperty('value');
      } catch (e) {
        return false;
      }
    }
  });
}

/**
 * System API Helpers
 */
export class SystemAPI {
  constructor(baseUrl, tenantId) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
  }

  /**
   * Get system status
   */
  getStatus() {
    const url = `${this.baseUrl}?p=status&tenant=${this.tenantId}`;
    return http.get(url, { headers });
  }

  /**
   * Run diagnostics (requires admin key)
   */
  runDiagnostics(adminKey) {
    const url = `${this.baseUrl}?action=runDiagnostics`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      adminKey: adminKey
    });
    return http.post(url, payload, { headers });
  }
}

/**
 * Events API Helpers
 */
export class EventsAPI {
  constructor(baseUrl, tenantId) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
  }

  /**
   * List all events
   */
  list() {
    const url = `${this.baseUrl}?p=api&action=list&tenantId=${this.tenantId}&scope=events`;
    return http.get(url, { headers });
  }

  /**
   * Get specific event
   */
  get(eventId) {
    const url = `${this.baseUrl}?p=api&action=get&tenantId=${this.tenantId}&scope=events&id=${eventId}`;
    return http.get(url, { headers });
  }

  /**
   * Create event
   */
  create(eventData, adminKey) {
    const url = `${this.baseUrl}?action=create`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'events',
      templateId: 'event',
      adminKey: adminKey,
      data: eventData
    });
    return http.post(url, payload, { headers });
  }

  /**
   * Update event
   */
  update(eventId, updateData, adminKey) {
    const url = `${this.baseUrl}?action=update`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'events',
      id: eventId,
      adminKey: adminKey,
      data: updateData
    });
    return http.post(url, payload, { headers });
  }

  /**
   * Delete event
   */
  delete(eventId, adminKey) {
    const url = `${this.baseUrl}?action=delete`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'events',
      id: eventId,
      adminKey: adminKey
    });
    return http.post(url, payload, { headers });
  }
}

/**
 * Sponsors API Helpers
 */
export class SponsorsAPI {
  constructor(baseUrl, tenantId) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
  }

  /**
   * List all sponsors
   */
  list() {
    const url = `${this.baseUrl}?p=api&action=list&tenantId=${this.tenantId}&scope=sponsors`;
    return http.get(url, { headers });
  }

  /**
   * Get specific sponsor
   */
  get(sponsorId) {
    const url = `${this.baseUrl}?p=api&action=get&tenantId=${this.tenantId}&scope=sponsors&id=${sponsorId}`;
    return http.get(url, { headers });
  }

  /**
   * Create sponsor
   */
  create(sponsorData, adminKey) {
    const url = `${this.baseUrl}?action=create`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'sponsors',
      templateId: 'sponsor',
      adminKey: adminKey,
      data: sponsorData
    });
    return http.post(url, payload, { headers });
  }

  /**
   * Update sponsor
   */
  update(sponsorId, updateData, adminKey) {
    const url = `${this.baseUrl}?action=update`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'sponsors',
      id: sponsorId,
      adminKey: adminKey,
      data: updateData
    });
    return http.post(url, payload, { headers });
  }

  /**
   * Delete sponsor
   */
  delete(sponsorId, adminKey) {
    const url = `${this.baseUrl}?action=delete`;
    const payload = JSON.stringify({
      tenantId: this.tenantId,
      scope: 'sponsors',
      id: sponsorId,
      adminKey: adminKey
    });
    return http.post(url, payload, { headers });
  }
}

/**
 * Generate random test event data
 */
export function generateEventData(prefix = 'LoadTest') {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 10000);

  return {
    name: `${prefix} Event ${timestamp}-${randomId}`,
    dateISO: '2025-12-15',
    timeISO: '18:00',
    location: `Test Venue ${randomId}`,
    summary: `Load test event created at ${new Date().toISOString()}`,
    entity: 'load-test'
  };
}

/**
 * Generate random test sponsor data
 */
export function generateSponsorData(prefix = 'LoadTest') {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 10000);

  const tiers = ['platinum', 'gold', 'silver', 'bronze'];
  const randomTier = tiers[Math.floor(Math.random() * tiers.length)];

  return {
    name: `${prefix} Sponsor ${timestamp}-${randomId}`,
    website: `https://load-test-${randomId}.example.com`,
    tier: randomTier,
    logoUrl: `https://via.placeholder.com/300?text=Sponsor${randomId}`,
    description: `Load test sponsor created at ${new Date().toISOString()}`,
    entity: 'load-test'
  };
}

/**
 * Random sleep between min and max seconds
 * Simulates real user think time
 */
export function randomSleep(minSeconds = 1, maxSeconds = 3) {
  const sleepTime = minSeconds + Math.random() * (maxSeconds - minSeconds);
  sleep(sleepTime);
}

/**
 * Extract ID from API response
 */
export function extractId(response) {
  try {
    const body = JSON.parse(response.body);
    return body.value?.id || null;
  } catch (e) {
    return null;
  }
}

/**
 * Performance thresholds for load tests
 * Adjust based on Google Apps Script performance characteristics
 */
export const thresholds = {
  // HTTP errors should be less than 1%
  http_req_failed: ['rate<0.01'],

  // 95% of requests should be below 5 seconds (Google Apps Script can be slow)
  http_req_duration: ['p(95)<5000'],

  // 99% of requests should be below 10 seconds
  'http_req_duration{p:0.99}': ['<10000'],

  // Average response time should be below 3 seconds
  'http_req_duration{avg}': ['<3000'],

  // Check success rate should be at least 95%
  checks: ['rate>0.95']
};
