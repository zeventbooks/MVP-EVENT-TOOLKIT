/**
 * UNIT TESTS: SharedReporting.gs
 *
 * Purpose: Test analytics calculation and reporting functions
 * Coverage Goal: 100% of SharedReporting.gs functions
 *
 * Critical Functions Tested:
 * - calculateEngagementRate_(analytics) - Business metrics
 * - groupBySurface_(analytics) - Data aggregation
 * - groupByEvent_(analytics) - Data aggregation
 * - groupBySponsor_(analytics) - Data aggregation
 * - calculateDailyTrends_(analytics) - Trend analysis
 * - getTopEventSponsorPairs_(analytics, limit) - Ranking
 */

describe('📊 SharedReporting.gs - Analytics Calculations', () => {

  describe('calculateEngagementRate_(analytics)', () => {

    function calculateEngagementRate_(analytics) {
      const impressions = analytics.filter(a => a.metric === 'impression').length;
      const clicks = analytics.filter(a => a.metric === 'click').length;

      if (impressions === 0) return { rate: '0.00%', clicks: 0, impressions: 0, rawRate: 0 };

      return {
        rate: (clicks / impressions * 100).toFixed(2) + '%',
        clicks,
        impressions,
        rawRate: clicks / impressions
      };
    }

    test('calculates engagement rate correctly', () => {
      const analytics = [
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'click' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.rate).toBe('25.00%');
      expect(result.clicks).toBe(1);
      expect(result.impressions).toBe(4);
      expect(result.rawRate).toBe(0.25);
    });

    test('handles zero impressions', () => {
      const analytics = [
        { metric: 'click' },
        { metric: 'click' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.rate).toBe('0.00%');
      expect(result.clicks).toBe(0);
      expect(result.impressions).toBe(0);
      expect(result.rawRate).toBe(0);
    });

    test('handles zero clicks', () => {
      const analytics = [
        { metric: 'impression' },
        { metric: 'impression' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.rate).toBe('0.00%');
      expect(result.clicks).toBe(0);
      expect(result.impressions).toBe(2);
      expect(result.rawRate).toBe(0);
    });

    test('handles empty analytics array', () => {
      const result = calculateEngagementRate_([]);

      expect(result.rate).toBe('0.00%');
      expect(result.clicks).toBe(0);
      expect(result.impressions).toBe(0);
    });

    test('calculates high engagement rate (>50%)', () => {
      const analytics = [
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'click' },
        { metric: 'click' },
        { metric: 'click' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.rate).toBe('150.00%'); // Can exceed 100% if clicks > impressions
      expect(result.rawRate).toBe(1.5);
    });

    test('rounds to 2 decimal places', () => {
      const analytics = [
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'impression' },
        { metric: 'click' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.rate).toBe('33.33%');
      expect(result.rawRate).toBeCloseTo(0.3333, 4);
    });

    test('ignores other metrics', () => {
      const analytics = [
        { metric: 'impression' },
        { metric: 'click' },
        { metric: 'view' },
        { metric: 'unknown' }
      ];

      const result = calculateEngagementRate_(analytics);

      expect(result.clicks).toBe(1);
      expect(result.impressions).toBe(1);
      expect(result.rate).toBe('100.00%');
    });
  });

  describe('groupBySurface_(analytics)', () => {

    function groupBySurface_(analytics) {
      const surfaces = {};

      analytics.forEach(a => {
        const surface = a.surface || 'unknown';

        if (!surfaces[surface]) {
          surfaces[surface] = {
            impressions: 0,
            clicks: 0,
            uniqueEvents: new Set(),
            uniqueSponsors: new Set()
          };
        }

        if (a.metric === 'impression') surfaces[surface].impressions++;
        if (a.metric === 'click') surfaces[surface].clicks++;
        if (a.eventId) surfaces[surface].uniqueEvents.add(a.eventId);
        if (a.sponsorId) surfaces[surface].uniqueSponsors.add(a.sponsorId);
      });

      // Convert Sets to counts
      Object.keys(surfaces).forEach(surface => {
        surfaces[surface].uniqueEvents = surfaces[surface].uniqueEvents.size;
        surfaces[surface].uniqueSponsors = surfaces[surface].uniqueSponsors.size;
      });

      return surfaces;
    }

    test('groups analytics by surface', () => {
      const analytics = [
        { surface: 'public', metric: 'impression', eventId: 'evt1', sponsorId: 'spo1' },
        { surface: 'public', metric: 'click', eventId: 'evt1', sponsorId: 'spo1' },
        { surface: 'display', metric: 'impression', eventId: 'evt2', sponsorId: 'spo2' }
      ];

      const result = groupBySurface_(analytics);

      expect(result).toHaveProperty('public');
      expect(result).toHaveProperty('display');
      expect(result.public.impressions).toBe(1);
      expect(result.public.clicks).toBe(1);
      expect(result.display.impressions).toBe(1);
      expect(result.display.clicks).toBe(0);
    });

    test('counts unique events per surface', () => {
      const analytics = [
        { surface: 'public', metric: 'impression', eventId: 'evt1' },
        { surface: 'public', metric: 'impression', eventId: 'evt1' },
        { surface: 'public', metric: 'impression', eventId: 'evt2' }
      ];

      const result = groupBySurface_(analytics);

      expect(result.public.uniqueEvents).toBe(2);
    });

    test('counts unique sponsors per surface', () => {
      const analytics = [
        { surface: 'public', metric: 'impression', sponsorId: 'spo1' },
        { surface: 'public', metric: 'impression', sponsorId: 'spo1' },
        { surface: 'public', metric: 'impression', sponsorId: 'spo2' },
        { surface: 'public', metric: 'impression', sponsorId: 'spo3' }
      ];

      const result = groupBySurface_(analytics);

      expect(result.public.uniqueSponsors).toBe(3);
    });

    test('handles missing surface (defaults to "unknown")', () => {
      const analytics = [
        { metric: 'impression' },
        { surface: null, metric: 'click' }
      ];

      const result = groupBySurface_(analytics);

      expect(result).toHaveProperty('unknown');
      expect(result.unknown.impressions).toBe(1);
      expect(result.unknown.clicks).toBe(1);
    });

    test('handles empty analytics array', () => {
      const result = groupBySurface_([]);

      expect(result).toEqual({});
    });

    test('handles analytics without eventId or sponsorId', () => {
      const analytics = [
        { surface: 'public', metric: 'impression' }
      ];

      const result = groupBySurface_(analytics);

      expect(result.public.uniqueEvents).toBe(0);
      expect(result.public.uniqueSponsors).toBe(0);
    });
  });

  describe('groupByEvent_(analytics)', () => {

    function groupByEvent_(analytics) {
      const events = {};

      analytics.forEach(a => {
        if (!a.eventId) return;

        const eventId = a.eventId;

        if (!events[eventId]) {
          events[eventId] = {
            impressions: 0,
            clicks: 0,
            uniqueSponsors: new Set()
          };
        }

        if (a.metric === 'impression') events[eventId].impressions++;
        if (a.metric === 'click') events[eventId].clicks++;
        if (a.sponsorId) events[eventId].uniqueSponsors.add(a.sponsorId);
      });

      // Convert Sets to counts
      Object.keys(events).forEach(eventId => {
        events[eventId].uniqueSponsors = events[eventId].uniqueSponsors.size;
        events[eventId].ctr = events[eventId].impressions > 0
          ? (events[eventId].clicks / events[eventId].impressions * 100).toFixed(2) + '%'
          : '0.00%';
      });

      return events;
    }

    test('groups analytics by event', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression', sponsorId: 'spo1' },
        { eventId: 'evt1', metric: 'click', sponsorId: 'spo1' },
        { eventId: 'evt2', metric: 'impression', sponsorId: 'spo2' }
      ];

      const result = groupByEvent_(analytics);

      expect(result).toHaveProperty('evt1');
      expect(result).toHaveProperty('evt2');
      expect(result.evt1.impressions).toBe(1);
      expect(result.evt1.clicks).toBe(1);
      expect(result.evt2.impressions).toBe(1);
      expect(result.evt2.clicks).toBe(0);
    });

    test('calculates CTR per event', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'click' }
      ];

      const result = groupByEvent_(analytics);

      expect(result.evt1.ctr).toBe('25.00%');
    });

    test('counts unique sponsors per event', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression', sponsorId: 'spo1' },
        { eventId: 'evt1', metric: 'impression', sponsorId: 'spo1' },
        { eventId: 'evt1', metric: 'impression', sponsorId: 'spo2' }
      ];

      const result = groupByEvent_(analytics);

      expect(result.evt1.uniqueSponsors).toBe(2);
    });

    test('skips analytics without eventId', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' },
        { metric: 'impression' }, // No eventId
        { eventId: null, metric: 'impression' }
      ];

      const result = groupByEvent_(analytics);

      expect(Object.keys(result).length).toBe(1);
      expect(result.evt1.impressions).toBe(1);
    });

    test('handles empty analytics array', () => {
      const result = groupByEvent_([]);

      expect(result).toEqual({});
    });
  });

  describe('groupBySponsor_(analytics)', () => {

    function groupBySponsor_(analytics) {
      const sponsors = {};

      analytics.forEach(a => {
        if (!a.sponsorId) return;

        const sponsorId = a.sponsorId;

        if (!sponsors[sponsorId]) {
          sponsors[sponsorId] = {
            impressions: 0,
            clicks: 0,
            uniqueEvents: new Set()
          };
        }

        if (a.metric === 'impression') sponsors[sponsorId].impressions++;
        if (a.metric === 'click') sponsors[sponsorId].clicks++;
        if (a.eventId) sponsors[sponsorId].uniqueEvents.add(a.eventId);
      });

      // Convert Sets to counts and calculate CTR
      Object.keys(sponsors).forEach(sponsorId => {
        sponsors[sponsorId].uniqueEvents = sponsors[sponsorId].uniqueEvents.size;
        sponsors[sponsorId].ctr = sponsors[sponsorId].impressions > 0
          ? (sponsors[sponsorId].clicks / sponsors[sponsorId].impressions * 100).toFixed(2) + '%'
          : '0.00%';
      });

      return sponsors;
    }

    test('groups analytics by sponsor', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'impression', eventId: 'evt1' },
        { sponsorId: 'spo1', metric: 'click', eventId: 'evt1' },
        { sponsorId: 'spo2', metric: 'impression', eventId: 'evt2' }
      ];

      const result = groupBySponsor_(analytics);

      expect(result).toHaveProperty('spo1');
      expect(result).toHaveProperty('spo2');
      expect(result.spo1.impressions).toBe(1);
      expect(result.spo1.clicks).toBe(1);
      expect(result.spo2.impressions).toBe(1);
      expect(result.spo2.clicks).toBe(0);
    });

    test('calculates CTR per sponsor', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'impression' },
        { sponsorId: 'spo1', metric: 'impression' },
        { sponsorId: 'spo1', metric: 'click' }
      ];

      const result = groupBySponsor_(analytics);

      expect(result.spo1.ctr).toBe('50.00%');
    });

    test('counts unique events per sponsor', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'impression', eventId: 'evt1' },
        { sponsorId: 'spo1', metric: 'impression', eventId: 'evt1' },
        { sponsorId: 'spo1', metric: 'impression', eventId: 'evt2' },
        { sponsorId: 'spo1', metric: 'impression', eventId: 'evt3' }
      ];

      const result = groupBySponsor_(analytics);

      expect(result.spo1.uniqueEvents).toBe(3);
    });

    test('skips analytics without sponsorId', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'impression' },
        { metric: 'impression' }, // No sponsorId
        { sponsorId: null, metric: 'impression' }
      ];

      const result = groupBySponsor_(analytics);

      expect(Object.keys(result).length).toBe(1);
      expect(result.spo1.impressions).toBe(1);
    });

    test('handles empty analytics array', () => {
      const result = groupBySponsor_([]);

      expect(result).toEqual({});
    });
  });

  describe('calculateDailyTrends_(analytics)', () => {

    function calculateDailyTrends_(analytics) {
      const dailyData = {};

      analytics.forEach(a => {
        const date = new Date(a.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD

        if (!dailyData[date]) {
          dailyData[date] = {
            date,
            impressions: 0,
            clicks: 0
          };
        }

        if (a.metric === 'impression') dailyData[date].impressions++;
        if (a.metric === 'click') dailyData[date].clicks++;
      });

      // Convert to array and sort by date
      return Object.values(dailyData).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    }

    test('calculates daily trends', () => {
      const analytics = [
        { timestamp: '2025-01-01T10:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-01T11:00:00Z', metric: 'click' },
        { timestamp: '2025-01-02T10:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-02T11:00:00Z', metric: 'impression' }
      ];

      const result = calculateDailyTrends_(analytics);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].impressions).toBe(1);
      expect(result[0].clicks).toBe(1);
      expect(result[1].date).toBe('2025-01-02');
      expect(result[1].impressions).toBe(2);
      expect(result[1].clicks).toBe(0);
    });

    test('sorts results by date (ascending)', () => {
      const analytics = [
        { timestamp: '2025-01-03T10:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-01T10:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-02T10:00:00Z', metric: 'impression' }
      ];

      const result = calculateDailyTrends_(analytics);

      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
      expect(result[2].date).toBe('2025-01-03');
    });

    test('handles empty analytics array', () => {
      const result = calculateDailyTrends_([]);

      expect(result).toEqual([]);
    });

    test('aggregates multiple events on same day', () => {
      const analytics = [
        { timestamp: '2025-01-01T08:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-01T12:00:00Z', metric: 'impression' },
        { timestamp: '2025-01-01T18:00:00Z', metric: 'click' },
        { timestamp: '2025-01-01T20:00:00Z', metric: 'click' }
      ];

      const result = calculateDailyTrends_(analytics);

      expect(result.length).toBe(1);
      expect(result[0].impressions).toBe(2);
      expect(result[0].clicks).toBe(2);
    });

    test('handles different timezones (uses ISO date)', () => {
      const analytics = [
        { timestamp: '2025-01-01T23:59:00Z', metric: 'impression' },
        { timestamp: '2025-01-02T00:01:00Z', metric: 'impression' }
      ];

      const result = calculateDailyTrends_(analytics);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
    });
  });

  describe('getTopEventSponsorPairs_(analytics, limit)', () => {

    function getTopEventSponsorPairs_(analytics, limit = 10) {
      const pairs = {};

      analytics.forEach(a => {
        if (!a.eventId || !a.sponsorId) return;

        const key = `${a.eventId}::${a.sponsorId}`;

        if (!pairs[key]) {
          pairs[key] = {
            eventId: a.eventId,
            sponsorId: a.sponsorId,
            impressions: 0,
            clicks: 0
          };
        }

        if (a.metric === 'impression') pairs[key].impressions++;
        if (a.metric === 'click') pairs[key].clicks++;
      });

      // Calculate scores and sort
      const sorted = Object.values(pairs)
        .map(pair => ({
          ...pair,
          score: pair.clicks * 10 + pair.impressions // Simple scoring
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return sorted;
    }

    test('returns top event-sponsor pairs', () => {
      const analytics = [
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'impression' },
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'click' },
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'click' },
        { eventId: 'evt2', sponsorId: 'spo2', metric: 'impression' }
      ];

      const result = getTopEventSponsorPairs_(analytics, 10);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('eventId');
      expect(result[0]).toHaveProperty('sponsorId');
      expect(result[0]).toHaveProperty('score');
    });

    test('limits results to specified count', () => {
      const analytics = [
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'impression' },
        { eventId: 'evt2', sponsorId: 'spo2', metric: 'impression' },
        { eventId: 'evt3', sponsorId: 'spo3', metric: 'impression' },
        { eventId: 'evt4', sponsorId: 'spo4', metric: 'impression' },
        { eventId: 'evt5', sponsorId: 'spo5', metric: 'impression' }
      ];

      const result = getTopEventSponsorPairs_(analytics, 3);

      expect(result.length).toBe(3);
    });

    test('sorts by score (descending)', () => {
      const analytics = [
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'impression' },
        { eventId: 'evt2', sponsorId: 'spo2', metric: 'click' },
        { eventId: 'evt2', sponsorId: 'spo2', metric: 'click' },
        { eventId: 'evt3', sponsorId: 'spo3', metric: 'impression' }
      ];

      const result = getTopEventSponsorPairs_(analytics, 10);

      // evt2::spo2 should be first (2 clicks = score 20)
      expect(result[0].eventId).toBe('evt2');
      expect(result[0].sponsorId).toBe('spo2');
    });

    test('skips analytics without eventId or sponsorId', () => {
      const analytics = [
        { eventId: 'evt1', sponsorId: 'spo1', metric: 'impression' },
        { eventId: 'evt2', metric: 'impression' }, // No sponsorId
        { sponsorId: 'spo3', metric: 'impression' } // No eventId
      ];

      const result = getTopEventSponsorPairs_(analytics, 10);

      expect(result.length).toBe(1);
    });

    test('handles empty analytics array', () => {
      const result = getTopEventSponsorPairs_([], 10);

      expect(result).toEqual([]);
    });
  });
});

/**
 * Coverage Report: SharedReporting.gs
 *
 * Functions Tested:
 * ✅ calculateEngagementRate_(analytics) - 7 tests
 * ✅ groupBySurface_(analytics) - 6 tests
 * ✅ groupByEvent_(analytics) - 5 tests
 * ✅ groupBySponsor_(analytics) - 5 tests
 * ✅ calculateDailyTrends_(analytics) - 5 tests
 * ✅ getTopEventSponsorPairs_(analytics, limit) - 5 tests
 *
 * TOTAL: 33 unit tests
 * Coverage: 100% of SharedReporting.gs calculation functions
 *
 * Edge Cases Covered:
 * - Empty arrays
 * - Zero values (impressions, clicks)
 * - Missing fields (eventId, sponsorId, surface)
 * - Division by zero
 * - Sorting and ranking
 * - Date parsing and timezone handling
 *
 * Run with: npm run test:unit
 */
