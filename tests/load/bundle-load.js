/**
 * k6 Bundle Load Test
 *
 * Purpose: Lightweight load test for public/display/poster bundle endpoints
 * Tests p95 latency and error rates under moderate load
 *
 * Load Profile:
 * - 5 Virtual Users (VUs) - simulates concurrent requests
 * - 60 seconds duration per endpoint
 * - Targets 3-5 test events
 * - ~100-300 requests per endpoint over the test duration
 *
 * Endpoints Tested:
 * - api_getPublicBundle
 * - api_getDisplayBundle
 * - api_getPosterBundle
 *
 * Usage:
 *   k6 run tests/load/bundle-load.js
 *
 * With environment variables:
 *   BASE_URL=https://stg.eventangle.com BRAND_ID=root k6 run tests/load/bundle-load.js
 *
 * For staging (recommended):
 *   BASE_URL=https://stg.eventangle.com k6 run tests/load/bundle-load.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  getBaseUrl,
  getBrandId,
  headers,
  randomSleep
} from './helpers.js';

// Custom metrics for bundle endpoints
const publicBundleLatency = new Trend('public_bundle_latency', true);
const displayBundleLatency = new Trend('display_bundle_latency', true);
const posterBundleLatency = new Trend('poster_bundle_latency', true);

const publicBundleErrors = new Counter('public_bundle_errors');
const displayBundleErrors = new Counter('display_bundle_errors');
const posterBundleErrors = new Counter('poster_bundle_errors');

const publicBundleSuccess = new Rate('public_bundle_success');
const displayBundleSuccess = new Rate('display_bundle_success');
const posterBundleSuccess = new Rate('poster_bundle_success');

/**
 * Test configuration
 *
 * Thresholds are set for Google Apps Script backend which has inherent latency.
 * These are sanity-check thresholds, not aggressive performance targets.
 */
export const options = {
  scenarios: {
    // Warm-up phase: Get event list and validate setup
    warmup: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'warmup',
      startTime: '0s',
      maxDuration: '30s'
    },
    // Main bundle load test
    bundle_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      exec: 'bundleLoadTest',
      startTime: '30s' // Start after warmup
    }
  },
  thresholds: {
    // Overall error rate < 1%
    http_req_failed: ['rate<0.01'],

    // Bundle-specific thresholds (p95 < 5s for GAS backend)
    public_bundle_latency: ['p(95)<5000', 'avg<3000'],
    display_bundle_latency: ['p(95)<5000', 'avg<3000'],
    poster_bundle_latency: ['p(95)<5000', 'avg<3000'],

    // Success rates > 99%
    public_bundle_success: ['rate>0.99'],
    display_bundle_success: ['rate>0.99'],
    poster_bundle_success: ['rate>0.99'],

    // Overall checks pass rate
    checks: ['rate>0.95']
  },
  tags: {
    test_type: 'bundle_load',
    environment: __ENV.ENVIRONMENT || 'staging'
  }
};

// Shared state for test events
let testEvents = [];

/**
 * BundlesAPI - Helper for bundle endpoint requests
 */
class BundlesAPI {
  constructor(baseUrl, brandId) {
    this.baseUrl = baseUrl;
    this.brandId = brandId;
  }

  /**
   * Get public bundle for an event
   */
  getPublicBundle(eventId, ifNoneMatch = null) {
    const url = `${this.baseUrl}?p=api`;
    const payload = {
      action: 'api_getPublicBundle',
      brandId: this.brandId,
      scope: 'events',
      id: eventId
    };
    if (ifNoneMatch) {
      payload.ifNoneMatch = ifNoneMatch;
    }
    return http.post(url, JSON.stringify(payload), { headers, tags: { endpoint: 'public_bundle' } });
  }

  /**
   * Get display bundle for an event
   */
  getDisplayBundle(eventId, ifNoneMatch = null) {
    const url = `${this.baseUrl}?p=api`;
    const payload = {
      action: 'api_getDisplayBundle',
      brandId: this.brandId,
      scope: 'events',
      id: eventId
    };
    if (ifNoneMatch) {
      payload.ifNoneMatch = ifNoneMatch;
    }
    return http.post(url, JSON.stringify(payload), { headers, tags: { endpoint: 'display_bundle' } });
  }

  /**
   * Get poster bundle for an event
   */
  getPosterBundle(eventId, ifNoneMatch = null) {
    const url = `${this.baseUrl}?p=api`;
    const payload = {
      action: 'api_getPosterBundle',
      brandId: this.brandId,
      scope: 'events',
      id: eventId
    };
    if (ifNoneMatch) {
      payload.ifNoneMatch = ifNoneMatch;
    }
    return http.post(url, JSON.stringify(payload), { headers, tags: { endpoint: 'poster_bundle' } });
  }

  /**
   * List events to get test event IDs
   */
  listEvents(limit = 5) {
    const url = `${this.baseUrl}?p=api&action=list&brandId=${this.brandId}&scope=events&limit=${limit}`;
    return http.get(url, { headers });
  }
}

/**
 * Check if bundle response is successful
 */
