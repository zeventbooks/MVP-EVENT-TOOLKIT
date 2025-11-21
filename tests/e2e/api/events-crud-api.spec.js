/**
 * Events CRUD API Tests - Playwright
 * Replaces Newman event API tests with comprehensive Playwright coverage
 */

import { test, expect } from '@playwright/test';
import { ApiHelpers, EventBuilder } from './api-helpers.js';
import { getCurrentEnvironment } from '../../config/environments.js';

test.describe('Events CRUD APIs', () => {
  let api;
  let adminKey;
  const brand = 'root';
  const createdEventIds = []; // Track for cleanup

  test.beforeEach(async ({ request }) => {
    const env = getCurrentEnvironment();
    api = new ApiHelpers(request, env.baseUrl);
    adminKey = process.env.ADMIN_KEY;

    if (!adminKey) {
      test.skip('ADMIN_KEY not set');
    }
  });

  test.afterEach(async () => {
    // Clean up created events
    for (const eventId of createdEventIds) {
      try {
        await api.deleteEvent(brand, eventId, adminKey);
      } catch (error) {
        console.warn(`Failed to delete event ${eventId}:`, error.message);
      }
    }
    createdEventIds.length = 0;
  });

  test.describe('Create Event', () => {
    test('creates event with valid data', async () => {
      const eventData = new EventBuilder()
        .withName('Playwright Test Event')
        .withDate('2025-12-15')
        .withLocation('Test Venue')
        .build();

      const response = await api.createEvent(brand, eventData, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toHaveProperty('id');
      expect(data.value.id).toBeDefined();

      createdEventIds.push(data.value.id);
    });

    test('creates event with minimal required fields', async () => {
      const eventData = {
        name: 'Minimal Event',
        dateISO: '2025-12-20'
      };

      const response = await api.createEvent(brand, eventData, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toHaveProperty('id');

      createdEventIds.push(data.value.id);
    });

    test('creates event with all optional fields', async () => {
      const eventData = new EventBuilder()
        .withName('Complete Event')
        .withDate('2025-12-25')
        .withTime('19:00')
        .withLocation('Complete Venue')
        .withSummary('A comprehensive test event')
        .build();

      // Add additional optional fields
      Object.assign(eventData, {
        summaryLink: 'https://example.com/summary',
        imageUrl: 'https://example.com/image.jpg',
        videoUrl: 'https://youtube.com/watch?v=test',
        bio: 'Event biography',
        signupUrl: 'https://example.com/signup',
        registerUrl: 'https://example.com/register'
      });

      const response = await api.createEvent(brand, eventData, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toHaveProperty('id');

      createdEventIds.push(data.value.id);
    });

    test('requires authentication', async () => {
      const eventData = {
        name: 'Unauthorized Event',
        dateISO: '2025-12-30'
      };

      // Try without admin key
      const response = await api.post('?action=create', {
        brandId: brand,
        scope: 'events',
        templateId: 'event',
        data: eventData
        // Missing adminKey
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });

    test('validates required fields', async () => {
      // Missing required 'name' field
      const eventData = {
        dateISO: '2025-12-31'
        // name is required but missing
      };

      const response = await api.createEvent(brand, eventData, adminKey);

      // Should fail validation
      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
        expect(data.error).toBeDefined();
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });

  test.describe('Get Event', () => {
    let testEventId;

    test.beforeEach(async () => {
      // Create a test event
      const { eventId } = await api.createTestEvent(brand, adminKey);
      testEventId = eventId;
      createdEventIds.push(testEventId);
    });

    test('retrieves event by ID', async () => {
      const response = await api.getEvent(brand, testEventId);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toHaveProperty('id', testEventId);
      expect(data.value).toHaveProperty('name');
      expect(data.value).toHaveProperty('dateISO');
    });

    test('returns 404 for non-existent event', async () => {
      const fakeId = 'non-existent-id-12345';
      const response = await api.getEvent(brand, fakeId);

      // Should either return 404 or ok:false
      if (response.status() === 404) {
        expect(response.ok()).toBe(false);
      } else {
        const data = await response.json();
        expect(data.ok).toBe(false);
      }
    });

    test('does not require authentication for public read', async () => {
      // Get event without admin key (public read)
      const response = await api.getEvent(brand, testEventId);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
    });
  });

  test.describe('List Events', () => {
    test.beforeEach(async () => {
      // Create 3 test events
      for (let i = 0; i < 3; i++) {
        const { eventId } = await api.createTestEvent(brand, adminKey, {
          name: `List Test Event ${i + 1}`
        });
        createdEventIds.push(eventId);
      }
    });

    test('lists all events for brand', async () => {
      const response = await api.listEvents(brand);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toBeInstanceOf(Array);
      expect(data.value.length).toBeGreaterThanOrEqual(3);
    });

    test('returns events with correct structure', async () => {
      const response = await api.listEvents(brand);
      const data = await response.json();

      expect(data.value.length).toBeGreaterThan(0);

      const event = data.value[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('dateISO');
    });

    test('does not require authentication for public read', async () => {
      const response = await api.listEvents(brand);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
    });
  });

  test.describe('Update Event', () => {
    let testEventId;

    test.beforeEach(async () => {
      // Create a test event
      const { eventId } = await api.createTestEvent(brand, adminKey, {
        name: 'Original Name',
        location: 'Original Location'
      });
      testEventId = eventId;
      createdEventIds.push(testEventId);
    });

    test('updates event fields', async () => {
      const updateData = {
        name: 'Updated Name',
        location: 'Updated Location'
      };

      const response = await api.updateEvent(brand, testEventId, updateData, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);

      // Verify update
      const getResponse = await api.getEvent(brand, testEventId);
      const getData = await getResponse.json();

      expect(getData.value.name).toBe('Updated Name');
      expect(getData.value.location).toBe('Updated Location');
    });

    test('updates partial fields', async () => {
      // Only update name, leave location unchanged
      const updateData = {
        name: 'Partially Updated'
      };

      const response = await api.updateEvent(brand, testEventId, updateData, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);

      // Verify update
      const getResponse = await api.getEvent(brand, testEventId);
      const getData = await getResponse.json();

      expect(getData.value.name).toBe('Partially Updated');
      expect(getData.value.location).toBe('Original Location'); // Unchanged
    });

    test('requires authentication', async () => {
      const updateData = { name: 'Unauthorized Update' };

      const response = await api.post('?action=update', {
        brandId: brand,
        scope: 'events',
        id: testEventId,
        data: updateData
        // Missing adminKey
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });

    test('returns error for non-existent event', async () => {
      const fakeId = 'non-existent-id-12345';
      const updateData = { name: 'Cannot Update' };

      const response = await api.updateEvent(brand, fakeId, updateData, adminKey);

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });

  test.describe('Delete Event', () => {
    let testEventId;

    test.beforeEach(async () => {
      // Create a test event
      const { eventId } = await api.createTestEvent(brand, adminKey);
      testEventId = eventId;
    });

    test('deletes event successfully', async () => {
      const response = await api.deleteEvent(brand, testEventId, adminKey);
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);

      // Verify deletion - event should not exist
      const getResponse = await api.getEvent(brand, testEventId);

      if (getResponse.status() === 404) {
        expect(getResponse.ok()).toBe(false);
      } else {
        const getData = await getResponse.json();
        expect(getData.ok).toBe(false);
      }

      // Don't add to cleanup array since we already deleted it
    });

    test('requires authentication', async () => {
      const response = await api.post('?action=delete', {
        brandId: brand,
        scope: 'events',
        id: testEventId
        // Missing adminKey
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Clean up
      createdEventIds.push(testEventId);
    });

    test('returns error for non-existent event', async () => {
      const fakeId = 'non-existent-id-12345';

      const response = await api.deleteEvent(brand, fakeId, adminKey);

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Clean up the real event
      createdEventIds.push(testEventId);
    });
  });

  test.describe('Get Public Bundle', () => {
    let testEventId;

    test.beforeEach(async () => {
      // Create a test event with sponsors
      const eventData = new EventBuilder()
        .withName('Bundle Test Event')
        .withDate('2025-12-20')
        .withLocation('Bundle Venue')
        .build();

      // Add sponsor data
      eventData.sponsors = [
        { id: 'sp-test-1', name: 'Test Sponsor', placements: { mobileBanner: true, posterTop: true } }
      ];
      eventData.display = { mode: 'public' };

      const response = await api.createEvent(brand, eventData, adminKey);
      const data = await response.json();
      testEventId = data.value.id;
      createdEventIds.push(testEventId);
    });

    test('retrieves bundled event data', async () => {
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: testEventId
      });
      const data = await response.json();

      expect(response.ok()).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.value).toHaveProperty('event');
      expect(data.value).toHaveProperty('sponsors');
      expect(data.value).toHaveProperty('display');
      expect(data.value).toHaveProperty('links');
      expect(data.value).toHaveProperty('config');
    });

    test('returns event with correct structure', async () => {
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: testEventId
      });
      const data = await response.json();

      expect(data.value.event).toHaveProperty('id', testEventId);
      expect(data.value.event).toHaveProperty('data');
      expect(data.value.event.data).toHaveProperty('name', 'Bundle Test Event');
    });

    test('returns sponsors at top level for convenience', async () => {
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: testEventId
      });
      const data = await response.json();

      expect(Array.isArray(data.value.sponsors)).toBe(true);
    });

    test('returns all link types', async () => {
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: testEventId
      });
      const data = await response.json();

      expect(data.value.links).toHaveProperty('publicUrl');
      expect(data.value.links).toHaveProperty('posterUrl');
      expect(data.value.links).toHaveProperty('displayUrl');
      expect(data.value.links).toHaveProperty('reportUrl');
    });

    test('supports etag caching', async () => {
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: testEventId
      });
      const data = await response.json();

      expect(data).toHaveProperty('etag');
      expect(typeof data.etag).toBe('string');
    });

    test('returns 404 for non-existent event', async () => {
      const fakeId = 'non-existent-bundle-12345';
      const response = await api.post('?action=getPublicBundle', {
        brandId: brand,
        scope: 'events',
        id: fakeId
      });

      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });

  test.describe('Event CRUD Flow', () => {
    test('complete CRUD lifecycle', async () => {
      // 1. CREATE
      const eventData = new EventBuilder()
        .withName('Lifecycle Test Event')
        .withDate('2025-12-25')
        .withLocation('Lifecycle Venue')
        .build();

      const createResponse = await api.createEvent(brand, eventData, adminKey);
      const createData = await createResponse.json();

      expect(createData.ok).toBe(true);
      const eventId = createData.value.id;

      // 2. READ
      const getResponse = await api.getEvent(brand, eventId);
      const getData = await getResponse.json();

      expect(getData.ok).toBe(true);
      expect(getData.value.name).toBe('Lifecycle Test Event');

      // 3. UPDATE
      const updateResponse = await api.updateEvent(brand, eventId, {
        location: 'Updated Venue'
      }, adminKey);
      const updateData = await updateResponse.json();

      expect(updateData.ok).toBe(true);

      // 4. READ (verify update)
      const getResponse2 = await api.getEvent(brand, eventId);
      const getData2 = await getResponse2.json();

      expect(getData2.value.location).toBe('Updated Venue');

      // 5. DELETE
      const deleteResponse = await api.deleteEvent(brand, eventId, adminKey);
      const deleteData = await deleteResponse.json();

      expect(deleteData.ok).toBe(true);

      // 6. READ (verify deletion)
      const getResponse3 = await api.getEvent(brand, eventId);

      if (getResponse3.status() === 404) {
        expect(getResponse3.ok()).toBe(false);
      } else {
        const getData3 = await getResponse3.json();
        expect(getData3.ok).toBe(false);
      }
    });
  });
});
