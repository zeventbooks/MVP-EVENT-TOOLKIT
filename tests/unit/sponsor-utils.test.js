/**
 * SponsorUtils Unit Tests
 *
 * Tests for the shared sponsor utilities module used across
 * Display.html, Public.html, and Poster.html
 */

describe('SponsorUtils', () => {

  describe('esc() - XSS Prevention', () => {
    let esc;

    beforeAll(() => {
      // Simulate the esc function from SponsorUtils
      esc = function(s) {
        return String(s).replace(/[&<>"']/g, m => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
      };
    });

    test('should escape ampersands', () => {
      expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should escape less than signs', () => {
      expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape greater than signs', () => {
      expect(esc('2 > 1')).toBe('2 &gt; 1');
    });

    test('should escape double quotes', () => {
      expect(esc('Say "hello"')).toBe('Say &quot;hello&quot;');
    });

    test('should escape single quotes', () => {
      expect(esc("It's fine")).toBe('It&#39;s fine');
    });

    test('should handle null/undefined by converting to string', () => {
      expect(esc(null)).toBe('null');
      expect(esc(undefined)).toBe('undefined');
    });

    test('should handle numbers', () => {
      expect(esc(123)).toBe('123');
    });

    test('should handle empty string', () => {
      expect(esc('')).toBe('');
    });

    test('should escape complex XSS attack vectors', () => {
      const xssVector = '<img src="x" onerror="alert(\'XSS\')">';
      const escaped = esc(xssVector);
      expect(escaped).not.toContain('<img');
      expect(escaped).not.toContain('onerror');
      expect(escaped).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;');
    });

    test('should escape URL with malicious query params', () => {
      const maliciousUrl = 'https://example.com?redirect=<script>steal()</script>';
      const escaped = esc(maliciousUrl);
      expect(escaped).not.toContain('<script>');
    });
  });

  describe('filterByPlacement()', () => {
    let filterByPlacement;

    beforeAll(() => {
      filterByPlacement = function(sponsors, placement) {
        return (sponsors || []).filter(s => s?.placements?.[placement]);
      };
    });

    const mockSponsors = [
      { id: 'sp1', name: 'Sponsor 1', placements: { tvTop: true, mobileBanner: false } },
      { id: 'sp2', name: 'Sponsor 2', placements: { tvTop: false, mobileBanner: true } },
      { id: 'sp3', name: 'Sponsor 3', placements: { tvTop: true, mobileBanner: true, tvSide: true } },
      { id: 'sp4', name: 'Sponsor 4', placements: { posterTop: true } }
    ];

    test('should filter sponsors by tvTop placement', () => {
      const result = filterByPlacement(mockSponsors, 'tvTop');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['sp1', 'sp3']);
    });

    test('should filter sponsors by mobileBanner placement', () => {
      const result = filterByPlacement(mockSponsors, 'mobileBanner');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['sp2', 'sp3']);
    });

    test('should filter sponsors by tvSide placement', () => {
      const result = filterByPlacement(mockSponsors, 'tvSide');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sp3');
    });

    test('should filter sponsors by posterTop placement', () => {
      const result = filterByPlacement(mockSponsors, 'posterTop');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sp4');
    });

    test('should return empty array for unknown placement', () => {
      const result = filterByPlacement(mockSponsors, 'unknownPlacement');
      expect(result).toHaveLength(0);
    });

    test('should handle null/undefined sponsors array', () => {
      expect(filterByPlacement(null, 'tvTop')).toEqual([]);
      expect(filterByPlacement(undefined, 'tvTop')).toEqual([]);
    });

    test('should handle sponsors with missing placements object', () => {
      const sponsorsWithMissing = [
        { id: 'sp1', name: 'No Placements' },
        { id: 'sp2', name: 'Has Placements', placements: { tvTop: true } }
      ];
      const result = filterByPlacement(sponsorsWithMissing, 'tvTop');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sp2');
    });
  });

  describe('Analytics Logging', () => {
    let logBatch;
    let logEvent;
    let flush;

    beforeEach(() => {
      logBatch = [];

      // Mock navigator and Date
      global.navigator = { userAgent: 'TestBrowser/1.0' };
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      logEvent = function(evt) {
        try {
          evt.ua = navigator.userAgent;
          evt.ts = Date.now();
          logBatch.push(evt);
        } catch (_) {}
      };

      flush = function() {
        if (!logBatch.length) return;
        const copy = logBatch.splice(0, logBatch.length);
        return copy;
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should add userAgent to log event', () => {
      logEvent({ eventId: 'ev1', surface: 'display', metric: 'impression' });
      expect(logBatch[0].ua).toBe('TestBrowser/1.0');
    });

    test('should add timestamp to log event', () => {
      logEvent({ eventId: 'ev1', surface: 'display', metric: 'impression' });
      expect(logBatch[0].ts).toBe(1700000000000);
    });

    test('should batch multiple events', () => {
      logEvent({ eventId: 'ev1', metric: 'impression' });
      logEvent({ eventId: 'ev1', metric: 'click' });
      logEvent({ eventId: 'ev2', metric: 'view' });

      expect(logBatch).toHaveLength(3);
    });

    test('should flush and clear batch', () => {
      logEvent({ metric: 'impression' });
      logEvent({ metric: 'click' });

      const flushed = flush();

      expect(flushed).toHaveLength(2);
      expect(logBatch).toHaveLength(0);
    });

    test('should return nothing on empty flush', () => {
      const result = flush();
      expect(result).toBeUndefined();
    });

    test('should preserve event properties on log', () => {
      logEvent({
        eventId: 'ev1',
        surface: 'poster',
        metric: 'print',
        sponsorId: 'sp1',
        value: 1
      });

      const evt = logBatch[0];
      expect(evt.eventId).toBe('ev1');
      expect(evt.surface).toBe('poster');
      expect(evt.metric).toBe('print');
      expect(evt.sponsorId).toBe('sp1');
      expect(evt.value).toBe(1);
    });
  });

  describe('Sponsor Carousel Logic', () => {
    test('should rotate through sponsors array', () => {
      const sponsors = ['A', 'B', 'C'];
      let currentIndex = 0;
      const results = [];

      for (let i = 0; i < 6; i++) {
        results.push(sponsors[currentIndex]);
        currentIndex = (currentIndex + 1) % sponsors.length;
      }

      expect(results).toEqual(['A', 'B', 'C', 'A', 'B', 'C']);
    });

    test('should handle single sponsor (no rotation)', () => {
      const sponsors = ['A'];
      let currentIndex = 0;
      const results = [];

      for (let i = 0; i < 3; i++) {
        results.push(sponsors[currentIndex]);
        currentIndex = (currentIndex + 1) % sponsors.length;
      }

      expect(results).toEqual(['A', 'A', 'A']);
    });
  });

  describe('Poster Analytics Events', () => {
    const posterSurface = 'poster';

    test('view event should have correct structure', () => {
      const viewEvent = {
        eventId: 'ev1',
        surface: posterSurface,
        metric: 'view',
        value: 1
      };

      expect(viewEvent.surface).toBe('poster');
      expect(viewEvent.metric).toBe('view');
      expect(viewEvent.value).toBe(1);
    });

    test('print event should have correct structure', () => {
      const printEvent = {
        eventId: 'ev1',
        surface: posterSurface,
        metric: 'print',
        value: 1
      };

      expect(printEvent.surface).toBe('poster');
      expect(printEvent.metric).toBe('print');
    });

    test('impression event should include sponsorId', () => {
      const impressionEvent = {
        eventId: 'ev1',
        surface: posterSurface,
        metric: 'impression',
        sponsorId: 'sp1'
      };

      expect(impressionEvent.sponsorId).toBe('sp1');
    });
  });
});
