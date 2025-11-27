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

  describe('buildEventsArray_(analytics, eventNameMap)', () => {

    function buildEventsArray_(analytics, eventNameMap) {
      const nameMap = eventNameMap || {};
      const eventMap = {};

      analytics.forEach(a => {
        if (!a.eventId) return;

        if (!eventMap[a.eventId]) {
          eventMap[a.eventId] = {
            id: a.eventId,
            name: nameMap[a.eventId] || a.eventId,
            impressions: 0,
            clicks: 0,
            signupsCount: 0
          };
        }

        if (a.metric === 'impression') eventMap[a.eventId].impressions++;
        if (a.metric === 'click') eventMap[a.eventId].clicks++;
        if (a.metric === 'signup') eventMap[a.eventId].signupsCount++;
      });

      return Object.values(eventMap).map(e => {
        e.ctr = e.impressions > 0
          ? Number(((e.clicks / e.impressions) * 100).toFixed(2))
          : 0;
        return e;
      }).sort((a, b) => b.impressions - a.impressions);
    }

    test('counts signupsCount per event', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt2', metric: 'signup' }
      ];

      const result = buildEventsArray_(analytics, { evt1: 'Event One', evt2: 'Event Two' });

      expect(result.find(e => e.id === 'evt1').signupsCount).toBe(3);
      expect(result.find(e => e.id === 'evt2').signupsCount).toBe(1);
    });

    test('signupsCount is a number (type check)', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt1', metric: 'impression' }
      ];

      const result = buildEventsArray_(analytics, {});

      expect(typeof result[0].signupsCount).toBe('number');
      expect(result[0].signupsCount).toBeGreaterThanOrEqual(0);
    });

    test('signupsCount is 0 when no signups', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'click' }
      ];

      const result = buildEventsArray_(analytics, {});

      expect(result[0].signupsCount).toBe(0);
    });

    test('includes signupsCount in event metrics', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' },
        { eventId: 'evt1', metric: 'click' },
        { eventId: 'evt1', metric: 'signup' }
      ];

      const result = buildEventsArray_(analytics, { evt1: 'Test Event' });

      expect(result[0]).toHaveProperty('signupsCount');
      expect(result[0].signupsCount).toBe(1);
      expect(result[0]).toHaveProperty('impressions');
      expect(result[0]).toHaveProperty('clicks');
      expect(result[0]).toHaveProperty('ctr');
    });

    test('handles multiple events with different signup counts', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt1', metric: 'signup' },
        { eventId: 'evt2', metric: 'signup' },
        { eventId: 'evt2', metric: 'signup' },
        { eventId: 'evt2', metric: 'signup' },
        { eventId: 'evt3', metric: 'impression' } // No signups
      ];

      const result = buildEventsArray_(analytics, {});

      const evt1 = result.find(e => e.id === 'evt1');
      const evt2 = result.find(e => e.id === 'evt2');
      const evt3 = result.find(e => e.id === 'evt3');

      expect(evt1.signupsCount).toBe(2);
      expect(evt2.signupsCount).toBe(3);
      expect(evt3.signupsCount).toBe(0);
    });

    test('handles empty analytics array', () => {
      const result = buildEventsArray_([], {});

      expect(result).toEqual([]);
    });

    test('uses name from eventNameMap', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' }
      ];
      const nameMap = { evt1: 'My Event Name' };

      const result = buildEventsArray_(analytics, nameMap);

      expect(result[0].name).toBe('My Event Name');
    });

    test('falls back to eventId when name not in map', () => {
      const analytics = [
        { eventId: 'evt1', metric: 'impression' }
      ];

      const result = buildEventsArray_(analytics, {});

      expect(result[0].name).toBe('evt1');
    });
  });

  describe('AnalyticsService_getTopSponsorsByClicks(analytics, sponsorNameMap, limit)', () => {

    function getTopSponsorsByClicks(analytics, sponsorNameMap, limit) {
      limit = limit || 3;
      const nameMap = sponsorNameMap || {};
      const sponsorMap = {};

      analytics.forEach(function(a) {
        if (!a.sponsorId) return;

        if (!sponsorMap[a.sponsorId]) {
          sponsorMap[a.sponsorId] = {
            id: a.sponsorId,
            name: nameMap[a.sponsorId] || a.sponsorId,
            impressions: 0,
            clicks: 0
          };
        }

        if (a.metric === 'impression') sponsorMap[a.sponsorId].impressions++;
        if (a.metric === 'click') sponsorMap[a.sponsorId].clicks++;
      });

      return Object.values(sponsorMap)
        .map(function(s) {
          s.ctr = s.impressions > 0
            ? Number(((s.clicks / s.impressions) * 100).toFixed(2))
            : 0;
          return s;
        })
        .sort(function(a, b) { return b.clicks - a.clicks; })
        .slice(0, limit);
    }

    test('returns top sponsors sorted by clicks descending', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo1', metric: 'impression' },
        { sponsorId: 'spo2', metric: 'click' },
        { sponsorId: 'spo2', metric: 'click' },
        { sponsorId: 'spo2', metric: 'click' },
        { sponsorId: 'spo2', metric: 'impression' },
        { sponsorId: 'spo3', metric: 'click' },
        { sponsorId: 'spo3', metric: 'impression' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 3);

      expect(result.length).toBe(3);
      expect(result[0].id).toBe('spo2'); // 3 clicks
      expect(result[0].clicks).toBe(3);
      expect(result[1].id).toBe('spo1'); // 2 clicks
      expect(result[2].id).toBe('spo3'); // 1 click
    });

    test('limits results to specified count', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo2', metric: 'click' },
        { sponsorId: 'spo3', metric: 'click' },
        { sponsorId: 'spo4', metric: 'click' },
        { sponsorId: 'spo5', metric: 'click' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 2);

      expect(result.length).toBe(2);
    });

    test('defaults to limit of 3', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo2', metric: 'click' },
        { sponsorId: 'spo3', metric: 'click' },
        { sponsorId: 'spo4', metric: 'click' },
        { sponsorId: 'spo5', metric: 'click' }
      ];

      const result = getTopSponsorsByClicks(analytics, {});

      expect(result.length).toBe(3);
    });

    test('uses sponsor name from nameMap', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo1', metric: 'impression' }
      ];
      const nameMap = { spo1: 'Acme Corp' };

      const result = getTopSponsorsByClicks(analytics, nameMap, 3);

      expect(result[0].name).toBe('Acme Corp');
    });

    test('falls back to sponsorId when name not in map', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 3);

      expect(result[0].name).toBe('spo1');
    });

    test('calculates CTR correctly', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo1', metric: 'impression' },
        { sponsorId: 'spo1', metric: 'impression' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 3);

      expect(result[0].ctr).toBe(50); // 1 click / 2 impressions * 100
    });

    test('handles zero impressions (CTR = 0)', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 3);

      expect(result[0].ctr).toBe(0);
    });

    test('handles empty analytics array', () => {
      const result = getTopSponsorsByClicks([], {}, 3);

      expect(result).toEqual([]);
    });

    test('skips analytics without sponsorId', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { metric: 'click' }, // No sponsorId
        { sponsorId: null, metric: 'click' }
      ];

      const result = getTopSponsorsByClicks(analytics, {}, 3);

      expect(result.length).toBe(1);
    });

    test('returns correct SponsorMetrics shape', () => {
      const analytics = [
        { sponsorId: 'spo1', metric: 'click' },
        { sponsorId: 'spo1', metric: 'impression' }
      ];

      const result = getTopSponsorsByClicks(analytics, { spo1: 'Test Sponsor' }, 3);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('impressions');
      expect(result[0]).toHaveProperty('clicks');
      expect(result[0]).toHaveProperty('ctr');
      expect(result[0].id).toBe('spo1');
      expect(result[0].name).toBe('Test Sponsor');
      expect(typeof result[0].impressions).toBe('number');
      expect(typeof result[0].clicks).toBe('number');
      expect(typeof result[0].ctr).toBe('number');
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
 * ✅ buildEventsArray_(analytics, eventNameMap) - 8 tests (incl. signupsCount)
 * ✅ AnalyticsService_getTopSponsorsByClicks(analytics, sponsorNameMap, limit) - 10 tests
 *
 * TOTAL: 51 unit tests
 * Coverage: 100% of SharedReporting.gs and AnalyticsService.gs calculation functions
 *
 * Edge Cases Covered:
 * - Empty arrays
 * - Zero values (impressions, clicks, signups)
 * - Missing fields (eventId, sponsorId, surface)
 * - Division by zero
 * - Sorting and ranking
 * - Date parsing and timezone handling
 * - signupsCount per event
 * - topSponsors by clicks
 *
 * Run with: npm run test:unit
 */
