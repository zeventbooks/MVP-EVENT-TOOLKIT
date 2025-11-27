// =============================================================================
// === MVP SURFACES (focus-group critical) =====================================
// =============================================================================
// Used by: SharedReport.html
//
// ═══════════════════════════════════════════════════════════════════════════════
// [MVP] SERVICE CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════
//
// READS:
//   ← Analytics sheet (via _ensureAnalyticsSheet_())
//
// WRITES: None (read-only reporting service)
//
// OUTPUT SHAPES:
//   → SharedAnalytics: /schemas/shared-analytics.schema.json (MVP-frozen v1.1)
//
// ═══════════════════════════════════════════════════════════════════════════════
// SharedAnalytics SHAPE - FROZEN (MVP v1.1)
// ═══════════════════════════════════════════════════════════════════════════════
//
// THIS FILE IS THE ONLY PLACE that builds the SharedAnalytics response shape.
// buildSharedAnalyticsResponse_() is the single source of truth.
//
// FROZEN SHAPE:
// {
//   lastUpdatedISO: string,
//   summary: {
//     totalImpressions: number,
//     totalClicks: number,
//     totalQrScans: number,
//     totalSignups: number,
//     uniqueEvents: number,
//     uniqueSponsors: number
//   },
//   surfaces: Array<{ id, label, impressions, clicks, qrScans, engagementRate }>,
//   sponsors: Array<{ id, name, impressions, clicks, ctr }> | null,
//   events: Array<{ id, name, impressions, clicks, ctr }> | null
// }
//
// ═══════════════════════════════════════════════════════════════════════════════
// FIELD → SOURCE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════
//
// SharedAnalytics.lastUpdatedISO
//   → new Date().toISOString() (generated at response time)
//
// SharedAnalytics.summary
//   → buildSharedAnalyticsResponse_() counts metrics from filtered analytics
//   → totalImpressions:  filter(metric === 'impression').length
//   → totalClicks:       filter(metric === 'click').length
//   → totalQrScans:      filter(metric === 'qr_scan').length
//   → totalSignups:      filter(metric === 'signup').length
//   → uniqueEvents:      Set(eventId).size
//   → uniqueSponsors:    Set(sponsorId).size
//
// SharedAnalytics.surfaces
//   → buildSurfacesArray_(analytics)
//   → Groups by surface id, counts impressions/clicks/qrScans per surface
//   → Calculates engagementRate = (clicks + qrScans) / impressions * 100
//
// SharedAnalytics.sponsors
//   → buildSponsorsArray_(analytics) [organizer view only]
//   → Groups by sponsorId, counts impressions/clicks per sponsor
//   → Calculates ctr = clicks / impressions * 100
//
// SharedAnalytics.events
//   → buildEventsArray_(analytics)
//   → Groups by eventId, counts impressions/clicks per event
//   → Calculates ctr = clicks / impressions * 100
//
// ═══════════════════════════════════════════════════════════════════════════════
//
// DO NOT add new fields without updating:
//   - /schemas/shared-analytics.schema.json (source of truth)
//   - ApiSchemas.gs (runtime validation)
//   - SharedReport.html (consumer)
//   - AnalyticsService.gs (locked metrics list)
//
// ═══════════════════════════════════════════════════════════════════════════════
//
// MVP-Critical APIs in this file:
//   - api_getSharedAnalytics() → Organizer view (all sponsors/events)
//   - api_getSponsorAnalytics() → Sponsor view (scoped to sponsorId)
//
// =============================================================================

/**
 * Shared Reporting System for Event Managers & Sponsors
 *
 * SCHEMA: /schemas/analytics.schema.json (MVP-frozen v1.1)
 *
 * Single Source of Truth for:
 * - Event Performance Metrics
 * - Sponsor Engagement Analytics
 * - Shared Dashboard Data
 *
 * Reports available to both Event Managers AND Sponsors (with appropriate filtering)
 */