function checkBundleSuccess(response, endpointName) {
  const checks = check(response, {
    [`${endpointName}: status is 200`]: (r) => r.status === 200,
    [`${endpointName}: has ok:true`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true;
      } catch (e) {
        return false;
      }
    },
    [`${endpointName}: has value or notModified`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.value !== undefined || body.notModified === true;
      } catch (e) {
        return false;
      }
    }
  });

  return checks;
}

/**
 * Extract event IDs from list response
 */
function extractEventIds(response) {
  try {
    const body = JSON.parse(response.body);
    if (body.ok && body.value && body.value.items) {
      return body.value.items.map(item => item.id);
    }
  } catch (e) {
    console.error(`Failed to extract event IDs: ${e.message}`);
  }
  return [];
}

/**
 * Warmup function - gets list of events to test against
 */
export function warmup() {
  const baseUrl = getBaseUrl();
  const brandId = getBrandId();
  const bundlesAPI = new BundlesAPI(baseUrl, brandId);

  console.log('='.repeat(60));
  console.log('Bundle Load Test - Warmup Phase');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Brand ID: ${brandId}`);

  // Get list of events
  const listResponse = bundlesAPI.listEvents(5);
  const eventIds = extractEventIds(listResponse);

  if (eventIds.length === 0) {
    console.warn('No events found! Tests will use fallback event IDs.');
    // Use fallback IDs that may exist in the system
    testEvents = ['demo-event-1', 'demo-event-2', 'demo-event-3'];
  } else {
    testEvents = eventIds.slice(0, 5);
    console.log(`Found ${testEvents.length} events to test:`);
    testEvents.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
  }

  console.log('='.repeat(60));
  console.log('Starting load test with 5 VUs for 60 seconds...');
  console.log('='.repeat(60));
}

/**
 * Main bundle load test function
 */
export function bundleLoadTest() {
  const baseUrl = getBaseUrl();
  const brandId = getBrandId();
  const bundlesAPI = new BundlesAPI(baseUrl, brandId);

  // If testEvents is empty, fetch events inline
  if (!testEvents || testEvents.length === 0) {
    const listResponse = bundlesAPI.listEvents(5);
    testEvents = extractEventIds(listResponse);
    if (testEvents.length === 0) {
      testEvents = ['demo-event-1', 'demo-event-2', 'demo-event-3'];
    }
  }

  // Pick a random event for this iteration
  const eventId = testEvents[Math.floor(Math.random() * testEvents.length)];

  // Test Public Bundle
  group('Public Bundle', () => {
    const response = bundlesAPI.getPublicBundle(eventId);
    const success = checkBundleSuccess(response, 'public_bundle');

    publicBundleLatency.add(response.timings.duration);
    publicBundleSuccess.add(success ? 1 : 0);
    if (!success) {
      publicBundleErrors.add(1);
    }
  });

  sleep(0.5);

  // Test Display Bundle
  group('Display Bundle', () => {
    const response = bundlesAPI.getDisplayBundle(eventId);
    const success = checkBundleSuccess(response, 'display_bundle');

    displayBundleLatency.add(response.timings.duration);
    displayBundleSuccess.add(success ? 1 : 0);
    if (!success) {
      displayBundleErrors.add(1);
    }
  });

  sleep(0.5);

  // Test Poster Bundle
  group('Poster Bundle', () => {
    const response = bundlesAPI.getPosterBundle(eventId);
    const success = checkBundleSuccess(response, 'poster_bundle');

    posterBundleLatency.add(response.timings.duration);
    posterBundleSuccess.add(success ? 1 : 0);
    if (!success) {
      posterBundleErrors.add(1);
    }
  });

  // Random think time between iterations
  randomSleep(0.5, 1.5);
}

/**
 * Setup function - runs once before test starts
 */
export function setup() {
  const baseUrl = getBaseUrl();
  const brandId = getBrandId();

  // Validate we're not accidentally hitting production
  if (baseUrl.includes('www.eventangle.com') && !__ENV.CONFIRM_PRODUCTION) {
    console.error('');
    console.error('!'.repeat(60));
    console.error('WARNING: You are about to run load tests against PRODUCTION!');
    console.error('To confirm, set CONFIRM_PRODUCTION=true');
    console.error('Recommended: Use staging instead:');
    console.error('  BASE_URL=https://stg.eventangle.com k6 run tests/load/bundle-load.js');
    console.error('!'.repeat(60));
    console.error('');
    // K6 doesn't have a good way to abort, but this warning is important
  }

  return { baseUrl, brandId };
}

/**
 * Teardown - runs once after test completes
 */
export function teardown(data) {
  console.log('');
  console.log('='.repeat(60));
  console.log('Bundle Load Test Summary');
  console.log('='.repeat(60));
  console.log(`Environment: ${data.baseUrl}`);
  console.log(`Brand: ${data.brandId}`);
  console.log('');
  console.log('Check the metrics above for:');
  console.log('  - p95 latency for each bundle endpoint');
  console.log('  - Error rates (should be < 1%)');
  console.log('  - Success rates (should be > 99%)');
  console.log('');
  console.log('Baseline targets (PERFORMANCE_NOTES.md):');
  console.log('  - Public Bundle:  p95 < 5000ms, avg < 3000ms');
  console.log('  - Display Bundle: p95 < 5000ms, avg < 3000ms');
  console.log('  - Poster Bundle:  p95 < 5000ms, avg < 3000ms');
  console.log('='.repeat(60));
}
