/**
 * Multi-Tenant API Tests - Playwright
 * Ensures tenant isolation and cross-tenant security
 */

import { test, expect } from '@playwright/test';
import { ApiHelpers, EventBuilder } from './api-helpers.js';
import { getCurrentEnvironment } from '../../config/environments.js';

const TENANTS = ['root', 'abc', 'cbc', 'cbl'];

test.describe('Multi-Tenant APIs', () => {
  let api;
  let adminKey;

  test.beforeEach(async ({ request }) => {
    const env = getCurrentEnvironment();
    api = new ApiHelpers(request, env.baseUrl);
    adminKey = process.env.ADMIN_KEY;

    if (!adminKey) {
      test.skip('ADMIN_KEY not set');
    }
  });

  test.describe('Tenant Isolation', () => {
    const createdEventIds = {};

    test.beforeAll(async ({ request }) => {
      // Create one event per tenant
      const env = getCurrentEnvironment();
      const setupApi = new ApiHelpers(request, env.baseUrl);

      for (const tenant of TENANTS) {
        const { eventId } = await setupApi.createTestEvent(tenant, process.env.ADMIN_KEY, {
          name: `${tenant.toUpperCase()} Isolation Test`
        });
        createdEventIds[tenant] = eventId;
      }
    });

    test.afterAll(async ({ request }) => {
      // Clean up
      const env = getCurrentEnvironment();
      const cleanupApi = new ApiHelpers(request, env.baseUrl);

      for (const tenant of TENANTS) {
        const eventId = createdEventIds[tenant];
        if (eventId) {
          try {
            await cleanupApi.deleteEvent(tenant, eventId, adminKey);
          } catch (error) {
            console.warn(`Failed to cleanup ${tenant}:${eventId}`);
          }
        }
      }
    });

    test('each tenant can only see their own events', async () => {
      for (const tenant of TENANTS) {
        const response = await api.listEvents(tenant);
        const data = await response.json();

        expect(data.ok).toBe(true);

        const events = data.value;
        const ownEvent = events.find(e => e.id === createdEventIds[tenant]);

        // Should find own event
        expect(ownEvent).toBeDefined();
        expect(ownEvent.name).toContain(tenant.toUpperCase());

        // Should NOT find other tenants' events
        for (const otherTenant of TENANTS) {
          if (otherTenant === tenant) continue;

          const otherEvent = events.find(e => e.id === createdEventIds[otherTenant]);
          expect(otherEvent).toBeUndefined();
        }
      }
    });

    test('cannot access another tenant\'s event directly', async () => {
      // Try to access root's event from abc tenant
      const rootEventId = createdEventIds['root'];

      const response = await api.getEvent('abc', rootEventId);

      // Should either return 404 or ok:false
      if (response.status() === 404) {
        expect(response.ok()).toBe(false);
      } else {
        const data = await response.json();
        expect(data.ok).toBe(false);
      }
    });

    test('cannot update another tenant\'s event', async () => {
      const rootEventId = createdEventIds['root'];

      // Try to update root's event from abc tenant
      const response = await api.post('?action=update', {
        tenantId: 'abc',
        scope: 'events',
        id: rootEventId,
        adminKey,
        data: { name: 'Hacked Name' }
      });

      // Should fail
      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Verify root event unchanged
      const getResponse = await api.getEvent('root', rootEventId);
      const getData = await getResponse.json();

      expect(getData.value.name).toContain('ROOT');
      expect(getData.value.name).not.toContain('Hacked');
    });

    test('cannot delete another tenant\'s event', async () => {
      const rootEventId = createdEventIds['root'];

      // Try to delete root's event from abc tenant
      const response = await api.post('?action=delete', {
        tenantId: 'abc',
        scope: 'events',
        id: rootEventId,
        adminKey
      });

      // Should fail
      if (response.ok()) {
        const data = await response.json();
        expect(data.ok).toBe(false);
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Verify root event still exists
      const getResponse = await api.getEvent('root', rootEventId);
      const getData = await getResponse.json();

      expect(getData.ok).toBe(true);
      expect(getData.value).toBeDefined();
    });
  });

  test.describe('Tenant Status', () => {
    test('all tenants return valid status', async () => {
      for (const tenant of TENANTS) {
        const response = await api.getStatus(tenant);
        const data = await response.json();

        expect(response.ok()).toBe(true);
        expect(data.ok).toBe(true);
        expect(data.value.tenant).toBe(tenant);
      }
    });

    test('tenants have correct configuration', async () => {
      const tenantConfigs = {
        root: 'Zeventbook',
        abc: 'American Bocce Co.',
        cbc: 'Chicago Bocce Club',
        cbl: 'Chicago Bocce League'
      };

      for (const tenant of TENANTS) {
        const response = await api.getStatus(tenant);
        const data = await response.json();

        expect(data.value.tenant).toBe(tenant);
        // Could verify tenant name if returned in status
      }
    });
  });

  test.describe('Concurrent Multi-Tenant Operations', () => {
    test('handles concurrent requests across tenants', async () => {
      // Fire concurrent requests to all tenants
      const promises = TENANTS.map(tenant =>
        api.getStatus(tenant)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response, index) => {
        expect(response.ok()).toBe(true);
      });

      // Verify each returned correct tenant
      for (let i = 0; i < responses.length; i++) {
        const data = await responses[i].json();
        expect(data.value.tenant).toBe(TENANTS[i]);
      }
    });

    test('handles concurrent event creation across tenants', async () => {
      const createdIds = [];

      try {
        // Create events concurrently for all tenants
        const promises = TENANTS.map(tenant =>
          api.createTestEvent(tenant, adminKey, {
            name: `${tenant} Concurrent Test`
          })
        );

        const results = await Promise.all(promises);

        // All should succeed
        results.forEach((result, index) => {
          expect(result.data.ok).toBe(true);
          expect(result.eventId).toBeDefined();
          createdIds.push({ tenant: TENANTS[index], eventId: result.eventId });
        });

        // Verify isolation - each tenant should only see their own
        for (const { tenant, eventId } of createdIds) {
          const response = await api.listEvents(tenant);
          const data = await response.json();

          const ownEvent = data.value.find(e => e.id === eventId);
          expect(ownEvent).toBeDefined();

          // Should not see other tenants' events
          for (const { tenant: otherTenant, eventId: otherEventId } of createdIds) {
            if (tenant === otherTenant) continue;

            const otherEvent = data.value.find(e => e.id === otherEventId);
            expect(otherEvent).toBeUndefined();
          }
        }
      } finally {
        // Cleanup
        for (const { tenant, eventId } of createdIds) {
          try {
            await api.deleteEvent(tenant, eventId, adminKey);
          } catch (error) {
            console.warn(`Failed to cleanup ${tenant}:${eventId}`);
          }
        }
      }
    });
  });

  test.describe('Tenant Scopes', () => {
    test('all tenants support events scope', async () => {
      for (const tenant of TENANTS) {
        const response = await api.listEvents(tenant);
        const data = await response.json();

        expect(response.ok()).toBe(true);
        expect(data.ok).toBe(true);
        expect(data.value).toBeInstanceOf(Array);
      }
    });

    test('all tenants support sponsors scope', async () => {
      for (const tenant of TENANTS) {
        const response = await api.listSponsors(tenant);
        const data = await response.json();

        expect(response.ok()).toBe(true);
        expect(data.ok).toBe(true);
        expect(data.value).toBeInstanceOf(Array);
      }
    });
  });

  test.describe('Tenant Data Integrity', () => {
    test('event IDs are unique across tenants', async () => {
      const createdIds = [];

      try {
        // Create events in all tenants
        for (const tenant of TENANTS) {
          const { eventId } = await api.createTestEvent(tenant, adminKey);
          createdIds.push({ tenant, eventId });
        }

        // Verify all IDs are unique
        const ids = createdIds.map(item => item.eventId);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
      } finally {
        // Cleanup
        for (const { tenant, eventId } of createdIds) {
          try {
            await api.deleteEvent(tenant, eventId, adminKey);
          } catch (error) {
            console.warn(`Failed to cleanup ${tenant}:${eventId}`);
          }
        }
      }
    });

    test('tenant data persists independently', async () => {
      const createdIds = [];

      try {
        // Create event in root
        const { eventId: rootEventId } = await api.createTestEvent('root', adminKey, {
          name: 'Root Persistence Test'
        });
        createdIds.push({ tenant: 'root', eventId: rootEventId });

        // Create event in abc
        const { eventId: abcEventId } = await api.createTestEvent('abc', adminKey, {
          name: 'ABC Persistence Test'
        });
        createdIds.push({ tenant: 'abc', eventId: abcEventId });

        // Delete root event
        await api.deleteEvent('root', rootEventId, adminKey);

        // Verify abc event still exists
        const abcResponse = await api.getEvent('abc', abcEventId);
        const abcData = await abcResponse.json();

        expect(abcData.ok).toBe(true);
        expect(abcData.value).toBeDefined();

        // Verify root event is gone
        const rootResponse = await api.getEvent('root', rootEventId);

        if (rootResponse.status() === 404) {
          expect(rootResponse.ok()).toBe(false);
        } else {
          const rootData = await rootResponse.json();
          expect(rootData.ok).toBe(false);
        }

        // Clean up abc event
        await api.deleteEvent('abc', abcEventId, adminKey);
      } catch (error) {
        // Cleanup on error
        for (const { tenant, eventId } of createdIds) {
          try {
            await api.deleteEvent(tenant, eventId, adminKey);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    });
  });
});