/**
 * Get Shared Event-Sponsor Analytics (Organizer View)
 *
 * SCHEMA CONTRACT: /schemas/analytics.schema.json (MVP-frozen v1.1)
 * Returns the SharedAnalytics shape expected by SharedReport.html
 *
 * @param {Object} params - Query parameters
 * @param {string} params.brandId - Brand ID
 * @param {string} [params.eventId] - Filter by specific event
 * @param {string} [params.sponsorId] - Filter by specific sponsor (for sponsor view)
 * @param {boolean} [params.isSponsorView=false] - True if sponsor is requesting
 * @returns {Object} SharedAnalytics shape per schema contract
 */
function api_getSharedAnalytics(params) {
  try {
    const { brandId, eventId, sponsorId, isSponsorView = false } = params;

    if (!brandId) {
      return Err(ERR.BAD_INPUT, 'brandId required');
    }

    // Get analytics sheet
    const analyticsSheet = _ensureAnalyticsSheet_();
    const rows = analyticsSheet.getDataRange().getValues();

    // Parse analytics data
    const analytics = rows.slice(1).map(row => ({
      timestamp: row[0],
      eventId: row[1],
      surface: row[2],
      metric: row[3],
      sponsorId: row[4],
      value: row[5]
    }));

    // Filter by parameters
    let filtered = analytics.filter(a => a.eventId);

    if (eventId) {
      filtered = filtered.filter(a => a.eventId === eventId);
    }

    if (sponsorId || isSponsorView) {
      filtered = filtered.filter(a => a.sponsorId === (sponsorId || params.sponsorId));
    }

    // Build SharedAnalytics response per schema contract (pass brandId for name resolution)
    const response = buildSharedAnalyticsResponse_(filtered, isSponsorView, brandId);

    return Ok(response);

  } catch (e) {
    diag_('error', 'api_getSharedAnalytics', e.toString());
    return Err(ERR.INTERNAL, 'Failed to get analytics');
  }
}

/**
 * Get Sponsor-Scoped Analytics (Sponsor View)
 *
 * SCHEMA CONTRACT: /schemas/analytics.schema.json (MVP-frozen v1.1)
 * Returns the SharedAnalytics shape scoped to a specific sponsor.
 *
 * Used by SharedReport.html when ?sponsor=true&sponsorId=XXX is in URL.
 *
 * @param {Object} params - Query parameters
 * @param {string} params.brandId - Brand ID
 * @param {string} params.sponsorId - Sponsor ID (required for sponsor view)
 * @param {string} [params.eventId] - Optional event filter
 * @returns {Object} SharedAnalytics shape per schema contract (sponsor-scoped)
 */
function api_getSponsorAnalytics(params) {
  try {
    const { brandId, sponsorId, eventId } = params;

    if (!brandId) {
      return Err(ERR.BAD_INPUT, 'brandId required');
    }
    if (!sponsorId) {
      return Err(ERR.BAD_INPUT, 'sponsorId required for sponsor analytics');
    }

    // Delegate to getSharedAnalytics with isSponsorView=true
    return api_getSharedAnalytics({
      brandId,
      sponsorId,
      eventId,
      isSponsorView: true
    });

  } catch (e) {
    diag_('error', 'api_getSponsorAnalytics', e.toString());
    return Err(ERR.INTERNAL, 'Failed to get sponsor analytics');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAME RESOLUTION HELPERS - Story 4.1
// ═══════════════════════════════════════════════════════════════════════════════
// These functions build lookup maps for resolving IDs to human-readable names.
// Used to display "Joe's Tavern" instead of "sponsor_123" in SharedReport.html.

/**
 * Build a map of eventId → eventName for all events of a brand
 *
 * @param {string} brandId - Brand ID to look up events for
 * @returns {Object} Map of { eventId: eventName }
 * @private
 */
function buildEventNameMap_(brandId) {
  const nameMap = {};

  if (!brandId) return nameMap;

  try {
    const brand = findBrand_(brandId);
    if (!brand) return nameMap;

    const sh = getStoreSheet_(brand, 'events');
    const lastRow = sh.getLastRow();
    if (lastRow <= 1) return nameMap;

    // Get all event rows: [id, brandId, templateId, dataJSON, createdAt, slug]
    const rows = sh.getRange(2, 1, lastRow - 1, 4).getValues();

    rows.forEach(row => {
      const id = row[0];
      const rowBrandId = row[1];
      const dataJson = row[3];

      // Only include events for this brand
      if (rowBrandId === brandId && id) {
        const data = safeJSONParse_(dataJson, {});
        nameMap[id] = data.name || id; // Fallback to ID if no name
      }
    });
  } catch (e) {
    diag_('warn', 'buildEventNameMap_', 'Failed to build event name map', {
      brandId,
      error: e.message
    });
  }

  return nameMap;
}

/**
 * Build a map of sponsorId → sponsorName for all sponsors of a brand
 *
 * Sponsors can be stored in two places:
 * 1. SPONSORS sheet (dedicated sponsor entities)
 * 2. Embedded within events (event.sponsors[])
 *
 * This function checks both sources.
 *
 * @param {string} brandId - Brand ID to look up sponsors for
 * @returns {Object} Map of { sponsorId: sponsorName }
 * @private
 */
function buildSponsorNameMap_(brandId) {
  const nameMap = {};

  if (!brandId) return nameMap;

  try {
    const brand = findBrand_(brandId);
    if (!brand) return nameMap;

    // Source 1: SPONSORS sheet
    try {
      const sponsorSheet = getStoreSheet_(brand, 'sponsors');
      const lastRow = sponsorSheet.getLastRow();
      if (lastRow > 1) {
        // Get sponsor rows: [id, brandId, ?, dataJSON, ...]
        const rows = sponsorSheet.getRange(2, 1, lastRow - 1, 4).getValues();

        rows.forEach(row => {
          const id = row[0];
          const rowBrandId = row[1];
          const dataJson = row[3];

          if (rowBrandId === brandId && id) {
            const data = safeJSONParse_(dataJson, {});
            nameMap[id] = data.name || id; // Fallback to ID if no name
          }
        });
      }
    } catch (e) {
      // SPONSORS sheet might not exist - that's OK
      diag_('debug', 'buildSponsorNameMap_', 'No SPONSORS sheet or error', {
        brandId,
        error: e.message
      });
    }

    // Source 2: Sponsors embedded in events
    const eventSheet = getStoreSheet_(brand, 'events');
    const eventLastRow = eventSheet.getLastRow();
    if (eventLastRow > 1) {
      const eventRows = eventSheet.getRange(2, 1, eventLastRow - 1, 4).getValues();

      eventRows.forEach(row => {
        const rowBrandId = row[1];
        const dataJson = row[3];

        if (rowBrandId === brandId) {
          const data = safeJSONParse_(dataJson, {});

          // Check for embedded sponsors array
          if (Array.isArray(data.sponsors)) {
            data.sponsors.forEach(sponsor => {
              if (sponsor.id && sponsor.name && !nameMap[sponsor.id]) {
                nameMap[sponsor.id] = sponsor.name;
              }
            });
          }
        }
      });
    }
  } catch (e) {
    diag_('warn', 'buildSponsorNameMap_', 'Failed to build sponsor name map', {
      brandId,
      error: e.message
    });
  }

  return nameMap;
}

/**
 * Build SharedAnalytics response matching /schemas/analytics.schema.json (MVP-frozen v1.1)
 *
 * SCHEMA SHAPE:
 *   { lastUpdatedISO, summary, surfaces, sponsors?, events? }
 *
 * @param {Array} analytics - Filtered analytics rows
 * @param {boolean} isSponsorView - Whether this is sponsor-scoped view
 * @param {string} brandId - Brand ID for name resolution
 * @returns {Object} SharedAnalytics shape per schema
 */
function buildSharedAnalyticsResponse_(analytics, isSponsorView, brandId) {
  // Count metrics
  const impressions = analytics.filter(a => a.metric === 'impression');
  const clicks = analytics.filter(a => a.metric === 'click');
  const qrScans = analytics.filter(a => a.metric === 'qr_scan');
  const signups = analytics.filter(a => a.metric === 'signup');

  // Unique counts (limit to prevent memory issues)
  const eventIds = new Set(analytics.slice(0, 10000).map(a => a.eventId).filter(Boolean));
  const sponsorIds = new Set(analytics.slice(0, 10000).map(a => a.sponsorId).filter(Boolean));

  // Build name lookup maps for human-readable display (Story 4.1)
  const eventNameMap = buildEventNameMap_(brandId);
  const sponsorNameMap = buildSponsorNameMap_(brandId);

  // Build surfaces array
  const surfaces = buildSurfacesArray_(analytics);

  // Build sponsors array (for organizer view) with name resolution
  const sponsors = !isSponsorView ? buildSponsorsArray_(analytics, sponsorNameMap) : null;

  // Build events array with name resolution
  const events = buildEventsArray_(analytics, eventNameMap);

  return {
    lastUpdatedISO: new Date().toISOString(),
    summary: {
      totalImpressions: impressions.length,
      totalClicks: clicks.length,
      totalQrScans: qrScans.length,
      totalSignups: signups.length,
      uniqueEvents: eventIds.size,
      uniqueSponsors: sponsorIds.size
    },
    surfaces: surfaces,
    sponsors: sponsors,
    events: events.length > 0 ? events : null
  };
}

/**
 * Build surfaces array per schema: { id, label, impressions, clicks, qrScans, engagementRate }
 */
function buildSurfacesArray_(analytics) {
  const surfaceMap = {};

  // Surface labels mapping
  const SURFACE_LABELS = {
    'poster': 'Poster',
    'display': 'Display',
    'public': 'Public',
    'signup': 'Signup',
    'admin': 'Admin'
  };

  analytics.forEach(a => {
    const surfaceId = (a.surface || 'unknown').toLowerCase();

    if (!surfaceMap[surfaceId]) {
      surfaceMap[surfaceId] = {
        id: surfaceId,
        label: SURFACE_LABELS[surfaceId] || surfaceId,
        impressions: 0,
        clicks: 0,
        qrScans: 0
      };
    }

    if (a.metric === 'impression') surfaceMap[surfaceId].impressions++;
    if (a.metric === 'click') surfaceMap[surfaceId].clicks++;
    if (a.metric === 'qr_scan') surfaceMap[surfaceId].qrScans++;
  });

  // Calculate engagement rate and convert to array
  return Object.values(surfaceMap).map(s => {
    const totalEngagement = s.clicks + s.qrScans;
    s.engagementRate = s.impressions > 0
      ? Number(((totalEngagement / s.impressions) * 100).toFixed(1))
      : 0;
    return s;
  }).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Build sponsors array per schema: { id, name, impressions, clicks, ctr }
 *
 * Story 4.1: Now resolves sponsorId to human-readable names using sponsorNameMap.
 *
 * @param {Array} analytics - Analytics rows
 * @param {Object} sponsorNameMap - Map of { sponsorId: sponsorName } for name resolution
 * @returns {Array} Array of sponsor metrics with resolved names
 */
function buildSponsorsArray_(analytics, sponsorNameMap) {
  const nameMap = sponsorNameMap || {};
  const sponsorMap = {};

  analytics.forEach(a => {
    if (!a.sponsorId) return;

    if (!sponsorMap[a.sponsorId]) {
      sponsorMap[a.sponsorId] = {
        id: a.sponsorId,
        name: nameMap[a.sponsorId] || a.sponsorId, // Use resolved name or fallback to ID
        impressions: 0,
        clicks: 0
      };
    }

    if (a.metric === 'impression') sponsorMap[a.sponsorId].impressions++;
    if (a.metric === 'click') sponsorMap[a.sponsorId].clicks++;
  });

  // Calculate CTR and convert to array
  return Object.values(sponsorMap).map(s => {
    s.ctr = s.impressions > 0
      ? Number(((s.clicks / s.impressions) * 100).toFixed(2))
      : 0;
    return s;
  }).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Build events array per schema: { id, name, impressions, clicks, ctr }
 *
 * Story 4.1: Now resolves eventId to human-readable names using eventNameMap.
 *
 * @param {Array} analytics - Analytics rows
 * @param {Object} eventNameMap - Map of { eventId: eventName } for name resolution
 * @returns {Array} Array of event metrics with resolved names
 */
function buildEventsArray_(analytics, eventNameMap) {
  const nameMap = eventNameMap || {};
  const eventMap = {};

  analytics.forEach(a => {
    if (!a.eventId) return;

    if (!eventMap[a.eventId]) {
      eventMap[a.eventId] = {
        id: a.eventId,
        name: nameMap[a.eventId] || a.eventId, // Use resolved name or fallback to ID
        impressions: 0,
        clicks: 0
      };
    }

    if (a.metric === 'impression') eventMap[a.eventId].impressions++;
    if (a.metric === 'click') eventMap[a.eventId].clicks++;
  });

  // Calculate CTR and convert to array
  return Object.values(eventMap).map(e => {
    e.ctr = e.impressions > 0
      ? Number(((e.clicks / e.impressions) * 100).toFixed(2))
      : 0;
    return e;
  }).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Calculate engagement rate (clicks / impressions)
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
function calculateEngagementRate_(analytics) {
  const impressions = analytics.filter(a => a.metric === 'impression').length;
  const clicks = analytics.filter(a => a.metric === 'click').length;
  const rawRate = MetricsUtils_calculateCTR(clicks, impressions);

  return {
    rate: rawRate.toFixed(2) + '%',
    clicks,
    impressions,
    rawRate: rawRate / 100  // Convert percentage back to ratio for backward compat
  };
}

/**
 * Group analytics by surface (public, display, poster)
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
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

  // Convert sets to counts and calculate engagement rate using shared utility
  Object.keys(surfaces).forEach(s => {
    surfaces[s].uniqueEvents = surfaces[s].uniqueEvents.size;
    surfaces[s].uniqueSponsors = surfaces[s].uniqueSponsors.size;
    const ctr = MetricsUtils_calculateCTR(surfaces[s].clicks, surfaces[s].impressions);
    surfaces[s].engagementRate = ctr.toFixed(2) + '%';
  });

  return surfaces;
}

/**
 * Group analytics by event
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
function groupByEvent_(analytics) {
  const events = {};

  analytics.forEach(a => {
    const eventId = a.eventId;

    if (!events[eventId]) {
      events[eventId] = {
        eventId,
        impressions: 0,
        clicks: 0,
        uniqueSponsors: new Set(),
        surfaces: new Set()
      };
    }

    if (a.metric === 'impression') events[eventId].impressions++;
    if (a.metric === 'click') events[eventId].clicks++;
    if (a.sponsorId) events[eventId].uniqueSponsors.add(a.sponsorId);
    if (a.surface) events[eventId].surfaces.add(a.surface);
  });

  // Convert sets and calculate rates using shared utility
  Object.keys(events).forEach(e => {
    events[e].uniqueSponsors = events[e].uniqueSponsors.size;
    events[e].surfaces = Array.from(events[e].surfaces);
    const ctr = MetricsUtils_calculateCTR(events[e].clicks, events[e].impressions);
    events[e].engagementRate = ctr.toFixed(2) + '%';
  });

  // Sort by impressions descending
  return Object.values(events).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Group analytics by sponsor
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
function groupBySponsor_(analytics) {
  const sponsors = {};

  analytics.forEach(a => {
    const sponsorId = a.sponsorId;
    if (!sponsorId) return; // Skip non-sponsor events

    if (!sponsors[sponsorId]) {
      sponsors[sponsorId] = {
        sponsorId,
        impressions: 0,
        clicks: 0,
        uniqueEvents: new Set(),
        surfaces: new Set()
      };
    }

    if (a.metric === 'impression') sponsors[sponsorId].impressions++;
    if (a.metric === 'click') sponsors[sponsorId].clicks++;
    if (a.eventId) sponsors[sponsorId].uniqueEvents.add(a.eventId);
    if (a.surface) sponsors[sponsorId].surfaces.add(a.surface);
  });

  // Convert sets and calculate rates using shared utility
  Object.keys(sponsors).forEach(s => {
    sponsors[s].uniqueEvents = sponsors[s].uniqueEvents.size;
    sponsors[s].surfaces = Array.from(sponsors[s].surfaces);
    const ctr = MetricsUtils_calculateCTR(sponsors[s].clicks, sponsors[s].impressions);
    sponsors[s].engagementRate = ctr.toFixed(2) + '%';
  });

  // Sort by impressions descending
  return Object.values(sponsors).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Calculate daily trends
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
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
  const trends = Object.values(dailyData).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Add engagement rate using shared utility
  trends.forEach(day => {
    const ctr = MetricsUtils_calculateCTR(day.clicks, day.impressions);
    day.engagementRate = ctr.toFixed(2) + '%';
  });

  return trends;
}

/**
 * Get top event-sponsor pairs (most engaged combinations)
 * Uses shared MetricsUtils_calculateCTR for DRY compliance
 */
function getTopEventSponsorPairs_(analytics, limit = 10) {
  const pairs = {};

  analytics.forEach(a => {
    if (!a.eventId || !a.sponsorId) return;

    const key = `${a.eventId}|${a.sponsorId}`;

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

  // Calculate engagement rate using shared utility and sort
  const sorted = Object.values(pairs)
    .map(p => {
      const ctr = MetricsUtils_calculateCTR(p.clicks, p.impressions);
      return {
        ...p,
        engagementRate: ctr / 100,  // As ratio for sorting
        engagementRateFormatted: ctr.toFixed(2) + '%'
      };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);

  return sorted;
}

/**
 * Generate Shared Report Template
 *
 * Creates a formatted report suitable for both Event Managers and Sponsors
 *
 * @param {string} brandId - Brand ID
 * @param {Object} [filters] - Report filters
 * @returns {Object} Report object with formatted data
 */
function api_generateSharedReport(brandId, filters = {}) {
  try {
    // Get analytics data
    const analyticsResult = api_getSharedAnalytics({ brandId, ...filters });

    if (!analyticsResult.ok) {
      return analyticsResult;
    }

    const metrics = analyticsResult.value;

    // Format report
    const report = {
      reportType: 'shared-event-sponsor',
      generatedAt: new Date().toISOString(),
      brand: brandId,
      filters,

      // Executive Summary (shared key metrics)
      summary: {
        totalImpressions: metrics.totalImpressions,
        totalClicks: metrics.totalClicks,
        engagementRate: metrics.engagementRate.rate,
        activeEvents: metrics.uniqueEvents,
        activeSponsors: metrics.uniqueSponsors
      },

      // Surface Performance (where engagement happens)
      surfacePerformance: metrics.bySurface,

      // Event Performance (for event managers)
      eventPerformance: metrics.byEvent,

      // Sponsor Performance (for both)
      sponsorPerformance: metrics.bySponsor,

      // Trends over time
      trends: metrics.dailyTrends,

      // Top combinations (insights for both)
      topPairings: metrics.topEventSponsorPairs,

      // Recommendations (AI-generated insights)
      recommendations: generateRecommendations_(metrics)
    };

    return Ok(report);

  } catch (e) {
    diag_('error', 'api_generateSharedReport', e.toString());
    return Err(ERR.INTERNAL, 'Failed to generate report');
  }
}

/**
 * Generate data-driven recommendations
 */
function generateRecommendations_(metrics) {
  const recommendations = [];

  // Engagement rate recommendations
  const overallRate = parseFloat(metrics.engagementRate.rate);
  if (overallRate < 2) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: `Low engagement rate (${metrics.engagementRate.rate}). Consider testing different sponsor placements or creative.`
    });
  } else if (overallRate > 10) {
    recommendations.push({
      type: 'engagement',
      priority: 'success',
      message: `Excellent engagement rate (${metrics.engagementRate.rate})! Current strategy is working well.`
    });
  }

  // Surface-specific recommendations
  const surfaces = metrics.bySurface;
  Object.keys(surfaces).forEach(surface => {
    const rate = parseFloat(surfaces[surface].engagementRate);
    if (rate > overallRate * 1.5) {
      recommendations.push({
        type: 'surface',
        priority: 'medium',
        message: `"${surface}" surface is performing ${rate.toFixed(1)}% above average. Consider increasing sponsor presence here.`
      });
    }
  });

  // Sponsor-specific recommendations - Fixed: Bug #10
  if (metrics.bySponsor && metrics.bySponsor.length > 0) {
    const topSponsor = metrics.bySponsor[0];
    // Add null check to prevent crash
    if (topSponsor && topSponsor.sponsorId) {
      recommendations.push({
        type: 'sponsor',
        priority: 'info',
        message: `Top performing sponsor: ${topSponsor.sponsorId} with ${topSponsor.engagementRate} engagement across ${topSponsor.uniqueEvents} events.`
      });
    }
  }

  return recommendations;
}

/**
 * Export Shared Report to Google Sheets
 *
 * Creates a new sheet with formatted report data
 *
 * @param {string} brandId - Brand ID
 * @param {Object} [filters] - Report filters
 * @returns {Object} Result with sheet URL
 */
function api_exportSharedReport(brandId, filters = {}) {
  try {
    // Generate report
    const reportResult = api_generateSharedReport(brandId, filters);

    if (!reportResult.ok) {
      return reportResult;
    }

    const report = reportResult.value;

    // Get spreadsheet
    const brand = findBrand_(brandId);
    if (!brand) {
      return Err(ERR.NOT_FOUND, 'Brand not found');
    }

    const ss = SpreadsheetApp.openById(brand.store.spreadsheetId);

    // Create new sheet with timestamp
    const sheetName = `Report_${new Date().toISOString().split('T')[0]}`;
    let sheet = ss.getSheetByName(sheetName);

    if (sheet) {
      ss.deleteSheet(sheet);
    }

    sheet = ss.insertSheet(sheetName);

    // Write summary
    sheet.appendRow(['SHARED EVENT-SPONSOR REPORT']);
    sheet.appendRow(['Generated:', report.generatedAt]);
    sheet.appendRow(['Brand:', report.brand]);
    sheet.appendRow([]);

    sheet.appendRow(['EXECUTIVE SUMMARY']);
    sheet.appendRow(['Total Impressions', report.summary.totalImpressions]);
    sheet.appendRow(['Total Clicks', report.summary.totalClicks]);
    sheet.appendRow(['Engagement Rate', report.summary.engagementRate]);
    sheet.appendRow(['Active Events', report.summary.activeEvents]);
    sheet.appendRow(['Active Sponsors', report.summary.activeSponsors]);
    sheet.appendRow([]);

    // Write surface performance
    sheet.appendRow(['SURFACE PERFORMANCE']);
    sheet.appendRow(['Surface', 'Impressions', 'Clicks', 'Engagement Rate', 'Unique Events', 'Unique Sponsors']);
    Object.keys(report.surfacePerformance).forEach(surface => {
      const data = report.surfacePerformance[surface];
      sheet.appendRow([
        surface,
        data.impressions,
        data.clicks,
        data.engagementRate,
        data.uniqueEvents,
        data.uniqueSponsors
      ]);
    });
    sheet.appendRow([]);

    // Write sponsor performance
    if (report.sponsorPerformance) {
      sheet.appendRow(['SPONSOR PERFORMANCE']);
      sheet.appendRow(['Sponsor ID', 'Impressions', 'Clicks', 'Engagement Rate', 'Events']);
      report.sponsorPerformance.forEach(sponsor => {
        sheet.appendRow([
          sponsor.sponsorId,
          sponsor.impressions,
          sponsor.clicks,
          sponsor.engagementRate,
          sponsor.uniqueEvents
        ]);
      });
      sheet.appendRow([]);
    }

    // Write recommendations
    sheet.appendRow(['RECOMMENDATIONS']);
    report.recommendations.forEach(rec => {
      sheet.appendRow([rec.priority.toUpperCase(), rec.message]);
    });

    // Format sheet
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, sheet.getLastColumn());

    return Ok({
      sheetName,
      url: ss.getUrl() + '#gid=' + sheet.getSheetId()
    });

  } catch (e) {
    diag_('error', 'api_exportSharedReport', e.toString());
    return Err(ERR.INTERNAL, 'Failed to export report');
  }
}
